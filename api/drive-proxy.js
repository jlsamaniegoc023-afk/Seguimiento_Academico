export default async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
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
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Error descargando archivo de Google Drive' }));
      return;
    }
    const xmlText = await response.text();
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.end(xmlText);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e?.message || 'Error en proxy de Google Drive' }));
  }
}
