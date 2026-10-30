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
              const folderIdParam = urlObj.searchParams.get('folderId') || '';
              const fileIdParam = urlObj.searchParams.get('fileId') || '';
              const driveUrl = urlObj.searchParams.get('url') || '';
              const checkInfoOnly = urlObj.searchParams.get('info') === 'true' || urlObj.searchParams.get('action') === 'info';

              const DEFAULT_FOLDER_ID = '1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK';
              const targetFolderId = folderIdParam || (driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,})/)?.[1] || DEFAULT_FOLDER_ID);

              let fileId = fileIdParam;
              let discoveredFileName = 'DF-14A_1.xml';
              let driveModifiedIso = '';
              const driveFiles: { id: string; name: string; parent?: string; modifiedTime?: string }[] = [];

              // Si no se proporcionó un fileId directo o es el ID de la carpeta, escaneamos dinámicamente la carpeta
              if (!fileId || fileId === targetFolderId || fileId === DEFAULT_FOLDER_ID || fileId === '1Ll1g7SmYMytc5qhmI1llL1l0tBfMqe5X') {
                try {
                  const folderUrl = `https://drive.google.com/drive/folders/${targetFolderId}?usp=sharing&_t=${Date.now()}`;
                  const folderRes = await fetch(folderUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache'
                    }
                  });

                  if (folderRes.ok) {
                    const html = await folderRes.text();

                    const decodeEscapes = (str: string) => {
                      return str
                        .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                        .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                    };

                    const decodedHtml = decodeEscapes(html);
                    const fileRegex = /\["([a-zA-Z0-9_-]{25,50})",\["([^"]*)"\],"([^"]+)"/g;
                    let match;

                    while ((match = fileRegex.exec(decodedHtml)) !== null) {
                      const fId = match[1];
                      const fName = match[3];
                      if (
                        fId !== targetFolderId &&
                        !fId.startsWith('AIza') &&
                        !fId.startsWith('ADFN') &&
                        !fId.startsWith('AA2Yr') &&
                        !fId.includes('Errors') &&
                        !fId.includes('Recaptcha')
                      ) {
                        const tail = decodedHtml.slice(match.index, match.index + 240);
                        const tsMatch = tail.match(/,(1\d{12}),/);
                        const modifiedIso = tsMatch ? new Date(Number(tsMatch[1])).toISOString() : '';
                        driveFiles.push({ id: fId, name: fName, parent: match[2], modifiedTime: modifiedIso });
                      }
                    }

                    if (driveFiles.length > 0) {
                      const preferred =
                        driveFiles.find(f => /\.xml$/i.test(f.name)) ||
                        driveFiles.find(f => /df-?14/i.test(f.name)) ||
                        driveFiles[0];

                      if (preferred) {
                        fileId = preferred.id;
                        discoveredFileName = preferred.name;
                        if (preferred.modifiedTime) {
                          driveModifiedIso = preferred.modifiedTime;
                        }
                      }
                    }

                    if (!fileId || fileId === targetFolderId) {
                      const allMatches = [...decodedHtml.matchAll(/"([a-zA-Z0-9_-]{28,45})"/g)].map(m => m[1]);
                      const candidates = [...new Set(allMatches)].filter(
                        id =>
                          id !== targetFolderId &&
                          !id.startsWith('AIza') &&
                          !id.startsWith('ADFN') &&
                          !id.startsWith('AA2Yr') &&
                          !id.includes('Errors') &&
                          !id.includes('Recaptcha')
                      );

                      for (const candId of candidates.slice(0, 8)) {
                        try {
                          const testUrl = `https://drive.usercontent.google.com/download?id=${candId}&export=download&confirm=t&_t=${Date.now()}`;
                          const testRes = await fetch(testUrl, {
                            method: 'HEAD',
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                          });
                          const ct = testRes.headers.get('content-type') || '';
                          const cd = testRes.headers.get('content-disposition') || '';
                          const len = Number(testRes.headers.get('content-length') || 0);

                          if (testRes.ok && (len > 5000 || ct.includes('xml') || ct.includes('octet-stream') || cd.includes('.xml'))) {
                            fileId = candId;
                            const fnMatch = cd.match(/filename="?([^";]+)"?/i);
                            if (fnMatch && fnMatch[1]) {
                              discoveredFileName = fnMatch[1];
                            }
                            break;
                          }
                        } catch (e) {}
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Advertencia escaneando carpeta Google Drive:', e);
                }
              }

              if (!fileId || fileId === targetFolderId) {
                fileId = '1CBCsLRu7T0ypYrUbrCc_afkLxjnS7-kQ';
              }

              if (checkInfoOnly) {
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: true,
                    folderId: targetFolderId,
                    fileId,
                    fileName: discoveredFileName,
                    modifiedTime: driveModifiedIso || null,
                    filesInFolder: driveFiles,
                    timestamp: new Date().toISOString()
                  })
                );
                return;
              }

              let xmlContent: string | null = null;

              // Intento 1: drive.usercontent.google.com
              try {
                const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&_t=${Date.now()}`;
                const dlRes = await fetch(downloadUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                  }
                });
                if (dlRes.ok) {
                  const text = await dlRes.text();
                  if (text && (text.includes('Workbook') || text.includes('Table') || text.includes('Row') || text.includes('<?xml'))) {
                    xmlContent = text;
                    const cd = dlRes.headers.get('content-disposition') || '';
                    const fnMatch = cd.match(/filename="?([^";]+)"?/i);
                    if (fnMatch && fnMatch[1]) {
                      discoveredFileName = fnMatch[1];
                    }
                    const lastMod = dlRes.headers.get('last-modified');
                    if (!driveModifiedIso && lastMod && !isNaN(Date.parse(lastMod))) {
                      driveModifiedIso = new Date(lastMod).toISOString();
                    }
                  }
                }
              } catch (e) {
                console.warn('Fallo intento 1 drive.usercontent:', e);
              }

              // Intento 2: drive.google.com/uc
              if (!xmlContent) {
                try {
                  const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&_t=${Date.now()}`;
                  const ucRes = await fetch(ucUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  if (ucRes.ok) {
                    const text = await ucRes.text();
                    if (text && (text.includes('Workbook') || text.includes('Table') || text.includes('Row') || text.includes('<?xml'))) {
                      xmlContent = text;
                      const lastMod = ucRes.headers.get('last-modified');
                      if (!driveModifiedIso && lastMod && !isNaN(Date.parse(lastMod))) {
                        driveModifiedIso = new Date(lastMod).toISOString();
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Fallo intento 2 drive uc:', e);
                }
              }

              if (!xmlContent) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `No se pudo descargar el archivo XML (${discoveredFileName}) desde la carpeta compartida de Google Drive.`
                  })
                );
                return;
              }

              res.setHeader('Content-Type', 'text/xml; charset=utf-8');
              res.setHeader('X-Drive-File-Id', fileId);
              res.setHeader('X-Drive-File-Name', encodeURIComponent(discoveredFileName));
              res.setHeader('X-Drive-Folder-Id', targetFolderId);
              if (driveModifiedIso) {
                res.setHeader('X-Drive-Modified-Time', driveModifiedIso);
              }
              res.setHeader('Access-Control-Expose-Headers', 'X-Drive-File-Id, X-Drive-File-Name, X-Drive-Folder-Id, X-Drive-Modified-Time');
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              res.end(xmlContent);
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
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
              let discoveredFileName = 'PE-04_1.xml';

              // Escaneo dinámico y en tiempo real de la carpeta oficial de Google Drive
              if (targetFolderId) {
                try {
                  const folderRes = await fetch(`https://drive.google.com/drive/folders/${targetFolderId}?usp=sharing&_t=${Date.now()}`, {
                    headers: { 
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache'
                    }
                  });
                  if (folderRes.ok) {
                    const html = await folderRes.text();
                    
                    // Decodificar escapes hex y unicode de Google Drive (\x5b, \x22, \u0022, etc.)
                    const decodeHex = (str: string) => {
                      return str.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                                .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
                    };

                    const decodedHtml = decodeHex(html);
                    
                    // Buscar patrones estructurados de archivos en Drive: ["fileId",["folderId"],"filename"
                    const fileRegex = /\["([a-zA-Z0-9_-]{25,50})",\["([^"]*)"\],"([^"]+)"/g;
                    let match;
                    const driveFiles: { id: string; name: string }[] = [];
                    
                    while ((match = fileRegex.exec(decodedHtml)) !== null) {
                      if (match[1] !== targetFolderId && !match[1].startsWith('AIza') && !match[1].startsWith('ADFN')) {
                        driveFiles.push({ id: match[1], name: match[3] });
                      }
                    }

                    // Si se encontraron archivos por regex
                    if (driveFiles.length > 0) {
                      // Preferir archivos de tipo excel o xml
                      const preferred = driveFiles.find(f => /pe-?04|\.xml$|\.xlsx?$|\.csv$/i.test(f.name)) || driveFiles[0];
                      if (preferred) {
                        fileId = preferred.id;
                        discoveredFileName = preferred.name;
                      }
                    }

                    // Si aún no se asignó, buscar IDs candidatos generales
                    if (!fileId) {
                      const allMatches = [...decodedHtml.matchAll(/"([a-zA-Z0-9_-]{28,40})"/g)].map(m => m[1]);
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
                          const cd = testRes.headers.get('content-disposition') || '';
                          if (testRes.ok && (len > 5000 || ct.includes('xml') || ct.includes('excel') || ct.includes('spreadsheet') || ct.includes('octet-stream'))) {
                            fileId = candId;
                            const fnMatch = cd.match(/filename="?([^";]+)"?/i);
                            if (fnMatch && fnMatch[1]) {
                              discoveredFileName = fnMatch[1];
                            }
                            break;
                          }
                        } catch (e) {}
                      }
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
                  headers: { 
                    'User-Agent': 'Mozilla/5.0',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                  }
                });
                if (response.ok) {
                  const buf = await response.arrayBuffer();
                  if (buf.byteLength > 1000) {
                    arrayBuf = buf;
                    const cd = response.headers.get('content-disposition') || '';
                    const fnMatch = cd.match(/filename="?([^";]+)"?/i);
                    if (fnMatch && fnMatch[1]) {
                      discoveredFileName = fnMatch[1];
                    }
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
              res.setHeader('X-Drive-File-Name', encodeURIComponent(discoveredFileName));
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              res.end(Buffer.from(arrayBuf));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Formación Complementaria Google Drive' }));
            }
          });

          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.originalUrl || req.url || '';
            if (!rawUrl.includes('/api/drive-programacion-ficha')) {
              return next();
            }

            const DEFAULT_PROG_FOLDER_ID = '1NGz4Uy5Vt-AfV2wJjHYalzn6W7DyT5ff';
            const decodeEscapes = (str: string) =>
              String(str || '')
                .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

            const extractFicha = (name: string) => {
              const clean = String(name || '').trim();
              const mStart = clean.match(/^\s*ficha[\s._-]*(\d{4,12})(?:\D|$)/i);
              if (mStart) return { ficha: mStart[1], startsWithFicha: true };
              if (/^\s*ficha\b/i.test(clean)) {
                const mAny = clean.match(/(?:^|\D)(\d{5,12})(?:\D|$)/);
                if (mAny) return { ficha: mAny[1], startsWithFicha: true };
              }
              const mFallback = clean.match(/(?:^|\D)(\d{6,10})(?:\D|$)/);
              if (mFallback) return { ficha: mFallback[1], startsWithFicha: false };
              return { ficha: '', startsWithFicha: false };
            };

            try {
              const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
              const folderId = urlObj.searchParams.get('folderId') || DEFAULT_PROG_FOLDER_ID;
              const action = urlObj.searchParams.get('action') || '';
              const fichaParam = (urlObj.searchParams.get('ficha') || '').trim();
              const fileIdParam = (urlObj.searchParams.get('fileId') || '').trim();
              const ua =
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

              const byId = new Map<
                string,
                { id: string; name: string; ficha: string; startsWithFicha: boolean; modifiedTime: string }
              >();

              try {
                const folderRes = await fetch(
                  `https://drive.google.com/drive/folders/${folderId}?usp=sharing&_t=${Date.now()}`,
                  {
                    headers: {
                      'User-Agent': ua,
                      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      Pragma: 'no-cache',
                    },
                  }
                );
                if (folderRes.ok) {
                  const decoded = decodeEscapes(await folderRes.text());
                  const fileRegex = /\["([a-zA-Z0-9_-]{25,50})",\["([^"]*)"\],"([^"]+)"/g;
                  let match;
                  while ((match = fileRegex.exec(decoded)) !== null) {
                    const fId = match[1];
                    const fName = match[3];
                    if (
                      fId !== folderId &&
                      !fId.startsWith('AIza') &&
                      !fId.startsWith('ADFN') &&
                      !fId.startsWith('AA2Yr') &&
                      !fId.includes('Errors') &&
                      !fId.includes('Recaptcha')
                    ) {
                      const tail = decoded.slice(match.index, match.index + 260);
                      const tsMatch = tail.match(/,(1\d{12}),/);
                      const modifiedTime = tsMatch ? new Date(Number(tsMatch[1])).toISOString() : '';
                      const parsed = extractFicha(fName);
                      byId.set(fId, {
                        id: fId,
                        name: fName,
                        ficha: parsed.ficha,
                        startsWithFicha: parsed.startsWithFicha,
                        modifiedTime,
                      });
                    }
                  }
                }
              } catch (e) {
                console.warn('Advertencia escaneando carpeta programación SOFIA:', e);
              }

              try {
                const embRes = await fetch(
                  `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
                  { headers: { 'User-Agent': ua, 'Cache-Control': 'no-cache' } }
                );
                if (embRes.ok) {
                  const embHtml = decodeEscapes(await embRes.text());
                  const entryRegex =
                    /id="entry-([a-zA-Z0-9_-]{20,50})"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
                  let m;
                  while ((m = entryRegex.exec(embHtml)) !== null) {
                    const fId = m[1];
                    const fName = m[2].trim();
                    if (fId && fId !== folderId && !byId.has(fId)) {
                      const parsed = extractFicha(fName);
                      byId.set(fId, {
                        id: fId,
                        name: fName,
                        ficha: parsed.ficha,
                        startsWithFicha: parsed.startsWithFicha,
                        modifiedTime: '',
                      });
                    }
                  }
                }
              } catch (e) {
                console.warn('Advertencia embeddedfolderview programación SOFIA:', e);
              }

              const files = Array.from(byId.values());

              if (action === 'list' || urlObj.searchParams.get('info') === 'true') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                res.end(
                  JSON.stringify({
                    success: true,
                    folderId,
                    totalFiles: files.length,
                    files,
                    timestamp: new Date().toISOString(),
                  })
                );
                return;
              }

              let matchedFile: {
                id: string;
                name: string;
                ficha: string;
                startsWithFicha: boolean;
                modifiedTime: string;
              } | null = null;

              if (fileIdParam) {
                matchedFile = files.find((f) => f.id === fileIdParam) || {
                  id: fileIdParam,
                  name: `Ficha ${fichaParam || ''}.xls`,
                  ficha: fichaParam,
                  startsWithFicha: true,
                  modifiedTime: '',
                };
              } else if (fichaParam) {
                const escaped = fichaParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactRx = new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`);
                const strictMatches = files.filter(
                  (f) => /^\s*ficha\b/i.test(f.name) && (f.ficha === fichaParam || exactRx.test(f.name))
                );
                if (strictMatches.length > 0) {
                  matchedFile = strictMatches.sort((a, b) =>
                    (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
                  )[0];
                } else {
                  const fbMatches = files.filter((f) => f.ficha === fichaParam || exactRx.test(f.name));
                  if (fbMatches.length > 0) {
                    matchedFile = fbMatches.sort((a, b) =>
                      (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
                    )[0];
                  }
                }
              }

              if (!matchedFile) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(
                  JSON.stringify({
                    found: false,
                    ficha: fichaParam,
                    folderId,
                    message: `No se encontró un archivo Excel iniciado con "Ficha" para la ficha ${fichaParam} en la carpeta de Google Drive.`,
                    availableFiles: files,
                  })
                );
                return;
              }

              let arrayBuf: ArrayBuffer | null = null;
              let dlFileName = '';
              let dlModifiedIso = '';

              try {
                const dlRes = await fetch(
                  `https://drive.usercontent.google.com/download?id=${matchedFile.id}&export=download&confirm=t&_t=${Date.now()}`,
                  { headers: { 'User-Agent': ua, 'Cache-Control': 'no-cache' } }
                );
                if (dlRes.ok) {
                  const ct = (dlRes.headers.get('content-type') || '').toLowerCase();
                  const buf = await dlRes.arrayBuffer();
                  if (buf.byteLength > 256 && !ct.includes('text/html')) {
                    arrayBuf = buf;
                    const cd = dlRes.headers.get('content-disposition') || '';
                    const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
                    if (fnMatch && fnMatch[1]) {
                      try {
                        dlFileName = decodeURIComponent(fnMatch[1]);
                      } catch {
                        dlFileName = fnMatch[1];
                      }
                    }
                    const lastMod = dlRes.headers.get('last-modified');
                    if (lastMod && !isNaN(Date.parse(lastMod))) {
                      dlModifiedIso = new Date(lastMod).toISOString();
                    }
                  }
                }
              } catch (e) {}

              if (!arrayBuf) {
                try {
                  const sheetRes = await fetch(
                    `https://docs.google.com/spreadsheets/d/${matchedFile.id}/export?format=xlsx&_t=${Date.now()}`,
                    { headers: { 'User-Agent': ua } }
                  );
                  if (sheetRes.ok) {
                    const ct = (sheetRes.headers.get('content-type') || '').toLowerCase();
                    const buf = await sheetRes.arrayBuffer();
                    if (buf.byteLength > 256 && !ct.includes('text/html')) {
                      arrayBuf = buf;
                    }
                  }
                } catch (e) {}
              }

              if (!arrayBuf) {
                try {
                  const ucRes = await fetch(
                    `https://drive.google.com/uc?export=download&id=${matchedFile.id}&confirm=t&_t=${Date.now()}`,
                    { headers: { 'User-Agent': ua } }
                  );
                  if (ucRes.ok) {
                    const ct = (ucRes.headers.get('content-type') || '').toLowerCase();
                    const buf = await ucRes.arrayBuffer();
                    if (buf.byteLength > 256 && !ct.includes('text/html')) {
                      arrayBuf = buf;
                    }
                  }
                } catch (e) {}
              }

              if (!arrayBuf) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(
                  JSON.stringify({
                    found: true,
                    error: `Se identificó el archivo "${matchedFile.name}", pero no fue posible descargarlo desde Google Drive.`,
                  })
                );
                return;
              }

              const finalName = matchedFile.name || dlFileName || `Ficha_${fichaParam}.xls`;
              const finalMod = matchedFile.modifiedTime || dlModifiedIso || '';

              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', arrayBuf.byteLength.toString());
              res.setHeader('X-Drive-File-Id', matchedFile.id);
              res.setHeader('X-Drive-File-Name', encodeURIComponent(finalName));
              res.setHeader('X-Drive-Folder-Id', folderId);
              res.setHeader('X-Drive-Matched-Ficha', matchedFile.ficha || fichaParam);
              if (finalMod) {
                res.setHeader('X-Drive-Modified-Time', finalMod);
              }
              res.setHeader(
                'Access-Control-Expose-Headers',
                'X-Drive-File-Id, X-Drive-File-Name, X-Drive-Folder-Id, X-Drive-Matched-Ficha, X-Drive-Modified-Time'
              );
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
              res.end(Buffer.from(arrayBuf));
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  error: e?.message || 'Error en proxy de Programación SOFIA Plus Google Drive',
                })
              );
            }
          });

          // 5. Proxy para Juicios Evaluativos del Aprendiz por Ficha (carpeta Drive con archivos Excel iniciados en "Ficha <numero>")
          server.middlewares.use('/api/drive-juicios-ficha', async (req: any, res: any) => {
            try {
              const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
              const folderId =
                urlObj.searchParams.get('folderId') || '1jD0PQu1jlHKLgkngmo4Hogip3DA5g5t3';
              const action = urlObj.searchParams.get('action') || '';
              const fichaParam = (urlObj.searchParams.get('ficha') || '').trim();
              const fileIdParam = (urlObj.searchParams.get('fileId') || '').trim();

              const decodeEscapes = (s: string) =>
                String(s || '')
                  .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                  )
                  .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                  )
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'");

              const extractFicha = (name: string) => {
                const clean = String(name || '').trim();
                const mStart = clean.match(/^\s*ficha[\s._-]*(\d{4,12})(?:\D|$)/i);
                if (mStart) return { ficha: mStart[1], startsWithFicha: true };
                if (/^\s*ficha\b/i.test(clean)) {
                  const mAny = clean.match(/(?:^|\D)(\d{5,12})(?:\D|$)/);
                  if (mAny) return { ficha: mAny[1], startsWithFicha: true };
                }
                const mFallback = clean.match(/(?:^|\D)(\d{6,10})(?:\D|$)/);
                if (mFallback) return { ficha: mFallback[1], startsWithFicha: false };
                return { ficha: '', startsWithFicha: false };
              };

              const ua =
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
              const byId = new Map<
                string,
                {
                  id: string;
                  name: string;
                  ficha: string;
                  startsWithFicha: boolean;
                  modifiedTime: string;
                }
              >();

              try {
                const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing&_t=${Date.now()}`;
                const fRes = await fetch(folderUrl, {
                  headers: {
                    'User-Agent': ua,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                  },
                });
                if (fRes.ok) {
                  const decoded = decodeEscapes(await fRes.text());
                  const fileRegex = /\["([a-zA-Z0-9_-]{25,50})",\["([^"]*)"\],"([^"]+)"/g;
                  let m;
                  while ((m = fileRegex.exec(decoded)) !== null) {
                    const fId = m[1];
                    const fName = m[3];
                    if (
                      fId !== folderId &&
                      !fId.startsWith('AIza') &&
                      !fId.startsWith('ADFN') &&
                      !fId.startsWith('AA2Yr') &&
                      !fId.includes('Errors') &&
                      !fId.includes('Recaptcha')
                    ) {
                      const tail = decoded.slice(m.index, m.index + 260);
                      const tsMatch = tail.match(/,(1\d{12}),/);
                      const modifiedTime = tsMatch
                        ? new Date(Number(tsMatch[1])).toISOString()
                        : '';
                      const parsed = extractFicha(fName);
                      byId.set(fId, {
                        id: fId,
                        name: fName,
                        ficha: parsed.ficha,
                        startsWithFicha: parsed.startsWithFicha,
                        modifiedTime,
                      });
                    }
                  }
                }
              } catch (err) {
                console.warn('Advertencia leyendo carpeta principal Drive juicios evaluativos:', err);
              }

              try {
                const embUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
                const embRes = await fetch(embUrl, {
                  headers: {
                    'User-Agent': ua,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                  },
                });
                if (embRes.ok) {
                  const embHtml = decodeEscapes(await embRes.text());
                  const entryRegex =
                    /id="entry-([a-zA-Z0-9_-]{20,50})"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
                  let em;
                  while ((em = entryRegex.exec(embHtml)) !== null) {
                    const fId = em[1];
                    const fName = em[2].trim();
                    if (fId && fId !== folderId && !byId.has(fId)) {
                      const parsed = extractFicha(fName);
                      byId.set(fId, {
                        id: fId,
                        name: fName,
                        ficha: parsed.ficha,
                        startsWithFicha: parsed.startsWithFicha,
                        modifiedTime: '',
                      });
                    }
                  }
                }
              } catch (err) {
                console.warn('Advertencia leyendo embeddedfolderview Drive juicios evaluativos:', err);
              }

              const files = Array.from(byId.values());

              if (action === 'list' || urlObj.searchParams.get('info') === 'true') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                res.end(
                  JSON.stringify({
                    success: true,
                    folderId,
                    totalFiles: files.length,
                    files,
                    timestamp: new Date().toISOString(),
                  })
                );
                return;
              }

              let matchedFile: {
                id: string;
                name: string;
                ficha: string;
                startsWithFicha: boolean;
                modifiedTime: string;
              } | null = null;

              if (fileIdParam) {
                matchedFile = files.find((f) => f.id === fileIdParam) || {
                  id: fileIdParam,
                  name: `Ficha ${fichaParam || ''}.xls`,
                  ficha: fichaParam,
                  startsWithFicha: true,
                  modifiedTime: '',
                };
              } else if (fichaParam) {
                const escaped = fichaParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactRx = new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`);
                const strict = files.filter(
                  (f) =>
                    /^\s*ficha\b/i.test(f.name) &&
                    (f.ficha === fichaParam || exactRx.test(f.name))
                );
                if (strict.length > 0) {
                  matchedFile = strict.sort((a, b) =>
                    (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
                  )[0];
                } else {
                  const loose = files.filter(
                    (f) => f.ficha === fichaParam || exactRx.test(f.name)
                  );
                  if (loose.length > 0) {
                    matchedFile = loose.sort((a, b) =>
                      (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
                    )[0];
                  }
                }
              }

              if (!matchedFile) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(
                  JSON.stringify({
                    found: false,
                    ficha: fichaParam,
                    folderId,
                    message: `No se encontró un archivo Excel iniciado con "Ficha" para la ficha ${fichaParam} en la carpeta de Juicios Evaluativos de Google Drive.`,
                    availableFiles: files,
                  })
                );
                return;
              }

              let arrayBuf: ArrayBuffer | null = null;
              let dlName = '';
              let dlModIso = '';

              try {
                const dlUrl = `https://drive.usercontent.google.com/download?id=${matchedFile.id}&export=download&confirm=t&_t=${Date.now()}`;
                const dlRes = await fetch(dlUrl, {
                  headers: {
                    'User-Agent': ua,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    Pragma: 'no-cache',
                  },
                });
                if (dlRes.ok) {
                  const ct = (dlRes.headers.get('content-type') || '').toLowerCase();
                  const buf = await dlRes.arrayBuffer();
                  if (buf.byteLength > 256 && !ct.includes('text/html')) {
                    arrayBuf = buf;
                    const cd = dlRes.headers.get('content-disposition') || '';
                    const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
                    if (fnMatch && fnMatch[1]) {
                      try {
                        dlName = decodeURIComponent(fnMatch[1]);
                      } catch {
                        dlName = fnMatch[1];
                      }
                    }
                    const lm = dlRes.headers.get('last-modified');
                    if (lm && !isNaN(Date.parse(lm))) {
                      dlModIso = new Date(lm).toISOString();
                    }
                  }
                }
              } catch (err) {
                console.warn('Fallo descarga 1 juicios drive.usercontent:', err);
              }

              if (!arrayBuf) {
                try {
                  const gsUrl = `https://docs.google.com/spreadsheets/d/${matchedFile.id}/export?format=xlsx&_t=${Date.now()}`;
                  const gsRes = await fetch(gsUrl, { headers: { 'User-Agent': ua } });
                  if (gsRes.ok) {
                    const ct = (gsRes.headers.get('content-type') || '').toLowerCase();
                    const buf = await gsRes.arrayBuffer();
                    if (buf.byteLength > 256 && !ct.includes('text/html')) {
                      arrayBuf = buf;
                    }
                  }
                } catch (err) {
                  console.warn('Fallo descarga 2 juicios google sheets export:', err);
                }
              }

              if (!arrayBuf) {
                try {
                  const ucUrl = `https://drive.google.com/uc?export=download&id=${matchedFile.id}&confirm=t&_t=${Date.now()}`;
                  const ucRes = await fetch(ucUrl, { headers: { 'User-Agent': ua } });
                  if (ucRes.ok) {
                    const ct = (ucRes.headers.get('content-type') || '').toLowerCase();
                    const buf = await ucRes.arrayBuffer();
                    if (buf.byteLength > 256 && !ct.includes('text/html')) {
                      arrayBuf = buf;
                    }
                  }
                } catch (err) {
                  console.warn('Fallo descarga 3 juicios drive uc:', err);
                }
              }

              if (!arrayBuf) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(
                  JSON.stringify({
                    found: true,
                    error: `Se identificó el archivo "${matchedFile.name}", pero no fue posible descargarlo desde Google Drive.`,
                    matchedFile,
                  })
                );
                return;
              }

              const finalName = matchedFile.name || dlName || `Ficha_${fichaParam}_Juicios.xls`;
              const finalMod = matchedFile.modifiedTime || dlModIso || '';

              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Length', arrayBuf.byteLength.toString());
              res.setHeader('X-Drive-File-Id', matchedFile.id);
              res.setHeader('X-Drive-File-Name', encodeURIComponent(finalName));
              res.setHeader('X-Drive-Folder-Id', folderId);
              res.setHeader('X-Drive-Matched-Ficha', matchedFile.ficha || fichaParam);
              if (finalMod) {
                res.setHeader('X-Drive-Modified-Time', finalMod);
              }
              res.setHeader(
                'Access-Control-Expose-Headers',
                'X-Drive-File-Id, X-Drive-File-Name, X-Drive-Folder-Id, X-Drive-Matched-Ficha, X-Drive-Modified-Time'
              );
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
              res.end(Buffer.from(arrayBuf));
            } catch (e: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  error: e?.message || 'Error en proxy de Juicios Evaluativos Google Drive',
                })
              );
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
