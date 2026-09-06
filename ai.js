/* Kids Seekho strict handwriting AI gate.
   Android: Google ML Kit Digital Ink Recognition + guide-mask safety gate.
   IMPORTANT: native Android builds NEVER fall back to guide-only acceptance.
*/
(function(){
  let aiStrokes=[], aiCurrent=null, aiBusy=false, lastAI=null;
  let nativeAI=false, nativeReady=false, nativeStatus='ब्रिज का इंतज़ार…', preparing={};
  const aiOriginalClear=clearTrace;

  function statusText(t){
    nativeStatus=t;
    const el=$('aiStatus');
    if(el)el.textContent='🤖 AI: '+t;
    updateDebug();
  }
  function isNative(){return nativeAI || !!window.cordova;}
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
  function numberMatch(candidate,target,word){const c=normalize(candidate),t=normalize(target);return c===t||!!word&&c===normalize(word)}
  function setHint(text){$('hint').textContent=text}
  function aiFailure(message){
    setHint(message||'❌ यह अक्षर सही नहीं है। फिर से कोशिश करो।');showError();errorSound();
    setTimeout(()=>speak('कोई बात नहीं। फिर से कोशिश करो।','hi-IN',.78),180);
    aiBusy=false;checking=false;updateDebug();
  }
  function aiSuccess(){
    let done=completedFor(mode);if(!done.includes(index)){done.push(index);localStorage.setItem(`kids-seekho-${mode}`,JSON.stringify(done))}
    setHint('⭐ शाबाश! AI ने सही अक्षर पहचाना।');showReward();rewardSound();
    setTimeout(()=>speak(mode==='hindi'?'बहुत बढ़िया! तुमने बहुत अच्छा लिखा।':'Great job! You did it!','en-US',.82),250);
    updateHomeProgress();$('success').classList.add('show');$('success').setAttribute('aria-hidden','false');
    setTimeout(()=>{$('success').classList.remove('show');$('success').setAttribute('aria-hidden','true');aiBusy=false;checking=false;next()},1200);
  }

  function prepareModel(tag){
    if(!isNative()||!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.prepare!=='function')return Promise.reject(new Error('native AI bridge unavailable'));
    if(preparing[tag])return preparing[tag];
    statusText('AI मॉडल डाउनलोड/तैयार हो रहा है…');
    preparing[tag]=new Promise((resolve,reject)=>{
      window.KidsSeekhoAI.prepare(tag,
        result=>{delete preparing[tag];nativeReady=true;statusText('तैयार ✓');resolve(result||{});},
        error=>{delete preparing[tag];nativeReady=false;statusText('मॉडल डाउनलोड नहीं हुआ');reject(new Error(String(error||'model preparation failed')))}
      );
    });
    return preparing[tag];
  }

  function recognizeNative(cfg){
    const strokes=aiStrokes.filter(s=>s.points&&s.points.length>0).map(s=>({points:s.points.map(p=>({x:p.x,y:p.y,t:p.t}))}));
    if(!strokes.length)return Promise.reject(new Error('No handwriting strokes'));
    if(!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.recognize!=='function')return Promise.reject(new Error('AI bridge unavailable'));
    const r=canvas.getBoundingClientRect();
    return new Promise((resolve,reject)=>window.KidsSeekhoAI.recognize(strokes,cfg.tag,r.width,r.height,
      result=>resolve(result||{}),error=>reject(new Error(String(error||'AI recognition failed')))));
  }

  function recognizeWithAI(){
    const cfg=targetForAI();
    if(!cfg)return Promise.resolve({shape:true});
    if(!isNative())return Promise.resolve({browser:true,cfg});
    if(!window.KidsSeekhoAI)return Promise.reject(new Error('native AI plugin is not loaded'));
    return prepareModel(cfg.tag).then(()=>recognizeNative(cfg).then(result=>({native:true,result,cfg})));
  }

  autoCheck=async function(){
    if(aiBusy)return;
    if(points.length<30){if(points.length>0){setHint('✍️ अक्षर पूरा करके उंगली हटाओ…');errorSound()}return}
    clearTimeout(autoTimer);aiBusy=true;checking=true;
    const cfg=targetForAI();
    const s=traceScore();
    if(s.hit<.45||s.coverage<.20){aiFailure('❌ अक्षर सही रास्ते पर नहीं लिखा। हल्के अक्षर के ऊपर उंगली चलाओ।');return}

    // Shapes have no handwriting text model; they keep the geometric/guide gate.
    if(!cfg){if(s.hit>=.60&&s.coverage>=.28)aiSuccess();else aiFailure('❌ आकार सही नहीं बना। फिर से कोशिश करो।');return}

    if(isNative() && !nativeReady){statusText('AI मॉडल तैयार नहीं है');}
    setHint(isNative()?'🤖 AI अक्षर की जाँच कर रहा है…':'✍️ अक्षर की जाँच हो रही है…');

    try{
      const ai=await recognizeWithAI();
      if(ai.browser){
        // Browser/PWA only: no native AI exists. This is intentionally separate from APK.
        if(s.hit>=.60&&s.coverage>=.28){lastAI={target:cfg.target,ai:'browser-guide',candidates:[],guide:s,detail:'PWA guide-only'};updateDebug();aiSuccess()}
        else aiFailure('❌ अक्षर सही नहीं बना। फिर से कोशिश करो।');
        return;
      }
      const result=ai.result||{};
      const candidates=Array.isArray(result.candidates)?result.candidates:[];
      const top=result.text||candidates[0]||'';
      const identityOK=mode==='numbers'?numberMatch(top,cfg.target,cfg.word):normalize(top)===normalize(cfg.target);
      lastAI={target:cfg.target,ai:top||'कुछ नहीं',candidates,guide:s,detail:'Google ML Kit Native'};updateDebug();
      if(!identityOK){aiFailure(`❌ AI ने “${top||'कुछ नहीं'}” पहचाना। यहाँ “${cfg.target}” लिखना है।`);return}
      // AI says it is the target, but the guide gate still must pass.
      if(s.hit<.60||s.coverage<.28){aiFailure('❌ AI ने अक्षर पहचाना, लेकिन लिखावट guide के अनुसार पूरी नहीं है। फिर से लिखो।');return}
      aiSuccess();
    }catch(e){
      lastAI={target:cfg.target,ai:'ERROR',candidates:[],guide:s,detail:String(e.message||e)};updateDebug();
      if(isNative())aiFailure('⚠️ AI अभी तैयार नहीं है। इंटरनेट चालू करके AI मॉडल डाउनलोड होने दें, फिर दोबारा लिखें।');
      else aiFailure('❌ अक्षर सही नहीं बना। फिर से कोशिश करो।');
    }
  };

  // Native Cordova bridge becomes available after deviceready. Preload English model so the
  // first A/B test cannot silently fall back to the old guide-only checker.
  document.addEventListener('deviceready',()=>{
    nativeAI=true;statusText('मॉडल जाँच रहा है…');
    if(window.KidsSeekhoAI&&typeof window.KidsSeekhoAI.isAvailable==='function'){
      window.KidsSeekhoAI.isAvailable(()=>{
        nativeReady=false;prepareModel('en-US').catch(()=>{});
      },()=>statusText('AI plugin उपलब्ध नहीं है'));
    }else statusText('AI plugin उपलब्ध नहीं है');
  },false);

  // Parent/QA panel: tap the Kids Seekho title 7 times.
  let taps=0,tapTimer=null;const brand=document.querySelector('.brand');
  if(brand){brand.addEventListener('click',()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,1800);if(taps>=7){taps=0;document.body.classList.toggle('ai-debug');localStorage.setItem('kids-seekho-ai-debug',document.body.classList.contains('ai-debug')?'1':'0');updateDebug()}})}
  function updateDebug(){
    if(!document.body.classList.contains('ai-debug'))return;
    let box=$('aiDebug');if(!box){box=document.createElement('div');box.id='aiDebug';box.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#111;color:#fff;padding:10px;border-radius:12px;font:12px/1.35 monospace;box-shadow:0 4px 18px #0008';document.body.appendChild(box)}
    const g=lastAI&&lastAI.guide?`hit=${lastAI.guide.hit.toFixed(2)} coverage=${lastAI.guide.coverage.toFixed(2)}`:'—';
    const target=data[mode]&&data[mode][index]?data[mode][index][0]:'—';
    box.innerHTML=`<b>AI TEST PANEL</b><br>Native: ${isNative()?'YES':'NO'}<br>Status: ${nativeStatus}<br>Target: ${lastAI?lastAI.target:target}<br>AI: ${lastAI?lastAI.ai:'—'}<br>Candidates: ${lastAI&&lastAI.candidates?lastAI.candidates.join(' | '):'—'}<br>Guide: ${g}<br>Source: ${lastAI?lastAI.detail:'—'}<br><small>Test: A lesson में B लिखो → PASS नहीं होना चाहिए.</small>`;
  }
  if(localStorage.getItem('kids-seekho-ai-debug')==='1')document.body.classList.add('ai-debug');
  updateDebug();
})();
