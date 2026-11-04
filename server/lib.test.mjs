// Run with `npm test`. Lives outside api/ so Vercel doesn't deploy it as a function.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonArray, leadLinks, shuffleOptions } from '../api/_lib.js';

test('parseJsonArray keeps only valid items and survives junk', () => {
  assert.deepEqual(parseJsonArray('ok: [{"title":"A"},{"x":1}]', (s) => typeof s?.title === 'string'), [{ title: 'A' }]);
  assert.deepEqual(parseJsonArray('not json', () => true), []);
  assert.deepEqual(parseJsonArray(null, () => true), []);
});

test('leadLinks returns prose links in reading order, skipping namespaces and infobox', () => {
  const html = '<table><tr><td><a href="/wiki/Infobox_only" title="Infobox only">x</a></td></tr></table>'
    + '<p class="x">A <a href="/wiki/Zebra" title="Zebra">z</a> and <a href="/wiki/Help:IPA" title="Help:IPA">ipa</a>'
    + ' then <a href="/wiki/AT%26T" class="mw-redirect" title="AT&amp;T">t</a> and <a href="/wiki/Zebra" title="Zebra">again</a></p>';
  assert.deepEqual(leadLinks(html), ['Zebra', 'AT&T']);
  assert.deepEqual(leadLinks(undefined), []);
});

test('shuffleOptions keeps the answer pointing at the same option', () => {
  for (let i = 0; i < 50; i++) {
    const q = shuffleOptions({ q: 'q', options: ['a', 'b', 'c', 'd'], answer: 2 });
    assert.equal(q.options[q.answer], 'c');
    assert.deepEqual([...q.options].sort(), ['a', 'b', 'c', 'd']);
  }
});
