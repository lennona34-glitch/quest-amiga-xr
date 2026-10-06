import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const relPath = 'Commodore Amiga CD32 [TOSEC]/Games/D-Generation v1.0 (1993)(Mindscape)[!].zip';
  const gameUrl = '/api/tosec/disk/' + encodeURIComponent('D-Generation.iso') + '?file=' + encodeURIComponent(relPath);
  const targetUrl = 'https://localhost:5173/puae/index.html#' + encodeURIComponent(JSON.stringify({
    core: 'cd32',
    model: 'CD32',
    warpBoot: false,
    gameUrl: gameUrl,
    title: 'D-Generation'
  }));

  const port = 9389;
  const tempProfile = `C:/Users/adria/AppData/Local/Temp/chrome_raw_${Date.now()}`;
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    `--user-data-dir=${tempProfile}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  http.get(`http://localhost:${port}/json`, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      const tabs = JSON.parse(raw);
      const pageTab = tabs.find(t => t.type === 'page');
      if (!pageTab) {
        console.error('No page tab found');
        chromeProc.kill();
        process.exit(1);
      }
      const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: targetUrl } }));
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.method === 'Runtime.consoleAPICalled') {
          const text = data.params.args.map(a => a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : (a.description || JSON.stringify(a))).join(' ');
          console.log('[BROWSER]', text);
        }
      });

      setTimeout(() => {
        console.log('--- Test time elapsed (20s) ---');
        ws.close();
        chromeProc.kill();
        process.exit(0);
      }, 20000);
    });
  }).on('error', err => {
    console.error(err);
    chromeProc.kill();
  });
}

main();
