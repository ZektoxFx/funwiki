import { send, metaEnv } from './_lib.js';

export default async function handler(req, res) {
  const { key, base, model } = metaEnv();
  // Reports only whether a key is configured - never its value.
  send(res, 200, { ok: true, meta: { keyConfigured: Boolean(key), base, model } });
}
