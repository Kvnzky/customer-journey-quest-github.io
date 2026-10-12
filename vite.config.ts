import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

function adminRoutePlugin(): Plugin {
  return {
    name: 'admin-route-plugin',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/admin' || req.url === '/admin/') {
          req.url = '/admin.html';
        }
        next();
      });
    },
    closeBundle() {
      try {
        const distDir = resolve(__dirname, 'dist');
        const adminHtmlPath = resolve(distDir, 'admin.html');
        const adminDir = resolve(distDir, 'admin');
        if (fs.existsSync(adminHtmlPath)) {
          if (!fs.existsSync(adminDir)) {
            fs.mkdirSync(adminDir, { recursive: true });
          }
          let adminHtml = fs.readFileSync(adminHtmlPath, 'utf-8');
          adminHtml = adminHtml.replace(/(src|href)="\.\/assets\//g, '$1="../assets/');
          fs.writeFileSync(resolve(adminDir, 'index.html'), adminHtml, 'utf-8');
        }
      } catch (err) {
        console.warn('Could not generate dist/admin/index.html:', err);
      }
    }
  };
}

export default defineConfig({
  base: './', // Relative asset paths for standalone offline desktop packaging
  plugins: [react(), adminRoutePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
});

