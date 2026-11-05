// Records real footage of FunWiki for the demo video.
// Each shot is its own browser context, so each gets its own .webm in public/footage/.
// marks.json logs when things happen in each clip (seconds), so the edit can cut
// out loading waits without guessing.
//
//   npm run capture                  (records the production deploy, all shots)
//   npm run capture -- map quiz      (re-record only some shots)
//   FUNWIKI_URL=http://localhost:5173 npm run capture
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const URL = process.env.FUNWIKI_URL || 'https://meta-hackathon-1y990r3ff-zektoxfxs-projects.vercel.app';
const RAW = 'capture/raw';
const OUT = 'public/footage';
const W = 1920, H = 1080;
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const marks = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Headless recordings have no cursor, so draw one.
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px)';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.5 L13.4 19.2 L10.4 12.6 L16.5 12.4 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const move = (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; };
    addEventListener('mousemove', move, true);
    addEventListener('pointermove', move, true);
  });
`;

async function shot(name, fn) {
  if (only.length && !only.includes(name)) return;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: RAW, size: { width: W, height: H } },
    colorScheme: 'dark'
  });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const m = {};
  const mark = (k) => { m[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`  ${name}.${k} = ${m[k]}s`); };
  console.log(`shot ${name}`);
  try {
    await fn(page, mark);
  } catch (e) {
    console.error(`  ${name} failed: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(RAW, `${name}-error.png`) });
  }
  mark('end');
  const video = page.video();
  await ctx.close();
  await browser.close();
  const webm = join(OUT, `${name}.webm`);
  renameSync(await video.path(), webm);
  // Constant 30fps H.264 seeks cleanly in Remotion; the raw webm is variable-rate.
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", webm, "-r", "30", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", "-g", "15", webm.replace(/.webm$/, ".mp4")]);
  marks[name] = m;
}

// Glide the mouse to an element's centre.
async function glide(page, locator, steps = 30) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element not visible');
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y, { steps });
  return { x, y };
}

async function slowType(page, text, delay = 100) {
  for (const ch of text) { await page.keyboard.type(ch); await wait(delay); }
}

async function scrollBy(page, dy, steps = 40, pause = 20) {
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await wait(pause); }
}



// ---- The problem: a real Wikipedia article is a wall of blue links.
await shot('wikipedia', async (page, mark) => {
  await page.goto('https://en.wikipedia.org/wiki/Black_hole', { waitUntil: 'networkidle' });
  await page.mouse.move(W * 0.6, H * 0.4);
  mark('ready');
  await wait(1500);
  await scrollBy(page, 900, 90, 30);
  await wait(800);
  await scrollBy(page, 1400, 120, 30);
  await wait(1500);
});

// ---- The front page.
await shot('home', async (page, mark) => {
  await page.goto(URL + '/#/', { waitUntil: 'networkidle' });
  await page.mouse.move(W * 0.7, H * 0.55);
  mark('ready');
  await wait(4500);
  await scrollBy(page, 760, 70);
  mark('lede');
  await wait(3000);
  await scrollBy(page, 900, 80);
  mark('today');
  await wait(3500);
  await page.locator('#try').scrollIntoViewIfNeeded();
  mark('try');
  const input = page.locator('#try-topic');
  await glide(page, input, 25);
  await input.click({ clickCount: 3 });
  await wait(300);
  await slowType(page, 'Octopus', 110);
  await page.waitForFunction(() => document.querySelector('.fragment svg .f-title')?.textContent === 'Octopus', null, { timeout: 15000 });
  mark('tryDone');
  await wait(3500);
  await scrollBy(page, 1100, 90);
  mark('how');
  await wait(3000);
  await scrollBy(page, 1400, 120);
  mark('gallery');
  await wait(4000);
});

// ---- Search -> the living map.
await shot('map', async (page, mark) => {
  await page.goto(URL + '/#/', { waitUntil: 'networkidle' });
  const input = page.locator('.find input');
  await page.mouse.move(W * 0.5, H * 0.75);
  mark('ready');
  await wait(800);
  await glide(page, input, 25);
  await input.click();
  await slowType(page, 'Black hole');
  await wait(400);
  await page.keyboard.press('Enter');
  mark('submit');
  await page.waitForFunction(() => document.querySelectorAll('g.node').length > 8, null, { timeout: 20000 });
  mark('mapShown');
  await wait(4500);

  const nodes = page.locator('g.node:not(.center)');
  const count = await nodes.count();
  const pick = (i) => nodes.nth(Math.min(i, count - 1));

  // Hover: a node's links light up.
  mark('hover');
  for (const i of [2, 5, 8]) { await glide(page, pick(i), 35); await wait(1300); }

  // Drag a node; its links follow and the rest re-settle.
  mark('drag');
  const p = await glide(page, pick(3), 30);
  await page.mouse.down();
  await page.mouse.move(p.x + 260, p.y - 160, { steps: 50 });
  await wait(300);
  await page.mouse.move(p.x + 120, p.y + 120, { steps: 40 });
  await page.mouse.up();
  await page.mouse.move(p.x + 220, p.y + 220, { steps: 20 });
  await wait(2500);

  // Grow a branch: double-click a linked topic.
  mark('grow');
  const grav = page.locator('g.node[aria-label="Gravity"]');
  const target = (await grav.count()) ? grav : pick(1);
  const t = await glide(page, target, 35);
  await wait(400);
  await page.mouse.dblclick(t.x, t.y);
  await page.waitForFunction((n) => document.querySelectorAll('g.node').length > n, count + 2, { timeout: 20000 }).catch(() => {});
  mark('grown');
  await wait(5000);

  // Select a node: the reading panel switches to it.
  mark('select');
  const ev = page.locator('g.node[aria-label="Event horizon"]');
  const sel = (await ev.count()) ? ev : pick(4);
  const q = await glide(page, sel, 35);
  await page.mouse.click(q.x, q.y);
  await wait(3500);
  const primary = page.locator('.btn-primary', { hasText: 'Map' }).first();
  if (await primary.count()) { await glide(page, primary, 30); await wait(1500); }
  mark('selected');
  await wait(1500);
});

// ---- Muse Spark shots start straight on the Black hole map.
async function openTopic(page, mark) {
  await page.goto(URL + '/#/Black_hole', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('g.node').length > 8, null, { timeout: 20000 });
  await page.mouse.move(W * 0.5, H * 0.5);
  mark('ready');
  await wait(1500);
}

await shot('summary', async (page, mark) => {
  await openTopic(page, mark);
  for (const [i, level] of ['Simple', '5 bullets'].entries()) {
    const seg = page.locator('.seg-btn', { hasText: level });
    await glide(page, seg, 35); await wait(300); await seg.click();
    await wait(600);
    const ask = page.locator('button', { hasText: 'Ask Muse' });
    await glide(page, ask, 25); await wait(300); await ask.click();
    mark('ask' + (i + 1));
    await page.waitForFunction((l) => !document.body.innerText.includes(l), 'Reading…', { timeout: 90000 });
    mark('answer' + (i + 1));
    await page.mouse.move(W * 0.62, H * 0.72, { steps: 25 });
    await wait(6000);
  }
});

await shot('path', async (page, mark) => {
  await openTopic(page, mark);
  const tab = page.locator('.tab', { hasText: 'Learning path' });
  await glide(page, tab, 35); await wait(300); await tab.click();
  await wait(700);
  const plan = page.locator('button', { hasText: 'Plan a path' });
  await glide(page, plan, 25); await wait(300); await plan.click();
  mark('ask');
  await page.waitForSelector('ol.steps li', { timeout: 90000 });
  mark('answer');
  await page.mouse.move(W * 0.4, H * 0.6, { steps: 40 });
  await wait(5000);
  const steps = page.locator('ol.steps .linklike');
  if ((await steps.count()) > 2) {
    const s = steps.nth(2);
    await glide(page, s, 35); await wait(400); await s.click();
    mark('step');
    await wait(4000);
  }
});

await shot('quiz', async (page, mark) => {
  await openTopic(page, mark);
  const tab = page.locator('.tab', { hasText: 'Quiz' });
  await glide(page, tab, 35); await wait(300); await tab.click();
  await wait(700);
  const go = page.locator('button', { hasText: 'Test me' });
  await glide(page, go, 25); await wait(300); await go.click();
  mark('ask');
  await page.waitForSelector('.opt', { timeout: 90000 });
  mark('answer');
  await wait(2500);
  for (let i = 0; i < 3; i++) {
    const opts = page.locator('.opt:not([disabled])');
    if (!(await opts.count())) break;
    const o = opts.nth(i === 1 ? 1 : 0);
    await o.scrollIntoViewIfNeeded();
    await glide(page, o, 35); await wait(700); await o.click();
    mark('q' + (i + 1));
    await wait(2200);
  }
  await wait(3000);
});

let prev = {};
try { prev = JSON.parse(readFileSync(join(OUT, 'marks.json'), 'utf8')); } catch { /* first run */ }
writeFileSync(join(OUT, 'marks.json'), JSON.stringify({ ...prev, ...marks }, null, 2));
console.log('done');
