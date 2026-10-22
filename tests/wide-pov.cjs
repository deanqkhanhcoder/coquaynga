const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=path.resolve(__dirname,'../artifacts');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu-sandbox']});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],failed=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});page.on('requestfailed',r=>failed.push(r.url()));
 await page.route('**/game.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nglobalThis.__test={game,render,start,get world(){return world}};'});});
 try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080');await page.waitForFunction(()=>globalThis.__test?.world,null,{polling:40,timeout:60000});
 await page.locator('#start').click();await page.waitForFunction(()=>__test.game.state.phase==='question',null,{polling:40,timeout:18000});
 for(const [width,height]of [[1920,1080],[1280,720]]){
  await page.setViewportSize({width,height});
  for(let id=0;id<4;id++){
   await page.evaluate(id=>{__test.game.state.current=id;__test.render()},id);await page.waitForFunction(()=>!__test.world.cameraTransition,null,{polling:40,timeout:8000});
   const info=await page.evaluate(()=>{
    const w=__test.world,faces=w.seats.filter(s=>s.id!==w.cameraSeat).map(s=>{
     const points=[];s.head.updateWorldMatrix(true,true);s.head.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=w.up.clone().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(w.camera);points.push({x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,z:v.z})}});
     const center=s.head.localToWorld(w.up.clone().set(0,0,.35)).project(w.camera);
     return {id:s.id,visible:s.body.visible,label:!s.label.hidden,center:[(center.x*.5+.5)*innerWidth,(-center.y*.5+.5)*innerHeight],left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y)),depth:points.every(p=>p.z>0&&p.z<1)};
    });return {id:w.cameraSeat,width:innerWidth,height:innerHeight,fov:w.camera.fov,faces,ownHidden:!w.seats[w.cameraSeat].body.visible,hudTop:document.querySelector('#terminal').getBoundingClientRect().top};
   });
   assert.ok(info.ownHidden&&info.fov>=88);assert.equal(info.faces.length,3);
   for(const face of info.faces)assert.ok(face.visible&&face.label&&face.depth&&face.left>0&&face.right<width&&face.top>0&&face.bottom<info.hudTop,JSON.stringify(info));
   checks.push(info);await page.screenshot({path:path.join(out,`wide-pov-${width}-seat-${id+1}.png`)});console.log('PASS',width,'seat',id+1,'all 3 masks and names visible');
  }
 }
 const motion=await page.evaluate(()=>{const w=__test.world;__test.game.state.current=0;__test.render();w.updateCamera(w.cameraTransition.start+w.cameraTransition.duration,0,0);__test.game.state.current=2;__test.render();const m=w.cameraTransition;const samples=[0,.1,.25,.5,.75,.9,1].map(p=>{w.updateCamera(m.start+p*m.duration,0,0);return {p,position:w.camera.position.toArray()}});return {duration:m.duration,samples}});
 assert.equal(motion.duration,2600);assert.notDeepEqual(motion.samples[0].position,motion.samples.at(-1).position);checks.push(motion);
 await page.locator('#restart').click();await page.waitForFunction(()=>__test.game.state.phase==='question'&&!__test.world.cameraTransition,null,{polling:40,timeout:18000});assert.equal(await page.evaluate(()=>__test.world.cameraSeat),0);
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 fs.writeFileSync(path.join(out,'wide-pov-verification.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,failed},null,2));console.log('SUCCESS wide POV, 2600ms transition, restart, zero errors');
 }catch(e){console.error(e);await page.screenshot({path:path.join(out,'wide-pov-failure.png')}).catch(()=>{});process.exitCode=1}
 finally{await browser.close()}
})();
