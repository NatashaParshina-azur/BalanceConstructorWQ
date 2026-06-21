// Returns a single level screenshot (binary) from the private Unity repo.
// Called as /.netlify/functions/shot?file=<filename>. Uses GITHUB_TOKEN from Netlify env.
const OWNER = 'azur-games', REPO = 'wool-crush-clone', BRANCH = 'main', DIR = 'LevelScreenshots';
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

exports.handler = async (event) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { statusCode: 500, body: 'GITHUB_TOKEN env var is not set' };
  const file = ((event.queryStringParameters || {}).file || '').trim();
  if (!file || file.includes('..') || file.includes('/')) return { statusCode: 400, body: 'bad file' };
  const ext = (file.split('.').pop() || '').toLowerCase();
  const ct = TYPES[ext] || 'application/octet-stream';
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}/${encodeURIComponent(file)}?ref=${BRANCH}`;
    const resp = await fetch(url, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw', 'User-Agent': 'wq-balance' },
    });
    if (!resp.ok) return { statusCode: resp.status, body: 'not found' };
    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: { 'Content-Type': ct, 'Cache-Control': 'max-age=300', 'Access-Control-Allow-Origin': '*' },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
