/* Kids Seekho Web AI: Vercel server -> AI Gateway -> vision model. Android keeps native ML Kit. */
(function(){
  const isWeb=!window.cordova;
  if(!isWeb)return;
  const $=id=>document.getElementById(id);
  const speakText=(text,lang='hi-IN')=>{if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.78;u.pitch=1.12;speechSynthesis.speak(u)};
  const canvas=$('traceCanvas');
  function canvasImage(){return canvas.toDataURL('image/jpeg',.82)}
  function target(){const x=data[mode][index];if(mode==='english')return{target:x[0],language:'English'};if(mode==='numbers')return{target:x[0],language:'English number'};if(mode==='hindi')return{target:x[0],language:'Hindi'};if(mode==='shapes')return{target:x[1],language:'shape name'};return null}
  async function onlineHandwriting(){
    if(checking)return;if(points.length<12){if(points.length){$('hint').textContent='✍️ अक्षर पूरा करके उंगली हटाओ…'}return}
    checking=true;$('aiStatus').textContent='🤖 AI: ऑनलाइन AI लिखावट जाँच रहा है…';$('hint').textContent='🤖 AI खुद जाँच कर रहा है…';
    try{
      const t=target();const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'handwriting',target:t.target,language:t.language,image:canvasImage()})});
      const out=await r.json();if(!r.ok)throw new Error(out.error||'Online AI error');
      const ok=out.correct===true && norm(out.recognized)===norm(t.target);
      if(ok){$('hint').textContent='⭐ ऑनलाइन AI ने सही पहचाना!';showReward();rewardSound();let done=completedFor(mode);if(!done.includes(index)){done.push(index);localStorage.setItem(`kids-seekho-${mode}`,JSON.stringify(done))}updateHomeProgress();speakText(mode==='hindi'?`${t.target} से ${data[mode][index][1]}`:`${t.target}`,'hi-IN');$('success').classList.add('show');$('success').setAttribute('aria-hidden','false');setTimeout(()=>{$('success').classList.remove('show');$('success').setAttribute('aria-hidden','true');checking=false;next()},1250)}
      else {const got=out.recognized||'कुछ नहीं';$('hint').textContent=`❌ AI ने “${got}” पहचाना। यहाँ “${t.target}” लिखना है।`;showError();errorSound();speakText('कोई बात नहीं। फिर से कोशिश करो।','hi-IN');checking=false}
    }catch(e){$('aiStatus').textContent='🤖 AI: ऑनलाइन AI उपलब्ध नहीं है';$('hint').textContent='⚠️ ऑनलाइन AI से कनेक्शन नहीं हुआ। इंटरनेट जाँचकर फिर लिखें।';showError();checking=false}
  }
  window.autoCheck=onlineHandwriting;
  const input=$('aiPhoto');
  if(input)input.addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    $('visionStatus').textContent='🤖 ऑनलाइन AI फोटो पहचान रहा है…';$('visionResult').innerHTML='';
    try{const fr=new FileReader();const image=await new Promise((res,rej)=>{fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)});const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'vision',image})});const out=await r.json();if(!r.ok)throw new Error(out.error||'AI error');const name=out.hindi||out.recognized||'कुछ';$('visionStatus').textContent='✅ ऑनलाइन AI ने पहचान लिया';$('visionResult').innerHTML=`<div class="vision-chip"><b>1. ${name}</b><small>${Math.round((Number(out.confidence)||.9)*100)}% भरोसा</small></div>`;speakText(`यह ${name} है।`)}catch(e){$('visionStatus').textContent='❌ ऑनलाइन AI पहचान नहीं कर पाया';speakText('माफ़ करना, मैं इसे पहचान नहीं पाया। साफ़ फोटो दिखाओ।')}});
  document.addEventListener('DOMContentLoaded',()=>{$('aiStatus').textContent='🤖 AI: ऑनलाइन AI तैयार है';});
})();
