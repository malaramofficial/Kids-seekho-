const lessons={
 english:[['A','Apple','🍎'],['B','Ball','⚽'],['C','Cat','🐱'],['D','Dog','🐶'],['E','Elephant','🐘'],['F','Fish','🐟'],['G','Grapes','🍇'],['H','House','🏠'],['I','Ice cream','🍦'],['J','Juice','🧃'],['K','Kite','🪁'],['L','Lion','🦁'],['M','Mango','🥭'],['N','Nest','🪺'],['O','Orange','🍊'],['P','Parrot','🦜'],['Q','Queen','👑'],['R','Rabbit','🐰'],['S','Sun','☀️'],['T','Tiger','🐯'],['U','Umbrella','☂️'],['V','Van','🚐'],['W','Watermelon','🍉'],['X','Xylophone','🎵'],['Y','Yak','🐃'],['Z','Zebra','🦓']],
 hindi:[['अ','अनार','🍎'],['आ','आम','🥭'],['इ','इमली','🌿'],['ई','ईख','🌱'],['उ','उल्लू','🦉'],['ऊ','ऊन','🧶'],['ए','एड़ी','🦶'],['ऐ','ऐनक','👓'],['ओ','ओखली','🥣'],['औ','औरत','👩'],['क','कबूतर','🕊️'],['ख','खरगोश','🐇'],['ग','गमला','🪴'],['घ','घर','🏠'],['च','चम्मच','🥄'],['छ','छाता','☂️'],['ज','जहाज','🚢'],['झ','झंडा','🚩'],['ट','टमाटर','🍅'],['ठ','ठेला','🛒'],['ड','डमरू','🥁'],['ढ','ढक्कन','🫙'],['त','तरबूज','🍉'],['थ','थर्मस','🧴'],['द','दरवाज़ा','🚪'],['ध','धनुष','🏹'],['न','नल','🚰'],['प','पतंग','🪁'],['फ','फल','🍊'],['ब','बकरी','🐐'],['भ','भालू','🐻'],['म','मछली','🐟'],['य','यज्ञ','🔥'],['र','रथ','🛺'],['ल','लट्टू','🪀'],['व','वन','🌳'],['श','शेर','🦁'],['ष','षट्कोण','⬡'],['स','साँप','🐍'],['ह','हाथी','🐘']],
 numbers:Array.from({length:20},(_,i)=>[String(i+1),['एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस','ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस','बीस'][i],['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣'][i]]),
 shapes:[['○','Circle','⚪'],['□','Square','⬜'],['△','Triangle','🔺'],['☆','Star','⭐'],['◇','Diamond','💎'],['♥','Heart','❤️']]
};
const labels={english:'English',hindi:'हिंदी',numbers:'गिनती',shapes:'Shapes'};
let mode='english',index=0;
const $=id=>document.getElementById(id);
function browserSpeak(text,lang){if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.78;u.pitch=1.12;speechSynthesis.speak(u)}
function speak(text,lang='hi-IN'){if(window.TTS){try{const r=window.TTS.speak({text,locale:lang,rate:.78});if(r&&r.catch)r.catch(()=>browserSpeak(text,lang));return}catch(e){}}browserSpeak(text,lang)}
function shapeHindi(s){return({Circle:'गोला',Square:'वर्ग',Triangle:'त्रिकोण',Star:'सितारा',Diamond:'हीरा',Heart:'दिल'})[s]||s}
function lessonText(){const x=lessons[mode][index];if(mode==='english')return `${x[0]} for ${x[1]}`;if(mode==='hindi')return `${x[0]} से ${x[1]}`;if(mode==='numbers')return `${x[0]}, ${x[1]}`;return `${x[1]}, ${shapeHindi(x[1])}`}
function speakLesson(){speak(lessonText(),mode==='english'?'en-US':'hi-IN')}
function completed(){try{return JSON.parse(localStorage.getItem('kids-seekho-tap')||'[]')}catch(e){return[]}}
function updateProgress(){let total=0;Object.keys(lessons).forEach(k=>total+=lessons[k].length);const d=completed().length;$('progressText').textContent=`${d} / ${total}`;$('progressBar').style.width=`${Math.min(100,d/total*100)}%`;$('progressLabel').textContent=d?`शाबाश दिव्यांश! ${d} चीज़ें सीख लीं ⭐`:'चलो दिव्यांश, आज सीखते हैं 🌟'}
function markDone(){const key=`${mode}-${index}`,d=completed();if(!d.includes(key)){d.push(key);localStorage.setItem('kids-seekho-tap',JSON.stringify(d))}updateProgress()}
function animateCard(){const c=$('lessonCard');c.classList.remove('tap-pop');void c.offsetWidth;c.classList.add('tap-pop')}
function showStar(){const s=$('tapStar');s.classList.remove('show');void s.offsetWidth;s.classList.add('show')}
function render(){const x=lessons[mode][index];$('modeLabel').textContent=labels[mode];$('counter').textContent=`${index+1} / ${lessons[mode].length}`;$('picture').textContent=x[2];$('letter').textContent=x[0];$('word').textContent=mode==='english'?`${x[0]} for ${x[1]}`:mode==='hindi'?`${x[0]} से ${x[1]}`:mode==='numbers'?`${x[0]} — ${x[1]}`:`${x[1]} — ${shapeHindi(x[1])}`;$('tapHint').textContent='👆 अक्षर या तस्वीर पर टैप करो';animateCard();markDone();setTimeout(speakLesson,180)}
function openMode(m){mode=m;index=0;$('homeScreen').classList.remove('active');$('learnScreen').classList.add('active');render()}
function goHome(){if('speechSynthesis'in window)speechSynthesis.cancel();if(window.TTS)try{window.TTS.silence()}catch(e){}$('learnScreen').classList.remove('active');$('homeScreen').classList.add('active');updateProgress()}
function next(){index=index<lessons[mode].length-1?index+1:0;render()}
function previous(){index=index>0?index-1:lessons[mode].length-1;render()}
function tapLearn(){animateCard();markDone();speakLesson();showStar()}
function randomLesson(){const keys=Object.keys(lessons);mode=keys[Math.floor(Math.random()*keys.length)];index=Math.floor(Math.random()*lessons[mode].length);$('homeScreen').classList.remove('active');$('learnScreen').classList.add('active');render()}
$('homeBtn').onclick=goHome;$('soundBtn').onclick=()=>speak('दिव्यांश, चलो खेल-खेल में सीखते हैं!');$('backBtn').onclick=goHome;$('prevBtn').onclick=previous;$('nextBtn').onclick=next;$('speakBtn').onclick=speakLesson;$('lessonCard').onclick=tapLearn;$('playHomeBtn').onclick=randomLesson;
document.querySelectorAll('.category').forEach(b=>b.onclick=()=>openMode(b.dataset.mode));
updateProgress();
