// Cloudflare Pages Function — per-user personal workspace (draft / landmarks / targets / diff).
// Stored in the same KV namespace as funnels (binding: FUNNELS), under the "p:" prefix.
// No password — the user name IS the key. This is convenience sync, not security.
//   GET  /api/profile            → ["Наташа", "Коля", …]  (list of known users)
//   GET  /api/profile?user=NAME  → { draft, landmarks, targets, diff }  ({} if none)
//   POST /api/profile?user=NAME  {body} → store that user's workspace
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.FUNNELS;
  if (!kv) return J({ error: 'KV namespace "FUNNELS" is not bound' }, 500);
  const method = request.method;
  const user = (new URL(request.url).searchParams.get('user') || '').trim();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (method === 'GET') {
    if (!user) {
      const list = await kv.list({ prefix: 'p:' });
      return J(list.keys.map(k => k.name.slice(2)));
    }
    const raw = await kv.get('p:' + user);
    let obj = {};
    if (raw) { try { obj = JSON.parse(raw); } catch (e) {} }
    return J(obj);
  }

  if (method === 'POST') {
    if (!user) return J({ error: 'user required' }, 400);
    let body;
    try { body = await request.json(); } catch (e) { return J({ error: 'bad json' }, 400); }
    body = body || {};
    body.updatedAt = new Date().toISOString();
    await kv.put('p:' + user, JSON.stringify(body));
    return J({ ok: true, user });
  }

  return J({ error: 'method not allowed' }, 405);
}
