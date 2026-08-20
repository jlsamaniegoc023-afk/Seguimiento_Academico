import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      {
        name: 'drive-api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.originalUrl || req.url || '';
            if (!rawUrl.includes('/api/drive-inasistencias')) {
              return next();
            }

            try {
              const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
              const folderId = urlObj.searchParams.get('folderId') || '';
              let fileId = urlObj.searchParams.get('fileId') || '';
              const driveUrl = urlObj.searchParams.get('url') || '';

              // Si es la carpeta especificada o tiene fileId conocido
              if (folderId === '1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi' || driveUrl.includes('1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi')) {
                fileId = '1I2gsbdJgZJry4fsDgnp-rs2IB_LFEYF1';
              } else if (!fileId && folderId) {
                // Intentar buscar el archivo dentro de la carpeta
                try {
                  const folderRes = await fetch(`https://drive.google.com/drive/folders/${folderId}?usp=sharing`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  if (folderRes.ok) {
                    const html = await folderRes.text();
                    const match = html.match(/\["([a-zA-Z0-9_-]{28,45})",\["[^"]*"\]/);
                    if (match && match[1]) {
                      fileId = match[1];
                    }
                  }
                } catch (e) {
                  console.warn('Error resolviendo carpeta de Drive:', e);
                }
              }

              if (!fileId) {
                fileId = '1I2gsbdJgZJry4fsDgnp-rs2IB_LFEYF1';
              }

              // Descargar archivo XLSX / XLS desde Google Drive / Google Sheets
              let arrayBuf: ArrayBuffer | null = null;
              
              // Intento 1: Google Sheets XLSX export
              try {
                const exportRes = await fetch(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`);
                if (exportRes.ok) {
                  const buf = await exportRes.arrayBuffer();
                  if (buf.byteLength > 1000) {
                    arrayBuf = buf;
                  }
                }
              } catch (e) {
                console.warn('Fallo export directo sheets:', e);
              }

              // Intento 2: Google Drive usercontent download
              if (!arrayBuf) {
                try {
                  const dlRes = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
                  if (dlRes.ok) {
                    const buf = await dlRes.arrayBuffer();
                    if (buf.byteLength > 1000) {
                      arrayBuf = buf;
                    }
                  }
                } catch (e) {
                  console.warn('Fallo download drive usercontent:', e);
                }
              }

              if (!arrayBuf) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: 'No se pudo descargar el archivo de inasistencias desde Google Drive.' }));
                return;
              }

              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Length', arrayBuf.byteLength.toString());
              res.end(Buffer.from(arrayBuf));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message || 'Error en proxy de inasistencias Google Drive' }));
            }
          });

          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.originalUrl || req.url || '';
            if (!rawUrl.includes('/api/drive-proxy')) {
              return next();
            }
            try {
              const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
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

          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.originalUrl || req.url || '';
            if (!rawUrl.includes('/api/drive-complementaria')) {
              return next();
            }
            try {
              const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
              let fileId = urlObj.searchParams.get('fileId') || '1VyXGzt3xxxodjAmeWRtXEYCjxVmrt5uE';
              const folderId = urlObj.searchParams.get('folderId') || '';
              const driveUrl = urlObj.searchParams.get('url') || '';

              if (folderId === '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y' || driveUrl.includes('1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y')) {
                fileId = '1VyXGzt3xxxodjAmeWRtXEYCjxVmrt5uE';
              }

              const driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
              let response = await fetch(driveDownloadUrl);
              
              if (!response.ok) {
                // Fallback to docs sheets export if applicable
                const fallbackUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
                const fbRes = await fetch(fallbackUrl);
                if (fbRes.ok) {
                  response = fbRes;
                }
              }

              if (!response.ok) {
                res.statusCode = response.status;
                res.end(JSON.stringify({ error: 'No se pudo descargar el reporte PE-04 de Formación Complementaria desde Google Drive.' }));
                return;
              }

              const arrayBuf = await response.arrayBuffer();
              res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
              res.setHeader('Content-Length', arrayBuf.byteLength.toString());
              res.end(Buffer.from(arrayBuf));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Formación Complementaria Google Drive' }));
            }
          });
        }
      },
      react(), 
      tailwindcss(), 
      viteSingleFile()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
