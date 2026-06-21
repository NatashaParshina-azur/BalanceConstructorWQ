// Cloudflare Pages Function — Google Sheets CSV proxy (bypasses browser CORS).
// Route: /api/sheets?id=<sheetId>&sheet=<tabName>
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id = (url.searchParams.get('id') || '').trim();
  const sheet = (url.searchParams.get('sheet') || '').trim();
  if (!id) return new Response('Missing "id" parameter', { status: 400 });

  const urls = [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=${encodeURIComponent(sheet)}`,
  ];
  for (const u of urls) {
    try {
      const resp = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,text/plain,*/*' } });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (text && text.length > 10) {
        return new Response(text, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' } });
      }
    } catch (e) { /* try next */ }
  }
  return new Response('Could not fetch from Google Sheets — check the sheet is shared "anyone with link".', { status: 502 });
}
