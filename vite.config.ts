import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      configureServer(server) {
        server.middlewares.use('/api/drive-proxy', async (req, res) => {
          try {
            const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            let fileId = urlObj.searchParams.get('fileId') || '1Ll1g7SmYMytc5qhmI1llL1l0tBfMqe5X';
            if (fileId === '1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK') {
              fileId = '1Ll1g7SmYMytc5qhmI1llL1l0tBfMqe5X';
            }
            let driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
            let response = await fetch(driveDownloadUrl);
            if (!response.ok) {
              fileId = '1Ll1g7SmYMytc5qhmI1llL1l0tBfMqe5X';
              driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
              response = await fetch(driveDownloadUrl);
            }
            if (!response.ok) {
              res.statusCode = response.status;
              res.end(JSON.stringify({ error: 'Error descargando archivo de Google Drive' }));
              return;
            }
            const xmlText = await response.text();
            res.setHeader('Content-Type', 'text/xml; charset=utf-8');
            res.end(xmlText);
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Google Drive' }));
          }
        });
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
