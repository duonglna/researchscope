// Netlify Function: Search proxy for arXiv + Semantic Scholar
// Solves CORS issues by proxying API calls through the backend

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { topic } = JSON.parse(event.body);
    if (!topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic required' }) };

    let arxivPapers = [];
    let semPapers = [];

    // Fetch arXiv
    try {
      const arxivQuery = encodeURIComponent(`all:${topic}`);
      const arxivUrl = `https://export.arxiv.org/api/query?search_query=${arxivQuery}&start=0&max_results=15&sortBy=relevance`;
      const resp = await fetch(arxivUrl);
      const xml = await resp.text();
      const entries = (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []);
      for (const entry of entries) {
        try {
          arxivPapers.push({
            title: ((entry.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'').replace(/\s+/g,' ').trim(),
            summary: ((entry.match(/<summary>([\s\S]*?)<\/summary>/)||[])[1]||'').replace(/\s+/g,' ').trim(),
            authors: [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map(m=>m[1].trim()),
            published: ((entry.match(/<published>([\s\S]*?)<\/published>/)||[])[1]||'').slice(0,4),
            link: (entry.match(/<link.*?href="([^"]*)"[^>]*\/>/)||[])[1]||'',
            source: 'arXiv'
          });
        } catch(e) {}
      }
    } catch(e) { console.warn('arXiv failed', e.message); }

    // Fetch Semantic Scholar
    try {
      const semUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=10&fields=title,authors,year,abstract,url,externalIds`;
      const resp = await fetch(semUrl);
      const data = await resp.json();
      semPapers = (data.data || []).map(p => ({
        title: p.title || '',
        summary: p.abstract || '',
        authors: (p.authors || []).map(a => a.name),
        published: String(p.year || ''),
        link: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
        source: 'Semantic Scholar'
      }));
    } catch(e) { console.warn('Semantic Scholar failed', e.message); }

    // Merge
    const seen = new Set();
    const merged = [];
    for (const p of [...arxivPapers, ...semPapers]) {
      const key = p.title.toLowerCase().slice(0,80);
      if (!seen.has(key) && p.summary) { seen.add(key); merged.push(p); }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ papers: merged.slice(0,25) }) };

  } catch (error) {
    console.error('Search error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
