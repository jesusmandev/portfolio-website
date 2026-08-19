import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Ruta absoluta al archivo de logs — fuera del alcance del watcher de Vite.
// CRÍTICO: si se escribe dentro del proyecto con una ruta relativa, Vite
// detecta el cambio y recarga la página → más logs → más escrituras → bucle infinito.
const LOG_FILE = path.resolve(process.cwd(), 'browser_logs.txt');

function logToTerminalPlugin() {
  return {
    name: 'log-to-terminal',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/__browser_log' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const { type, message } = JSON.parse(body);
              fs.appendFileSync(LOG_FILE, `[${type.toUpperCase()}] ${message}\n`);
            } catch (e) {}
            res.end('ok');
          });
        } else {
          next();
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/portfolio-website/',
  plugins: [
    tailwindcss(),
    react(),
    logToTerminalPlugin()
  ],
  server: {
    watch: {
      ignored: ['**/browser_logs.txt']
    }
  }
})