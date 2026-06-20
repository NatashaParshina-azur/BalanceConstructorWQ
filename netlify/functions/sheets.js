// Serverless proxy to Google Sheets CSV — replaces the local server.py proxy on Netlify.
// The browser can't fetch docs.google.com directly (no CORS headers); this function does it
// server-side and returns the CSV with Access-Control-Allow-Origin: *.
//
// Called from the app as:  /.netlify/functions/sheets?id=<sheetId>&sheet=<tabName>
exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const id = (params.id || '').trim();
  const sheet = (params.sheet || '').trim();
  if (!id) return { statusCode: 400, body: 'Missing "id" parameter' };

  // Same two endpoints server.py tries, in order: gviz CSV, then export CSV.
  const urls = [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=${encodeURIComponent(sheet)}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'text/csv,text/plain,*/*',
        },
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (text && text.length > 10) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
          body: text,
        };
      }
    } catch (e) {
      // try the next URL
    }
  }

  return { statusCode: 502, body: 'Could not fetch from Google Sheets — check that the sheet is shared "anyone with link".' };
};
