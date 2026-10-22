import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createRetroPass } from './retro-pass.js';
import { ITEMS } from './engine.js';

const SEAT_POSITIONS=[[-3.02,-.18],[0,-3.04],[3.02,-.18],[0,3.04]];
// Eye offsets are local to each fixed seat; +Z is the character's seated forward.
// Scene heads are at 2.16 m and the tabletop at 1.205 m, so use the model's eye level.
const TURN_CAMERAS=[
  {eye:[0,2.32,0],focusHeight:1.20},
  {eye:[0,2.32,.04],focusHeight:1.20},
  {eye:[0,2.32,0],focusHeight:1.20},
  {eye:[0,2.32,.04],focusHeight:1.20}
];
const SLOT_POSITIONS=[
  [[-2.08,-.81],[-2.08,-.27],[-2.08,.27],[-2.08,.81]],
  [[-.81,-1.76],[-.27,-1.76],[.27,-1.76],[.81,-1.76]],
  [[2.08,.81],[2.08,.27],[2.08,-.27],[2.08,-.81]],
  [[.81,1.76],[.27,1.76],[-.27,1.76],[-.81,1.76]]
];

// Pure presentation. Only the supplied callbacks may request game actions.
export class GameScene {
  constructor(host,labels,onSelect,onItem,onMechanical) {
    Object.assign(this,{host,labels,onSelect,onItem,onMechanical});
    this.state=null;this.epoch=-1;this.previous=null;this.phaseAt=performance.now();
    this.itemAt=-10000;this.itemType=null;this.destroyed=false;
    this.hidden=document.hidden;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.seed=17004;this.geometryCache=new Map();this.materials=[];this.textures=[];this.extraGeometry=[];
    this.pointer=new THREE.Vector2();this.raycaster=new THREE.Raycaster();
    this.up=new THREE.Vector3(0,1,0);this.aimPoint=new THREE.Vector3();this.aimMatrix=new THREE.Matrix4();
    this.targetQuaternion=new THREE.Quaternion();this.muzzlePosition=new THREE.Vector3();this.spentOrigin=new THREE.Vector3();
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.info.autoReset=false;
    this.renderer.setPixelRatio(1);this.renderer.setClearColor(0x020101);
    this.renderer.domElement.setAttribute('aria-label','Bàn chơi 3D. Nhấp vật phẩm để sử dụng; nhấp mặt nạ hoặc CRT để chọn tổ.');
    host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0x090303,.045);
    this.camera=new THREE.PerspectiveCamera(88,1,.06,24);
    this.camera.position.set(0,2.32,3);this.cameraLook=new THREE.Vector3(0,1.2,0);this.camera.lookAt(this.cameraLook);
    this.cameraSeat=null;this.cameraTransition=null;this.cameraTransitions=0;
    this.labelPoint=new THREE.Vector3();this.labelView=new THREE.Vector3();this.visibleLabels=[];
    const pmrem=new THREE.PMREMGenerator(this.renderer),roomEnv=new RoomEnvironment();
    this.envTarget=pmrem.fromScene(roomEnv,.06);this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=.18;
    roomEnv.dispose();pmrem.dispose();
    this.makeMaterials();
    this.room=new THREE.Group();this.scene.add(this.room);
    this.makeRoom();this.makeTable();this.batchDirect(this.room);
    this.makeSeats();this.makeGun();this.makeInventory();this.makeEffects();this.makeLights();
    this.camera.position.copy(this.seats[3].cameraAnchor.position);
    this.cameraLook.copy(this.seats[3].cameraAnchor.look);this.camera.lookAt(this.cameraLook);
    this.batchDirect(this.weapon,new Set([this.bolt,this.flash]));this.batchDirect(this.pump);
    this.composer=new EffectComposer(this.renderer);
    this.renderPass=new RenderPass(this.scene,this.camera);this.outputPass=new OutputPass();this.retroPass=createRetroPass();
    this.composer.addPass(this.renderPass);this.composer.addPass(this.outputPass);this.composer.addPass(this.retroPass);
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2]){
      target.texture.minFilter=target.texture.magFilter=THREE.NearestFilter;
    }
    this.setQuality('auto');
    this.tooltip=document.getElementById('scene-tooltip');this.hover=null;
    this.move=event=>this.point(event);this.leave=()=>this.clearHover();
    this.click=event=>{
      const hit=this.point(event);if(!hit||this.state?.phase!=='target')return;
      if(hit.kind==='item'){if(!this.availability[hit.owner]?.[hit.index])this.onItem?.(hit.owner,hit.index);}
      else if(this.state.players[hit.owner].hp>0)this.onSelect(hit.owner);
    };
    host.addEventListener('pointermove',this.move);host.addEventListener('pointerleave',this.leave);host.addEventListener('click',this.click);
    this.resize=this.resize.bind(this);this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(host);
    this.tick=this.tick.bind(this);this.frame=0;this.lastTime=performance.now();this.lastRender=0;this.performanceStart=this.lastTime;this.performanceFrames=0;
    this.visibility=()=>{this.hidden=document.hidden;cancelAnimationFrame(this.frame);if(!this.hidden&&!this.destroyed){this.lastTime=performance.now();this.frame=requestAnimationFrame(this.tick);}};
    document.addEventListener('visibilitychange',this.visibility);
    this.contextLost=event=>{event.preventDefault();this.hidden=true;cancelAnimationFrame(this.frame);const el=document.getElementById('world-status');el.hidden=false;el.className='world-status failed';el.textContent='WebGL tạm mất kết nối. Đang khôi phục bàn chơi…';};
    this.contextRestored=()=>{document.getElementById('world-status').hidden=true;this.visibility();};
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
    this.resize();this.frame=requestAnimationFrame(this.tick);
  }

  rand(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  material(options){const m=new THREE.MeshStandardMaterial({flatShading:true,...options});this.materials.push(m);return m;}
  basic(options){const m=new THREE.MeshBasicMaterial(options);this.materials.push(m);return m;}
  geom(key,create){if(!this.geometryCache.has(key))this.geometryCache.set(key,create());return this.geometryCache.get(key);}
  mesh(geo,mat,parent=this.room,x=0,y=0,z=0){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  box(w,h,d,mat,parent=this.room,x=0,y=0,z=0,bevel=0){return this.mesh(this.geom(`b${w},${h},${d},${bevel}`,()=>bevel?new RoundedBoxGeometry(w,h,d,1,bevel):new THREE.BoxGeometry(w,h,d)),mat,parent,x,y,z);}
  cyl(r1,r2,h,mat,parent=this.room,x=0,y=0,z=0,n=16,open=false){return this.mesh(this.geom(`c${r1},${r2},${h},${n},${open}`,()=>new THREE.CylinderGeometry(r1,r2,h,n,1,open)),mat,parent,x,y,z);}
  sphere(rx,ry,rz,mat,parent,x,y,z){const o=this.mesh(this.geom('facetedSphere',()=>new THREE.SphereGeometry(1,12,8)),mat,parent,x,y,z);o.scale.set(rx,ry,rz);return o;}
  torus(r,t,mat,parent,x,y,z){return this.mesh(this.geom(`t${r},${t}`,()=>new THREE.TorusGeometry(r,t,6,24)),mat,parent,x,y,z);}
  rod(a,b,r,mat,parent=this.room){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b),o=this.cyl(r,r,aa.distanceTo(bb),mat,parent);o.position.copy(aa).add(bb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(this.up,bb.sub(aa).normalize());return o;}
  cable(points,r=.022,mat=this.mat.rubber,parent=this.room){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const geo=new THREE.TubeGeometry(curve,20,r,5,false);this.extraGeometry.push(geo);const o=this.mesh(geo,mat,parent);o.castShadow=false;return o;}
  canvasTexture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapNearestFilter;t.anisotropy=1;this.textures.push(t);return t;}
  dirtyTexture(kind,size=256){
    const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');
    const base={olive:[88,86,60],rust:[91,56,48],steel:[75,70,62],wood:[65,43,30],bone:[166,152,123],cloth:[25,22,20],brick:[61,33,29]}[kind];
    const im=ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const grain=(this.rand()-.5)*33+Math.sin(x*.13+y*.07)*7+Math.cos(y*.065)*10;
      const i=(y*size+x)*4;for(let j=0;j<3;j++)im.data[i+j]=Math.max(0,base[j]+grain);im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);
    for(let i=0;i<90;i++){
      const x=this.rand()*size,y=this.rand()*size,r=2+this.rand()*19;
      ctx.fillStyle=i%3?'#20191699':'#ae887b55';ctx.beginPath();
      for(let a=0;a<7;a++){const k=a/7*Math.PI*2;ctx.lineTo(x+Math.cos(k)*r*(.4+this.rand()*.6),y+Math.sin(k)*r*(.4+this.rand()*.6));}ctx.closePath();ctx.fill();
    }
    for(let i=0;i<200;i++){const x=this.rand()*size,y=this.rand()*size;ctx.strokeStyle=i%4?'#120d0ba0':'#e0d5b080';ctx.lineWidth=this.rand()<.8?1:2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+this.rand()*32-5,y+this.rand()*3);ctx.stroke();}
    const t=this.canvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
  }
  makeMaterials(){
    const olive=this.dirtyTexture('olive'),rust=this.dirtyTexture('rust'),steel=this.dirtyTexture('steel'),wood=this.dirtyTexture('wood'),bone=this.dirtyTexture('bone'),cloth=this.dirtyTexture('cloth'),brick=this.dirtyTexture('brick');
    this.mat={
      olive:this.material({map:olive,bumpMap:olive,bumpScale:.012,metalness:.35,roughness:.88}),
      rust:this.material({map:rust,bumpMap:rust,bumpScale:.025,metalness:.48,roughness:.91}),
      steel:this.material({map:steel,bumpMap:steel,bumpScale:.008,color:0x98948a,metalness:.78,roughness:.63}),
      gun:this.material({map:steel,bumpMap:steel,bumpScale:.004,color:0x626965,metalness:.8,roughness:.48}),
      stock:this.material({map:wood,bumpMap:wood,bumpScale:.008,color:0x95674c,roughness:.75}),
      pallet:this.material({map:wood,bumpMap:wood,bumpScale:.015,color:0xe1d3ba,roughness:.98}),
      dark:this.material({color:0x13100f,roughness:.95,metalness:.25}),
      rubber:this.material({color:0x080707,roughness:1}),
      fabric:this.material({map:cloth,color:0x514947,roughness:1}),
      leather:this.material({map:cloth,color:0x9b8070,roughness:.86}),
      bone:this.material({map:bone,bumpMap:bone,bumpScale:.014,roughness:.94}),
      brass:this.material({map:steel,color:0x9b8053,metalness:.72,roughness:.58}),
      shell:this.material({map:rust,color:0x8f5953,roughness:.8}),
      paper:this.material({map:bone,color:0xc7c7ab,roughness:1}),
      white:this.material({map:bone,color:0xd2c3a2,roughness:.88}),
      brick:this.material({map:brick,bumpMap:brick,bumpScale:.025,roughness:1}),
      eye:this.material({color:0x090f0b,emissive:0x6e9666,emissiveIntensity:.055,metalness:.4,roughness:.5}),
      light:this.material({color:0xffdfb7,emissive:0xffc78b,emissiveIntensity:2.2,roughness:.9}),
      red:this.material({color:0x5b1410,emissive:0xa2190d,emissiveIntensity:1.2,roughness:.8})
    };
    this.hitMaterial=this.basic({visible:false});
    this.outlineMaterial=this.basic({color:0xe8d9a3,side:THREE.BackSide,depthWrite:false});
    this.targetOutlineMaterial=this.basic({color:0x665e47,side:THREE.BackSide,depthWrite:false});
  }

  batchDirect(parent,exclude=new Set()){
    const batches=new Map();
    for(const o of [...parent.children]){
      if(!o.isMesh||exclude.has(o))continue;o.updateMatrix();
      const key=o.material.uuid;if(!batches.has(key))batches.set(key,{mat:o.material,geos:[],objects:[]});
      const b=batches.get(key),g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);b.geos.push(g);b.objects.push(o);
    }
    for(const b of batches.values()){
      if(b.geos.length>1){const g=mergeGeometries(b.geos,false);if(g){this.mesh(g,b.mat,parent);this.extraGeometry.push(g);b.objects.forEach(o=>o.removeFromParent());}}
      b.geos.forEach(g=>g.dispose());
    }
  }

  makeRoom(){
    const m=this.mat;
    this.box(9,.15,9,m.dark,this.room,0,-.05,-.2);
    this.box(8.6,4.8,.2,m.dark,this.room,0,2.3,-4.15);
    this.box(.2,4.8,8.5,m.brick,this.room,-4.25,2.3,-.1);
    this.box(.2,4.8,8.5,m.brick,this.room,4.25,2.3,-.1);
    // Uneven brick bond behind the close-set participants.
    const brickGeo=this.geom('wallBrick',()=>new THREE.BoxGeometry(.53,.22,.08));
    const bricks=new THREE.InstancedMesh(brickGeo,m.brick,208);let index=0;const transform=new THREE.Matrix4();
    for(let row=0;row<13;row++)for(let col=0;col<16;col++){
      transform.makeTranslation(-4.2+col*.55+(row%2)*.275,.23+row*.25,-4.01+this.rand()*.015);bricks.setMatrixAt(index++,transform);
      bricks.setColorAt(index-1,new THREE.Color().setRGB(.55+this.rand()*.35,.5+this.rand()*.25,.49+this.rand()*.2));
    }
    bricks.castShadow=false;bricks.receiveShadow=true;this.scene.add(bricks);
    for(let side of [-1,1]){
      const pallet=new THREE.Group();pallet.position.set(side*3.25,1.65,-3.86);pallet.rotation.z=side*.14;this.scene.add(pallet);
      for(let x of [-.55,.55])this.box(.16,2.65,.16,m.pallet,pallet,x,0,0);
      for(let y=-1.2;y<1.35;y+=.32)this.box(1.45,.22,.13,m.pallet,pallet,0,y,.12);
      for(let y=-1.2;y<1.35;y+=.32)for(let x of [-.55,.55])this.cyl(.018,.018,.025,m.rust,pallet,x,y,.2).rotation.x=Math.PI/2;
      this.batchDirect(pallet);
      this.speaker(side*1.65,-3.56,side);
    }
    // Cables hang into the shot, replacing the spacious ceiling/fluorescent fixture.
    for(let i=0;i<8;i++){
      const z=-3.5+i*.54;
      this.cable([[-4.2,4.3,z],[-2,3.55-this.rand()*.4,z+.12],[.4,3.45-this.rand()*.4,z-.1],[4.25,4.35,z+.2]],.018+i%2*.004,i%3===0?m.rust:m.rubber);
    }
    for(let x of [-3.8,3.8]){
      this.rod([x,.1,-3.7],[x,4.4,-3.7],.065,m.rust);
      for(let y of [.5,2.1,3.6])this.torus(.085,.018,m.steel,this.room,x,y,-3.7).rotation.x=Math.PI/2;
    }
    this.box(.8,.48,.44,m.dark,this.room,-.65,3.98,-.45);
    const lamp=this.cyl(.27,.3,.16,m.rust,this.room,-.65,3.69,-.45,8);lamp.rotation.x=.15;
    this.cyl(.24,.24,.02,m.light,this.room,-.65,3.59,-.43,12);
    this.box(.18,.1,.07,m.red,this.room,0,3.2,-3.98);
    this.makeScope();
  }
  speaker(x,z,side){
    const m=this.mat,g=new THREE.Group();g.position.set(x,1.73,z);g.rotation.y=-side*.08;this.scene.add(g);
    this.box(.92,2.94,.63,m.dark,g,0,0,0,.025);
    this.box(.83,2.81,.045,m.rust,g,0,0,.34);
    for(const [y,r] of [[-.76,.33],[.1,.245],[.9,.14]]){
      this.cyl(r,r,.055,m.rubber,g,0,y,.38,24).rotation.x=Math.PI/2;
      this.torus(r,.024,m.steel,g,0,y,.43);
      this.cyl(r*.85,r*.28,.075,m.dark,g,0,y,.42,20,true).rotation.x=Math.PI/2;
      this.sphere(r*.26,r*.26,.075,m.rubber,g,0,y,.46);
    }
    for(let xx of [-.4,.4])for(let yy of [-1.4,1.4]){this.box(.12,.12,.08,m.steel,g,xx,yy,.37);this.cyl(.018,.018,.01,m.dark,g,xx,yy,.42,8).rotation.x=Math.PI/2;}
    this.batchDirect(g);
  }
  makeScope(){
    const m=this.mat,g=new THREE.Group();g.position.set(2.55,1.85,-2.95);g.rotation.y=-.22;this.scene.add(g);
    this.box(.97,.79,.65,m.rust,g,0,.2,0,.025);this.box(.67,.53,.05,m.dark,g,-.08,.26,.35,.025);
    const c=document.createElement('canvas');c.width=256;c.height=192;this.scopeCanvas=c;this.scopeCtx=c.getContext('2d');this.scopeTexture=this.canvasTexture(c);
    const screen=this.mesh(this.geom('scopePlane',()=>new THREE.PlaneGeometry(.58,.43)),this.basic({map:this.scopeTexture,toneMapped:false}),g,-.08,.27,.383);screen.castShadow=false;
    for(let y of [.1,.39])this.cyl(.045,.045,.04,m.dark,g,.36,y,.36).rotation.x=Math.PI/2;
    this.box(1.08,.55,.65,m.dark,g,0,-.5,0);
    for(let i=0;i<8;i++)this.box(.68,.014,.025,m.steel,g,0,-.68+i*.047,.34);
    this.cable([[.4,-.1,.1],[.7,-.6,.25],[.6,-1.2,.4],[-.2,-1.5,.8]],.024,m.rubber,g);
    this.lastScope=-10000;this.batchDirect(g,new Set([screen]));
  }

  octagon(width,depth,cut,height,mat,parent,x,y,z){
    const shape=new THREE.Shape(),w=width/2,d=depth/2;
    const points=[[-w+cut,-d],[w-cut,-d],[w,-d+cut],[w,d-cut],[w-cut,d],[-w+cut,d],[-w,d-cut],[-w,-d+cut]];
    points.forEach(([a,b],i)=>i?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
    const key=`oct${width},${depth},${cut},${height}`;
    const geo=this.geom(key,()=>{
      const g=height?new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1}):new THREE.ShapeGeometry(shape);
      const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/width+.5,.5-p.getY(i)/depth);
      g.rotateX(-Math.PI/2);return g;
    });
    return this.mesh(geo,mat,parent,x,y,z);
  }
  tableTexture(){
    const c=document.createElement('canvas');c.width=c.height=1024;const cx=c.getContext('2d');
    // Low-resolution, chipped military enamel, with the markings baked into the top face.
    const im=cx.createImageData(1024,1024);
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
      const n=(this.rand()-.5)*28+Math.sin(x*.027)*Math.cos(y*.019)*7,i=(y*1024+x)*4;
      im.data[i]=71+n;im.data[i+1]=78+n;im.data[i+2]=57+n;im.data[i+3]=255;
    }
    cx.putImageData(im,0,0);
    for(let i=0;i<2400;i++){
      const x=this.rand()*1024,y=this.rand()*1024,r=1+this.rand()*12;
      cx.fillStyle=i%4?'#30272190':'#a3977b80';cx.beginPath();for(let j=0;j<6;j++)cx.lineTo(x+Math.cos(j)*r*this.rand(),y+Math.sin(j)*r*this.rand());cx.closePath();cx.fill();
    }
    const px=x=>(x/5.82+.5)*1024,pz=z=>(z/4.66+.5)*1024;
    cx.strokeStyle='#d4cdb09c';cx.lineWidth=2;
    for(const slots of SLOT_POSITIONS)for(const [x,z] of slots){
      cx.strokeRect(px(x-.225),pz(z-.225),px(.45)-px(0),pz(.45)-pz(0));
      cx.strokeRect(px(x-.195),pz(z-.195),px(.39)-px(0),pz(.39)-pz(0));
    }
    cx.beginPath();cx.moveTo(px(-2.6),pz(0));cx.lineTo(px(2.6),pz(0));cx.moveTo(px(0),pz(-2.1));cx.lineTo(px(0),pz(2.1));cx.stroke();
    for(const z of [-1.22,1.22]){cx.beginPath();cx.moveTo(px(-2.2),pz(z));cx.lineTo(px(2.2),pz(z));cx.stroke();}
    cx.save();cx.translate(px(-1.42),pz(1.05));cx.rotate(-Math.PI/2);cx.fillStyle='#d9ceb16b';cx.font='bold 21px monospace';cx.fillText('DO NOT CROSS',-90,0);cx.restore();
    cx.fillStyle='#ddd3b370';cx.font='bold 19px monospace';cx.fillText('12 GA // AUTHORIZED USE ONLY',px(-1.2),pz(-1.08));
    cx.font='bold 14px monospace';cx.fillText('PROPERTY OF THE HOUSE / 04',px(-1.03),pz(2.12));
    for(let i=0;i<600;i++){const x=this.rand()*1024,y=this.rand()*1024;cx.strokeStyle=i%3?'#100a0780':'#d5c3a13b';cx.lineWidth=1;cx.beginPath();cx.moveTo(x,y);cx.lineTo(x+this.rand()*45,y+this.rand()*8-4);cx.stroke();}
    return this.canvasTexture(c);
  }
  makeTable(){
    const m=this.mat;
    this.octagon(6.16,4.96,.94,.21,m.rust,this.room,0,.91,0);
    this.octagon(5.97,4.77,.88,.08,m.steel,this.room,0,1.12,0);
    this.tableMaterial=this.material({map:this.tableTexture(),metalness:.25,roughness:.91,bumpScale:.008});
    this.octagon(5.82,4.66,.83,0,this.tableMaterial,this.room,0,1.205,0);
    for(let x of [-2.86,2.86])for(let z of [-1.3,-.65,0,.65,1.3])this.cyl(.027,.027,.014,m.dark,this.room,x,1.213,z,8);
    for(let z of [-2.33,2.33])for(let x of [-1.65,-.85,0,.85,1.65])this.cyl(.027,.027,.014,m.dark,this.room,x,1.213,z,8);
    for(let x of [-2.2,2.2])for(let z of [-1.7,1.7])this.box(.15,1.02,.15,m.dark,this.room,x,.5,z);
    // Radiator-like steel rails between each participant and the playing surface.
    for(let side of [-1,1]){
      for(let z=-.9;z<=.9;z+=.14)this.box(.19,.6,.065,m.steel,this.room,side*3.02,.91,z);
      this.box(.27,.1,2.1,m.rust,this.room,side*3.02,1.23,0);
    }
    for(let x=-.9;x<=.9;x+=.14)this.box(.06,.58,.18,m.steel,this.room,x,.91,-2.54);
    this.box(2.1,.1,.25,m.rust,this.room,0,1.23,-2.54);
    this.turntable=new THREE.Group();this.scene.add(this.turntable);
    this.cyl(1.30,1.37,.12,m.rust,this.turntable,0,1.275,0,48);
    this.cyl(1.19,1.21,.075,m.olive,this.turntable,0,1.37,0,48);
    this.torus(1.235,.026,m.steel,this.turntable,0,1.407,0).rotation.x=-Math.PI/2;
    this.cyl(.92,.92,.022,m.dark,this.turntable,0,1.416,0,48);
    this.cyl(.87,.87,.026,m.olive,this.turntable,0,1.437,0,48);
    for(let a of [Math.PI/4,-Math.PI/4]){this.box(.017,.006,1.62,m.dark,this.turntable,0,1.455,0).rotation.y=a;this.box(.006,.003,1.58,m.paper,this.turntable,.013,1.46,0).rotation.y=a;}
    for(let i=0;i<36;i++){
      const a=i/36*Math.PI*2,led=this.box(.045,.028,.026,m.light,this.turntable,Math.sin(a)*1.339,1.297,Math.cos(a)*1.339);led.rotation.y=a;
    }
    for(let i=0;i<4;i++){const a=i*Math.PI/2;this.box(.18,.055,.13,m.rust,this.turntable,Math.sin(a)*.95,1.47,Math.cos(a)*.95).rotation.y=a;}
    this.batchDirect(this.turntable);
    // Neutral shells expose count only; the chamber order is never used by rendering.
    this.shells=[];for(let i=0;i<6;i++){const shell=this.makeShell(this.scene);shell.scale.setScalar(.65);this.shells.push(shell);}
    this.monitors=[];this.hitboxes=[];
    const monitors=[[-2.57,1.28,.12,Math.PI/3],[0,1.28,-2.18,0],[2.57,1.28,-.12,-Math.PI/3],[0,1.28,2.13,0]];
    monitors.forEach((v,id)=>this.makeMonitor(id,v));
  }
  makeMonitor(id,[x,y,z,yaw]){
    const m=this.mat,g=new THREE.Group();g.position.set(x,y,z);g.rotation.set(0,yaw,0);this.scene.add(g);
    const tilt=new THREE.Group();tilt.rotation.x=id===3?-.9:-.62;g.add(tilt);
    this.box(.72,.31,.28,m.rust,tilt,0,0,0,.018);this.box(.63,.215,.018,m.dark,tilt,0,.018,.151,.012);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const texture=this.canvasTexture(canvas);
    const screen=this.mesh(this.geom('hpCRT',()=>new THREE.PlaneGeometry(.566,.174)),this.basic({map:texture,toneMapped:false}),tilt,0,.018,.164);screen.castShadow=false;
    for(let xx of [-.325,.325])for(let yy of [-.11,.11])this.cyl(.016,.016,.02,m.steel,tilt,xx,yy,.151,8).rotation.x=Math.PI/2;
    this.cable([[.15,-.1,-.12],[.29,-.2,-.28],[.48,-.35,-.3],[.6,-.15,-.34]],.018,m.rubber,g);
    const indicator=this.material({color:0x343b24,emissive:0xc4d19b,emissiveIntensity:0,roughness:.9});
    const ring=this.box(.68,.018,.025,indicator,tilt,0,.17,.14);
    const hit=this.box(.84,.48,.45,this.hitMaterial,tilt,0,0,0);hit.castShadow=false;hit.userData={kind:'team',owner:id};this.hitboxes.push(hit);
    this.batchDirect(tilt,new Set([screen,ring,hit]));
    this.monitors.push({root:g,canvas,ctx:canvas.getContext('2d'),texture,screen,ring,indicator,key:'',id});
  }
  drawMonitor(monitor,p,s){
    const active=s.phase!=='idle'&&s.phase!=='won'&&s.current===p.id,chosen=(s.phase==='shot'?s.shot?.target:s.target)===p.id;
    const key=[p.hp,p.cuffed,active,chosen,s.winner,s.phase==='idle'].join(',');if(key===monitor.key)return;monitor.key=key;
    const cx=monitor.ctx;cx.fillStyle='#020705';cx.fillRect(0,0,256,128);
    cx.fillStyle='#6b9364';cx.font='bold 18px monospace';cx.textAlign='left';cx.fillText(`TỔ ${p.id+1}`,10,23);
    cx.textAlign='right';cx.font='12px monospace';cx.fillText(p.hp===0?'OFFLINE':p.cuffed?'LOCKED':s.winner===p.id?'WINNER':active?'YOUR TURN':'STANDBY',244,22);
    for(let i=0;i<3;i++){
      const x=53+i*75;cx.fillStyle=i<p.hp?'#adff95':'#193421';cx.shadowColor='#9bff82';cx.shadowBlur=i<p.hp?9:0;
      cx.beginPath();cx.moveTo(x+7,36);cx.lineTo(x-16,73);cx.lineTo(x+1,73);cx.lineTo(x-11,112);cx.lineTo(x+26,61);cx.lineTo(x+8,61);cx.lineTo(x+21,36);cx.closePath();cx.fill();
    }
    cx.shadowBlur=0;cx.fillStyle='#00000024';for(let y=0;y<128;y+=3)cx.fillRect(0,y,256,1);
    monitor.texture.needsUpdate=true;
    const champion=s.phase==='won'&&s.winner===p.id;
    monitor.indicator.color.setHex(champion?0xd5d5a5:chosen?0xc4a977:0x5a663e);monitor.indicator.emissiveIntensity=champion?1.4:chosen?1.3:active?.5:0;
  }

  profile(points,depth,mat,parent,x=0,y=0,z=0,holes=[]){
    const shape=new THREE.Shape();points.forEach(([a,b],i)=>i?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
    for(const [a,b,rx,ry] of holes){const path=new THREE.Path();path.absellipse(a,b,rx,ry,0,Math.PI*2,true);shape.holes.push(path);}
    const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.016,bevelThickness:.016});
    this.extraGeometry.push(geo);return this.mesh(geo,mat,parent,x,y,z);
  }
  makeSeats(){
    this.seats=[];
    SEAT_POSITIONS.forEach(([x,z],id)=>{
      const m=this.mat,root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=Math.atan2(-x,-z);this.scene.add(root);
      const body=new THREE.Group();root.add(body);
      this.box(.91,.9,.07,m.dark,body,0,.9,-.37);
      // Angular coat, high shoulders and thin limbs. Nothing uses the old rounded mannequin torso.
      this.profile([[-.45,0],[-.5,.72],[-.39,1.1],[-.2,1.22],[.22,1.19],[.48,.98],[.47,0]],.35,m.fabric,body,0,.57,-.19);
      this.box(.045,.74,.03,m.dark,body,0,1.4,.19);
      this.profile([[-.38,0],[-.26,.22],[-.06,-.1],[-.14,-.28]],.026,m.leather,body,0,1.56,.2);
      const head=new THREE.Group();head.position.set(0,2.16,.015);body.add(head);
      this.sphere(.38,.47,.32,m.fabric,head,0,.03,-.04);
      if(id===0)this.skullMask(head);
      else if(id===1)this.gasMask(head);
      else if(id===2)this.weldingMask(head);
      else this.executionMask(head);
      const hands=new THREE.Group();root.add(hands);
      for(const side of [-1,1]){
        this.rod([side*.43,1.57,0],[side*.51,1.13,.38],.082,m.fabric,hands);
        this.rod([side*.51,1.13,.38],[side*.42,1.27,.79],.065,m.leather,hands);
        this.makeHand(hands,side*.42,1.29,.82,id===1?m.bone:id===0?m.white:m.leather,side,id===3);
      }
      const cuffs=new THREE.Group();hands.add(cuffs);
      for(let side of [-1,1])this.torus(.086,.017,m.steel,cuffs,side*.42,1.26,.75).rotation.x=-Math.PI/2;
      this.rod([-.37,1.26,.75],[.37,1.26,.75],.012,m.steel,cuffs);cuffs.visible=false;
      const hit=this.box(1.05,1.47,.76,this.hitMaterial,root,0,1.9,0);hit.castShadow=false;hit.userData={kind:'team',owner:id};this.hitboxes.push(hit);
      this.batchDirect(head);this.batchDirect(body);this.batchDirect(hands);this.batchDirect(cuffs);
      const outline=new THREE.Group();
      for(const o of [...head.children])if(o.isMesh){const edge=new THREE.Mesh(o.geometry,this.targetOutlineMaterial);edge.position.copy(o.position);edge.quaternion.copy(o.quaternion);edge.scale.copy(o.scale).multiplyScalar(1.025);edge.raycast=()=>{};outline.add(edge);}
      outline.visible=false;head.add(outline);
      const headAnchor=new THREE.Object3D();headAnchor.position.set(0,.52,0);head.add(headAnchor);
      const label=document.createElement('div');label.className='world-label';label.dataset.team=String(id);label.hidden=true;
      const name=document.createElement('strong');name.textContent=`TỔ ${id+1}`;
      const health=document.createElement('span');health.className='label-health';
      label.append(name,health);this.labels.append(label);
      const view=TURN_CAMERAS[id];
      const cameraMount=new THREE.Object3D();cameraMount.position.fromArray(view.eye);root.add(cameraMount);
      const cameraPosition=cameraMount.getWorldPosition(new THREE.Vector3());
      const localFocus=new THREE.Vector3(0,view.focusHeight,Math.hypot(x,z));
      const seat={id,root,body,head,hands,cuffs,outline,headAnchor,label,health,hit:0,dead:false,
        aim:new THREE.Vector3(x,id===3?2.65:2.2,z),
        cameraAnchor:{mount:cameraMount,localFocus,position:cameraPosition,look:root.localToWorld(localFocus.clone())},
        indicator:this.monitors[id].indicator,ring:this.monitors[id].ring};
      this.seats.push(seat);
    });
  }
  makeHand(parent,x,y,z,mat,side,own){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=-side*.12;g.rotation.z=side*.08;parent.add(g);
    this.box(.19,.075,.23,mat,g,0,0,0,.018);
    for(let i=0;i<4;i++){
      const xx=-.072+i*.047,len=[.14,.185,.17,.12][i];
      this.rod([xx,.005,.08],[xx,-.018,.08+len*.6],.017,mat,g);
      this.sphere(.022,.02,.021,mat,g,xx,-.018,.08+len*.6);
      this.rod([xx,-.018,.08+len*.6],[xx,-.045,.08+len],.014,mat,g);
      this.box(.021,.007,.028,this.mat.dark,g,xx,-.035,.07+len);
    }
    this.rod([side*.09,0,-.03],[side*.145,-.02,.04],.026,mat,g);
    this.rod([side*.145,-.02,.04],[side*.17,-.04,.12],.02,mat,g);
    for(let i=0;i<3;i++)this.box(.12,.012,.008,this.mat.dark,g,0,.043,-.035+i*.036);
    this.batchDirect(g);
  }
  skullMask(g){
    const m=this.mat;
    this.profile([[-.33,.35],[-.41,.08],[-.31,-.3],[-.16,-.47],[.2,-.42],[.35,-.14],[.38,.18],[.24,.4]],.13,m.bone,g,0,0,.205,[[-.17,.1,.115,.09],[.17,.11,.12,.085]]);
    this.sphere(.13,.11,.06,m.rubber,g,-.17,.1,.24);this.sphere(.13,.11,.06,m.rubber,g,.17,.11,.24);
    this.profile([[-.07,.02],[.06,.01],[.11,-.16],[-.085,-.16]],.08,m.bone,g,0,0,.34);
    this.box(.23,.045,.025,m.dark,g,0,-.26,.362);
    for(let i=0;i<7;i++)this.box(.025,.075,.03,m.bone,g,-.1+i*.033,-.28,.38);
    for(let side of [-1,1]){this.box(.15,.1,.07,m.bone,g,side*.27,-.15,.32).rotation.z=-side*.34;this.cyl(.032,.032,.032,m.steel,g,side*.31,.26,.36,8).rotation.x=Math.PI/2;}
    this.box(.57,.055,.04,m.leather,g,0,.27,.355).rotation.z=.1;
  }
  gasMask(g){
    const m=this.mat;
    this.profile([[-.34,.31],[-.39,-.14],[-.18,-.42],[.18,-.42],[.39,-.14],[.34,.31],[0,.4]],.13,m.olive,g,0,0,.2);
    for(let side of [-1,1]){
      this.cyl(.17,.16,.09,m.rust,g,side*.195,.1,.4,20).rotation.x=Math.PI/2;
      this.cyl(.134,.134,.012,m.rubber,g,side*.195,.1,.457,20).rotation.x=Math.PI/2;
      this.cyl(.111,.111,.014,m.eye,g,side*.195,.1,.47,20).rotation.x=Math.PI/2;
      this.torus(.143,.014,m.steel,g,side*.195,.1,.47);
      this.box(.055,.015,.012,m.mask||m.steel,g,side*.195-.05,.158,.483).rotation.z=.5;
      const filter=this.cyl(.145,.15,.2,m.dark,g,side*.35,-.23,.35,12);filter.rotation.z=side*.65;filter.rotation.x=Math.PI/2;
      for(let j=0;j<4;j++)this.torus(.144,.009,m.steel,g,side*.35,-.23,.3+j*.04);
    }
    this.cyl(.105,.13,.16,m.rust,g,0,-.22,.41,16).rotation.x=Math.PI/2;
    for(let i=-2;i<=2;i++)this.box(.12,.012,.018,m.dark,g,0,-.22+i*.035,.5);
    this.box(.09,.53,.035,m.leather,g,0,.05,.16);
  }
  weldingMask(g){
    const m=this.mat;
    this.profile([[-.39,.4],[-.43,-.29],[-.22,-.48],[.26,-.43],[.42,-.25],[.36,.42]],.19,m.rust,g,0,0,.18);
    this.box(.56,.21,.09,m.steel,g,0,.16,.414,.01);this.box(.44,.112,.012,m.rubber,g,0,.17,.465);
    this.box(.39,.013,.015,m.eye,g,0,.177,.474);
    for(let x of [-.29,.29])for(let y of [-.33,.31])this.cyl(.022,.022,.025,m.steel,g,x,y,.397,8).rotation.x=Math.PI/2;
    for(let i=-3;i<=3;i++)this.box(.017,.13,.035,m.dark,g,i*.055,-.23,.397);
    for(let side of [-1,1])this.cyl(.075,.075,.08,m.brass,g,side*.42,.05,.12,12).rotation.z=Math.PI/2;
    this.box(.58,.045,.014,m.paper,g,0,-.05,.403).rotation.z=-.06;
  }
  executionMask(g){
    const m=this.mat;
    const wornLeather=this.material({map:m.bone.map,color:0x8e7d62,roughness:.95});
    this.profile([[-.32,.36],[-.35,-.16],[-.16,-.44],[.18,-.43],[.34,-.17],[.31,.34]],.14,wornLeather,g,0,0,.23);
    for(let side of [-1,1]){this.box(.17,.064,.02,m.rubber,g,side*.16,.09,.39);this.rod([side*.12,-.12,.39],[side*.07,-.3,.39],.014,m.steel,g);}
  }
  textPanel(title,subtitle,w,h){
    const c=document.createElement('canvas');c.width=256;c.height=96;const cx=c.getContext('2d');cx.fillStyle='#24231c';cx.fillRect(0,0,256,96);cx.fillStyle='#bab193';cx.font='bold 28px monospace';cx.textAlign='center';cx.fillText(title,128,40);cx.font='12px monospace';cx.fillText(subtitle,128,68);
    return this.box(w,h,.012,this.material({map:this.canvasTexture(c),metalness:.2,roughness:1}),new THREE.Group());
  }
  makeShell(parent){
    const g=new THREE.Group();parent?.add(g);const m=this.mat;
    this.cyl(.046,.046,.19,m.shell,g,0,.02,0);this.cyl(.049,.049,.055,m.brass,g,0,-.102,0);
    this.cyl(.054,.054,.012,m.brass,g,0,-.132,0);this.cyl(.012,.012,.003,m.gun,g,0,-.14,0);this.cyl(.042,.042,.003,m.rubber,g,0,.117,0);
    this.batchDirect(g);return g;
  }

  makeItem(type){
    const g=new THREE.Group(),m=this.mat;
    if(type==='beer'){
      this.cyl(.112,.112,.36,m.paper,g,0,.2,0,16);this.cyl(.114,.114,.15,m.dark,g,0,.19,0,16);
      for(let y of [.024,.381])this.cyl(.117,.117,.023,m.steel,g,0,y,0,16);
      this.torus(.032,.008,m.dark,g,.023,.398,0).rotation.x=-Math.PI/2;
      this.box(.11,.035,.008,m.paper,g,0,.18,.113);
    }else if(type==='glass'){
      this.torus(.13,.018,m.steel,g,0,.04,0).rotation.x=-Math.PI/2;
      this.cyl(.113,.113,.008,m.eye,g,0,.042,0,24);
      this.rod([.09,.038,.09],[.26,.038,.26],.028,m.rubber,g);
    }else if(type==='saw'){
      g.scale.setScalar(.8);
      this.box(.48,.019,.13,m.steel,g,.015,.05,0);
      for(let x=-.2;x<.24;x+=.045){const tooth=this.mesh(this.geom('sawTooth',()=>new THREE.ConeGeometry(.027,.045,3)),m.steel,g,x,.05,.085);tooth.rotation.x=Math.PI/2;}
      this.box(.13,.06,.17,m.rust,g,-.29,.05,0,.01);this.box(.064,.066,.1,m.dark,g,-.29,.051,0);
    }else if(type==='cigarette'){
      this.box(.18,.07,.25,m.paper,g,0,.045,0,.008);this.box(.18,.016,.08,m.rust,g,0,.084,.08);
      for(let i=-1;i<=1;i++)this.rod([i*.04,.097,-.02],[i*.04,.097,.11],.012,m.white,g);
      this.cyl(.015,.015,.16,m.white,g,.1,.12,.04).rotation.x=Math.PI/2;
    }else{
      for(let x of [-.1,.1])this.torus(.085,.015,m.steel,g,x,.04,0).rotation.x=-Math.PI/2;
      this.rod([-.04,.04,0],[.04,.04,.02],.013,m.steel,g);
    }
    this.batchDirect(g);return g;
  }
  makeInventory(){
    this.templates={};for(const name of Object.keys(ITEMS))this.templates[name]=this.makeItem(name);
    this.itemBounds={};
    for(const [type,template] of Object.entries(this.templates)){
      const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3());
      size.x+=.025;size.z+=.025;size.y=Math.max(.065,size.y+.025);
      this.itemBounds[type]={size,center:bounds.getCenter(new THREE.Vector3())};
    }
    this.slots=[];
    SLOT_POSITIONS.forEach((positions,owner)=>positions.forEach(([x,z],index)=>{
      const root=new THREE.Group();root.position.set(x,1.216,z);root.rotation.y=owner===0?Math.PI/2:owner===2?-Math.PI/2:owner===3?Math.PI:0;this.scene.add(root);
      const models={},outlines={};
      for(const [type,template] of Object.entries(this.templates)){
        const model=template.clone(true);model.visible=false;root.add(model);models[type]=model;
        const outline=new THREE.Group();root.add(outline);outline.visible=false;
        outline.scale.copy(template.scale);
        for(const o of template.children){
          if(!o.isMesh)continue;const line=new THREE.Mesh(o.geometry,this.outlineMaterial);line.position.copy(o.position);line.quaternion.copy(o.quaternion);line.scale.copy(o.scale).multiplyScalar(1.06);line.raycast=()=>{};outline.add(line);
        }
        outlines[type]=outline;
      }
      const frame=new THREE.Group();root.add(frame);
      const mat=this.material({color:0x807c59,emissive:0xafb882,emissiveIntensity:0,roughness:.9});
      for(const v of [-.235,.235]){this.box(.47,.007,.008,mat,frame,0,.006,v);this.box(.008,.007,.47,mat,frame,v,.006,0);}this.batchDirect(frame);
      const hit=this.box(1,1,1,this.hitMaterial,root);hit.castShadow=false;hit.userData={kind:'item',owner,index};
      this.slots.push({owner,index,root,models,outlines,frame,mat,hit,type:null,reason:'',hovered:false});
    }));
    this.itemRoot=new THREE.Group();this.itemRoot.position.set(1.1,1.6,.6);this.scene.add(this.itemRoot);
    this.itemModels={};for(const [type,t] of Object.entries(this.templates)){const model=t.clone(true);model.visible=false;this.itemRoot.add(model);this.itemModels[type]=model;}
  }
  makeEffects(){
    const g=new THREE.BufferGeometry(),p=new Float32Array(80*3);
    for(let i=0;i<80;i++){p[i*3]=(this.rand()-.5)*7;p[i*3+1]=1+this.rand()*3;p[i*3+2]=(this.rand()-.5)*6;}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));this.extraGeometry.push(g);
    const mat=new THREE.PointsMaterial({color:0xae8d6b,size:.009,opacity:.23,transparent:true,depthWrite:false});this.materials.push(mat);this.dust=new THREE.Points(g,mat);this.scene.add(this.dust);
    const smokeGeo=new THREE.BufferGeometry();this.smokePositions=new Float32Array(24*3);smokeGeo.setAttribute('position',new THREE.BufferAttribute(this.smokePositions,3));this.extraGeometry.push(smokeGeo);
    const smokeMat=new THREE.PointsMaterial({color:0x9e9785,size:.055,transparent:true,opacity:0,depthWrite:false});this.materials.push(smokeMat);this.smoke=new THREE.Points(smokeGeo,smokeMat);this.smoke.visible=false;this.scene.add(this.smoke);
    this.smokeOffsets=Array.from({length:24},()=>new THREE.Vector3(this.rand()-.5,this.rand(),this.rand()-.5));
  }
  makeLights(){
    this.scene.add(new THREE.HemisphereLight(0xc1b99e,0x2b1714,.6));
    this.key=new THREE.SpotLight(0xffe0b5,80,11,.84,.28,1.8);this.key.position.set(-.65,3.7,.35);this.key.target.position.set(0,1,0);this.scene.add(this.key,this.key.target);
    this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);this.key.shadow.bias=-.0003;this.key.shadow.normalBias=.018;this.key.shadow.camera.near=.35;this.key.shadow.camera.far=12;
    this.faceLight=new THREE.PointLight(0xd2cab2,30,10,1.6);this.faceLight.position.set(0,2.65,.3);this.scene.add(this.faceLight);
    this.redLight=new THREE.PointLight(0xa51513,15,9,1.6);this.redLight.position.set(-2.5,3.1,-2.9);this.scene.add(this.redLight);
    this.muzzleLight=new THREE.PointLight(0xffbc6b,0,6,1.7);this.scene.add(this.muzzleLight);
  }

  makeGun() {
    this.gun=new THREE.Group();this.gun.position.set(0,1.55,0);this.gun.scale.setScalar(.72);this.scene.add(this.gun);
    this.weapon=new THREE.Group();this.gun.add(this.weapon);
    const m=this.mat,g=this.weapon;
    // Local forward is -Z; the muzzle bore remains open and catches a worn rim.
    const barrel=this.cyl(.071,.071,1.46,m.gun,g,0,.065,-.68,32,true);barrel.rotation.x=Math.PI/2;
    const bore=this.cyl(.052,.052,.20,m.rubber,g,0,.065,-1.29,24,true);bore.rotation.x=Math.PI/2;
    this.torus(.061,.01,m.steel,g,0,.065,-1.415);
    const magazine=this.cyl(.066,.066,1.14,m.gun,g,0,-.065,-.46,24);magazine.rotation.x=Math.PI/2;
    this.cyl(.073,.073,.025,m.steel,g,0,-.065,-1.04).rotation.x=Math.PI/2;
    for(let z of [-1.08,-.4]){const band=this.torus(.08,.015,m.steel,g,0,.065,z);this.box(.13,.13,.04,m.gun,g,0,0,z,.01);}
    this.box(.23,.23,.58,m.gun,g,0,.02,.2,.03);
    this.box(.238,.012,.47,m.steel,g,0,.143,.2,.005);
    this.box(.012,.09,.25,m.rubber,g,.121,.04,.15,.006); // ejection port
    this.bolt=this.box(.015,.069,.15,m.steel,g,.131,.043,.19,.004);
    this.rod([.12,.035,.31],[.21,.035,.31],.019,m.steel,g);
    this.sphere(.027,.027,.04,m.gun,g,.21,.035,.31);
    // Shaped walnut stock made from an extruded, bevelled profile.
    const shape=new THREE.Shape();shape.moveTo(.42,.06);shape.lineTo(.57,.13);shape.lineTo(1.21,.09);shape.lineTo(1.32,-.01);shape.lineTo(1.30,-.23);shape.lineTo(.98,-.23);shape.lineTo(.62,-.11);shape.lineTo(.46,-.16);shape.closePath();
    const stockGeo=new THREE.ExtrudeGeometry(shape,{depth:.19,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1});
    // Profile X becomes longitudinal Z; profile Y remains Y.
    stockGeo.rotateY(-Math.PI/2);stockGeo.translate(.095,0,0);this.extraGeometry.push(stockGeo);this.mesh(stockGeo,m.stock,g);
    this.box(.24,.32,.055,m.rubber,g,0,-.07,1.315,.025);
    for(let y=-.2;y<.03;y+=.038)this.box(.243,.009,.058,m.dark,g,0,y,1.317,.004);
    this.pump=new THREE.Group();this.pump.position.z=-.67;g.add(this.pump);
    const pump=this.cyl(.113,.108,.49,m.stock,this.pump,0,-.065,0,24);pump.rotation.x=Math.PI/2;
    for(let z=-.2;z<=.22;z+=.045)this.torus(.111,.009,m.dark,this.pump,0,-.065,z);
    this.rod([-.075,-.055,-.62],[-.075,-.055,.33],.013,m.steel,g);
    this.rod([.075,-.055,-.62],[.075,-.055,.33],.013,m.steel,g);
    // Trigger guard is a closed curve, with an independently moving trigger.
    const guardCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.1,.07),new THREE.Vector3(0,-.29,.09),new THREE.Vector3(0,-.31,.37),new THREE.Vector3(0,-.14,.43)],true);
    const guardGeo=new THREE.TubeGeometry(guardCurve,36,.017,8,true);this.extraGeometry.push(guardGeo);this.mesh(guardGeo,m.gun,g);
    this.trigger=new THREE.Group();this.trigger.position.set(0,-.105,.2);g.add(this.trigger);
    this.rod([0,0,0],[0,-.115,.02],.014,m.steel,this.trigger);
    this.box(.035,.032,.075,m.steel,this.trigger,0,-.11,.045,.009);
    for(let z of [-1.29,.04])this.box(.028,.06,.045,m.steel,g,0,.15,z,.006);
    for(let z of [.05,.34])for(let x of [-.12,.12]){const pin=this.cyl(.018,.018,.006,m.steel,g,x,.005,z,12);pin.rotation.z=Math.PI/2;}
    const engraving=this.textPanel('12 GA','BUCKSHOT / 04',.25,.074);engraving.position.set(-.125,.02,.19);engraving.rotation.y=-Math.PI/2;g.add(engraving);
    this.gun.rotation.y=1.18;
    this.muzzle=new THREE.Object3D();this.muzzle.position.set(0,.065,-1.46);g.add(this.muzzle);
    this.flashMaterial=new THREE.MeshBasicMaterial({color:0xffdb91,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});this.materials.push(this.flashMaterial);
    this.flash=this.mesh(new THREE.ConeGeometry(.16,.68,9),this.flashMaterial,g,0,.065,-1.65);this.extraGeometry.push(this.flash.geometry);this.flash.rotation.x=-Math.PI/2;this.flash.castShadow=false;
    this.flash.visible=false;
    this.spent=this.makeShell(this.scene);this.spent.visible=false;
    this.spentOrigin=new THREE.Vector3();
  }


  setQuality(mode){
    this.qualityMode=mode;
    const constrained=innerWidth<700||(navigator.hardwareConcurrency||4)<=4;
    this.quality=mode==='low'||(mode==='auto'&&constrained)?'low':'high';
    const low=this.quality==='low';
    this.key.shadow.mapSize.set(low?512:1024,low?512:1024);
    if(this.key.shadow.map){this.key.shadow.map.dispose();this.key.shadow.map=null;}
    this.dust.visible=!low;
    if(this.host.clientWidth)this.resize();
  }
  resize(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h||!this.composer)return;
    this.camera.aspect=w/h;
    // Wide seated framing includes both diagonal masks as well as the opposite player.
    this.camera.fov=Math.min(100,Math.max(88,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(57.5))/this.camera.aspect))));
    // Resize changes projection only, never the active seat or an in-flight transition.
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
    const cap=this.quality==='low'?640:960,scale=Math.min(1,cap/w,720/h);
    this.renderWidth=Math.max(240,Math.floor(w*scale));this.renderHeight=Math.max(180,Math.floor(h*scale));
    this.composer.setSize(this.renderWidth,this.renderHeight);this.retroPass.uniforms.resolution.value.set(this.renderWidth,this.renderHeight);
    this.clearHover();
  }
  sync(s,epoch,availability=[]){
    const now=performance.now();this.availability=availability;
    if(epoch!==this.epoch){
      this.epoch=epoch;this.previous=null;this.soundTarget=null;
      this.itemAt=-10000;this.spent.visible=false;this.smoke.visible=false;this.flash.visible=false;
      this.clearHover();
      this.cameraSeat=null;this.cameraTransition=null;
    }
    if(this.previous!==s.phase){
      this.phaseAt=now;
      if(s.phase==='reload')this.onMechanical?.();
      if(s.phase==='shot'){
        this.gun.updateMatrixWorld(true);this.weapon.getWorldPosition(this.spentOrigin);this.spentOrigin.y+=.04;
        this.muzzle.getWorldPosition(this.muzzlePosition);this.seats[s.shot.target].hit=now;
      }
      this.previous=s.phase;
    }
    if(s.phase==='target'&&s.target!==null&&s.target!==this.soundTarget){this.soundTarget=s.target;this.onMechanical?.();}
    if(s.phase==='question')this.soundTarget=null;
    this.state=s;
    // A shot's target never owns the turn camera. Restart replaces the previous transition.
    const active=s.phase==='idle'?null:s.phase==='won'?s.winner:s.current;
    if(active!==null&&active!==this.cameraSeat)this.focusSeat(active,now);
    const target=s.phase==='shot'?s.shot?.target:s.target;
    this.seats.forEach((seat,i)=>{
      const p=s.players[i];seat.dead=p.hp===0;seat.cuffs.visible=p.cuffed;
      seat.label.classList.toggle('active',active===i);seat.label.classList.toggle('eliminated',seat.dead);
      seat.health.textContent=p.hp===0?'ĐÃ LOẠI':`${p.hp} / 3 HP${p.cuffed?' · BỊ CÒNG':''}`;
      seat.outline.visible=p.hp>0&&target===i&&['target','aiming','shot'].includes(s.phase);
      this.drawMonitor(this.monitors[i],p,s);
    });
    for(const slot of this.slots){
      slot.type=s.players[slot.owner].items[slot.index]||null;
      slot.reason=availability[slot.owner]?.[slot.index]||'';
      if(slot.type){slot.hit.position.copy(this.itemBounds[slot.type].center);slot.hit.scale.copy(this.itemBounds[slot.type].size);}
      for(const [type,model] of Object.entries(slot.models))model.visible=type===slot.type;
      for(const outline of Object.values(slot.outlines))outline.visible=false;
      const ready=s.phase==='target'&&s.current===slot.owner&&slot.type&&!slot.reason;
      slot.mat.emissiveIntensity=ready?.38:0;slot.mat.color.setHex(ready?0xaeb78a:0x504c35);
      slot.frame.visible=!!slot.type;
    }
    this.clearHover();
    const hint=document.getElementById('scene-hint');
    hint.textContent=s.phase==='target'?'NHẤP VẬT PHẨM ĐỂ DÙNG · NHẤP MẶT NẠ / CRT ĐỂ NHẮM':s.phase==='question'?'MC CHỌN A / B / C / D':s.phase==='aiming'?'MỤC TIÊU ĐÃ KHÓA':s.phase==='won'?'THE HOUSE HAS A WINNER':'';
  }
  focusSeat(id,now){
    const anchor=this.seats[id].cameraAnchor;
    anchor.mount.getWorldPosition(anchor.position);
    this.seats[id].root.localToWorld(anchor.look.copy(anchor.localFocus));
    const from=this.camera.position.clone(),to=anchor.position.clone();
    const fromAngle=Math.atan2(from.x,from.z),toAngle=Math.atan2(to.x,to.z);
    const angle=Math.atan2(Math.sin(toAngle-fromAngle),Math.cos(toAngle-fromAngle));
    this.cameraSeat=id;this.cameraTransitions++;
    // Snapshot both endpoints once; HUD renders and target changes cannot restart this move.
    this.cameraTransition={start:now,duration:this.reduced?0:2600,
      from,to,fromLook:this.cameraLook.clone(),toLook:anchor.look.clone(),
      fromAngle,angle,fromRadius:Math.hypot(from.x,from.z),toRadius:Math.hypot(to.x,to.z)};
  }
  updateCamera(now,shake,elapsed){
    const move=this.cameraTransition;
    if(move){
      const progress=move.duration?THREE.MathUtils.clamp((now-move.start)/move.duration,0,1):1;
      // Smootherstep gives zero velocity and acceleration at both ends of the slow dolly.
      const eased=progress*progress*progress*(progress*(progress*6-15)+10);
      // Bend inside the seat ring rather than passing through an intermediate player's head.
      // Stay away from the centre so opposite-seat moves never pitch vertically into the gun.
      const arc=Math.sin(Math.PI*eased),angle=move.fromAngle+move.angle*eased;
      const radius=Math.max(1.95,THREE.MathUtils.lerp(move.fromRadius,move.toRadius,eased)-Math.min(1.05,Math.abs(move.angle)*.68)*arc);
      this.camera.position.set(Math.sin(angle)*radius,THREE.MathUtils.lerp(move.from.y,move.to.y,eased)+Math.min(.45,Math.abs(move.angle)*.23)*arc,Math.cos(angle)*radius);
      this.cameraLook.lerpVectors(move.fromLook,move.toLook,eased);
      if(progress===1)this.camera.position.copy(move.to);
      if(progress===1)this.cameraTransition=null;
    }else if(this.cameraSeat!==null){
      this.camera.position.copy(this.seats[this.cameraSeat].cameraAnchor.position);
      this.cameraLook.copy(this.seats[this.cameraSeat].cameraAnchor.look);
    }
    // Bounded, non-accumulating shot response; no new camera owner during aiming/shot.
    this.camera.position.x+=Math.sin(elapsed*107)*shake;
    this.camera.position.y+=Math.cos(elapsed*91)*shake;
    this.camera.lookAt(this.cameraLook);
    this.camera.updateMatrixWorld(true);
    // First-person clipping guard, including the departing seat during an interrupted move.
    // Models stay in the scene and return as soon as the camera leaves their head volume.
    for(const seat of this.seats){
      seat.head.getWorldPosition(this.labelPoint);
      seat.body.visible=seat.id!==this.cameraSeat&&this.camera.position.distanceToSquared(this.labelPoint)>.85*.85&&this.camera.position.distanceToSquared(seat.cameraAnchor.position)>.85*.85;
      seat.hands.visible=seat.body.visible;
    }
  }
  updateLabels(){
    const width=this.host.clientWidth,height=this.host.clientHeight;
    this.visibleLabels.length=0;
    for(const seat of this.seats){
      seat.headAnchor.getWorldPosition(this.labelPoint);
      this.labelView.copy(this.labelPoint).applyMatrix4(this.camera.matrixWorldInverse);
      this.labelPoint.project(this.camera);
      const p=this.labelPoint;
      const visible=seat.body.visible&&seat.id!==this.cameraSeat&&this.labelView.z<0&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<1&&p.y>-.9&&p.y<.96;
      seat.label.hidden=!visible;
      if(visible){
        seat.label.style.left=`${((p.x*.5+.5)*width).toFixed(2)}px`;
        seat.label.style.top=`${((-p.y*.5+.5)*height).toFixed(2)}px`;
        this.visibleLabels.push(seat.label);
      }
    }
    // A side participant may be only partly in frame. Do not leave half a name at its edge.
    for(const label of this.visibleLabels){
      const bounds=label.getBoundingClientRect();
      if(bounds.left<4||bounds.right>width-4||bounds.top<0)label.hidden=true;
    }
  }
  item(type){this.itemType=type;this.itemAt=performance.now();}
  clearHover(){
    if(this.hover?.kind==='item'){
      const slot=this.slots?.[this.hover.owner*4+this.hover.index];
      if(slot){Object.values(slot.outlines).forEach(o=>o.visible=false);slot.mat.emissiveIntensity=this.state?.phase==='target'&&this.state.current===slot.owner&&slot.type&&!slot.reason ? .38 : 0;}
    }
    this.hover=null;this.host.style.cursor='';if(this.tooltip)this.tooltip.hidden=true;
  }
  point(event){
    if(!this.state)return null;
    const rect=this.host.getBoundingClientRect();
    this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const objects=this.hitboxes.filter(hit=>hit.parent!==this.seats[hit.userData.owner].root||this.seats[hit.userData.owner].body.visible).concat(this.slots.filter(slot=>slot.type).map(slot=>slot.hit));
    const hits=this.raycaster.intersectObjects(objects,false);const data=hits[0]?.object.userData;
    this.clearHover();if(!data)return null;this.hover=data;
    let text='',ready=false;
    if(data.kind==='item'){
      const slot=this.slots[data.owner*4+data.index];ready=this.state.phase==='target'&&this.state.current===slot.owner&&!slot.reason;
      text=`Tổ ${data.owner+1} · ${ITEMS[slot.type].name} — ${ready?'Nhấp để dùng. '+ITEMS[slot.type].desc:slot.reason||'Chỉ dùng sau khi trả lời đúng.'}`;
      if(ready){slot.outlines[slot.type].visible=true;slot.mat.emissiveIntensity=1.2;}
    }else{
      const p=this.state.players[data.owner];ready=this.state.phase==='target'&&p.hp>0;
      text=`Tổ ${data.owner+1} · ${p.hp}/3 HP${p.cuffed?' · Bị còng':''} — ${ready?'Nhấp để chọn mục tiêu.':p.hp===0?'Đã bị loại.':'Chờ chọn mục tiêu.'}`;
    }
    this.host.style.cursor=ready?(data.kind==='item'?'pointer':'crosshair'):'';
    if(this.tooltip){
      this.tooltip.textContent=text;this.tooltip.hidden=false;
      const bounds=this.tooltip.getBoundingClientRect();
      this.tooltip.style.left=`${Math.max(8,Math.min(innerWidth-bounds.width-8,event.clientX+16))}px`;
      this.tooltip.style.top=`${Math.max(8,Math.min(innerHeight-bounds.height-8,event.clientY+18))}px`;
    }
    return data;
  }
  updateScope(t){
    const interval=this.quality==='low'?.2:.1;if(t-this.lastScope<interval)return;this.lastScope=t;
    const cx=this.scopeCtx;cx.fillStyle='#11150c';cx.fillRect(0,0,256,192);cx.strokeStyle='#52603b45';cx.lineWidth=1;
    for(let x=0;x<256;x+=24){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,192);cx.stroke();}
    for(let y=0;y<192;y+=24){cx.beginPath();cx.moveTo(0,y);cx.lineTo(256,y);cx.stroke();}
    cx.strokeStyle='#c1d593';cx.lineWidth=2;cx.beginPath();
    for(let x=0;x<256;x++){const p=(x/256+t*.15)%1,y=95+Math.sin(x*.06+t)*4+Math.exp(-Math.pow((p-.45)*36,2))*24-Math.exp(-Math.pow((p-.51)*45,2))*67+Math.exp(-Math.pow((p-.56)*36,2))*31;cx.lineTo(x,y);}cx.stroke();
    cx.fillStyle='#00000033';for(let y=0;y<192;y+=3)cx.fillRect(0,y,256,1);this.scopeTexture.needsUpdate=true;
  }
  tick(){
    if(this.destroyed||this.hidden)return;
    this.frame=requestAnimationFrame(this.tick);const now=performance.now();
    if(now-this.lastRender<(this.quality==='low'?1000/30:1000/45)-1)return;
    const dt=Math.max(0,Math.min(.25,(now-this.lastTime)/1000));this.lastTime=now;this.lastRender=now;
    this.update(now,dt);this.renderer.info.reset();this.composer.render(dt);
    if(this.qualityMode==='auto'&&this.quality==='high'){
      this.performanceFrames++;if(now-this.performanceStart>5500){if(this.performanceFrames/(now-this.performanceStart)*1000<23)this.setQuality('low');this.performanceStart=now;this.performanceFrames=0;}
    }
  }
  update(now,dt){
    const s=this.state;if(!s)return;
    const t=now/1000,elapsed=Math.max(0,(now-this.phaseAt)/1000),ease=1-Math.exp(-dt*6);
    const target=s.phase==='shot'?s.shot?.target:s.target;
    const aiming=target!==null&&target!==undefined&&['target','item','eject','aiming','shot'].includes(s.phase);
    this.aimPoint.set(-3,1.5,-.7);if(aiming)this.aimPoint.copy(this.seats[target].aim);
    this.aimMatrix.lookAt(this.gun.position,this.aimPoint,this.up);this.targetQuaternion.setFromRotationMatrix(this.aimMatrix);
    this.gun.quaternion.slerp(this.targetQuaternion,ease);
    this.gun.position.y=THREE.MathUtils.lerp(this.gun.position.y,aiming?1.60:1.56,ease);
    const shot=s.phase==='shot',live=shot&&s.shot.live;
    const recoil=shot?Math.exp(-elapsed*7)*Math.sin(Math.min(elapsed*21,Math.PI)):0;
    this.weapon.position.set(0,0,recoil*(live?.23:.022));this.weapon.rotation.set(recoil*(live?.13:.009),0,0);
    this.pump.position.z=-.67;this.bolt.position.z=.19;
    this.trigger.rotation.x=s.phase==='aiming'?-.36*Math.min(1,elapsed/2.4):0;
    const yaw=Math.atan2(this.aimPoint.x-this.gun.position.x,this.aimPoint.z-this.gun.position.z)+Math.PI;
    let rotor=yaw;
    if(s.phase==='reload'){
      const p=Math.min(1,elapsed/2.8),swing=Math.sin(p*Math.PI);
      this.weapon.rotation.z=-.24*swing;this.weapon.position.y=.1*swing;
      this.weapon.rotation.y=Math.PI*2*p; // The shotgun follows the mechanical platter while reloading.
      const pump=Math.max(0,1-Math.abs(elapsed-2.35)/.25);this.pump.position.z+=pump*.25;this.bolt.position.z+=pump*.14;
      rotor+=Math.PI*2*p;
    }
    // Rotation is visual only: no selection, RNG or chamber operations are performed here.
    const rotorDelta=Math.atan2(Math.sin(rotor-this.turntable.rotation.y),Math.cos(rotor-this.turntable.rotation.y));
    this.turntable.rotation.y+=rotorDelta*ease;
    if((shot&&elapsed>.48)||s.phase==='eject'){
      const age=s.phase==='eject'?elapsed:elapsed-.48,pump=Math.max(0,1-Math.abs(age-.23)/.23);
      this.pump.position.z+=pump*.25;this.bolt.position.z+=pump*.14;
      this.spent.visible=age>.18&&age<1.55;
      if(this.spent.visible){
        if(s.phase==='eject')this.gun.getWorldPosition(this.spentOrigin);
        const v=age-.18;this.spent.position.copy(this.spentOrigin);this.spent.position.x+=v;this.spent.position.z+=v*.3;
        this.spent.position.y=Math.max(1.23,this.spentOrigin.y+v*1.6-v*v*4.9);this.spent.rotation.set(v*7,v*5,Math.PI/2+v*4);
      }
    }else this.spent.visible=false;
    this.flash.visible=live&&elapsed<.12&&!this.reduced;this.flashMaterial.opacity=this.flash.visible?1-elapsed/.12:0;
    this.muzzle.getWorldPosition(this.muzzleLight.position);this.muzzleLight.intensity=live&&elapsed<.15&&!this.reduced?45*Math.exp(-elapsed*22):0;
    this.smoke.visible=live&&elapsed<1.8&&this.quality!=='low';
    if(this.smoke.visible){
      for(let i=0;i<24;i++){const a=this.smokeOffsets[i];this.smokePositions[i*3]=this.muzzlePosition.x+a.x*(.05+elapsed*.26);this.smokePositions[i*3+1]=this.muzzlePosition.y+elapsed*.25+a.y*elapsed*.3;this.smokePositions[i*3+2]=this.muzzlePosition.z+a.z*(.06+elapsed*.3);}
      this.smoke.geometry.attributes.position.needsUpdate=true;this.smoke.material.opacity=.19*(1-elapsed/1.8);
    }
    this.shells.forEach((shell,i)=>{
      shell.position.set(-.45+i*.18,1.26,-1.47);shell.rotation.set(Math.PI/2,0,.15);
      shell.visible=s.phase==='idle'||i<s.ammo.length;
      if(s.phase==='reload'){
        const p=Math.max(0,Math.min(1,(elapsed-.35-i*.34)/.28));shell.visible=p<1;
        if(p>0&&p<1){shell.position.lerp(this.gun.position,p);shell.position.y+=Math.sin(p*Math.PI)*.4;shell.rotation.x+=p*Math.PI;}
      }
    });
    const itemAge=Math.max(0,(now-this.itemAt)/1000),duration=this.itemType==='beer'?1.5:.8;
    this.itemRoot.visible=itemAge<duration;for(const [name,model] of Object.entries(this.itemModels))model.visible=name===this.itemType;
    if(this.itemRoot.visible){const p=itemAge/duration;this.itemRoot.position.y=1.3+Math.sin(p*Math.PI)*.3;this.itemRoot.rotation.set(0,p*Math.PI*.7,this.itemType==='beer'?Math.sin(p*Math.PI)*-.6:0);}
    this.seats.forEach((seat,i)=>{
      const age=Math.max(0,(now-seat.hit)/1000),impact=shot&&s.shot.target===i?Math.exp(-age*5)*Math.sin(age*16):0;
      const threatened=aiming&&target===i,breath=this.reduced?0:Math.sin(t*1.4+i*2)*.009;
      seat.body.position.y=seat.dead?0:breath;
      seat.body.rotation.x=THREE.MathUtils.lerp(seat.body.rotation.x,seat.dead?.52:threatened?-.055:0,ease);
      seat.head.rotation.x=(seat.dead?.3:threatened?-.05:breath*.7)-impact*(live?.17:.025);
      seat.head.rotation.z=seat.dead?.23:breath*.8;
      seat.hands.position.y=impact*(live?.09:.01);
    });
    const motion=this.reduced?0:1,shake=live?Math.exp(-elapsed*13)*.028*motion:0;
    this.updateCamera(now,shake,elapsed);this.updateLabels();
    const won=s.phase==='won';
    this.key.target.position.x=THREE.MathUtils.lerp(this.key.target.position.x,won?SEAT_POSITIONS[s.winner][0]*.55:0,ease*.5);
    this.key.target.position.z=THREE.MathUtils.lerp(this.key.target.position.z,won?SEAT_POSITIONS[s.winner][1]*.4:0,ease*.5);
    this.key.intensity=(won?94:80)+(this.reduced?0:Math.sin(t*31)*.6);
    this.retroPass.uniforms.time.value=this.reduced?0:t;this.dust.rotation.y=this.reduced?0:t*.006;this.updateScope(t);
  }
  dispose(){
    if(this.destroyed)return;this.destroyed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();
    this.host.removeEventListener('pointermove',this.move);this.host.removeEventListener('pointerleave',this.leave);this.host.removeEventListener('click',this.click);
    document.removeEventListener('visibilitychange',this.visibility);this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);
    const geos=new Set([...this.geometryCache.values(),...this.extraGeometry]);this.scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);});
    for(const g of geos)g.dispose();for(const m of new Set(this.materials))m.dispose();for(const t of this.textures)t.dispose();
    this.renderPass.dispose();this.outputPass.dispose();this.retroPass.dispose();this.composer.dispose();this.envTarget.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.labels.replaceChildren();
  }
}
