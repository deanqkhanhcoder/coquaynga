import { ITEMS, SurvivalGame } from './engine.js';

const ICONS={
  glass:'<circle cx="13" cy="12" r="7"/><path d="m18 17 7 7M10 8q4-3 6 1"/>',
  cigarette:'<path d="M4 18h21v6H4zM19 18v6m-4-9q-5-4 0-6t0-6m7 12q-4-3 0-6"/><path d="M5 21h12"/>',
  saw:'<path d="m4 23 3-8L25 5l3 7-3 2-2-1-2 3-3-1-2 4-3-1-2 4-3-1-1 3zM7 15l4 7M5 18l3 2"/>',
  beer:'<path d="M14 3h5v7l4 6v11H10V16l4-6zM13 3h7M10 19h13m-13 5h13M15 5h3"/>',
  cuffs:'<circle cx="9" cy="19" r="6"/><circle cx="24" cy="10" r="6"/><path d="m13 15 7-3M5 19a4 4 0 0 1 4-4m11-5a4 4 0 0 1 4-4"/>'
};

const $=id=>document.getElementById(id);
const esc=text=>String(text).replace(
  /[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
);
const svg=id=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

const game=new SurvivalGame();
let epoch=0;
let soundEnabled=true;
let audio=null;
const activeSounds=new Set();

let journalEpoch=-1;
let lastEventId=-1;
let world=null;
let runnerEpoch=-1;
let sequence=new AbortController();
let ambience=[];
let qualityMode='auto';
let mechanicalSeed=17004;

function delay(ms,signal){
  return new Promise(resolve=>{
    if(signal.aborted){resolve(false);return;}
    const finish=ok=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve(ok);};
    const abort=()=>finish(false);
    const timer=setTimeout(()=>finish(true),ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}

function stopAmbience(){
  for(const node of ambience){try{node.stop();}catch(_){}try{node.disconnect();}catch(_){}}
  ambience=[];
}
function startAmbience(){
  if(!audio||!soundEnabled||ambience.length)return;
  const gain=audio.createGain();gain.gain.value=.006;
  const hum=audio.createOscillator();hum.type='sine';hum.frequency.value=50;
  hum.connect(gain).connect(audio.destination);hum.start();
  const overtone=audio.createOscillator();overtone.type='sine';overtone.frequency.value=100;
  const quiet=audio.createGain();quiet.gain.value=.0025;overtone.connect(quiet).connect(audio.destination);overtone.start();
  ambience=[hum,overtone,gain,quiet];
}

function stopSounds(){
  for(const node of activeSounds){
    try{
      node.stop();
    }catch(_){}
  }

  activeSounds.clear();
}

function trackSound(node){
  activeSounds.add(node);
  node.onended=()=>activeSounds.delete(node);
  return node;
}

function sound(type){
  if(!soundEnabled||document.hidden)return;

  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;

    if(!audio)audio=new Audio();

    if(audio.state==='suspended'){
      audio.resume().catch(()=>{});
    }

    startAmbience();
    const now=audio.currentTime;

    if(type==='heartbeat'){
      // Bốn nhịp tăng dần, kết thúc trước mốc 2.400 ms.
      for(let beat=0;beat<4;beat++){
        const at=now+.1+beat*.6;
        const osc=trackSound(audio.createOscillator());
        const gain=audio.createGain();
        const filter=audio.createBiquadFilter();

        osc.type='sine';
        osc.frequency.setValueAtTime(72+beat*2,at);
        osc.frequency.exponentialRampToValueAtTime(32,at+.26);

        filter.type='lowpass';
        filter.frequency.value=230;

        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(.18+beat*.09,at+.022);
        gain.gain.exponentialRampToValueAtTime(.0001,at+.32);

        osc.connect(filter).connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at+.34);
      }

      return;
    }

    if(type==='reload'||type==='eject'){
      const count=type==='reload'?6:2;

      for(let i=0;i<count;i++){
        const at=now+(type==='reload'?.62+i*.34:i*.32);
        const duration=.085;
        const buffer=audio.createBuffer(
          1,
          Math.ceil(audio.sampleRate*duration),
          audio.sampleRate
        );
        const data=buffer.getChannelData(0);

        for(let j=0;j<data.length;j++){
          data[j]=(Math.random()*2-1)*Math.pow(1-j/data.length,5);
        }

        const source=trackSound(audio.createBufferSource());
        const filter=audio.createBiquadFilter();
        const gain=audio.createGain();

        source.buffer=buffer;
        filter.type='highpass';
        filter.frequency.value=1300;
        gain.gain.value=.17;

        source.connect(filter).connect(gain).connect(audio.destination);
        source.start(at);
        source.stop(at+duration);

        const osc=trackSound(audio.createOscillator());
        const ring=audio.createGain();

        osc.type='triangle';
        osc.frequency.value=900+i*73;

        ring.gain.setValueAtTime(.0001,at);
        ring.gain.exponentialRampToValueAtTime(.055,at+.004);
        ring.gain.exponentialRampToValueAtTime(.0001,at+.12);

        osc.connect(ring).connect(audio.destination);
        osc.start(at);
        osc.stop(at+.13);
      }

      return;
    }

    if(type==='live'||type==='blank'){
      const length=type==='live'?.8:.10;
      const buffer=audio.createBuffer(
        1,
        Math.ceil(audio.sampleRate*length),
        audio.sampleRate
      );
      const data=buffer.getChannelData(0);

      for(let i=0;i<data.length;i++){
        data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,type==='live'?3:6);
      }

      const source=trackSound(audio.createBufferSource());
      const filter=audio.createBiquadFilter();
      const gain=audio.createGain();

      source.buffer=buffer;
      filter.type='lowpass';
      filter.frequency.value=type==='live'?1500:3500;
      gain.gain.value=type==='live'?.42:.15;

      source.connect(filter).connect(gain).connect(audio.destination);
      source.start(now);
      source.stop(now+length);

      if(type==='live'){
        const bass=trackSound(audio.createOscillator());
        const impact=audio.createGain();

        bass.type='triangle';
        bass.frequency.setValueAtTime(88,now);
        bass.frequency.exponentialRampToValueAtTime(28,now+.4);

        impact.gain.setValueAtTime(.0001,now);
        impact.gain.exponentialRampToValueAtTime(.24,now+.008);
        impact.gain.exponentialRampToValueAtTime(.0001,now+.48);

        bass.connect(impact).connect(audio.destination);
        bass.start(now);
        bass.stop(now+.5);
      }
    }else{
      const notes=type==='win'
        ?[261.63,329.63,392,523.25]
        :type==='correct'
          ?[440,660]
          :type==='wrong'
            ?[180,130]
            :[420];

      notes.forEach((freq,i)=>{
        const osc=trackSound(audio.createOscillator());
        const gain=audio.createGain();
        const at=now+i*.13;

        osc.type='triangle';
        osc.frequency.value=freq;

        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(.09,at+.015);
        gain.gain.exponentialRampToValueAtTime(.0001,at+.26);

        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at+.28);
      });
    }
  }catch(_){
    // Không có Web Audio vẫn giữ đầy đủ logic trò chơi.
  }
}

// Additional turntable friction; all pre-existing ambience and sound functions above remain unchanged.
function mechanicalSound(){
  if(!soundEnabled||document.hidden||!audio)return;
  try{
    const now=audio.currentTime,duration=.28;
    const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      mechanicalSeed=(Math.imul(mechanicalSeed,1664525)+1013904223)>>>0;
      data[i]=(mechanicalSeed/4294967296*2-1)*Math.sin(i/data.length*Math.PI);
    }
    const source=trackSound(audio.createBufferSource()),filter=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=530;filter.Q.value=3;gain.gain.value=.045;
    source.connect(filter).connect(gain).connect(audio.destination);source.start(now);source.stop(now+duration);
  }catch(_){}
}

function useInventoryItem(owner,index){
  if(owner!==game.state.current)return false;
  const id=game.state.players[owner].items[index];
  if(!game.useItem(index))return false;
  world?.item(id);sound('item');render();continueAnimations(epoch);return true;
}

function renderItems(){
  const s=game.state,p=s.players[s.current];
  $('crew-summary').textContent=s.players.map(p=>`Tổ ${p.id+1}: ${p.hp}/3 HP${p.cuffed?', bị còng':''}, ${p.items.map(id=>ITEMS[id].name).join(', ')||'không có vật phẩm'}.`).join(' ');
  $('item-shortcuts').innerHTML=s.phase!=='target'?'':`<span class="shortcut-label">VẬT PHẨM TỔ ${p.id+1} / 1–4</span>${p.items.length?p.items.map((id,i)=>{
    const reason=game.itemReason(i);
    return `<button class="item-shortcut" data-item="${i}" data-owner="${p.id}" aria-disabled="${!!reason}" title="${esc(ITEMS[id].name+': '+(reason||ITEMS[id].desc))}" aria-label="${esc(ITEMS[id].name+'. '+(reason||ITEMS[id].desc))}"><kbd>${i+1}</kbd>${svg(id)}<span>${ITEMS[id].name}</span></button>`;
  }).join(''):'<span class="empty-slot">Kho trống · chọn mục tiêu trên bàn.</span>'}`;
}

function renderEvents(s){
  if(journalEpoch===epoch&&lastEventId===s.eventId)return;
  journalEpoch=epoch;lastEventId=s.eventId;
  $('events').innerHTML=s.events.length?s.events.map(e=>`
    <li class="${e.tone}"><span class="event-num">${String(e.id).padStart(2,'0')}</span><span class="event-text">${esc(e.text)}</span></li>
  `).join(''):'<li>Bàn chơi sẵn sàng. Chờ MC bắt đầu.</li><li>Mỗi tổ: 3 HP · 2 vật phẩm ngẫu nhiên.</li><li>Mỗi băng: 6 viên · 2–4 đạn thật · còn lại đạn lép.</li>';
  $('events').scrollTop=0;
}

function render(){
  const s=game.state;
  const started=s.phase!=='idle';
  const live=started?s.ammo.filter(Boolean).length:null;
  const blank=started?s.ammo.length-live:null;
  const remaining=started?s.ammo.length:6;

  document.querySelector('.app').dataset.phase=s.phase;
  renderItems();
  $('terminal-status').textContent=s.phase==='question'?`CÂU ${s.questionCount} / TỔ ${s.current+1}`:({idle:'CHỜ MC',verdict:s.correct?'CHÍNH XÁC':'CHƯA ĐÚNG',target:'CHỌN MỤC TIÊU',item:'ĐANG DÙNG VẬT PHẨM',reload:'ĐANG NẠP ĐẠN',aiming:'ĐANG BÓP CÒ',shot:s.shot?.live?'ĐẠN THẬT':'ĐẠN LÉP',eject:'ĐÃ BỎ MỘT VIÊN',won:`TỔ ${s.winner+1} CHIẾN THẮNG`})[s.phase];
  $('restart').disabled=!started||!world;

  $('turn-number').textContent=started
    ?String((s.winner??s.current)+1).padStart(2,'0')
    :'—';

  $('turn-label').textContent=s.phase==='won'
    ?'KẾT THÚC'
    :started?'LƯỢT HIỆN TẠI':'SẴN SÀNG';

  $('turn-title').textContent=s.phase==='won'
    ?`TỔ ${s.winner+1} CHIẾN THẮNG`
    :started?`TỔ ${s.current+1}`:'CHỜ BẮT ĐẦU';
  $('current-hp').textContent=started?`${s.players[s.winner??s.current].hp} / 3 HP`:'';

  $('live-count').textContent=live??'?';
  $('blank-count').textContent=blank??'?';
  $('ammo-total').textContent=`/ ${String(remaining).padStart(2,'0')} VIÊN`;
  $('round').textContent=String(s.round||1).padStart(2,'0');

  $('ammo-strip').innerHTML=Array.from(
    {length:s.capacity},
    (_,i)=>`<span class="shell ${i>=remaining?'used':''}" style="--i:${i}" aria-hidden="true"></span>`
  ).join('');

  $('desk').className=`desk ${s.phase==='won'?'winner':''}`;

  $('weapon-state').innerHTML=`${
    s.saw
      ?'<span class="saw-tag">CƯA TAY / SÁT THƯƠNG ×2</span>'
      :'SÁT THƯƠNG / 01 HP'
  }${
    s.peek!==null
      ?`<span class="peek-tag">◉ ${s.peek?'ĐẠN THẬT':'ĐẠN LÉP'}</span>`
      :''
  }`;

  if(world)world.sync(s,epoch,s.players.map(p=>p.items.map((_,i)=>p.id===s.current?game.itemReason(i):'Chỉ sử dụng vật phẩm của tổ đang đến lượt.')));

  let overlay='';

  if(s.phase==='idle'){
    overlay=`
      <div class="scene-banner">
        <div class="eyebrow">BUCKSHOT ROULETTE</div>
        <h2>THE HOUSE IS READY.</h2><p>4 tổ · 3 HP · 6 viên đạn · không có đường lùi</p>
        <button class="primary" id="start">BẮT ĐẦU ▸</button>
      </div>`;
  }

  if(s.phase==='reload'){
    overlay='<div class="scene-message">ĐANG NẠP ĐẠN</div>';
  }

  if(s.phase==='eject'){
    overlay='<div class="scene-message">ĐÃ BỎ MỘT VIÊN</div>';
  }

  if(s.phase==='aiming'){
    overlay=`
      <div class="scene-message suspense-message">
        ĐANG BÓP CÒ...
        <span class="pulse-line" aria-hidden="true">▁▁╱╲▁╱╲▁▁</span>
      </div>`;
  }

  if(s.phase==='shot'){
    overlay=`
      <div class="scene-message ${s.shot.live?'live-shot':'blank-shot'}">
        ${s.shot.live?'ĐẠN THẬT':'ĐẠN LÉP'}
        <small>
          Tổ ${s.shot.target+1}
          ${s.shot.damage?`−${s.shot.damage} HP`:'không mất HP'}
          ${s.shot.keep?' · GIỮ LƯỢT':''}
        </small>
      </div>`;
  }

  if(s.phase==='won'){
    overlay=`
      <div class="scene-banner" role="region" aria-label="Kết quả ván đấu">
        <div class="eyebrow">CHIẾN THẮNG</div>
        <div class="winner-number">TỔ ${s.winner+1}</div>
        <button class="primary" id="play-again">↻ CHƠI LẠI</button>
      </div>`;
  }

  $('scene-overlay').innerHTML=overlay;
  renderQuiz();

  $('event-count').textContent=s.eventId
    ?`${String(s.eventId).padStart(2,'0')} SỰ KIỆN`
    :'TRỰC TIẾP';

  renderEvents(s);
}

function renderQuiz(){
  const s=game.state;
  const q=game.question();
  const quiz=$('quiz');

  if(s.phase==='idle'){
    quiz.innerHTML=`
      <div class="quiz-top">
        <span class="quiz-label">TRẮC NGHIỆM</span>
        <span class="phase-badge">SẴN SÀNG</span>
      </div>
      <div class="quiz-idle"><span class="big-number">04</span><div><h2 id="question-title">BẠN ĐÃ SẴN SÀNG?</h2><p>Trả lời câu hỏi. Chọn mục tiêu. Chờ tiếng cò súng.</p><p>Mở hướng dẫn để xem đầy đủ luật và vật phẩm.</p></div></div>`;
    return;
  }

  if(s.phase==='won'){
    quiz.innerHTML=`
      <div class="quiz-top">
        <span class="quiz-label">KẾT QUẢ</span>
        <span class="phase-badge">KẾT THÚC</span>
      </div>
      <h2 id="question-title">TỔ ${s.winner+1} CHIẾN THẮNG</h2>
      <div class="result-stats">
        <span>${s.players[s.winner].hp}/3 HP</span>
        <span>${s.questionCount} câu hỏi</span>
        <span>${s.round} băng đạn</span>
      </div>`;
    return;
  }

  if(
    ['target','item','eject','aiming'].includes(s.phase)||
    (s.phase==='reload'&&s.returnPhase==='target')
  ){
    const enabled=s.phase==='target';

    quiz.innerHTML=`
      <div class="quiz-top">
        <span class="quiz-label">CÂU ${String(s.questionCount).padStart(2,'0')} / TỔ ${s.current+1}</span>
        <span class="phase-badge">${
          enabled
            ?'CHỌN MỤC TIÊU'
            :s.phase==='aiming'
              ?'ĐÃ KHÓA MỤC TIÊU'
              :'ĐANG XỬ LÝ'
        }</span>
      </div>
      <h2 id="question-title" class="target-title">CHỌN MỤC TIÊU</h2><p class="item-notice">Nhấp vật phẩm trên bàn hoặc phím 1–4 trước khi khai hỏa.</p>
      <div class="target-area">
        <div class="targets">
          ${s.players.map(p=>`
            <button
              class="target ${s.target===p.id?'chosen':''}"
              data-target="${p.id}"
              aria-pressed="${s.target===p.id}"
              ${!enabled||p.hp===0?'disabled':''}
            >
              TỔ ${p.id+1}
              <small>${
                p.hp===0
                  ?'ĐÃ BỊ LOẠI'
                  :p.id===s.current
                    ?'TỰ BẮN MÌNH'
                    :`${p.hp} HP`
              }</small>
            </button>
          `).join('')}
        </div>
        <button
          class="fire"
          id="fire"
          ${!enabled||s.target===null?'disabled':''}
        >KHAI HỎA</button>
      </div>`;
    return;
  }

  if(s.phase==='reload'){
    quiz.innerHTML=`
      <div class="quiz-top">
        <span class="quiz-label">6 VIÊN / BĂNG</span>
        <span class="phase-badge">ĐANG XỬ LÝ</span>
      </div>
      <h2 id="question-title">NẠP ĐẠN</h2>`;
    return;
  }

  const active=s.phase==='question';
  const show=s.selected!==null;

  quiz.innerHTML=`
    <div class="quiz-top">
      <span class="quiz-label">CÂU HỎI ${String(s.questionCount).padStart(2,'0')} / TỔ ${s.current+1}</span>
      <span class="phase-badge ${show&&!s.correct?'bad':''}">${
        active
          ?'CHỜ ĐÁP ÁN'
          :s.phase==='shot'
            ?(s.shot.live?'ĐẠN THẬT':'ĐẠN LÉP')
            :(s.correct?'CHÍNH XÁC':'CHƯA ĐÚNG')
      }</span>
    </div>
    <h2 id="question-title">${q.text}</h2>
    <div class="choices">
      ${q.options.map((opt,i)=>`
        <button
          class="choice ${
            show&&i===q.answer?'correct':''
          } ${
            show&&i===s.selected&&!s.correct?'incorrect':''
          } ${
            s.selected===i?'selected':''
          }"
          data-answer="${i}"
          ${active?'':'disabled'}
        >
          <span class="choice-letter">${'ABCD'[i]}</span>
          <span>${opt}</span>
        </button>
      `).join('')}
    </div>`;
}

// One asynchronous sequence per game epoch; restart cancels and clears its timeout.
async function continueAnimations(token){
  if(runnerEpoch===token)return;
  runnerEpoch=token;
  const signal=sequence.signal;
  try{
    while(token===epoch&&!signal.aborted){
      const phase=game.state.phase;
      let wait=0,finish=null;
      if(phase==='verdict'){
        sound(game.state.correct?'correct':'wrong');wait=2200;finish=()=>game.finishAnswer();
      }else if(phase==='aiming'){
        sound('heartbeat');wait=2400;finish=()=>game.finishAiming();
      }else if(phase==='shot'){
        sound(game.state.shot.live?'live':'blank');wait=2600;finish=()=>game.finishShot();
      }else if(phase==='item'){
        wait=500;finish=()=>game.finishItem();
      }else if(phase==='eject'){
        sound('eject');wait=1600;finish=()=>game.finishEject();
      }else if(phase==='reload'){
        sound('reload');wait=2800;finish=()=>game.finishReload();
      }else return;
      if(!await delay(wait,signal)||token!==epoch)return;
      finish();render();
      if(game.state.phase==='won')sound('win');
    }
  }finally{
    if(runnerEpoch===token)runnerEpoch=-1;
  }
}

function start(){
  if(!world)return;
  sequence.abort();sequence=new AbortController();epoch++;
  stopSounds();stopAmbience();
  $('terminal').classList.remove('collapsed');$('hud-toggle').setAttribute('aria-expanded','true');$('hud-toggle').textContent='THU GỌN ▾';
  game.start();render();continueAnimations(epoch);
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');

  if(
    !button||
    button.disabled||
    button.getAttribute('aria-disabled')==='true'
  ){
    return;
  }

  if(['start','restart','play-again'].includes(button.id)){
    start();
    return;
  }

  if(button.dataset.answer!==undefined){
    if(game.answer(Number(button.dataset.answer))){
      render();
      continueAnimations(epoch);
    }
    return;
  }

  if(button.dataset.target!==undefined){
    if(game.chooseTarget(Number(button.dataset.target))){
      render();
    }
    return;
  }

  if(button.id==='fire'){
    if(game.fire()){
      render();
      continueAnimations(epoch);
    }
    return;
  }

  if(button.dataset.item!==undefined){
    useInventoryItem(Number(button.dataset.owner),Number(button.dataset.item));
  }
});

document.addEventListener('keydown',event=>{
  if(
    event.repeat||
    event.ctrlKey||
    event.altKey||
    event.metaKey||
    $('rules').open||
    event.target.closest('input,textarea,select,[contenteditable="true"]')
  ){
    return;
  }

  if(game.state.phase==='target'&&/^[1-4]$/.test(event.key)){
    event.preventDefault();useInventoryItem(game.state.current,Number(event.key)-1);return;
  }
  const i='abcd'.indexOf(event.key.toLowerCase());

  if(event.key.length===1&&i>=0&&game.answer(i)){
    event.preventDefault();
    render();
    continueAnimations(epoch);
  }
});

$('sound').addEventListener('click',()=>{
  soundEnabled=!soundEnabled;

  $('sound').setAttribute('aria-pressed',String(soundEnabled));
  $('sound-label').textContent=`Âm thanh: ${soundEnabled?'bật':'tắt'}`;

  if(!soundEnabled){
    stopSounds();stopAmbience();
    if(audio)audio.suspend().catch(()=>{});
  }else{
    sound('item');
  }
});

if(!document.fullscreenEnabled){
  $('fullscreen').hidden=true;
}

$('fullscreen').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement){
      await document.exitFullscreen();
    }else{
      await document.documentElement.requestFullscreen();
    }
  }catch(_){
    alert('Trình duyệt chặn toàn màn hình. Hãy dùng F11.');
  }
});

$('rules-open').addEventListener('click',()=>{
  $('rules').showModal();
});

$('rules-close').addEventListener('click',()=>{
  $('rules').close();
});

render();

$('quality').addEventListener('click',()=>{
  qualityMode=qualityMode==='auto'?'low':qualityMode==='low'?'high':'auto';
  world?.setQuality(qualityMode);
  $('quality').textContent=`Đồ họa: ${qualityMode==='auto'?'tự động':qualityMode==='low'?'thấp':'cao'}`;
});
document.addEventListener('visibilitychange',()=>{
  if(!audio)return;
  if(document.hidden)audio.suspend().catch(()=>{});
  else if(soundEnabled)audio.resume().catch(()=>{});
});
window.addEventListener('pagehide',event=>{
  if(event.persisted)return;
  sequence.abort();stopSounds();stopAmbience();world?.dispose();
  if(audio)audio.close().catch(()=>{});
});

async function openRoom(){
  const status=$('world-status');
  try{
    const { GameScene }=await import('./scene.js');
    world=new GameScene($('world'),$('team-labels'),id=>{
      if(game.chooseTarget(id))render();
    },useInventoryItem,mechanicalSound);
    world.setQuality(qualityMode);status.hidden=true;render();
  }catch(error){
    console.error('Không thể mở phòng 3D:',error);
    status.className='world-status failed';
    status.textContent='Không thể khởi tạo cảnh 3D. Hãy kiểm tra WebGL / tăng tốc phần cứng và kết nối CDN Three.js.';
    const retry=document.createElement('button');retry.textContent='TẢI LẠI PHÒNG';retry.addEventListener('click',()=>location.reload());status.append(retry);
  }
}
openRoom();

$('journal-toggle').addEventListener('click',()=>{
  $('journal').hidden=!$('journal').hidden;
  $('journal-toggle').setAttribute('aria-expanded',String(!$('journal').hidden));
});
$('hud-toggle').addEventListener('click',()=>{
  const collapsed=$('terminal').classList.toggle('collapsed');
  $('hud-toggle').setAttribute('aria-expanded',String(!collapsed));
  $('hud-toggle').textContent=collapsed?'MỞ TERMINAL ▴':'THU GỌN ▾';
});
