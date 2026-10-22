const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const channel=process.env.BROWSER_CHANNEL||'chrome';const smoke=process.argv.includes('--smoke');
const out=path.resolve(__dirname,'../artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel,headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[],failed=[],checks=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('requestfailed',r=>failed.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url())});
 const check=(name,info={})=>{checks.push({name,...info});console.log('PASS',name,JSON.stringify(info));};
 const screenshot=name=>page.screenshot({path:path.join(out,`pov-regression-${channel}-${name}.png`)});
 const wait=phase=>page.waitForFunction(p=>__test.game.state.phase===p,phase,{polling:50,timeout:18000});
 const get=()=>page.evaluate(()=>{const s=__test.game.state;return {phase:s.phase,current:s.current,hp:s.players.map(p=>p.hp),ammo:s.ammo.length,peek:s.peek,saw:s.saw,shot:s.shot,questionCount:s.questionCount,winner:s.winner,round:s.round}});
 const correct=async()=>{const a=await page.evaluate(()=>__test.game.question().answer);await page.locator(`[data-answer="${a}"]`).click();await wait('target');};
 const item=async owner=>{await page.locator(`[data-owner="${owner}"][data-item="0"]`).click();await wait('target');};
 await page.route('**/game.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nglobalThis.__test={game,render,start,get world(){return world},get epoch(){return epoch},get sounds(){return activeSounds.size},get ambience(){return ambience.length},get runner(){return runnerEpoch}};'});});
 try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080');await page.waitForFunction(()=>globalThis.__test?.world,null,{timeout:60000});await page.waitForTimeout(1200);
 await page.evaluate(()=>{globalThis.__cameraMismatches=[];new MutationObserver(()=>{const s=__test.game.state;if(s.phase!=='idle'&&__test.world.cameraSeat!==(s.phase==='won'?s.winner:s.current))__cameraMismatches.push({phase:s.phase,current:s.current,camera:__test.world.cameraSeat})}).observe(document.querySelector('.app'),{attributes:true,attributeFilter:['data-phase']})});
 const initial=await page.evaluate(()=>{const w=__test.world,r=w.renderer.domElement.getBoundingClientRect();return {fov:w.camera.fov,canvas:[r.width,r.height],viewport:[innerWidth,innerHeight],buffer:[w.renderWidth,w.renderHeight],monitors:w.monitors.length,slots:w.slots.length,seats:w.seats.length,passes:w.composer.passes.map(p=>p.constructor.name),geometries:w.renderer.info.memory.geometries,textures:w.renderer.info.memory.textures,calls:w.renderer.info.render.calls}});
 assert.deepEqual(initial.canvas,initial.viewport);assert.ok(initial.fov>=88&&initial.fov<=100);assert.equal(initial.monitors,4);assert.equal(initial.slots,16);assert.equal(initial.seats,4);assert.deepEqual(initial.passes,['RenderPass','OutputPass','ShaderPass']);assert.ok(initial.buffer[0]<1440);
 assert.equal(await page.locator('.crew-strip,.team,.health').count(),0);assert.equal(await page.locator('canvas').count(),1);
 check('full viewport POV, four physical CRTs, inventory slots, low-res custom shader pipeline',initial);await screenshot('room');
 await page.locator('#start').click();
 await page.waitForFunction(()=>__test.game.state.phase==='reload'&&__test.world.weapon.rotation.y>.5,null,{polling:30,timeout:12000});
 assert.equal(await page.locator('#terminal-content').isVisible(),false);
 await wait('question');await page.waitForFunction(()=>__test.world.weapon.rotation.y===0,null,{polling:30,timeout:6000});
 check('shotgun rotates with the platter during reload, then clears its local spin');
 const hud=await page.locator('#terminal').boundingBox();assert.ok(hud.height<900*.55);
 await page.evaluate(()=>{const s=__test.game.state;s.ammo=[false,true,false,true,false,true];s.players[0].items=['glass','cigarette','saw','beer'];s.players[0].hp=2;__test.render();});
 await screenshot('question');check('larger projection terminal, four original answers, no 2D team/inventory cards',{height:hud.height});
 await correct();
 await page.locator('#hud-toggle').click();
 const slotPoint=await page.evaluate(()=>{const w=__test.world,s=w.slots[0],v=s.root.localToWorld(s.hit.position.clone());v.project(w.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};});
 await page.mouse.move(slotPoint.x,slotPoint.y);await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>__test.world.hover?.kind),'item');assert.equal(await page.evaluate(()=>__test.world.hover?.owner),0);
 assert.equal(await page.evaluate(()=>__test.world.slots[0].outlines.glass.visible),true);await screenshot('item-hover');
 await page.mouse.click(slotPoint.x,slotPoint.y);await wait('target');assert.equal((await get()).peek,false);
 await page.locator('#hud-toggle').click();
 assert.equal(await page.evaluate(()=>__test.world.slots[0].type),'cigarette');check('real 3D inventory raycast, silhouette highlight and correct slot reindex after use');
 await item(0);assert.equal((await get()).hp[0],3);await item(0);assert.equal((await get()).saw,true);await item(0);assert.equal((await get()).ammo,5);assert.equal((await get()).peek,null);assert.equal((await get()).saw,true);
 check('magnifier, cigarette, saw and beer preserve original rules through compact shortcuts');
 await page.locator('#hud-toggle').click();
 for(let id=0;id<4;id++){
   await page.evaluate(id=>{__test.game.state.current=(id+2)%4;__test.render()},id);
   await page.waitForFunction(()=>!__test.world.cameraTransition,null,{polling:50});
   const pt=await page.evaluate(id=>{const w=__test.world,v=w.monitors[id].screen.position.clone();w.monitors[id].screen.getWorldPosition(v);v.project(w.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}},id);
   await page.mouse.click(pt.x,pt.y);assert.equal(await page.evaluate(()=>__test.game.state.target),id);
 }
 await page.evaluate(()=>{__test.game.state.current=0;__test.render()});
 await page.waitForFunction(()=>!__test.world.cameraTransition,null,{polling:50});
 await page.locator('#hud-toggle').click();check('all four physical CRTs map to exact teams when viewed from opposite-seat POVs');
 const facePoint=await page.evaluate(()=>{const w=__test.world,v=w.seats[2].aim.clone().project(w.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight}});
 await page.mouse.click(facePoint.x,facePoint.y);assert.equal(await page.evaluate(()=>__test.game.state.target),2);
 const povBefore=await page.evaluate(()=>({id:__test.world.cameraSeat,position:__test.world.camera.position.toArray(),moves:__test.world.cameraTransitions}));
 await page.locator('[data-target="1"]').click();
 assert.deepEqual(await page.evaluate(()=>({id:__test.world.cameraSeat,position:__test.world.camera.position.toArray(),moves:__test.world.cameraTransitions})),povBefore);
 await page.waitForFunction(()=>{const w=__test.world,d=w.gun.position.clone().set(0,0,-1).applyQuaternion(w.gun.quaternion);return d.dot(w.seats[1].aim.clone().sub(w.gun.position).normalize())>.98},null,{timeout:6000});
 const rotor=await page.evaluate(()=>__test.world.turntable.rotation.y);check('mask raycast selects fixed team and both gun/turntable turn toward it',{rotor});await screenshot('aim');
 await page.locator('#fire').click();
 assert.equal(await page.locator('#terminal-content').isVisible(),false);await wait('shot');assert.equal((await get()).shot.damage,2);
 const liveVisual=await page.evaluate(()=>{const w=__test.world;w.update(w.phaseAt+40,.016);return {flash:w.flash.visible,light:w.muzzleLight.intensity,recoil:w.weapon.position.z}});
 assert.equal(liveVisual.flash,true);assert.ok(liveVisual.light>0);assert.ok(liveVisual.recoil>0);await screenshot('shot');await wait('question');check('live recoil/flash, CRT HP update and automatic terminal collapse during actions');
 const hpMonitor=await page.evaluate(()=>({key:__test.world.monitors[1].key,frame:__test.world.monitors[1].texture.version}));assert.ok(hpMonitor.key.startsWith('1,'));
 if(!smoke){
   await page.evaluate(()=>{__test.game.state.ammo=[true,false,true];__test.game.state.saw=true;__test.render();});
   const wrong=await page.evaluate(()=>(__test.game.question().answer+1)%4);await page.locator(`[data-answer="${wrong}"]`).click();await wait('shot');assert.equal((await get()).shot.forced,true);assert.equal((await get()).shot.damage,1);await wait('question');check('wrong answer forces self-shot and original one HP damage');
   const actor=(await get()).current;await page.evaluate(()=>{__test.game.state.ammo=[false,true,false];__test.render();});await correct();await page.locator(`[data-target="${actor}"]`).click();await page.locator('#fire').click();await wait('shot');assert.equal((await get()).shot.keep,true);
   const blank=await page.evaluate(()=>{const w=__test.world;w.update(w.phaseAt+40,.016);return {flash:w.flash.visible,light:w.muzzleLight.intensity}});assert.deepEqual(blank,{flash:false,light:0});await wait('question');assert.equal((await get()).current,actor);check('blank self-shot has no live effect and keeps turn');
   await page.evaluate(()=>{const s=__test.game.state;s.ammo=[false];s.players[s.current].items=['cuffs','beer'];__test.render();});await correct();const next=await page.evaluate(()=>__test.game.nextOpponent());await item(actor);assert.equal(await page.evaluate(id=>__test.world.seats[id].cuffs.visible,next),true);
   const count=(await get()).questionCount;await item(actor);assert.equal((await get()).ammo,6);assert.equal((await get()).questionCount,count);check('physical cuffs and last-shell beer reload keep original state transitions');
   const warm=await page.evaluate(()=>({geometries:__test.world.renderer.info.memory.geometries,textures:__test.world.renderer.info.memory.textures}));
   await page.locator(`[data-target="${next}"]`).click();await page.locator('#fire').click();for(let i=0;i<5;i++)await page.locator('#restart').click();await wait('question');await page.waitForTimeout(2800);
   assert.deepEqual((await get()).hp,[3,3,3,3]);assert.equal((await get()).questionCount,1);assert.equal((await get()).ammo,6);
   const stable=await page.evaluate(()=>({geometries:__test.world.renderer.info.memory.geometries,textures:__test.world.renderer.info.memory.textures}));assert.deepEqual(stable,warm);assert.equal(await page.locator('#world canvas').count(),1);check('five restarts cancel old callbacks and keep geometry/texture counts stable',stable);
 }
 await page.locator('#sound').click();assert.equal(await page.evaluate(()=>__test.sounds),0);assert.equal(await page.evaluate(()=>__test.ambience),0);await page.locator('#sound').click();assert.equal(await page.evaluate(()=>__test.ambience),4);await page.locator('#sound').click();check('all original audio nodes and added friction respect mute');
 await page.locator('#quality').click();assert.equal(await page.evaluate(()=>__test.world.quality),'low');await page.locator('#quality').click();assert.equal(await page.evaluate(()=>__test.world.quality),'high');await page.locator('#quality').click();
 await page.locator('#journal-toggle').click();assert.equal(await page.locator('#journal').isVisible(),true);await page.locator('#journal-toggle').click();
 await page.locator('#rules-open').click();assert.equal(await page.locator('#rules').evaluate(el=>el.open),true);await page.locator('#rules-close').click();
 await page.locator('#fullscreen').click();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);await page.locator('#fullscreen').click();check('graphics, journal, full rules and fullscreen controls');
 if(!smoke){
   await page.evaluate(()=>{let seed=711;__test.game.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32}});
   await page.locator('#restart').click();await wait('question');let shots=0;
   while((await get()).phase!=='won'&&shots<80){await correct();const target=await page.evaluate(()=>__test.game.nextOpponent());await page.locator(`[data-target="${target}"]`).click();await page.locator('#fire').click();await page.waitForFunction(()=>['question','won'].includes(__test.game.state.phase),null,{polling:50,timeout:18000});shots++;if(shots%5===0)console.log('PROGRESS',shots,JSON.stringify(await get()));}
   assert.equal((await get()).phase,'won');assert.equal((await get()).hp.filter(v=>v>0).length,1);await screenshot('victory');check('complete match through original-timing UI to one winner',{shots,...await get()});
   await page.locator('#play-again').click();await wait('question');assert.deepEqual((await get()).hp,[3,3,3,3]);check('winner play-again resets all four CRTs/teams');
 }
 for(const [width,height] of [[1280,720],[390,844]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(650);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('[data-answer]').count(),4);const rect=await page.locator('#world canvas').boundingBox();assert.equal(rect.width,width);assert.equal(rect.height,height);await screenshot(`${width}`);check('full viewport responsive layout and all four answer controls',{width,height});
 }
 assert.deepEqual(await page.evaluate(()=>__cameraMismatches),[]);check('camera owner matches current team across all exercised UI phases');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);check('zero shader compile, JS, console, HTTP or resource errors');
 fs.writeFileSync(path.join(out,`pov-regression-${channel}-verification.json`),JSON.stringify({browser:channel,scope:smoke?'interaction/rendering smoke check':'full UI match and branch checks',timing:'original production delays',date:new Date().toISOString(),checks,errors,failed},null,2));console.log('SUCCESS',checks.length);
 }catch(e){console.error(e);console.error('ERRORS',JSON.stringify(errors));console.error('REQUESTS',JSON.stringify(failed));await screenshot('failure').catch(()=>{});process.exitCode=1;}
 finally{await browser.close();}
})();
