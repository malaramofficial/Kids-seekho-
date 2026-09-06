export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI_GATEWAY_API_KEY is not configured on the server.' });
  try {
    const { type, target, language, image } = req.body || {};
    if (!type || !image) return res.status(400).json({ error: 'type and image are required' });
    if (typeof image !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(image) || image.length > 1800000) {
      return res.status(400).json({ error: 'Valid image data is required (max 1.8 MB).' });
    }
    if (type !== 'handwriting' && type !== 'vision') return res.status(400).json({ error: 'Unknown AI request type.' });
    if (type === 'handwriting' && !String(target || '').trim()) return res.status(400).json({ error: 'Handwriting target is required.' });

    const system = type === 'handwriting'
      ? 'You are a careful handwriting teacher for a 2-year-old. Inspect the image. The child was asked to write exactly the target character. Ignore printed/faint guide marks and judge only the child dark/colored strokes. Allow messy toddler handwriting, but reject a clearly different character. Return ONLY valid JSON: {"correct":true|false,"recognized":"short recognized text","confidence":0-1,"feedback":"short Hindi feedback"}. Never invent a match.'
      : 'You are a visual learning assistant for a 2-year-old. Identify the most visible everyday object, animal, plant, food, vehicle, or place. Return ONLY valid JSON: {"recognized":"English label","hindi":"simple Hindi name","confidence":0-1,"feedback":"short Hindi sentence"}.';
    const user = type === 'handwriting'
      ? `Target character: ${String(target).slice(0,80)}. Language: ${String(language || 'English').slice(0,40)}. Judge only the child strokes.`
      : 'Identify the main visible subject and give a simple common Hindi name.';
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', temperature: 0, max_tokens: 180,
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
    if (!response.ok) return res.status(502).json({ error: `AI gateway error ${response.status}` });
    const data = JSON.parse(raw);
    const content = data?.choices?.[0]?.message?.content || '';
    const cleaned = String(content).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    let result;
    try { result = JSON.parse(cleaned); } catch { return res.status(502).json({ error: 'AI returned an unreadable result.' }); }
    if (type === 'handwriting') {
      return res.status(200).json({
        correct: result.correct === true,
        recognized: String(result.recognized || '').slice(0,80),
        confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
        feedback: String(result.feedback || '').slice(0,240)
      });
    }
    return res.status(200).json({
      recognized: String(result.recognized || '').slice(0,80),
      hindi: String(result.hindi || '').slice(0,80),
      confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0)),
      feedback: String(result.feedback || '').slice(0,240)
    });
  } catch (e) {
    return res.status(500).json({ error: 'Online AI request failed.' });
  }
}
