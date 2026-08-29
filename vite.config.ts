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
              let fileId = urlObj.searchParams.get('fileId') || '';
              const folderId = urlObj.searchParams.get('folderId') || '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y';
              const driveUrl = urlObj.searchParams.get('url') || '';

              const targetFolderId = folderId || (driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,})/)?.[1] || '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y');

              // Escaneo dinámico y en tiempo real de la carpeta oficial de Google Drive
              if (targetFolderId) {
                try {
                  const folderRes = await fetch(`https://drive.google.com/drive/folders/${targetFolderId}?usp=sharing&_t=${Date.now()}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                  });
                  if (folderRes.ok) {
                    const html = await folderRes.text();
                    const allMatches = [...html.matchAll(/"([a-zA-Z0-9_-]{28,40})"/g)].map(m => m[1]);
                    const candidates = [...new Set(allMatches)].filter(id => 
                      id !== targetFolderId && 
                      !id.startsWith('AIza') && 
                      !id.startsWith('ADFN') && 
                      !id.startsWith('AA2Yr') &&
                      !id.includes('Errors') &&
                      !id.includes('Recaptcha')
                    );

                    for (const candId of candidates) {
                      try {
                        const testUrl = `https://drive.usercontent.google.com/download?id=${candId}&export=download&confirm=t&_t=${Date.now()}`;
                        const testRes = await fetch(testUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
                        const len = Number(testRes.headers.get('content-length') || 0);
                        const ct = testRes.headers.get('content-type') || '';
                        if (testRes.ok && (len > 5000 || ct.includes('xml') || ct.includes('excel') || ct.includes('spreadsheet') || ct.includes('octet-stream'))) {
                          fileId = candId;
                          break;
                        }
                      } catch (e) {}
                    }
                  }
                } catch (e) {
                  console.warn('Error resolviendo carpeta de Complementaria dinámicamente:', e);
                }
              }

              if (!fileId) {
                fileId = '1ZEqmMzr_MuB4wdlQlw1ldXe78WeR7S9Q';
              }

              let arrayBuf: ArrayBuffer | null = null;

              // Intento 1: drive.usercontent.google.com con confirmación y anti-caché
              try {
                const driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&_t=${Date.now()}`;
                const response = await fetch(driveDownloadUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (response.ok) {
                  const buf = await response.arrayBuffer();
                  if (buf.byteLength > 1000) {
                    arrayBuf = buf;
                  }
                }
              } catch (e) {
                console.warn('Fallo intento 1 drive.usercontent:', e);
              }

              // Intento 2: drive.google.com/uc
              if (!arrayBuf) {
                try {
                  const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&_t=${Date.now()}`;
                  const ucRes = await fetch(ucUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  if (ucRes.ok) {
                    const buf = await ucRes.arrayBuffer();
                    if (buf.byteLength > 1000) {
                      arrayBuf = buf;
                    }
                  }
                } catch (e) {
                  console.warn('Fallo intento 2 drive uc:', e);
                }
              }

              // Intento 3: docs.google.com/spreadsheets/export
              if (!arrayBuf) {
                try {
                  const fallbackUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx&_t=${Date.now()}`;
                  const fbRes = await fetch(fallbackUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  if (fbRes.ok) {
                    const buf = await fbRes.arrayBuffer();
                    if (buf.byteLength > 1000) {
                      arrayBuf = buf;
                    }
                  }
                } catch (e) {
                  console.warn('Fallo intento 3 docs export:', e);
                }
              }

              if (!arrayBuf) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: 'No se pudo descargar el archivo PE-04 de Formación Complementaria desde la carpeta de Google Drive.' }));
                return;
              }

              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', arrayBuf.byteLength.toString());
              res.setHeader('X-Drive-File-Id', fileId);
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
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
