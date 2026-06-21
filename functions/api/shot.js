// Cloudflare Pages Function — returns one level screenshot (binary) from the private Unity repo.
// Route: /api/shot?file=<filename>
const OWNER = 'azur-games', REPO = 'wool-crush-clone';
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export async function onRequest(context) {
  const env = context.env;
  const token = env.GITHUB_TOKEN;
  if (!token) return new Response('GITHUB_TOKEN env var is not set', { status: 500 });
  const branch = env.SCREENSHOTS_BRANCH || 'main';
  const dir = env.SCREENSHOTS_DIR || 'LevelScreenshots';
  const url = new URL(context.request.url);
  const file = (url.searchParams.get('file') || '').trim();
  if (!file || file.includes('..') || file.includes('/')) return new Response('bad file', { status: 400 });
  const ext = (file.split('.').pop() || '').toLowerCase();
  const ct = TYPES[ext] || 'application/octet-stream';
  try {
    const resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${dir}/${encodeURIComponent(file)}?ref=${branch}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw', 'User-Agent': 'wq-balance' },
    });
    if (!resp.ok) return new Response('not found', { status: resp.status });
    const buf = await resp.arrayBuffer();
    return new Response(buf, { status: 200, headers: { 'Content-Type': ct, 'Cache-Control': 'max-age=300', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
