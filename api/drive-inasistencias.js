export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const folderId = urlObj.searchParams.get('folderId') || '';
    let fileId = urlObj.searchParams.get('fileId') || '';
    const driveUrl = urlObj.searchParams.get('url') || '';

    if (folderId === '1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi' || driveUrl.includes('1tuyu3WsrxKsIkKtPesgeXLfPMS53uCbi')) {
      fileId = '1I2gsbdJgZJry4fsDgnp-rs2IB_LFEYF1';
    } else if (!fileId && folderId) {
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

    let arrayBuf = null;
    
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
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'No se pudo descargar el archivo de inasistencias desde Google Drive.' }));
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', arrayBuf.byteLength.toString());
    res.end(Buffer.from(arrayBuf));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e?.message || 'Error en proxy de inasistencias Google Drive' }));
  }
}
