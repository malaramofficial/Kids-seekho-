export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {text,language='hi-IN'}=req.body||{};
  if(!text||typeof text!=='string'||text.length>300)return res.status(400).json({error:'Invalid text'});
  const key=process.env.ELEVENLABS_API_KEY;
  const voice=process.env.ELEVENLABS_VOICE_ID;
  if(!key||!voice)return res.status(503).json({error:'AI voice is not configured'});
  try{
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.38,similarity_boost:.78,style:.65,use_speaker_boost:true}})});
    if(!r.ok)return res.status(502).json({error:'Voice provider error'});
    const buf=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return res.status(200).send(buf);
  }catch(e){return res.status(500).json({error:'Voice generation failed'});}
}