/**
 * API Proxy para sincronizar y descargar dinámicamente el archivo XML de la carpeta de Google Drive.
 * Carpeta oficial DF14: https://drive.google.com/drive/folders/1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK?usp=sharing
 */

export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const folderIdParam = urlObj.searchParams.get('folderId') || '';
    const fileIdParam = urlObj.searchParams.get('fileId') || '';
    const driveUrl = urlObj.searchParams.get('url') || '';
    const checkInfoOnly = urlObj.searchParams.get('info') === 'true' || urlObj.searchParams.get('action') === 'info';

    // Carpeta DF14 por defecto
    const DEFAULT_FOLDER_ID = '1khmfgzE-GFmlWZvtGlaBXfoyh8LJgiTK';
    const targetFolderId = folderIdParam || (driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,})/)?.[1] || DEFAULT_FOLDER_ID);

    let fileId = fileIdParam;
    let discoveredFileName = 'DF-14A_1.xml';
    let driveModifiedIso = '';
    let driveFiles = [];

    // Si no se proporcionó un fileId directo, o si el fileId recibido es el ID de la carpeta, escaneamos dinámicamente la carpeta
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

          // Decodificar secuencias de escape hexadecimales y unicode (\x22, \u0022, etc.)
          const decodeEscapes = (str) => {
            return str
              .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          };

          const decodedHtml = decodeEscapes(html);

          // Patrón oficial de archivos en Google Drive: ["ID_ARCHIVO",["ID_CARPETA"],"NOMBRE_ARCHIVO"
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
            // Priorizar archivos con extensión .xml o con "df" o "ficha" en el nombre
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

          // Si el regex principal no encontró archivos, buscar IDs candidatos y verificar con HEAD
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

    // Fallback si por alguna razón Google Drive bloquea el HTML
    if (!fileId || fileId === targetFolderId) {
      fileId = '1CBCsLRu7T0ypYrUbrCc_afkLxjnS7-kQ'; // ID del archivo DF-14A_1.xml verificado en la carpeta
    }

    // Si sólo se pidió información del archivo detectado
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

    // Descargar el archivo XML
    let xmlContent = null;

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
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Google Drive DF14' }));
  }
}
