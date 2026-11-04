// Dev / preview server for the web frontend.
//  - /admin/*  -> admin/index.html     /user/*  -> user/index.html
//    (so /admin/home, /user/logs ... work on refresh; js/router.js shows the section)
//  - /api and /uploads are forwarded to the backend (default http://localhost:3000)
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';

const pageRoutes = () => {
  const rewrite = (req, _res, next) => {
    const [path, query = ''] = (req.url || '').split('?');
    const m = /^\/(admin|user)(\/[^.]*)?$/.exec(path); // no dot -> not a file
    if (m) req.url = '/' + m[1] + '/index.html' + (query ? '?' + query : '');
    next();
  };
  return {
    name: 'page-routes',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
};

const proxy = {
  '/api': { target: BACKEND, changeOrigin: true },
  '/uploads': { target: BACKEND, changeOrigin: true },
};

export default defineConfig({
  plugins: [pageRoutes()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        user: resolve(__dirname, 'user/index.html'),
      },
    },
  },
});
