// Netlify Function: Research Directions Generator
// Analyzes gaps in literature and suggests research directions + paper writing roadmap

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

  try {
    const { topic, papers, review } = JSON.parse(event.body);
    if (!topic || !papers) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic and papers required' }) };

    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 501, headers, body: JSON.stringify({ error: 'No LLM API key configured', fallback: true }) };

    const papersText = papers.map((p,i) => `Paper ${i+1}: "${p.title}" (${p.year}) - ${(p.summary||'').slice(0,300)}`).join('\n');

    const prompt = `You are a research advisor. Based on this literature review and papers, suggest specific research directions and a paper writing roadmap.

TOPIC: ${topic}

KEY PAPERS:
${papersText}

LITERATURE REVIEW SUMMARY:
${(review||'').slice(0,2000)}

Please provide:
1. 4 specific research directions with:
   - Title
   - Gap being addressed
   - Proposed approach
   - Novelty factor
   - Difficulty level
   - Timeline estimate

2. A 12-week paper writing roadmap with 5 phases

Format in Markdown with ## and ### headings. Use 🎯 for directions and 📝 for the roadmap.`;

    const url = process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      })
    });
    const data = await resp.json();
    const directions = data.choices?.[0]?.message?.content || 'Error generating directions';

    return { statusCode: 200, headers, body: JSON.stringify({ directions }) };

  } catch (error) {
    console.error('Research directions error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, fallback: true }) };
  }
};
