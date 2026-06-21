// Cloudflare Pages Function — shared saved funnels, stored in KV (binding: FUNNELS).
// GET  /api/funnels         → array of funnel objects
// POST /api/funnels  {body} → upsert one funnel (must have .id)
// DELETE /api/funnels?id=ID → remove one
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.FUNNELS;
  if (!kv) return J({ error: 'KV namespace "FUNNELS" is not bound' }, 500);
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (method === 'GET') {
    const list = await kv.list({ prefix: 'f:' });
    const items = await Promise.all(list.keys.map(k => kv.get(k.name)));
    const funnels = items.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
    return J(funnels);
  }

  if (method === 'POST') {
    let f;
    try { f = await request.json(); } catch (e) { return J({ error: 'bad json' }, 400); }
    if (!f || !f.id) return J({ error: 'funnel must have an id' }, 400);
    await kv.put('f:' + f.id, JSON.stringify(f));
    return J({ ok: true, id: f.id });
  }

  if (method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (id) await kv.delete('f:' + id);
    return J({ ok: true });
  }

  return J({ error: 'method not allowed' }, 405);
}
