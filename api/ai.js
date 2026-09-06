export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI_GATEWAY_API_KEY is not configured on the server.' });
  try {
    const { type, target, language, image } = req.body || {};
    if (!type || !image) return res.status(400).json({ error: 'type and image are required' });
    const system = type === 'handwriting'
      ? 'You are a careful handwriting teacher for a 2-year-old. Inspect the provided image. The child was asked to write exactly the target character. Ignore the printed/faint guide character and judge only the child\'s dark/colored strokes. Return ONLY valid JSON: {"correct":true|false,"recognized":"...","feedback":"short Hindi feedback"}. Be strict: do not mark a different character as correct.'
      : 'You are a visual learning assistant for a 2-year-old. Identify the most visible object in the image. Return ONLY valid JSON: {"recognized":"English label","hindi":"simple Hindi name","confidence":0-1,"feedback":"short Hindi sentence"}.';
    const user = type === 'handwriting'
      ? `Target character: ${target}. Language: ${language || 'English'}. Judge the child strokes in the image.`
      : 'Identify the main object and give a simple child-friendly Hindi name.';
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0,
        max_tokens: 180,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: image } }
          ] }
        ]
      })
    });
    const raw = await response.text();
    if (!response.ok) return res.status(502).json({ error: `AI gateway error ${response.status}`, detail: raw.slice(0, 500) });
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    let result;
    try { result = JSON.parse(cleaned); } catch { result = { recognized: content, correct: false, feedback: 'AI का उत्तर समझ नहीं आया। फिर से कोशिश करो।' }; }
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Online AI request failed', detail: String(e?.message || e) });
  }
}
