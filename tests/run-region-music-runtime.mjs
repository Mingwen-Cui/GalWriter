import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const packageRoot = process.env.CODEX_NODE_MODULES || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = await import('playwright').catch(() => import(pathToFileURL(path.join(packageRoot, 'playwright/index.mjs')).href));
const output = path.resolve('tmp/region-music-validation');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) console.error(message.text()); });
  await page.goto('http://127.0.0.1:3011/tests/region-music-runtime.html');
  await page.waitForFunction(() => window.__bgmResults || window.__bgmError, undefined, { timeout: 90000 });
  const result = await page.evaluate(() => ({ result: window.__bgmResults, error: window.__bgmError }));
  if (result.error) {
    await page.screenshot({ path: path.join(output, 'runtime-failure.png'), fullPage: true });
    console.error(await page.locator('[data-region-music-clip-id]').allTextContents());
    throw new Error(result.error);
  }
  for (const [name, bytes] of Object.entries(result.result.files)) {
    try { await fs.writeFile(path.join(output, name), Buffer.from(bytes)); }
    catch (error) {
      if (error.code !== 'EBUSY') throw error;
      await fs.writeFile(path.join(output, name.replace(/(\.[^.]+)$/, '-updated$1')), Buffer.from(bytes));
    }
  }
  const zip = await JSZip.loadAsync(Buffer.from(result.result.files['region-music-web.zip']));
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const filePath = path.resolve(output, 'web', entry.name);
    if (!filePath.startsWith(path.join(output, 'web') + path.sep)) throw new Error('Invalid ZIP path');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, await entry.async('nodebuffer'));
  }
  await page.screenshot({ path: path.join(output, 'runtime-tests.png'), fullPage: true });
  const exportedPage = await browser.newPage();
  await exportedPage.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__regionTracks = [];
    window.Audio = function(url) { const audio = new NativeAudio(url); window.__regionTracks.push(audio); return audio; };
  });
  await exportedPage.goto('http://127.0.0.1:3011/tmp/region-music-validation/web/index.html');
  await exportedPage.waitForFunction(() => window.__regionTracks.length > 0 && window.__regionTracks[0].currentTime > 0);
  const initial = await exportedPage.evaluate(() => ({ count: window.__regionTracks.length, time: window.__regionTracks[0].currentTime }));
  await exportedPage.locator('#stage').click({ position: { x: 50, y: 100 } });
  await exportedPage.waitForFunction(() => document.querySelector('#nodeText .typewriter-visible')?.textContent === 'b');
  const adjacent = await exportedPage.evaluate(() => ({ count: window.__regionTracks.length, time: window.__regionTracks[0].currentTime, paused: window.__regionTracks[0].paused }));
  if (adjacent.count !== initial.count || adjacent.paused || adjacent.time < initial.time) throw new Error('Exported Web restarted BGM on adjacent card');
  await exportedPage.locator('#stage').click({ position: { x: 50, y: 100 } });
  await exportedPage.waitForFunction(() => window.__regionTracks.every(audio => audio.paused));
  result.result.results.push('Exported Web in browser: real BGM remains continuous on card two and stops outside the region');
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result.result.results, null, 2));
  await exportedPage.screenshot({ path: path.join(output, 'exported-web.png'), fullPage: true });
  console.log(JSON.stringify({ results: result.result.results, output }, null, 2));
} finally { await browser.close(); }
