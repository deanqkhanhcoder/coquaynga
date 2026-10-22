import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source=readFileSync(new URL('../engine.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const { ITEMS, QUESTIONS, SurvivalGame }=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const hash=s=>createHash('sha256').update(s).digest('hex');
const fresh=()=>{const g=new SurvivalGame(()=>.4);g.start();g.finishReload();return g;};
const ready=(g,ammo=[true,false,true,false,true,false])=>{g.answer(g.question().answer);g.finishAnswer();g.state.ammo=[...ammo];return g;};
const shoot=(g,target)=>{assert.equal(g.chooseTarget(target),true);assert.equal(g.fire(),true);g.finishAiming();};

test('original engine and all question bytes are preserved',()=>{
  const saved=JSON.parse(readFileSync(new URL('../preservation.json',import.meta.url),'utf8'));
  assert.equal(hash(source.slice(0,source.indexOf('// ENGINE END')+'// ENGINE END'.length)),saved.engineSHA256);
  assert.equal(hash(source.slice(source.indexOf('const QUESTIONS = ['),source.indexOf('class SurvivalGame'))),saved.questionSourceSHA256);
  assert.equal(QUESTIONS.length,31);
  for(const q of QUESTIONS){assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<=3);}
});
test('all original ambience and sound functions are byte-for-byte preserved',()=>{
  const ui=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const saved=JSON.parse(readFileSync(new URL('../retro-preservation.json',import.meta.url),'utf8'));
  const region=ui.slice(ui.indexOf('function stopAmbience(){'),ui.indexOf('// Additional turntable friction'));
  assert.equal(hash(region),saved.audioSHA256);
});
test('four fixed teams, 3 HP, 2 starting items, first team first',()=>{
  const g=fresh();assert.equal(g.state.current,0);
  assert.deepEqual(g.state.players.map(p=>[p.id,p.hp,p.items.length]),[[0,3,2],[1,3,2],[2,3,2],[3,3,2]]);
});
test('every reload has six shells, two to four live, shuffled',()=>{
  let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const g=new SurvivalGame(random);const counts=new Set();const orders=new Set();
  for(let i=0;i<500;i++){g.load();assert.equal(g.state.ammo.length,6);const live=g.state.ammo.filter(Boolean).length;assert.ok(live>=2&&live<=4);counts.add(live);orders.add(g.state.ammo.join());}
  assert.equal(counts.size,3);assert.ok(orders.size>10);
});
test('questions cycle through three complete lists without undefined',()=>{
  const g=fresh();for(let i=0;i<QUESTIONS.length*3+2;i++){assert.equal(g.question(),QUESTIONS[i%QUESTIONS.length]);g.newQuestion();}
});
test('correct answer awards an item but caps at four',()=>{
  const g=fresh();ready(g);assert.equal(g.state.players[0].items.length,3);
  g.newQuestion();ready(g);assert.equal(g.state.players[0].items.length,4);
  g.newQuestion();ready(g);assert.equal(g.state.players[0].items.length,4);
});
for(const live of [true,false])test(`wrong answer forces self shot, one HP for live=${live}, always ends turn`,()=>{
  const g=fresh();g.state.ammo=[live,true,false];g.state.saw=true;
  g.answer((g.question().answer+1)%4);assert.equal(g.useItem(0),false);g.finishAnswer();
  assert.deepEqual(g.state.pendingShot,{target:0,forced:true});g.finishAiming();
  assert.equal(g.state.players[0].hp,live?2:3);assert.equal(g.state.shot.keep,false);
  g.finishShot();assert.equal(g.state.current,1);
});
test('blank self shot keeps turn; blank opponent shot ends turn',()=>{
  const g=ready(fresh(),[false,false,true]);shoot(g,0);assert.equal(g.state.shot.keep,true);g.finishShot();assert.equal(g.state.current,0);
  ready(g,[false,true]);shoot(g,1);g.finishShot();assert.equal(g.state.current,1);
});
test('magnifier reads chamber once, beer clears knowledge and preserves saw',()=>{
  const g=ready(fresh(),[false,true]);g.state.players[0].items=['glass','beer'];g.state.saw=true;
  assert.equal(g.useItem(0),true);assert.equal(g.state.peek,false);g.finishItem();
  assert.equal(g.useItem(0),true);assert.equal(g.state.peek,null);assert.equal(g.state.saw,true);g.finishEject();
  assert.equal(g.state.current,0);assert.equal(g.state.phase,'target');assert.deepEqual(g.state.ammo,[true]);
});
test('last shell ejected reloads and returns to target without another question',()=>{
  const g=ready(fresh(),[true]);const count=g.state.questionCount;g.state.players[0].items=['beer'];
  g.useItem(0);g.finishEject();assert.equal(g.state.phase,'reload');assert.equal(g.state.returnPhase,'target');g.finishReload();
  assert.equal(g.state.phase,'target');assert.equal(g.state.questionCount,count);assert.equal(g.state.current,0);assert.equal(g.state.ammo.length,6);
});
test('cigarette refuses full HP and restores only one HP',()=>{
  const g=ready(fresh());g.state.players[0].items=['cigarette'];assert.equal(g.useItem(0),false);
  g.state.players[0].hp=1;assert.equal(g.useItem(0),true);assert.equal(g.state.players[0].hp,2);assert.equal(g.state.players[0].items.length,0);
});
for(const live of [true,false])test(`saw doubles only a live shot and is consumed, live=${live}`,()=>{
  const g=ready(fresh(),[live,true]);g.state.players[0].items=['saw','saw'];g.useItem(0);g.finishItem();assert.equal(g.useItem(0),false);
  shoot(g,1);assert.equal(g.state.shot.damage,live?2:0);assert.equal(g.state.saw,false);
});
test('cuffs skip next living opponent exactly once and cannot stack',()=>{
  const g=ready(fresh());g.state.players[1].hp=0;g.state.players[0].items=['cuffs','cuffs'];
  g.useItem(0);g.finishItem();assert.equal(g.state.players[2].cuffed,true);assert.equal(g.useItem(0),false);
  shoot(g,3);g.finishShot();assert.equal(g.state.current,3);assert.equal(g.state.players[2].cuffed,false);
});
test('dead targets, invalid answers and actions outside phase are rejected',()=>{
  const g=fresh();assert.equal(g.answer(4),false);assert.equal(g.answer(NaN),false);assert.equal(g.chooseTarget(1),false);assert.equal(g.fire(),false);
  ready(g);g.state.players[1].hp=0;assert.equal(g.chooseTarget(1),false);assert.equal(g.chooseTarget(-1),false);assert.equal(g.useItem(-1),false);
  assert.equal(g.finishAiming(),false);assert.equal(g.finishShot(),false);
});
test('one aiming phase consumes exactly one shell despite repeated callbacks',()=>{
  const g=ready(fresh());shoot(g,1);const count=g.state.ammo.length;
  assert.equal(g.finishAiming(),false);assert.equal(g.fire(),false);assert.equal(g.state.ammo.length,count);
});
test('last shot reloads and advances question/turn; victory preserves winner',()=>{
  const g=ready(fresh(),[true]);shoot(g,1);g.finishShot();assert.equal(g.state.phase,'reload');g.finishReload();assert.equal(g.state.current,1);assert.equal(g.state.questionCount,2);
  g.state.players[0].hp=0;g.state.players[2].hp=1;g.state.players[3].hp=0;ready(g,[true]);shoot(g,2);g.finishShot();assert.equal(g.state.phase,'won');assert.equal(g.state.winner,1);
});
test('restart clears all temporary state, events, HP, cuffs and inventory',()=>{
  const g=ready(fresh());g.state.players[2].cuffed=true;g.state.players[1].hp=0;g.state.saw=true;g.state.peek=true;g.start();
  assert.equal(g.state.phase,'reload');assert.equal(g.state.questionCount,0);assert.equal(g.state.winner,null);assert.equal(g.state.saw,false);assert.equal(g.state.peek,null);assert.equal(g.state.pendingShot,null);
  for(const p of g.state.players){assert.equal(p.hp,3);assert.equal(p.cuffed,false);assert.equal(p.items.length,2);}
});
test('100 seeded complete games reach one winner with stable invariants',()=>{
  for(let seed=1;seed<=100;seed++) {
    let n=seed;const g=new SurvivalGame(()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;});g.start();
    let steps=0;
    while(g.state.phase!=='won'&&steps++<2000){
      const s=g.state;
      if(s.phase==='reload')g.finishReload();
      else if(s.phase==='question')g.answer(g.question().answer);
      else if(s.phase==='verdict')g.finishAnswer();
      else if(s.phase==='target'){g.chooseTarget(g.nextOpponent());g.fire();}
      else if(s.phase==='aiming')g.finishAiming();
      else if(s.phase==='shot')g.finishShot();
      for(const p of s.players){assert.ok(p.hp>=0&&p.hp<=3);assert.ok(p.items.length<=4);}
      assert.ok(s.ammo.length<=6);assert.ok(s.events.length<=60);
    }
    assert.equal(g.state.phase,'won');assert.equal(g.state.players.filter(p=>p.hp>0).length,1);
  }
});
