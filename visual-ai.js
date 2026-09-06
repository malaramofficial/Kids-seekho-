/* Kids Seekho Visual AI Lab: camera/photo -> native ML Kit image labeling -> child-friendly speech */
(function(){
  const input=()=>document.getElementById('aiPhoto');
  const resultEl=()=>document.getElementById('visionResult');
  const status=()=>document.getElementById('visionStatus');
  const speakHindi=(text)=>{try{if(window.TTS){window.TTS.speak({text,locale:'hi-IN',rate:.78});return}}catch(e){}if(window.speechSynthesis){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='hi-IN';u.rate=.78;u.pitch=1.12;speechSynthesis.speak(u)}};
  function friendly(label){const m={person:'इंसान',animal:'जानवर',dog:'कुत्ता',cat:'बिल्ली',bird:'पक्षी',tree:'पेड़',plant:'पौधा',flower:'फूल',chair:'कुर्सी',table:'मेज़',house:'घर',building:'इमारत',car:'कार',bus:'बस',bicycle:'साइकिल',fruit:'फल',food:'खाना',apple:'सेब',banana:'केला',orange:'संतरा',ball:'गेंद',book:'किताब',phone:'मोबाइल',cup:'कप',bottle:'बोतल',shoe:'जूता',hat:'टोपी'};return m[String(label).toLowerCase()]||label}
  function show(msg){if(status())status().textContent=msg}
  function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
  async function analyze(file){
    if(!file)return; show('🤖 AI फोटो को पहचान रहा है…'); if(resultEl())resultEl().innerHTML='';
    if(!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.labelImage!=='function'){show('⚠️ इस APK में Visual AI उपलब्ध नहीं है।');return}
    try{const b64=await fileToDataURL(file);window.KidsSeekhoAI.labelImage(b64,r=>{
      const labels=(r&&Array.isArray(r.labels)?r.labels:[]).sort((a,b)=>b.confidence-a.confidence);if(!labels.length){show('🤔 AI को साफ़ चीज़ नहीं मिली।');speakHindi('मुझे साफ़ चीज़ नहीं दिखी। फिर से फोटो दिखाओ।');return}
      const top=labels.slice(0,5);show('✅ AI ने पहचान लिया');if(resultEl())resultEl().innerHTML=top.map((x,i)=>`<div class="vision-chip"><b>${i+1}. ${friendly(x.label)}</b><small>${Math.round(x.confidence*100)}% भरोसा</small></div>`).join('');
      const names=top.slice(0,3).map(x=>friendly(x.label));speakHindi('यहाँ मुझे '+names.join(', ')+' दिखाई दे रहा है।');
    },e=>{show('❌ AI पहचान नहीं कर पाया');speakHindi('माफ़ करना, मैं इसे पहचान नहीं पाया। साफ़ फोटो दिखाओ।')});}
    catch(e){show('❌ फोटो पढ़ने में समस्या');}
  }
  document.addEventListener('DOMContentLoaded',()=>{const f=input();if(f)f.addEventListener('change',e=>analyze(e.target.files&&e.target.files[0]));const b=document.getElementById('aiSpeakResult');if(b)b.onclick=()=>{const txt=[...document.querySelectorAll('.vision-chip b')].map(x=>x.textContent.replace(/^\d+\.\s*/,''));if(txt.length)speakHindi('AI ने बताया: '+txt.join(', '))};});
})();
