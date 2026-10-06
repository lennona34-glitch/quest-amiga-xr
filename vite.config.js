import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { tosecAmigaServerPlugin } from './src/server/tosec-amiga-plugin.js';

export default defineConfig({
  plugins: [
    basicSsl(),
    tosecAmigaServerPlugin()
  ],
  server: {
    host: true, // Listen on 0.0.0.0 for Quest 3 access over Wi-Fi
    port: 5173,
    https: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    watch: {
      ignored: ['**/.*/**', '**/node_modules/**', '**/dist/**', '**/public/disks/**', '**/chrome_profile*/**', '**/scratch*/**', '**/*.iso', '**/*.adf', '**/*.zip']
    }
  }
});
