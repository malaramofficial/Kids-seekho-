/* Kids Seekho AI handwriting gate.
   Native Android builds use Google ML Kit Digital Ink Recognition.
   The existing guide-mask check remains as the second safety gate. */
(function(){
  let aiStrokes=[], aiCurrent=null, aiBusy=false, lastAI=null;
  const aiOriginalClear=clearTrace;

  function aiPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:Date.now()}}
  function aiDown(e){if(!aiCurrent)aiCurrent=[];const p=aiPos(e);aiCurrent.push(p);aiStrokes.push({points:aiCurrent});}
  function aiMove(e){if(!aiCurrent)return;aiCurrent.push(aiPos(e));}
  function aiUp(){aiCurrent=null;}
  canvas.addEventListener('pointerdown',aiDown,{passive:true});
  canvas.addEventListener('pointermove',aiMove,{passive:true});
  window.addEventListener('pointerup',aiUp,{passive:true});
  $('clearBtn').addEventListener('click',()=>{aiStrokes=[];aiCurrent=null;lastAI=null;updateDebug()});

  clearTrace=function(){aiOriginalClear();aiStrokes=[];aiCurrent=null;lastAI=null;updateDebug();};

  function targetForAI(){
    const x=data[mode][index];
    if(mode==='english')return {tag:'en-US',target:String(x[0]).toUpperCase()};
    if(mode==='numbers')return {tag:'en-US',target:String(x[0]),word:String(x[1]).slice(String(x[0]).length+1).toLowerCase()};
    if(mode==='hindi')return {tag:'hi-IN',target:String(x[0])};
    return null;
  }
  function normalize(s){return String(s||'').trim().replace(/[\s.,!?;:'"`\-_/\\]+/g,'').toUpperCase()}
  function numberMatch(candidate,target,word){
    const c=normalize(candidate),t=normalize(target);
    if(c===t)return true;
    return !!word && c===normalize(word);
  }
  function setHint(text){$('hint').textContent=text}
  function aiFailure(message){
    setHint(message||'❌ यह अक्षर सही नहीं है। फिर से कोशिश करो।');
    showError();errorSound();
    setTimeout(()=>speak('कोई बात नहीं। फिर से कोशिश करो।','hi-IN',.78),180);
    aiBusy=false;checking=false;updateDebug();
  }
  function aiSuccess(){
    let done=completedFor(mode);
    if(!done.includes(index)){done.push(index);localStorage.setItem(`kids-seekho-${mode}`,JSON.stringify(done))}
    setHint('⭐ शाबाश! AI ने भी सही अक्षर पहचाना।');showReward();rewardSound();
    setTimeout(()=>speak(mode==='hindi'?'बहुत बढ़िया! तुमने बहुत अच्छा लिखा।':'Great job! You did it!','en-US',.82),250);
    updateHomeProgress();
    $('success').classList.add('show');$('success').setAttribute('aria-hidden','false');
    setTimeout(()=>{$('success').classList.remove('show');$('success').setAttribute('aria-hidden','true');aiBusy=false;checking=false;next()},1200);
  }
  function recognizeWithAI(){
    const cfg=targetForAI();
    if(!cfg)return Promise.resolve({available:false,reason:'shape'});
    if(!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.recognize!=='function')return Promise.resolve({available:false,reason:'plugin'});
    const strokes=aiStrokes.filter(s=>s.points&&s.points.length>0).map(s=>({points:s.points.map(p=>({x:p.x,y:p.y,t:p.t}))}));
    if(!strokes.length)return Promise.resolve({available:true,error:'no-strokes'});
    const r=canvas.getBoundingClientRect();
    return new Promise(resolve=>{
      window.KidsSeekhoAI.recognize(strokes,cfg.tag,r.width,r.height,
        result=>resolve({available:true,result:result||{}}),
        error=>resolve({available:true,error:String(error||'AI recognition failed')}));
    });
  }

  autoCheck=async function(){
    if(aiBusy)return;
    if(points.length<30){if(points.length>0){setHint('✍️ अक्षर पूरा करके उंगली हटाओ…');errorSound()}return}
    clearTimeout(autoTimer);aiBusy=true;checking=true;
    const cfg=targetForAI();
    const s=traceScore();
    if(s.hit<.45||s.coverage<.20){aiFailure('❌ अक्षर सही रास्ते पर नहीं लिखा। हल्के अक्षर के ऊपर उंगली चलाओ।');return}
    if(!cfg){aiSuccess();return}
    setHint('🤖 AI अक्षर पहचान रहा है…');
    const ai=await recognizeWithAI();
    if(ai.available&&ai.error){
      lastAI={target:cfg.target,ai:'ERROR',candidates:[],guide:s,detail:ai.error};
      updateDebug();
      aiFailure('📶 पहली बार AI तैयार करने के लिए इंटरनेट चाहिए। फिर से कोशिश करो।');
      return;
    }
    if(ai.available){
      const candidates=Array.isArray(ai.result.candidates)?ai.result.candidates:[];
      const top=ai.result.text||candidates[0]||'';
      const identityOK=mode==='numbers'?numberMatch(top,cfg.target,cfg.word):normalize(top)===normalize(cfg.target);
      lastAI={target:cfg.target,ai:top,candidates,guide:s,detail:'ML Kit'};updateDebug();
      if(!identityOK){aiFailure(`❌ AI ने “${top||'कुछ नहीं'}” पहचाना। यहाँ “${cfg.target}” लिखना है।`);return}
      aiSuccess();return;
    }
    // Browser/PWA fallback: keep the guide check, but Android APK uses AI.
    if(s.hit>=.60&&s.coverage>=.28){lastAI={target:cfg.target,ai:'fallback',candidates:[],guide:s,detail:'guide-only'};updateDebug();aiSuccess()}
    else aiFailure('❌ अक्षर सही नहीं बना। फिर से कोशिश करो।');
  };

  // Parent/QA verification panel: tap the Kids Seekho title 7 times.
  let taps=0,tapTimer=null;
  const brand=document.querySelector('.brand');
  if(brand){brand.addEventListener('click',()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,1800);if(taps>=7){taps=0;document.body.classList.toggle('ai-debug');localStorage.setItem('kids-seekho-ai-debug',document.body.classList.contains('ai-debug')?'1':'0');updateDebug()}})}
  function updateDebug(){
    if(!document.body.classList.contains('ai-debug'))return;
    let box=$('aiDebug');if(!box){box=document.createElement('div');box.id='aiDebug';box.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#111;color:#fff;padding:10px;border-radius:12px;font:12px/1.35 monospace;box-shadow:0 4px 18px #0008';document.body.appendChild(box)}
    const g=lastAI&&lastAI.guide?`hit=${lastAI.guide.hit.toFixed(2)} coverage=${lastAI.guide.coverage.toFixed(2)}`:'—';
    box.innerHTML=`<b>AI TEST</b><br>Target: ${lastAI?lastAI.target:data[mode][index][0]}<br>AI: ${lastAI?lastAI.ai:'—'}<br>Candidates: ${lastAI&&lastAI.candidates?lastAI.candidates.join(' | '):'—'}<br>Guide: ${g}<br>Source: ${lastAI?lastAI.detail:'—'}<br><small>A→B लिखकर देखें: PASS नहीं होना चाहिए.</small>`;
  }
  if(localStorage.getItem('kids-seekho-ai-debug')==='1')document.body.classList.add('ai-debug');
  updateDebug();
})();
