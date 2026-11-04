// Local dev server: mounts the exact same handlers Vercel runs from api/,
// so local and production can never drift apart again.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import health from '../api/health.js';
import search from '../api/wiki/search.js';
import summary from '../api/wiki/summary/[title].js';
import links from '../api/wiki/links/[title].js';
import summarize from '../api/ai/summarize.js';
import path from '../api/ai/path.js';
import quiz from '../api/ai/quiz.js';

const app = express();
app.use(cors());
app.use(express.json());

// Vercel passes dynamic segments ([title]) in req.query; mirror that.
const withParams = (handler) => (req, res) => {
  Object.assign(req.query, req.params);
  return handler(req, res);
};

app.get('/api/health', health);
app.get('/api/wiki/search', search);
app.get('/api/wiki/summary/:title', withParams(summary));
app.get('/api/wiki/links/:title', withParams(links));
app.all('/api/ai/summarize', summarize);
app.all('/api/ai/path', path);
app.all('/api/ai/quiz', quiz);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`FunWiki API on http://localhost:${PORT}`));
