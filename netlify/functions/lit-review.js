// Netlify Function: Literature Review Generator
// Called when AI backend is configured. Falls back to client-side synthesis.

exports.handler = async (event) => {
  // CORS headers
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
    const { topic, papers } = JSON.parse(event.body);
    
    if (!topic || !papers || papers.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic and papers are required' }) };
    }

    // If no LLM API key configured, return 501 to trigger client-side fallback
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!deepseekKey && !openaiKey) {
      return { 
        statusCode: 501, 
        headers, 
        body: JSON.stringify({ 
          error: 'No LLM API key configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in Netlify env vars.',
          fallback: true
        }) 
      };
    }

    // Build prompt
    const papersText = papers.map((p, i) => 
      `Paper ${i+1}: "${p.title}" by ${(p.authors||[]).slice(0,3).join(', ')} (${p.year})\nAbstract: ${p.summary}`
    ).join('\n\n');

    const prompt = `You are a research assistant helping with literature review. Given the following research topic and paper abstracts, write a comprehensive literature review.

TOPIC: ${topic}

PAPERS FOUND:
${papersText}

Please write a structured literature review with these sections:
## 1. Overview & Research Landscape
## 2. Key Themes & Approaches
## 3. Methods & Techniques
## 4. Gaps & Future Directions
## 5. References

Format in Markdown. Be concise but thorough. Highlight connections between papers and identify research trends.`;

    let review;
    if (openaiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });
      const data = await resp.json();
      review = data.choices?.[0]?.message?.content || 'Error generating review';
    } else if (deepseekKey) {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });
      const data = await resp.json();
      review = data.choices?.[0]?.message?.content || 'Error generating review';
    }

    return { statusCode: 200, headers, body: JSON.stringify({ review }) };

  } catch (error) {
    console.error('Literature review error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: error.message, fallback: true }) 
    };
  }
};
