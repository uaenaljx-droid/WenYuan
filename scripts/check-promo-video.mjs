import { chromium } from 'playwright';
import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const videoPath = path.resolve('dist/video/wenyuan-atlas-promo-60s.mp4');

async function launchBrowser() {
  const executableCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const executablePath of executableCandidates) {
    try {
      await fs.access(executablePath);
      return chromium.launch({
        executablePath,
        headless: true,
        args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
      });
    } catch {
      // Try the next installed browser candidate.
    }
  }

  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({
        channel,
        headless: true,
        args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
      });
    } catch {
      // Try the next Playwright channel.
    }
  }

  return chromium.launch({
    headless: true,
    args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  });
}

const metadata = await parseMedia({
  src: videoPath,
  reader: nodeReader,
  acknowledgeRemotionLicense: true,
  fields: {
    durationInSeconds: true,
    dimensions: true,
    fps: true,
    videoCodec: true,
    audioCodec: true,
    size: true,
    container: true,
  },
});

console.log(JSON.stringify(metadata, null, 2));

await fs.mkdir(path.resolve('dist/video/check-frames'), { recursive: true });

const server = http.createServer(async (request, response) => {
  if (request.url !== '/video.mp4') {
    response.writeHead(404);
    response.end();
    return;
  }

  const stat = await fs.stat(videoPath);
  const range = request.headers.range;

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;

    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Type': 'video/mp4',
    });
    fsSync.createReadStream(videoPath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    'Accept-Ranges': 'bytes',
    'Content-Length': stat.size,
    'Content-Type': 'video/mp4',
  });
  fsSync.createReadStream(videoPath).pipe(response);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const { port } = server.address();
const src = `http://127.0.0.1:${port}/video.mp4`;

await page.setContent(`
  <html>
    <body style="margin:0;background:#000;overflow:hidden">
      <video id="promo" src="${src}" style="width:1920px;height:1080px;object-fit:contain" muted></video>
    </body>
  </html>
`);

await page.waitForFunction(() => {
  const video = document.querySelector('video');
  return video && video.readyState >= 1 && video.duration > 10;
}, null, { timeout: 60000 });

const frames = [
  ['opening', 2],
  ['earth', 18],
  ['profile', 39.5],
  ['work', 48],
  ['finale', 60],
];

for (const [name, time] of frames) {
  await page.evaluate(
    (targetTime) =>
      new Promise((resolve) => {
        const video = document.querySelector('video');
        const done = () => {
          video.removeEventListener('seeked', done);
          resolve();
        };
        video.addEventListener('seeked', done);
        video.currentTime = targetTime;
      }),
    time,
  );

  const output = path.resolve(`dist/video/check-frames/${name}.png`);
  await page.screenshot({ path: output, fullPage: false });
  console.log(`captured ${name} @ ${time}s -> ${output}`);
}

await browser.close();
server.close();
