// Cloudflare Pages Function — list level screenshots in the private Unity repo.
// Route: /api/shots-list  → JSON { "<basename>": "<filename>", ... }
const OWNER = 'azur-games', REPO = 'wool-crush-clone';

export async function onRequest(context) {
  const env = context.env || {};
  const token = env.GITHUB_TOKEN;
  if (!token) return new Response('GITHUB_TOKEN env var is not set. Vars the function sees: ' + JSON.stringify(Object.keys(env)), { status: 500 });
  const branch = env.SCREENSHOTS_BRANCH || 'main';
  const dir = env.SCREENSHOTS_DIR || 'LevelScreenshots';
  try {
    const resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${dir}?ref=${branch}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wq-balance' },
    });
    if (!resp.ok) return new Response(`GitHub list error: ${resp.status}`, { status: resp.status });
    const arr = await resp.json();
    const map = {};
    if (Array.isArray(arr)) {
      for (const it of arr) {
        if (it.type !== 'file') continue;
        const m = it.name.match(/^(.*)\.(png|jpe?g|webp|gif)$/i);
        if (m) map[m[1]] = it.name;
      }
    }
    return new Response(JSON.stringify(map), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120', 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
}
