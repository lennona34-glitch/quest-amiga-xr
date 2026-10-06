import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const targetUrl = 'https://localhost:5173/puae/index.html#%7B%22core%22%3A%22amiga%22%2C%22model%22%3A%22A1200%22%7D';
  
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    '--user-data-dir=C:/Users/adria/AppData/Local/Temp/chrome_test_profile_opts',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get('http://localhost:9227/json', (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      const tabs = JSON.parse(raw);
      const pageTab = tabs.find(t => t.type === 'page');
      if (!pageTab) {
        chromeProc.kill();
        return;
      }
      const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Page.navigate', params: { url: targetUrl } }));
      });

      ws.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.id === 3) {
          setTimeout(() => {
            // Evaluate getCoreOptions
            ws.send(JSON.stringify({
              id: 10,
              method: 'Runtime.evaluate',
              params: {
                expression: `
                  (() => {
                    try {
                      if (window.EJS_emulator && window.EJS_emulator.gameManager && window.EJS_emulator.gameManager.functions.getCoreOptions) {
                        return window.EJS_emulator.gameManager.functions.getCoreOptions();
                      }
                      return "getCoreOptions not available";
                    } catch(e) {
                      return e.toString();
                    }
                  })()
                `
              }
            }));
          }, 5000);
        } else if (data.id === 10) {
          console.log('--- CORE OPTIONS RESULT ---');
          console.log(data.result.result.value);
          console.log('--- END CORE OPTIONS ---');
          ws.close();
          chromeProc.kill();
          process.exit(0);
        }
      });
    });
  }).on('error', err => {
    console.error('Failed to connect:', err);
    chromeProc.kill();
  });
}

main();
