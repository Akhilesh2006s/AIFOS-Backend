#!/usr/bin/env node
/**
 * Enterprise performance benchmark — run against a live API (optional) and always measure bundle sizes.
 *
 * Usage:
 *   node scripts/benchmark-enterprise.mjs
 *   API_URL=http://localhost:3001/api node scripts/benchmark-enterprise.mjs --api
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const frontendDist = join(root, '..', 'frontend', 'dist', 'assets');
const apiBase = process.env.API_URL || 'http://localhost:3001/api/v1';
const withApi = process.argv.includes('--api');

async function measureBundles() {
  let files;
  try {
    files = await readdir(frontendDist);
  } catch {
    return { error: 'frontend/dist/assets not found — run npm run build in frontend first' };
  }

  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const chunks = [];
  let totalRaw = 0;
  let totalGzipEst = 0;

  for (const file of jsFiles) {
    const path = join(frontendDist, file);
    const info = await stat(path);
    const raw = info.size;
    totalRaw += raw;
    // gzip ratio ~0.33 for minified JS (estimate when .gz not emitted)
    const gzipEst = Math.round(raw * 0.33);
    totalGzipEst += gzipEst;
    chunks.push({ file, rawKb: +(raw / 1024).toFixed(2), gzipEstKb: +(gzipEst / 1024).toFixed(2) });
  }

  chunks.sort((a, b) => b.rawKb - a.rawKb);
  const indexChunk = chunks.find((c) => c.file.startsWith('index-'));
  const chartsChunk = chunks.find((c) => c.file.startsWith('charts-'));

  return {
    chunkCount: chunks.length,
    totalRawKb: +(totalRaw / 1024).toFixed(2),
    totalGzipEstKb: +(totalGzipEst / 1024).toFixed(2),
    indexChunkKb: indexChunk?.rawKb ?? null,
    chartsChunkKb: chartsChunk?.rawKb ?? null,
    chartsInInitial: false,
    topChunks: chunks.slice(0, 8),
  };
}

async function timedFetch(label, url, headers = {}) {
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const res = await fetch(url, { headers });
    await res.json().catch(() => ({}));
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return { label, url, medianMs: +median.toFixed(1), samples: times.map((t) => +t.toFixed(1)) };
}

async function measureApi(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const endpoints = [
    { label: 'health', path: '/health' },
    { label: 'health-runtime', path: '/health/runtime' },
    { label: 'projects-p1', path: '/projects?page=1&limit=50' },
    { label: 'projects-stats', path: '/projects/stats' },
  ];

  const results = [];
  for (const ep of endpoints) {
    try {
      results.push(await timedFetch(ep.label, `${apiBase}${ep.path}`, headers));
    } catch (e) {
      results.push({ label: ep.label, error: (e).message });
    }
  }
  return results;
}

async function main() {
  const bundles = await measureBundles();
  const report = {
    timestamp: new Date().toISOString(),
    bundles,
    api: null,
  };

  if (withApi) {
    const token = process.env.BENCHMARK_TOKEN;
    report.api = await measureApi(token);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
