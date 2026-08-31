export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let fileId = urlObj.searchParams.get('fileId') || '';
    const folderId = urlObj.searchParams.get('folderId') || '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y';
    const driveUrl = urlObj.searchParams.get('url') || '';

    const targetFolderId = folderId || (driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,})/)?.[1] || '1DqBcInloI9_V2P4g4LxJMum1F5ZDJJ0y');
    let discoveredFileName = 'PE-04_1.xml';

    // Escaneo dinámico de la carpeta oficial de Google Drive
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
          
          const decodeHex = (str) => {
            return str.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                      .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          };

          const decodedHtml = decodeHex(html);
          const fileRegex = /\["([a-zA-Z0-9_-]{25,50})",\["([^"]*)"\],"([^"]+)"/g;
          let match;
          const driveFiles = [];
          
          while ((match = fileRegex.exec(decodedHtml)) !== null) {
            if (match[1] !== targetFolderId && !match[1].startsWith('AIza') && !match[1].startsWith('ADFN')) {
              driveFiles.push({ id: match[1], name: match[3] });
            }
          }

          if (driveFiles.length > 0) {
            const preferred = driveFiles.find(f => /pe-?04|\.xml$|\.xlsx?$|\.csv$/i.test(f.name)) || driveFiles[0];
            if (preferred) {
              fileId = preferred.id;
              discoveredFileName = preferred.name;
            }
          }

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

    let arrayBuf = null;

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
      res.setHeader('Content-Type', 'application/json');
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
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Formación Complementaria Google Drive' }));
  }
}
