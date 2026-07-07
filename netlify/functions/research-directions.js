// Netlify Function: Research Directions Generator
// Analyzes literature review + papers to suggest research directions and paper writing steps

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
    const { topic, papers, review } = JSON.parse(event.body);
    
    if (!topic || !papers || papers.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic and papers are required' }) };
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!deepseekKey && !openaiKey) {
      return { 
        statusCode: 501, 
        headers, 
        body: JSON.stringify({ 
          error: 'No LLM API key configured.',
          fallback: true
        }) 
      };
    }

    const papersText = papers.map((p, i) => 
      `Paper ${i+1}: "${p.title}" by ${(p.authors||[]).slice(0,3).join(', ')} (${p.year})\nAbstract: ${p.summary}`
    ).join('\n\n');

    const reviewContext = review ? `\n\nLITERATURE REVIEW ALREADY GENERATED:\n${review}` : '';

    const prompt = `You are a senior research advisor helping a graduate student plan their next research paper. Based on the following research topic, paper abstracts, and literature review analysis, provide actionable research directions and a concrete paper writing roadmap.

TOPIC: ${topic}

PAPERS ANALYZED:
${papersText}
${reviewContext}

Please provide TWO sections in Markdown:

## 🎯 Research Directions

Suggest 3-5 specific, novel research directions that could become a publishable paper. For each direction:
- **Title**: A potential paper title
- **Gap**: What gap in the current literature this addresses
- **Approach**: Suggested methodology (2-3 sentences)
- **Novelty**: What makes this different from existing work
- **Difficulty**: Easy / Medium / Hard
- **Estimated timeline**: How long to complete

Prioritize directions that are:
1. Novel (not just incremental improvements)
2. Feasible for a graduate student
3. Have clear evaluation metrics
4. Address real gaps identified in the literature

## 📝 Paper Writing Roadmap

Provide a step-by-step guide for writing a research paper based on the analyzed literature:

### Phase 1: Preparation (Week 1-2)
- Literature deep-dive (specific papers to read, what to look for)
- Research question formulation
- Hypothesis development

### Phase 2: Methodology (Week 3-4)
- Experiment design
- Dataset selection/creation
- Baseline models to compare against

### Phase 3: Execution (Week 5-8)
- Implementation plan
- Experiment timeline
- Expected results and fallback plans

### Phase 4: Writing (Week 9-11)
- Paper structure (Introduction → Related Work → Method → Experiments → Conclusion)
- Key figures and tables to include
- Target venues (conferences/journals) with deadlines

### Phase 5: Submission (Week 12)
- Final review checklist
- Common rejection reasons to avoid
- Rebuttal preparation tips

Be specific and reference the actual papers analyzed. Make suggestions actionable and concrete.`;

    let result;
    if (openaiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.7
        })
      });
      const data = await resp.json();
      result = data.choices?.[0]?.message?.content || 'Error generating directions';
    } else if (deepseekKey) {
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 3000,
          temperature: 0.7
        })
      });
      const data = await resp.json();
      result = data.choices?.[0]?.message?.content || 'Error generating directions';
    }

    return { statusCode: 200, headers, body: JSON.stringify({ directions: result }) };

  } catch (error) {
    console.error('Research directions error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: error.message, fallback: true })
    };
  }
};
