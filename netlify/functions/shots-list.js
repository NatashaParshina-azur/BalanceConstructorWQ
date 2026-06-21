// Lists screenshots in the private Unity repo's LevelScreenshots folder.
// Returns JSON { "<basename>": "<filename>", ... }. Uses GITHUB_TOKEN from Netlify env.
const OWNER = 'azur-games', REPO = 'wool-crush-clone';
const BRANCH = process.env.SCREENSHOTS_BRANCH || 'main';
const DIR = process.env.SCREENSHOTS_DIR || 'LevelScreenshots';

exports.handler = async () => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { statusCode: 500, body: 'GITHUB_TOKEN env var is not set' };
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${BRANCH}`;
    const resp = await fetch(url, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wq-balance' },
    });
    if (!resp.ok) return { statusCode: resp.status, body: `GitHub list error: ${resp.status}` };
    const arr = await resp.json();
    const map = {};
    if (Array.isArray(arr)) {
      for (const it of arr) {
        if (it.type !== 'file') continue;
        const m = it.name.match(/^(.*)\.(png|jpe?g|webp|gif)$/i);
        if (m) map[m[1]] = it.name;   // basename (без расширения) → имя файла
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=120', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(map),
    };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
};
