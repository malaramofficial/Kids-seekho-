/* Browser-only handwriting AI. Android continues using native ML Kit in ai.js. */
(function(){
  if(window.cordova)return;
  const $=id=>document.getElementById(id),canvas=$('traceCanvas');
  const norm=s=>String(s||'').trim().replace(/[\s.,!?;:'"`\-_/\\]+/g,'').toUpperCase();
  const getTarget=()=>{const x=data[mode][index];if(mode==='english')return{target:x[0],language:'English'};if(mode==='numbers')return{target:x[0],language:'English number'};if(mode==='hindi')return{target:x[0],language:'Hindi'};if(mode==='shapes')return{target:x[1],language:'shape name'};return null};
  const speak=t=>{if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='hi-IN';u.rate=.78;u.pitch=1.12;speechSynthesis.speak(u)};
  async function checkOnline(){
    if(checking)return;if(points.length<12){if(points.length)$('hint').textContent='✍️ अक्षर पूरा करके उंगली हटाओ…';return}
    checking=true;$('aiStatus').textContent='🤖 AI: ऑनलाइन AI लिखावट जाँच रहा है…';$('hint').textContent='🤖 AI खुद जाँच कर रहा है…';
    try{
      const t=getTarget(),image=canvas.toDataURL('image/jpeg',.82);
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'handwriting',target:t.target,language:t.language,image})});
      const out=await response.json();if(!response.ok)throw new Error(out.error||'AI request failed');
      const correct=out.correct===true&&norm(out.recognized)===norm(t.target);
      if(!correct){$('hint').textContent=`❌ AI ने “${out.recognized||'कुछ नहीं'}” पहचाना। यहाँ “${t.target}” लिखना है।`;showError();errorSound();speak('कोई बात नहीं। फिर से कोशिश करो।');checking=false;return}
      let done=completedFor(mode);if(!done.includes(index)){done.push(index);localStorage.setItem(`kids-seekho-${mode}`,JSON.stringify(done))}
      $('hint').textContent='⭐ ऑनलाइन AI ने सही पहचान लिया!';showReward();rewardSound();updateHomeProgress();speak(mode==='hindi'?`${t.target} से ${data[mode][index][1]}`:`${t.target}`);$('success').classList.add('show');$('success').setAttribute('aria-hidden','false');
      setTimeout(()=>{$('success').classList.remove('show');$('success').setAttribute('aria-hidden','true');checking=false;next()},1250);
    }catch(e){$('aiStatus').textContent='🤖 AI: ऑनलाइन AI से कनेक्शन नहीं हुआ';$('hint').textContent='⚠️ इंटरनेट जाँचकर फिर कोशिश करें।';showError();checking=false}
  }
  window.autoCheck=checkOnline;
  document.addEventListener('DOMContentLoaded',()=>{const s=$('aiStatus');if(s)s.textContent='🤖 AI: ऑनलाइन AI तैयार है'});
})();
