/* Kids Seekho handwriting AI: native Google ML Kit is the only Android decision-maker. */
(function(){
  let aiStrokes=[], currentStroke=null, busy=false, lastAI=null, native=false;
  let status='शुरू हो रहा है…', prep={};
  let modelTimer=null, modelDownloading=false;
  const $=id=>document.getElementById(id);
  const setStatus=t=>{status=t;const e=$('aiStatus');if(e)e.textContent='🤖 AI: '+t;debug()};
  const norm=s=>String(s||'').trim().replace(/[\s.,!?;:'"`\-_/\\]+/g,'').toUpperCase();
  const target=()=>{const x=data[mode][index];if(mode==='english')return{tag:'en-US',target:x[0]};if(mode==='numbers')return{tag:'en-US',target:x[0],word:x[1].slice(String(x[0]).length+1)};if(mode==='hindi')return{tag:'hi-IN',target:x[0]};if(mode==='shapes')return{tag:'en-US',target:x[1]};return null};
  const shapeSymbols={CIRCLE:'○',SQUARE:'□',TRIANGLE:'△',STAR:'☆',DIAMOND:'◇',HEART:'♥'};
  const matches=(r,t)=>{
    const candidates=[r&&r.text,...(r&&Array.isArray(r.candidates)?r.candidates:[])].filter(Boolean).map(norm);
    const wanted=norm(t.target);
    if(candidates.includes(wanted))return true;
    if(t.word&&candidates.includes(norm(t.word)))return true;
    const symbol=shapeSymbols[wanted];
    return !!symbol&&candidates.includes(norm(symbol));
  };
  const pos=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:Date.now()}};

  function begin(e){
    if(busy)return;
    e.preventDefault();
    try{if(canvas.setPointerCapture)e&&canvas.setPointerCapture(e.pointerId)}catch(_){ }
    currentStroke=[];
    const p=pos(e);currentStroke.push(p);aiStrokes.push({points:currentStroke});
  }
  function move(e){if(!currentStroke||busy)return;e.preventDefault();currentStroke.push(pos(e))}
  function finish(){currentStroke=null}
  canvas.addEventListener('pointerdown',begin,{passive:false});
  canvas.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',finish,{passive:true});
  window.addEventListener('pointercancel',finish,{passive:true});

  const oldClear=clearTrace;
  clearTrace=function(){oldClear();aiStrokes=[];currentStroke=null;lastAI=null;debug()};

  function prepModel(tag){
    if(!native||!window.KidsSeekhoAI)return Promise.reject(new Error('Native AI engine unavailable'));
    if(prep[tag])return prep[tag];
    setStatus('AI मॉडल की स्थिति जाँच रहा है…');
    prep[tag]=new Promise((resolve,reject)=>{
      window.KidsSeekhoAI.prepare(tag,r=>{setStatus('तैयार ✓');resolve(r)},e=>{
        delete prep[tag];
        const d=String(e||'model error');
        setStatus(d.includes('NO_INTERNET')?'इंटरनेट कनेक्शन नहीं मिला':d.includes('MODEL_DOWNLOAD_FAILED')?'AI मॉडल डाउनलोड असफल हुआ':'AI मॉडल तैयार नहीं हुआ');
        reject(new Error(d));
      });
    });
    return prep[tag];
  }

  function recognize(t){
    const strokes=aiStrokes.filter(s=>s.points.length).map(s=>({points:s.points.map(p=>({x:p.x,y:p.y,t:p.t}))}));
    if(!strokes.length)return Promise.reject(new Error('No handwriting'));
    const r=canvas.getBoundingClientRect();
    return prepModel(t.tag).then(()=>new Promise((resolve,reject)=>window.KidsSeekhoAI.recognize(strokes,t.tag,r.width,r.height,resolve,reject)));
  }

  const bytesText=n=>{n=Number(n)||0;if(!n)return'—';if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB'};
  const selectedModelTag=()=>{const s=$('modelLanguage');return s?s.value:'en-US'};

  function renderModelStatus(r){
    if(!r)return;
    const text=$('modelStatusText'),pct=$('modelPercent'),bar=$('modelProgressBar'),wrap=$('modelProgress'),bytes=$('modelBytes'),err=$('modelError');
    if(!text)return;
    const state=r.state||'waiting',p=Number(r.progress);
    let label='जाँच हो रही है…';
    if(r.downloaded||state==='complete'){
      label='डाउनलोड पूरा ✓';modelDownloading=false;
      if(bar)bar.style.width='100%';if(wrap)wrap.classList.remove('indeterminate');if(pct)pct.textContent='100%';
    }else if(state==='downloading'){
      label='डाउनलोड हो रहा है…';modelDownloading=true;
      if(p>=0){if(bar)bar.style.width=p+'%';if(wrap)wrap.classList.remove('indeterminate');if(pct)pct.textContent=p+'%'}
      else{if(wrap)wrap.classList.add('indeterminate');if(pct)pct.textContent='चल रहा है…'}
    }else if(state==='pending'){
      label='डाउनलोड कतार में है…';modelDownloading=true;if(wrap)wrap.classList.add('indeterminate');if(pct)pct.textContent='प्रतीक्षा…';
    }else if(state==='paused'){
      label='डाउनलोड रुका है — नेटवर्क का इंतज़ार';modelDownloading=true;if(wrap)wrap.classList.add('indeterminate');if(pct)pct.textContent=p>=0?p+'%':'—';
    }else if(state==='failed'){
      label='डाउनलोड असफल';modelDownloading=false;if(wrap)wrap.classList.remove('indeterminate');if(pct)pct.textContent='—';
    }else if(state==='no_internet'){
      label='इंटरनेट कनेक्शन नहीं मिला';modelDownloading=false;if(wrap)wrap.classList.remove('indeterminate');if(pct)pct.textContent='—';
    }else{
      label=r.network?'मॉडल डाउनलोड के लिए तैयार है':'इंटरनेट कनेक्शन नहीं मिला';modelDownloading=false;if(wrap)wrap.classList.remove('indeterminate');if(bar)bar.style.width='0%';if(pct)pct.textContent='0%';
    }
    text.innerHTML='<span>स्थिति: '+label+'</span><span>'+((p>=0&&!r.downloaded)?p+'%':(r.downloaded?'100%':''))+'</span>';
    if(bytes)bytes.textContent='डेटा: '+bytesText(r.downloadedBytes)+' / '+bytesText(r.totalBytes)+(r.totalBytes>0?' — Android status':'');
    if(err)err.textContent=r.detail||'';

    if(r.downloaded){
      prep[r.languageTag||selectedModelTag()]=Promise.resolve(r);
      if(!busy)setStatus('तैयार ✓ — ऑफलाइन भी काम करेगा');
    }
  }

  function pollModelStatus(){
    if(!native||!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.modelStatus!=='function')return;
    const tag=selectedModelTag();
    window.KidsSeekhoAI.modelStatus(tag,r=>{
      renderModelStatus(r);
      if(r&&r.downloaded&&modelTimer){clearInterval(modelTimer);modelTimer=null}
    },e=>{const x=$('modelError');if(x)x.textContent=String(e||'Model status error')});
  }

  function startModelDownload(){
    const tag=selectedModelTag(),err=$('modelError');
    if(err)err.textContent='';
    if(modelDownloading)return;
    if(!native||!window.KidsSeekhoAI||typeof window.KidsSeekhoAI.downloadModel!=='function'){
      if(err)err.textContent='इस APK में AI मॉडल डाउनलोड सुविधा उपलब्ध नहीं है।';return;
    }
    modelDownloading=true;
    renderModelStatus({state:'pending',network:true,progress:-1,downloadedBytes:0,totalBytes:0});
    if(modelTimer)clearInterval(modelTimer);modelTimer=setInterval(pollModelStatus,1000);
    window.KidsSeekhoAI.downloadModel(tag,r=>{
      prep[tag]=Promise.resolve(r);
      renderModelStatus({state:'complete',downloaded:true,progress:100,network:true,languageTag:tag});
      if(modelTimer){clearInterval(modelTimer);modelTimer=null}
      setStatus('तैयार ✓ — ऑफलाइन भी काम करेगा');
    },e=>{
      if(modelTimer){clearInterval(modelTimer);modelTimer=null}
      const d=String(e||'AI मॉडल डाउनलोड नहीं हुआ');
      if(err)err.textContent=d;
      renderModelStatus({state:d.includes('NO_INTERNET')?'no_internet':'failed',network:!d.includes('NO_INTERNET'),progress:-1,detail:d,languageTag:tag});
    });
  }

  function setupModelSection(){
    const b=$('modelDownloadBtn'),sel=$('modelLanguage');if(!b)return;
    b.onclick=startModelDownload;
    if(sel)sel.onchange=()=>{if(modelTimer){clearInterval(modelTimer);modelTimer=null}pollModelStatus()};
    pollModelStatus();
  }

  function fail(msg){
    $('hint').textContent='❌ '+msg;showError();errorSound();
    setTimeout(()=>speak('कोई बात नहीं। फिर से कोशिश करो। फिर से लिखो।','hi-IN',.78),150);
    busy=false;checking=false;debug();
  }
  function pass(t,r){
    let done=completedFor(mode);if(!done.includes(index)){done.push(index);localStorage.setItem(`kids-seekho-${mode}`,JSON.stringify(done))}
    $('hint').textContent='⭐ AI ने सही पहचान लिया!';showReward();rewardSound();
    const x=data[mode][index];
    const speech=mode==='english'?`${t.target} for ${x[1].replace(/^[A-Z] for /,'')}`:mode==='numbers'?`${t.target}, ${t.word}`:mode==='hindi'?`${t.target} से ${x[1]}`:`${t.target}`;
    setTimeout(()=>speak(speech,mode==='hindi'?'hi-IN':'en-US',.76),180);updateHomeProgress();
    $('success').classList.add('show');$('success').setAttribute('aria-hidden','false');
    setTimeout(()=>{$('success').classList.remove('show');$('success').setAttribute('aria-hidden','true');busy=false;checking=false;next()},1250);
  }

  autoCheck=async function(){
    if(busy)return;
    if(points.length<12){if(points.length)fail('AI को लिखावट पूरी नहीं मिली। अक्षर पूरा लिखो।');return}
    busy=true;checking=true;const t=target();
    if(!t){fail('यह पाठ अभी AI के लिए उपलब्ध नहीं है।');return}
    if(!native||!window.KidsSeekhoAI){fail('Android AI engine उपलब्ध नहीं है।');return}
    setStatus('लिखावट को AI समझ रहा है…');$('hint').textContent='🤖 AI खुद जाँच कर रहा है…';
    try{
      const r=await recognize(t),candidates=Array.isArray(r.candidates)?r.candidates:[],top=r.text||candidates[0]||'';
      lastAI={target:t.target,ai:top,candidates,source:'Google ML Kit — native only'};debug();
      if(matches(r,t))pass(t,r);else fail(`AI ने “${top||'कुछ नहीं'}” पहचाना। यहाँ “${t.target}” लिखना है।`);
    }catch(e){
      const detail=String(e&&e.message||e||'Unknown error');lastAI={target:t.target,ai:'ERROR',candidates:[],source:detail};debug();
      setStatus(detail.includes('NO_INTERNET')?'इंटरनेट कनेक्शन नहीं मिला':detail.includes('MODEL_DOWNLOAD_FAILED')?'AI मॉडल डाउनलोड असफल हुआ':'AI मॉडल तैयार नहीं हुआ');
      fail(detail.includes('NO_INTERNET')?'इंटरनेट चालू रखें और मॉडल डाउनलोड करें।':detail.includes('MODEL_DOWNLOAD_FAILED')?'AI मॉडल डाउनलोड नहीं हो पाया। इंटरनेट चालू रखें और दोबारा कोशिश करें।':'AI मॉडल तैयार नहीं हुआ। मॉडल डाउनलोड होने के बाद फिर से कोशिश करें।');
    }
  };

  document.addEventListener('deviceready',()=>{
    native=true;setupModelSection();setStatus('AI इंजन तैयार है — मॉडल की स्थिति जाँच रहा है…');
    if(window.KidsSeekhoAI&&window.KidsSeekhoAI.isAvailable)window.KidsSeekhoAI.isAvailable(()=>setStatus('AI इंजन तैयार है — मॉडल की स्थिति जाँच रहा है…'),()=>setStatus('AI इंजन उपलब्ध नहीं है'));
    else setStatus('AI इंजन उपलब्ध नहीं है');
  },false);

  let taps=0,timer;const brand=document.querySelector('.brand');
  if(brand)brand.onclick=()=>{taps++;clearTimeout(timer);timer=setTimeout(()=>taps=0,1800);if(taps>=7){taps=0;document.body.classList.toggle('ai-debug');debug()}};
  function debug(){
    if(!document.body.classList.contains('ai-debug'))return;
    let b=$('aiDebug');if(!b){b=document.createElement('div');b.id='aiDebug';b.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#111;color:#fff;padding:10px;border-radius:12px;font:12px monospace';document.body.appendChild(b)}
    b.innerHTML=`<b>AI TEST</b><br>Native: ${native?'YES':'NO'}<br>Status: ${status}<br>Target: ${lastAI?lastAI.target:data[mode][index][0]}<br>AI: ${lastAI?lastAI.ai:'—'}<br>Candidates: ${lastAI?lastAI.candidates.join(' | '):'—'}<br>Source/Error: ${lastAI?lastAI.source:'—'}<br><small>A में B लिखो → PASS नहीं होना चाहिए</small>`;
  }
})();
