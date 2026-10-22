// Run against a static server. PLAYWRIGHT_PATH may point to an existing Playwright install.
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts');
const channel=process.env.BROWSER_CHANNEL||'chrome';
const layoutOnly=process.argv.includes('--layout-only');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const bytes=name=>fs.readFileSync(path.join(root,name));
const engine=bytes('engine.js').toString().replace(/\r\n/g,'\n');
const audio=bytes('game.js').toString().replace(/\r\n/g,'\n');
const preserved={
 engineFile:sha(bytes('engine.js')),
 engine:sha(engine.slice(engine.indexOf('// ENGINE START'),engine.indexOf('// ENGINE END')+'// ENGINE END'.length)),
 questions:sha(engine.slice(engine.indexOf('const QUESTIONS = ['),engine.indexOf('class SurvivalGame'))),
 originalAudio:sha(audio.slice(audio.indexOf('function stopAmbience(){'),audio.indexOf('// Additional turntable friction'))),
 shaderFile:sha(bytes('retro-pass.js')),netlifyFile:sha(bytes('netlify.toml'))
};
assert.deepEqual(preserved,JSON.parse(bytes('artifacts/camera-typography-before.json')));
fs.writeFileSync(path.join(out,'camera-typography-after.json'),JSON.stringify(preserved,null,2)+'\n');
const povPreserved=Object.fromEntries(Object.keys(JSON.parse(bytes('artifacts/pov-preservation-before.json'))).map(name=>[name,sha(bytes(name))]));
assert.deepEqual(povPreserved,JSON.parse(bytes('artifacts/pov-preservation-before.json')));
fs.writeFileSync(path.join(out,'pov-preservation-after.json'),JSON.stringify(povPreserved,null,2)+'\n');

(async()=>{
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const checks=[],errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('requestfailed',r=>failed.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url())});
 const check=(name,info={})=>{checks.push({name,...info});console.log('PASS',name,JSON.stringify(info));};
 const shot=name=>page.screenshot({path:path.join(out,`pov-${channel}-${name}.png`)});
 const wait=phase=>page.waitForFunction(p=>__test.game.state.phase===p,phase,{polling:40,timeout:18000});
 const settled=()=>page.waitForFunction(()=>!__test.world.cameraTransition,null,{polling:40,timeout:6000});
 const correct=async()=>{const a=await page.evaluate(()=>__test.game.question().answer);await page.locator(`[data-answer="${a}"]`).click();await wait('target');};
 const camera=()=>page.evaluate(()=>({id:__test.world.cameraSeat,position:__test.world.camera.position.toArray(),moves:__test.world.cameraTransitions}));
 await page.route('**/game.js',async route=>{
   const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nimport {QUESTIONS} from "./engine.js";globalThis.__test={game,render,start,questions:QUESTIONS,get world(){return world},get epoch(){return epoch}};'});
 });
 try{
   await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080');
   await page.waitForFunction(()=>globalThis.__test?.world,null,{polling:40,timeout:60000});
   await page.locator('#start').click();await wait('question');await settled();
   const identities=await page.evaluate(()=>__test.world.seats.map(s=>({id:s.id,uuid:s.root.uuid,position:s.root.position.toArray(),rotation:s.root.rotation.toArray()})));
   assert.equal((await camera()).id,0);assert.equal(await page.locator('.world-label').count(),4);
   check('engine, 31 questions, original audio, shader and Netlify hashes unchanged',preserved);

   const measures=await page.evaluate(()=>{
     const s=__test.game.state,rows=[],size=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
     for(let i=0;i<__test.questions.length;i++){
       s.questionIndex=i;__test.render();
       const panel=document.querySelector('#terminal-content'),rect=panel.getBoundingClientRect(),answers=[...document.querySelectorAll('[data-answer]')];
       rows.push({index:i,characters:__test.questions[i].text.replace(/<[^>]*>/g,'').length,
         height:document.querySelector('#terminal').offsetHeight,scroll:panel.scrollHeight-panel.clientHeight,
         complete:answers.length===4&&answers.every(el=>el.getBoundingClientRect().bottom<=rect.bottom&&el.scrollWidth<=el.clientWidth)});
     }
     s.questionIndex=0;__test.render();
     return {rows,sizes:{question:size('#question-title'),answers:size('.choice'),letters:size('.choice-letter'),names:size('.world-label strong'),hp:size('.label-health'),turn:size('#turn-title'),controls:size('#restart'),journal:size('.events li')},
       labelsInCanvas:!!document.querySelector('#world .world-label'),canvas:[document.querySelector('canvas').clientWidth,document.querySelector('canvas').clientHeight]};
   });
   assert.deepEqual(Object.fromEntries(Object.entries(measures.sizes).map(([k,v])=>[k,Math.round(v)])),{question:44,answers:32,letters:36,names:36,hp:28,turn:38,controls:26,journal:22});
   assert.ok(measures.rows.every(r=>r.scroll===0&&r.complete&&r.height<1080*.5));
   assert.equal(measures.labelsInCanvas,false);assert.deepEqual(measures.canvas,[1920,1080]);
   const longest=measures.rows.reduce((a,b)=>a.characters>b.characters?a:b);
   await page.evaluate(i=>{__test.game.state.questionIndex=i;__test.render()},longest.index);await shot('longest-question');
   check('all 31 questions and four complete answers fit Full HD without scrolling; crisp DOM typography',{sizes:measures.sizes,longest,maxPanelHeight:Math.max(...measures.rows.map(r=>r.height))});

   // Check actual curved travel corridors, including the slumped character pose.
   const clearance=await page.evaluate(()=>{
     const w=__test.world,meshes=[];w.scene.updateMatrixWorld(true);
     w.scene.traverse(o=>{if(o.isMesh&&o.material.visible!==false)meshes.push(o)});
     const ray=new w.raycaster.constructor();ray.far=.1;
     const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(p=>w.up.clone().set(...p));
     const collisions=[],foreignHidden=[],anchors=[];
     for(const seat of w.seats){
       anchors.push({id:seat.id,local:seat.root.worldToLocal(seat.cameraAnchor.position.clone()).toArray(),look:seat.cameraAnchor.look.toArray(),radius:Math.hypot(seat.cameraAnchor.position.x,seat.cameraAnchor.position.z)});
     }
     const poses=w.seats.map(s=>({body:s.body.rotation.clone(),head:s.head.rotation.clone()}));
     for(const dead of [false,true]){
       w.seats.forEach((seat,i)=>{seat.body.rotation.copy(poses[i].body);seat.head.rotation.copy(poses[i].head);if(dead){seat.body.rotation.x=.52;seat.head.rotation.x=.3}});w.scene.updateMatrixWorld(true);
       for(const seat of w.seats)for(const other of w.seats){
         w.camera.position.copy(seat.cameraAnchor.position);w.cameraLook.copy(seat.cameraAnchor.look);w.focusSeat(other.id,0);const move=w.cameraTransition;
         for(let n=0;n<=20;n++){
           w.updateCamera(move.start+move.duration*n/20,0,0);
           const visible=meshes.filter(o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true});
           for(const direction of directions){ray.set(w.camera.position,direction);if(ray.intersectObjects(visible,false).length)collisions.push({from:seat.id,to:other.id,n,dead});}
           for(const s of w.seats)if(s.id!==seat.id&&s.id!==other.id&&!s.body.visible)foreignHidden.push({from:seat.id,to:other.id,id:s.id,n,dead});
         }
       }
     }
     w.seats.forEach((seat,i)=>{seat.body.rotation.copy(poses[i].body);seat.head.rotation.copy(poses[i].head)});w.scene.updateMatrixWorld(true);
     return {collisions,foreignHidden,anchors};
   });
   assert.deepEqual(clearance.collisions,[]);assert.deepEqual(clearance.foreignHidden,[]);
   assert.ok(clearance.anchors.every(r=>r.radius>2.9&&r.radius<3.1&&Math.abs(r.local[0])<1e-6&&r.local[1]===2.32&&Math.abs(r.local[2])<=.041&&Math.hypot(r.look[0],r.look[2])<1e-6&&r.look[1]===1.2));
   check('seat-local eye anchors point into table; 100 mm clearance on 16 curved routes with standing/slumped models',clearance);

   for(let id=0;id<4;id++){
     await page.evaluate(id=>{__test.game.state.current=id;__test.game.state.questionIndex=0;__test.render()},id);await settled();
     const info=await page.evaluate(()=>{
       const w=__test.world,seat=w.seats[w.cameraSeat],opposite=w.seats[(seat.id+2)%4],v=opposite.head.getWorldPosition(w.up.clone()).project(w.camera);
       const labels=w.seats.filter(s=>!s.label.hidden).map(s=>{const p=s.headAnchor.getWorldPosition(w.up.clone()).project(w.camera);return {id:s.id,name:s.label.querySelector('strong').textContent,error:Math.hypot(parseFloat(s.label.style.left)-(p.x*.5+.5)*innerWidth,parseFloat(s.label.style.top)-(-p.y*.5+.5)*innerHeight)}});
       const points=[];w.weapon.updateWorldMatrix(true,true);w.weapon.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const p=w.up.clone().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(w.camera);points.push([(p.x*.5+.5)*innerWidth,(-p.y*.5+.5)*innerHeight])}});
       return {id:seat.id,position:w.camera.position.toArray(),look:w.cameraLook.toArray(),error:w.camera.position.distanceTo(seat.cameraAnchor.position),ownBodyHidden:!seat.body.visible,ownNameHidden:seat.label.hidden,
         oppositeVisible:opposite.body.visible&&Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z<1,labels,
         gun:{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))},
         hudTop:document.querySelector('#terminal').getBoundingClientRect().top};
     });
     assert.ok(info.error<1e-6&&info.ownBodyHidden&&info.ownNameHidden&&info.oppositeVisible);
     assert.ok(info.labels.length>0&&info.labels.every(s=>s.name===`TỔ ${s.id+1}`&&s.error<.02));
     assert.ok(info.gun.left>0&&info.gun.right<1920&&info.gun.top>0&&info.gun.bottom<info.hudTop);
     assert.ok(info.gun.bottom<1080-14-Math.max(...measures.rows.map(r=>r.height)));
     await shot(`seat-${id+1}`);check(`seat ${id+1} POV: own face hidden, opposite player visible, entire gun above HUD`,info);
   }

   // Opposite seats and mid-transition replacement, without timers or moving the models.
   const motion=await page.evaluate(()=>{
     const w=__test.world,s=__test.game.state;s.current=0;__test.render();w.updateCamera(w.cameraTransition.start+w.cameraTransition.duration,0,0);
     s.current=2;__test.render();const m=w.cameraTransition;
     const samples=[0,.25,.5,.75,1].map(p=>{w.updateCamera(m.start+p*m.duration,0,0);const forward=w.up.clone().set(0,0,-1).applyQuaternion(w.camera.quaternion),toward=w.cameraLook.clone().sub(w.camera.position).normalize();return {p,position:w.camera.position.toArray(),radius:Math.hypot(w.camera.position.x,w.camera.position.z),focusDot:forward.dot(toward)}});
     s.current=1;__test.render();w.updateCamera(w.cameraTransition.start+350,0,0);
     const before=w.camera.position.toArray();s.current=3;__test.render();const after=w.cameraTransition.from.toArray();
     const count=w.cameraTransitions;for(let i=0;i<100;i++)__test.render();
     return {from:m.from.toArray(),to:m.to.toArray(),duration:m.duration,samples,before,after,count,afterRenders:w.cameraTransitions};
   });
   assert.equal(motion.duration,2600);assert.deepEqual(motion.before,motion.after);assert.equal(motion.count,motion.afterRenders);
   for(const [actual,expected]of [[motion.samples[0].position,motion.from],[motion.samples.at(-1).position,motion.to]])actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6));
   assert.ok(motion.samples.every(s=>s.radius>=1.95&&s.focusDot>.999999));
   assert.notDeepEqual(motion.from,motion.to);await settled();check('2600 ms smootherstep curved move keeps table focus, safe replacement; 100 HUD renders never restart move',motion);

   if(!layoutOnly){
   await page.locator('#restart').click();await wait('question');
   const turns=[];
   for(let i=0;i<8;i++){
     await settled();const actor=await page.evaluate(()=>__test.game.state.current);turns.push(actor);
     await page.evaluate(()=>{__test.game.state.ammo=[false,true,false,true,false,true];__test.render()});
     const wrong=await page.evaluate(()=>(__test.game.question().answer+1)%4);await page.locator(`[data-answer="${wrong}"]`).click();
     await wait('aiming');assert.equal((await camera()).id,actor);await wait('shot');assert.equal((await camera()).id,actor);
     await wait('question');assert.equal((await camera()).id,(actor+1)%4);
     console.log('TURN',i+1,'camera',actor+1,'->',(actor+1)%4+1);
   }
   assert.deepEqual(turns,[0,1,2,3,0,1,2,3]);await settled();check('two real rounds follow 1 → 2 → 3 → 4; trigger/shot never steal camera',{turns});

   // Cuffs skip the adjacent seat, then a live shot eliminates it in a new fixture.
   for(const eliminate of [false,true]){
     await page.locator('#restart').click();await wait('question');
     await page.evaluate(eliminate=>{const s=__test.game.state;s.ammo=[eliminate,true,false,true,false,false];s.players[0].items=eliminate?[]:['cuffs'];if(eliminate)s.players[1].hp=1;__test.render()},eliminate);
     await correct();if(!eliminate){await page.locator('[data-item="0"]').click();await wait('target')}
     const before=await camera();await page.locator('[data-target="1"]').click();const selected=await camera();
     assert.equal(selected.id,0);assert.equal(selected.moves,before.moves);assert.deepEqual(selected.position,before.position);
     await page.locator('#fire').click();await wait('aiming');assert.equal((await camera()).id,0);
     await wait('shot');assert.equal((await camera()).id,0);await wait('question');await settled();assert.equal((await camera()).id,2);
     if(eliminate)assert.equal(await page.locator('[data-team="1"]').evaluate(e=>e.classList.contains('eliminated')),true);
     check(eliminate?'eliminated seat is skipped; camera follows next living team':'cuffs skip Tổ 2; opposite-seat transition goes directly to Tổ 3');
   }

   const beforeRestart=await camera();for(let i=0;i<5;i++)await page.locator('#restart').click();await wait('question');await settled();
   assert.equal((await camera()).id,0);assert.equal((await camera()).moves,beforeRestart.moves+5);
   assert.deepEqual(await page.evaluate(()=>__test.world.seats.map(s=>({id:s.id,uuid:s.root.uuid,position:s.root.position.toArray(),rotation:s.root.rotation.toArray()}))),identities);
   assert.equal(await page.locator('.world-label').count(),4);assert.equal(await page.locator('canvas').count(),1);
   check('five restarts replace transitions; four models, seats, names and one renderer retain identity');

   await page.evaluate(()=>{const s=__test.game.state;s.questionIndex=30;__test.render()});
   await correct();await page.locator('[data-target="1"]').click();await page.locator('#fire').click();await wait('question');
   assert.equal(await page.evaluate(()=>__test.game.state.questionIndex),0);check('browser question 31 wraps to original question 1');
   }

   for(const [width,height] of [[1920,1080],[1280,720],[390,844]]){
     await page.setViewportSize({width,height});await settled();await page.waitForTimeout(400);
     const layout=await page.evaluate(()=>{
       const p=document.querySelector('#terminal-content'),scrollable=p.scrollHeight>p.clientHeight,seen=[];
       for(let i=0;i<__test.questions.length;i++){
         __test.game.state.questionIndex=i;__test.render();
         for(const el of document.querySelectorAll('[data-answer]')){el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect(),parent=p.getBoundingClientRect();seen.push(r.top>=parent.top-1&&r.bottom<=parent.bottom+1&&el.scrollWidth<=el.clientWidth)}
       }
       __test.game.state.questionIndex=0;__test.render();
       p.scrollTop=0;
       return {viewport:[innerWidth,innerHeight],canvas:[document.querySelector('canvas').clientWidth,document.querySelector('canvas').clientHeight],overflow:document.documentElement.scrollWidth>innerWidth,scrollable,seen};
     });
     assert.equal(layout.overflow,false);assert.deepEqual(layout.canvas,[width,height]);assert.ok(layout.seen.length===124&&layout.seen.every(Boolean));
     const labels=await page.evaluate(()=>{
       const w=__test.world,rows=[];
       for(let id=0;id<4;id++){
         __test.game.state.current=id;__test.render();if(w.cameraTransition)w.updateCamera(w.cameraTransition.start+w.cameraTransition.duration,0,0);w.updateLabels();
         const other=w.seats[(id+2)%4],r=other.label.getBoundingClientRect();
         rows.push({id,ownHidden:w.seats[id].label.hidden,oppositeLabel:!other.label.hidden,inBounds:r.left>=0&&r.right<=innerWidth&&r.top>=0});
       }
       return rows;
     });
     assert.ok(labels.every(r=>r.ownHidden&&r.oppositeLabel&&r.inBounds));
     await shot(`${width}x${height}`);check('responsive, all four answers reachable without clipped text',layout);
   }
   const tooltip=await page.evaluate(()=>{
     const w=__test.world;__test.game.state.players[__test.game.state.current].items=['glass'];__test.render();
     const intersect=w.raycaster.intersectObjects;w.raycaster.intersectObjects=()=>[{object:w.slots[__test.game.state.current*4].hit}];
     try{w.point({clientX:innerWidth-2,clientY:innerHeight-2});const r=w.tooltip.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight}}
     finally{w.raycaster.intersectObjects=intersect;w.clearHover()}
   });
   assert.ok(tooltip.left>=0&&tooltip.top>=0&&tooltip.right<=tooltip.width&&tooltip.bottom<=tooltip.height);check('enlarged tooltip remains inside viewport even at bottom-right pointer',tooltip);
   await page.setViewportSize({width:1920,height:1080});await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement,null,{polling:30,timeout:6000});await shot('fullscreen');await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement,null,{polling:30,timeout:6000});
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);check('fullscreen and static-server WebGL: zero JS, console, shader, HTTP or resource errors');
   fs.writeFileSync(path.join(out,`${layoutOnly?'pov-layout':'pov-camera'}-${channel}-verification.json`),JSON.stringify({browser:channel,scope:layoutOnly?'seat POV and typography only':'seat POV, typography and real game turns',date:new Date().toISOString(),timing:'original production delays',checks,errors,failed,limits:['No physical 5 metre projection or speaker listening test.','Software WebGL; no hardware FPS benchmark.']},null,2));
   console.log('SUCCESS',checks.length);
 }catch(e){console.error(e);console.error('ERRORS',errors,'REQUESTS',failed);await shot('failure').catch(()=>{});process.exitCode=1;}
 finally{await browser.close()}
})();
