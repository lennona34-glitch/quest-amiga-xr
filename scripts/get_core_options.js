import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9395;
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    '--user-data-dir=C:/Users/adria/AppData/Local/Temp/chrome_opts',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  http.get(`http://localhost:${port}/json`, res => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      const tabs = JSON.parse(raw);
      const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'https://localhost:5173/puae/index.html' } }));
      });
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: 'window.EJS_emulator && window.EJS_emulator.gameManager ? window.EJS_emulator.gameManager.getCoreOptions() : "no gm"',
            returnByValue: true
          }
        }));
      }, 12000);
      ws.on('message', m => {
        const d = JSON.parse(m);
        if (d.id === 10) {
          console.log('--- CORE OPTIONS ---');
          console.log(d.result && d.result.result && d.result.result.value);
          chromeProc.kill();
          process.exit(0);
        }
      });
    });
  });
}

main();
