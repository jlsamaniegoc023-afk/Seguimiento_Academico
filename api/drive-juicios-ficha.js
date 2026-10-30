/**
 * API Proxy para listar y descargar los archivos Excel de Reporte de Juicios Evaluativos por Ficha
 * desde la carpeta compartida de Google Drive:
 * https://drive.google.com/drive/folders/1jD0PQu1jlHKLgkngmo4Hogip3DA5g5t3?usp=sharing
 *
 * Regla de coincidencia:
 * Los archivos Excel cuyo nombre inicia con "Ficha" y contienen el número exacto de la ficha seleccionada.
 */

const DEFAULT_JUICIOS_FOLDER_ID = '1jD0PQu1jlHKLgkngmo4Hogip3DA5g5t3';

function decodeDriveEscapes(str) {
  return String(str || '')
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractFichaFromFileName(name) {
  const clean = String(name || '').trim();
  const mStart = clean.match(/^\s*ficha[\s._-]*(\d{4,12})(?:\D|$)/i);
  if (mStart) {
    return { ficha: mStart[1], startsWithFicha: true };
  }
  if (/^\s*ficha\b/i.test(clean)) {
    const mAny = clean.match(/(?:^|\D)(\d{5,12})(?:\D|$)/);
    if (mAny) {
      return { ficha: mAny[1], startsWithFicha: true };
    }
  }
  const mFallback = clean.match(/(?:^|\D)(\d{6,10})(?:\D|$)/);
  if (mFallback) {
    return { ficha: mFallback[1], startsWithFicha: false };
  }
  return { ficha: '', startsWithFicha: false };
}

async function scanDriveFolderFiles(folderId) {
  const byId = new Map();
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing&_t=${Date.now()}`;
    const res = await fetch(folderUrl, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const decoded = decodeDriveEscapes(await res.text());
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
          const parsed = extractFichaFromFileName(fName);
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
    console.warn('Advertencia escaneando HTML principal de Drive juicios evaluativos:', err);
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
      const embHtml = decodeDriveEscapes(await embRes.text());
      const entryRegex =
        /id="entry-([a-zA-Z0-9_-]{20,50})"[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
      let m;
      while ((m = entryRegex.exec(embHtml)) !== null) {
        const fId = m[1];
        const fName = m[2].trim();
        if (fId && fId !== folderId && !byId.has(fId)) {
          const parsed = extractFichaFromFileName(fName);
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
    console.warn('Advertencia escaneando embeddedfolderview de Drive juicios evaluativos:', err);
  }

  return Array.from(byId.values());
}

function matchFileForFicha(files, targetFicha) {
  const cleanFicha = String(targetFicha || '').trim();
  if (!cleanFicha) return null;

  const exactNumberRegex = new RegExp(
    `(?:^|\\D)${cleanFicha.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\D|$)`
  );

  const strictMatches = files.filter(
    (f) => /^\s*ficha\b/i.test(f.name) && (f.ficha === cleanFicha || exactNumberRegex.test(f.name))
  );
  if (strictMatches.length > 0) {
    return strictMatches.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))[0];
  }

  const fallbackMatches = files.filter(
    (f) => f.ficha === cleanFicha || exactNumberRegex.test(f.name)
  );
  if (fallbackMatches.length > 0) {
    return fallbackMatches.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))[0];
  }

  return null;
}

async function downloadDriveBinary(fileId) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  let arrayBuf = null;
  let fileName = '';
  let modifiedIso = '';

  try {
    const dlUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&_t=${Date.now()}`;
    const res = await fetch(dlUrl, {
      headers: {
        'User-Agent': ua,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (res.ok) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 256 && !ct.includes('text/html')) {
        arrayBuf = buf;
        const cd = res.headers.get('content-disposition') || '';
        const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        if (fnMatch && fnMatch[1]) {
          try {
            fileName = decodeURIComponent(fnMatch[1]);
          } catch {
            fileName = fnMatch[1];
          }
        }
        const lastMod = res.headers.get('last-modified');
        if (lastMod && !isNaN(Date.parse(lastMod))) {
          modifiedIso = new Date(lastMod).toISOString();
        }
      }
    }
  } catch (e) {
    console.warn('Fallo intento 1 juicios drive.usercontent:', e);
  }

  if (!arrayBuf) {
    try {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx&_t=${Date.now()}`;
      const res = await fetch(sheetUrl, { headers: { 'User-Agent': ua } });
      if (res.ok) {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 256 && !ct.includes('text/html')) {
          arrayBuf = buf;
        }
      }
    } catch (e) {
      console.warn('Fallo intento 2 juicios google sheets export:', e);
    }
  }

  if (!arrayBuf) {
    try {
      const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&_t=${Date.now()}`;
      const res = await fetch(ucUrl, { headers: { 'User-Agent': ua } });
      if (res.ok) {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 256 && !ct.includes('text/html')) {
          arrayBuf = buf;
        }
      }
    } catch (e) {
      console.warn('Fallo intento 3 juicios drive uc:', e);
    }
  }

  return { arrayBuf, fileName, modifiedIso };
}

export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const folderId = urlObj.searchParams.get('folderId') || DEFAULT_JUICIOS_FOLDER_ID;
    const action = urlObj.searchParams.get('action') || '';
    const fichaParam = (urlObj.searchParams.get('ficha') || '').trim();
    const fileId = (urlObj.searchParams.get('fileId') || '').trim();

    const files = await scanDriveFolderFiles(folderId);

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

    let matchedFile = null;
    if (fileId) {
      matchedFile = files.find((f) => f.id === fileId) || {
        id: fileId,
        name: `Ficha ${fichaParam || ''}.xls`,
        ficha: fichaParam,
        startsWithFicha: true,
        modifiedTime: '',
      };
    } else if (fichaParam) {
      matchedFile = matchFileForFicha(files, fichaParam);
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

    const { arrayBuf, fileName, modifiedIso } = await downloadDriveBinary(matchedFile.id);
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

    const finalName = matchedFile.name || fileName || `Ficha_${fichaParam}_Juicios.xls`;
    const finalModified = matchedFile.modifiedTime || modifiedIso || '';

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', arrayBuf.byteLength.toString());
    res.setHeader('X-Drive-File-Id', matchedFile.id);
    res.setHeader('X-Drive-File-Name', encodeURIComponent(finalName));
    res.setHeader('X-Drive-Folder-Id', folderId);
    res.setHeader('X-Drive-Matched-Ficha', matchedFile.ficha || fichaParam);
    if (finalModified) {
      res.setHeader('X-Drive-Modified-Time', finalModified);
    }
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Drive-File-Id, X-Drive-File-Name, X-Drive-Folder-Id, X-Drive-Matched-Ficha, X-Drive-Modified-Time'
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.end(Buffer.from(arrayBuf));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: e?.message || 'Error interno consultando la carpeta de Juicios Evaluativos en Google Drive.',
      })
    );
  }
}
