import * as THREE from 'three';

/* =========================================================
   FLYBAND V2 — one-house autonomous fly band simulator
   Browser-only, no build step, no paid services required.
   ========================================================= */

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const now = () => performance.now();
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const ROOM_DEFS = {
  practice: {name:'Practice Room', x:-10, z:-5.5, w:9, d:7.4, door:{x:-10,z:-1.7}, color:0x19232c, desc:'Solo practice + rehearsal'},
  stage:    {name:'Stage Room',    x:0,   z:-5.5, w:9, d:7.4, door:{x:0,z:-1.7},   color:0x211d24, desc:'Performance + band work'},
  dark:     {name:'Dark Room',     x:10,  z:-5.5, w:9, d:7.4, door:{x:10,z:-1.7}, color:0x090a0c, desc:'Nothing useful lives here'},
  dining:   {name:'Dining Room',   x:-10, z:5.5,  w:9, d:7.4, door:{x:-10,z:1.7}, color:0x26251d, desc:'Food + recovery'},
  chill:    {name:'Chill Garden',  x:0,   z:5.5,  w:9, d:7.4, door:{x:0,z:1.7},   color:0x17271f, desc:'Rest + social time'},
  lab:      {name:'Brain Lab',     x:10,  z:5.5,  w:9, d:7.4, door:{x:10,z:1.7},  color:0x13232a, desc:'Observation + curiosity'},
};
const ROOM_ORDER = ['practice','stage','dark','dining','chill','lab'];

const FLY_SPECS = [
  {id:'piano',  name:'Tom',    role:'Piano',           eye:'#46d9ff'},
  {id:'guitar', name:'Paul',   role:'Electric Guitar', eye:'#ff5e70'},
  {id:'bass',   name:'Stuart', role:'Bass Guitar',     eye:'#c386ff'},
  {id:'drums',  name:'Ringo',  role:'Drums',           eye:'#ffb74b'},
  {id:'violin', name:'John',   role:'Violin',          eye:'#7dff8b'},
];

const INSTRUMENT_ANCHORS = {
  practice: {
    piano:{x:-12.6,z:-5.4}, guitar:{x:-9.2,z:-7.1}, bass:{x:-7.5,z:-4.3}, drums:{x:-10,z:-4.8}, violin:{x:-11.7,z:-7.1}
  },
  stage: {
    piano:{x:-2.8,z:-5.7}, guitar:{x:-1.1,z:-6.2}, bass:{x:1.2,z:-6.3}, drums:{x:0,z:-4.4}, violin:{x:2.8,z:-5.8}
  }
};

const FOOD = [
  {id:'shit', name:'Shit', emoji:'💩', reward:.15, nutrition:4, dopamine:3},
  {id:'apple', name:'Apple', emoji:'🍎', reward:.35, nutrition:16, dopamine:8},
  {id:'peach', name:'Peach', emoji:'🍑', reward:.55, nutrition:20, dopamine:12},
  {id:'sugar', name:'Sugar Cube', emoji:'⬜', reward:.8, nutrition:12, dopamine:20},
  {id:'cola', name:'Cola', emoji:'🥤', reward:1.0, nutrition:7, dopamine:30},
];

const NOTE_NAMES = ['C3','D3','E3','F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5','B5'];
const NOTE_TO_MIDI = {};
const MIDI_TO_NOTE = {};
for(let m=36;m<=84;m++){
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const n=names[m%12]+(Math.floor(m/12)-1); NOTE_TO_MIDI[n]=m; MIDI_TO_NOTE[m]=n;
}
function noteFreq(note){
  const m = NOTE_TO_MIDI[note] ?? 69;
  return 440*Math.pow(2,(m-69)/12);
}
function nearestNaturalNote(midi){
  const naturals=[0,2,4,5,7,9,11];
  let best=midi, d=99;
  for(let m=Math.max(36,midi-3);m<=Math.min(84,midi+3);m++){
    if(naturals.includes(m%12) && Math.abs(m-midi)<d){best=m;d=Math.abs(m-midi)}
  }
  return MIDI_TO_NOTE[best] || 'C4';
}
function sanitizeNoteToken(tok){
  const m=String(tok).trim().toUpperCase().match(/^([A-G])([#B]?)([2-6])$/);
  if(!m) return null;
  let name=m[1]+m[2]+m[3];
  if(m[2]==='B'){
    const flatMap={'CB':'B','DB':'C#','EB':'D#','FB':'E','GB':'F#','AB':'G#','BB':'A#'};
    name=(flatMap[m[1]+'B']||m[1])+m[3];
  }
  return NOTE_TO_MIDI[name] ? name : null;
}

const BRAIN_REGIONS = [
  {id:'optic', name:'Optic Lobe', x:.20,y:.37, side:'L'},
  {id:'opticR', name:'Optic Lobe R', x:.80,y:.37, side:'R'},
  {id:'antennal', name:'Antennal Lobe', x:.34,y:.63},
  {id:'antennalR', name:'Antennal Lobe R', x:.66,y:.63},
  {id:'mushroom', name:'Mushroom Body', x:.40,y:.34},
  {id:'mushroomR', name:'Mushroom Body R', x:.60,y:.34},
  {id:'central', name:'Central Complex', x:.50,y:.47},
  {id:'auditory', name:'Auditory / Chordotonal', x:.50,y:.70},
  {id:'feeding', name:'SEZ / Feeding', x:.50,y:.80},
  {id:'motor', name:'Motor Output', x:.50,y:.91},
  {id:'dopamine', name:'Dopaminergic', x:.43,y:.56},
  {id:'aversive', name:'Aversive / Stress', x:.57,y:.56},
];

function newFly(spec, index){
  const startRooms=['practice','chill','dining','practice','lab'];
  const r=ROOM_DEFS[startRooms[index]];
  return {
    id:spec.id,name:spec.name,role:spec.role,eye:spec.eye,
    room:startRooms[index], x:r.x+rand(-1.5,1.5), y:1.35+rand(-.12,.18), z:r.z+rand(-1.4,1.4),
    vx:0,vy:0,vz:0,
    needs:{
      dopamine:45+rand(-4,4), stressDrive:12+rand(0,5), octopamine:38+rand(-5,5), energy:82+rand(-6,6),
      hunger:20+rand(-5,5), mood:72+rand(-6,5), fear:4, fatigue:14+rand(-4,4), social:28+rand(-8,8), curiosity:55+rand(-10,10), focus:55+rand(-8,8)
    },
    skill:{instrument:3+rand(0,3), timing:4+rand(0,3), pitch:3+rand(0,3), ear:2+rand(0,3), reading:1+rand(0,2), improv:2+rand(0,3), ensemble:1+rand(0,2)},
    styleMemory:{},
    q:{},
    task:null,
    path:[],
    pathIndex:0,
    action:'idle',
    actionSince:0,
    practiceBeats:0,
    practiceMinutes:0,
    performances:0,
    rewards:0,
    punishments:0,
    lastReward:0,
    lastRewardAt:0,
    recentTarget:null,
    recentNote:null,
    lastDecision:0,
    wanderTarget:null,
    userHeld:false,
  };
}

const DEFAULT_CURRICULUM = {
  type:'builtin', name:'House Warm-up', tempo:96, genreKey:'builtin-basic',
  notes:['C4','E4','G4','C5','G4','E4','D4','F4','A4','C5','A4','F4'],
  sourceSummary:'Built-in ear + timing exercise', duration:0
};

const defaultState = () => ({
  version:2,
  simMinutes:12*60,
  day:1,
  speed:2,
  paused:false,
  audioOn:true,
  selected:['piano'],
  focusedFly:'piano',
  viewedRoom:null,
  curriculum:{...DEFAULT_CURRICULUM},
  flies:Object.fromEntries(FLY_SPECS.map((s,i)=>[s.id,newFly(s,i)])),
  wasp:{released:false,state:'absent',x:11.5,y:2.2,z:-6,target:null,perchUntil:0},
  logs:[{t:Date.now(),msg:'FlyBand V2 initialized.'}],
  brainPackMeta:null,
  settings:{autonomy:true}
});

let state = loadLocal() || defaultState();
normalizeState();
let selectedRoomForSend = 'practice';
let brainViewFlyId = state.focusedFly;
let currentAudioFileName = null;
let songAnalysisBusy = false;
let globalLastBeatAt = 0;
let worldSpeedSeconds = 0;
let toastTimer = null;

function normalizeState(){
  if(state.version !== 2){ state = defaultState(); return; }
  state.selected ||= ['piano']; state.focusedFly ||= state.selected[0] || 'piano';
  state.curriculum ||= {...DEFAULT_CURRICULUM}; state.logs ||= []; state.wasp ||= defaultState().wasp;
  for(const [i,spec] of FLY_SPECS.entries()){
    if(!state.flies?.[spec.id]) state.flies[spec.id]=newFly(spec,i);
    const f=state.flies[spec.id];
    f.name=spec.name; f.role=spec.role; f.eye=spec.eye;
    f.needs ||= newFly(spec,i).needs; f.skill ||= newFly(spec,i).skill; f.styleMemory ||= {}; f.q ||= {}; f.path ||= [];
  }
}

function addLog(msg){
  state.logs.unshift({t:Date.now(),msg}); state.logs=state.logs.slice(0,120); renderLog();
}
function toast(msg, ms=4200){
  $('#sceneToast').textContent=msg; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#sceneToast').textContent='Autonomy is active. The house keeps running.',ms);
}
function selectedFlies(){ return state.selected.map(id=>state.flies[id]).filter(Boolean); }
function focusedFly(){ return state.flies[state.focusedFly] || state.flies.piano; }
function roomOfPoint(x,z){
  for(const [id,r] of Object.entries(ROOM_DEFS)) if(Math.abs(x-r.x)<=r.w/2 && Math.abs(z-r.z)<=r.d/2) return id;
  return null;
}
function formatTask(f){
  if(!f.task) return `${ROOM_DEFS[f.room]?.name||'Hall'} · ${f.action}`;
  const rem=f.task.remaining!=null?` · ${Math.max(0,f.task.remaining).toFixed(1)}m`:'';
  return `${f.task.label || f.action}${rem}`;
}

/* =========================================================
   UI RENDERING
   ========================================================= */
function renderRooms(){
  const el=$('#roomButtons'); el.innerHTML='';
  ROOM_ORDER.forEach(id=>{
    const r=ROOM_DEFS[id]; const b=document.createElement('button');
    b.textContent=r.name.replace(' Room',''); b.title=r.desc;
    if(state.viewedRoom===id)b.classList.add('active-view');
    b.onclick=()=>focusRoom(id,true); el.appendChild(b);
  });
}
function renderFlyList(){
  const el=$('#flyList'); el.innerHTML='';
  FLY_SPECS.forEach(spec=>{
    const f=state.flies[spec.id]; const row=document.createElement('div');
    row.className='fly-row'+(state.selected.includes(spec.id)?' selected':'');
    row.style.setProperty('--eye',spec.eye);
    row.innerHTML=`<div class="fly-row-main"><i class="eye-dot"></i><div class="fly-copy"><b>${f.name}</b><span>${f.role} · ${escapeHtml(f.action)}</span></div></div><div class="fly-room">${ROOM_DEFS[f.room]?.name.replace(' Room','')||'Hall'}</div>`;
    row.onclick=(e)=>selectFly(spec.id,e.ctrlKey||e.metaKey);
    el.appendChild(row);
  });
  $('#selectionCount').textContent=String(state.selected.length);
  $('#selectAllBtn').textContent=state.selected.length===FLY_SPECS.length?'Clear':'Select all';
}
function renderSelectedSummary(){
  const fs=selectedFlies();
  const el=$('#selectedSummary');
  if(!fs.length) el.innerHTML='<span style="color:#66727e">No flies selected.</span>';
  else if(fs.length===1){const f=fs[0];el.innerHTML=`<b style="color:${f.eye}">${f.name}</b> · ${f.role}<br><span style="color:#74818d">${escapeHtml(formatTask(f))}</span>`;}
  else el.innerHTML=`<b>${fs.length} flies selected</b><br><span style="color:#74818d">${fs.map(f=>f.name).join(', ')}</span>`;
  document.querySelectorAll('#sendBtn,#giveBtn,#punishBtn,#rehearseBtn,#performBtn').forEach(b=>b.disabled=!fs.length);
}
function metric(label,value,invert=false){
  const v=clamp(invert?100-value:value); return `<div class="metric"><span>${label}</span><div class="bar"><i style="--v:${v}%"></i></div><strong>${Math.round(value)}</strong></div>`;
}
function renderStats(){
  const f=focusedFly(); $('#statsFlyName').textContent=f.name;
  const n=f.needs;
  $('#statsGrid').innerHTML=[
    metric('Dopamine',n.dopamine), metric('Stress drive',n.stressDrive,true), metric('Octopamine',n.octopamine), metric('Energy',n.energy),
    metric('Hunger',n.hunger,true), metric('Mood',n.mood), metric('Fear',n.fear,true), metric('Fatigue',n.fatigue,true),
    metric('Social need',n.social,true), metric('Curiosity',n.curiosity), metric('Focus',n.focus)
  ].join('');
}
function skillRow(label,v){return `<div class="skill-row"><div class="skill-head"><span>${label}</span><strong>${v.toFixed(1)}%</strong></div><div class="bar"><i style="--v:${clamp(v)}%"></i></div></div>`}
function renderProgress(){
  const f=focusedFly(); $('#progressFlyName').textContent=f.name; const s=f.skill;
  $('#progressGrid').innerHTML=skillRow('Instrument control',s.instrument)+skillRow('Timing',s.timing)+skillRow('Pitch / note choice',s.pitch)+skillRow('Ear learning',s.ear)+skillRow('Reading notation',s.reading)+skillRow('Improvisation',s.improv)+skillRow('Band awareness',s.ensemble)+`<div class="hint line">Practice ${Math.floor(f.practiceMinutes/60)}h ${Math.round(f.practiceMinutes%60)}m · performances ${f.performances}</div>`;
}
function renderCurriculum(){
  const c=state.curriculum; $('#curriculumType').textContent=c.type.toUpperCase();
  $('#curriculumCard').innerHTML=`<b>${escapeHtml(c.name)}</b><span>${Math.round(c.tempo)} BPM · ${escapeHtml(c.sourceSummary||'')}</span><span>${c.notes.slice(0,10).join(' ')}${c.notes.length>10?' …':''}</span>`;
}
function renderClock(){
  const h=Math.floor(state.simMinutes/60)%24, m=Math.floor(state.simMinutes%60);
  $('#simClock').textContent=`Day ${state.day} · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  $('#pauseBtn').textContent=state.paused?'Resume':'Pause'; $('#speedBtn').textContent=`${state.speed}×`; $('#audioBtn').textContent=`Audio: ${state.audioOn?'On':'Off'}`;
}
function renderLog(){
  $('#log').innerHTML=state.logs.slice(0,34).map(x=>`<div class="log-row"><time>${new Date(x.t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time>${escapeHtml(x.msg)}</div>`).join('');
}
function renderTaskTicker(){
  const tasks=FLY_SPECS.map(s=>state.flies[s.id]).filter(f=>f.task||['flying','practicing','playing','eating','resting','socializing','fleeing wasp'].includes(f.action));
  $('#taskTicker').innerHTML=tasks.map(f=>`<div class="task-chip" style="--eye:${f.eye}"><i></i><b>${f.name}</b><span>${escapeHtml(formatTask(f))}</span></div>`).join('');
}
function renderBrainHeader(){
  const f=state.flies[brainViewFlyId]||focusedFly(); $('#brainMiniName').textContent=f.name; $('#brainMiniAction').textContent=f.action;
  $('#brainMode').textContent=state.brainPackMeta?'CONNECTOME':'PROXY';
}
function renderAll(){ renderRooms(); renderFlyList(); renderSelectedSummary(); renderStats(); renderProgress(); renderCurriculum(); renderClock(); renderLog(); renderTaskTicker(); renderBrainHeader(); }

function selectFly(id,multi=false){
  if(multi){
    if(state.selected.includes(id)) state.selected=state.selected.filter(x=>x!==id); else state.selected.push(id);
  } else state.selected=[id];
  if(state.selected.length){state.focusedFly=id; brainViewFlyId=id;}
  renderAll(); focusFlyCamera(id,false);
}

/* =========================================================
   THREE.JS HOUSE
   ========================================================= */
const canvas=$('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x070a0e); scene.fog=new THREE.Fog(0x070a0e,28,58);
const camera=new THREE.PerspectiveCamera(46,1,.05,120);
const cameraTarget=new THREE.Vector3(0,0,-.5); camera.position.set(23,23,27); camera.lookAt(cameraTarget);
const hemi=new THREE.HemisphereLight(0xaec4d5,0x21170f,1.8); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(8,22,10); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25; scene.add(sun);
const ambientAccent=new THREE.PointLight(0x8ef0c2,10,30,2); ambientAccent.position.set(0,5,4); scene.add(ambientAccent);
const house=new THREE.Group(); scene.add(house);
const flyMeshes={}; const roomFloorMeshes=[]; const transient=[];
let waspMesh=null;

function material(color,rough=.7,metal=.06,opts={}){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,...opts});}
function mk(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;return o;}
function addBox(parent,x,y,z,w,h,d,color,rough=.7,metal=.04){const o=mk(new THREE.BoxGeometry(w,h,d),material(color,rough,metal),x,y,z);parent.add(o);return o;}
function addCylinderBetween(parent,a,b,r,color){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),mid=A.clone().add(B).multiplyScalar(.5),dir=B.clone().sub(A),len=dir.length();
  const o=mk(new THREE.CylinderGeometry(r,r,len,7),material(color,.75,.03),mid.x,mid.y,mid.z);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());parent.add(o);return o;
}
function addWallWithDoor(parent,x,z,w,d,h,doorCenter,doorWidth,orientation='x',color=0x202830){
  if(orientation==='x'){
    const leftLen=(w-doorWidth)/2; addBox(parent,x-(doorWidth/2+leftLen/2),h/2,z,leftLen,h,d,color); addBox(parent,x+(doorWidth/2+leftLen/2),h/2,z,leftLen,h,d,color);
  } else {
    const seg=(d-doorWidth)/2; addBox(parent,x,h/2,z-(doorWidth/2+seg/2),w,h,seg,color); addBox(parent,x,h/2,z+(doorWidth/2+seg/2),w,h,seg,color);
  }
}

function buildHouse(){
  house.clear(); roomFloorMeshes.length=0;
  addBox(house,0,-.3,0,30,.5,18,0x111820,.95,0);
  // central hall floor
  addBox(house,0,-.02,0,29.4,.08,2.8,0x182129,.9,0);
  for(const [id,r] of Object.entries(ROOM_DEFS)){
    const floor=addBox(house,r.x,0,r.z,r.w,.16,r.d,r.color,.9,0); floor.userData.roomId=id; roomFloorMeshes.push(floor);
    // outer wall
    const top=id==='practice'||id==='stage'||id==='dark';
    const outerZ=top?r.z-r.d/2:r.z+r.d/2; addBox(house,r.x,1.7,outerZ,r.w,3.4,.18,0x1c242b);
    // left/right room walls
    addBox(house,r.x-r.w/2,1.7,r.z,.18,3.4,r.d,0x1c242b);
    addBox(house,r.x+r.w/2,1.7,r.z,.18,3.4,r.d,0x1c242b);
    // hall-facing wall with open door
    const innerZ=top?r.z+r.d/2:r.z-r.d/2;
    addWallWithDoor(house,r.x,innerZ,r.w,.18,3.4,r.x,1.8,'x', id==='dark'?0x14171a:0x1c242b);
    addRoomLabel(id,r.x,.04,r.z);
  }
  // Exterior end walls around hall
  addBox(house,-14.85,1.7,0,.18,3.4,2.9,0x1c242b); addBox(house,14.85,1.7,0,.18,3.4,2.9,0x1c242b);
  buildPractice();buildStage();buildDining();buildChill();buildLab();buildDark();
  for(const spec of FLY_SPECS){const f=state.flies[spec.id];const g=createRealishFly(f);g.position.set(f.x,f.y,f.z);house.add(g);flyMeshes[f.id]=g;}
  waspMesh=createWasp();house.add(waspMesh);waspMesh.visible=state.wasp.released;
}
function addRoomLabel(id,x,y,z){
  // low-tech floor tile marker, avoids font assets
  const r=ROOM_DEFS[id]; const tile=addBox(house,x,y+.06,z,r.w*.45,.03,.42,0x0a0d10,.5,.25);tile.material.emissive=new THREE.Color(0x0b1116);tile.material.emissiveIntensity=.5;
}
function rug(x,z,w,d,color){const o=addBox(house,x,.11,z,w,.035,d,color,.95,0);o.receiveShadow=true;return o;}
function buildPractice(){
  rug(-10,-5.5,7.6,5.8,0x222a30);
  createPiano(house,-12.7,.4,-5.5,.9); createDrumKit(house,-10,.35,-4.45,.88); createGuitarStand(house,-8.3,.35,-6.8,false,.9); createGuitarStand(house,-7.3,.35,-4.25,true,.95); createViolinStand(house,-11.7,.35,-7,.86);
  addBox(house,-6.45,.75,-6.8,1.4,1.5,.75,0x111315,.55,.12);addBox(house,-6.45,.78,-6.39,1.15,1.05,.05,0x24282c);
  addBox(house,-13.3,.45,-3.25,2.4,.65,.85,0x332923,.75,0); addBox(house,-13.3,.84,-3.55,2.4,.55,.25,0x3a3029);
  for(let i=0;i<3;i++) addBox(house,-8.0+i*.8,1.1,-8.85,.5,1.45,.12,0x232b33,.7,.05);
}
function buildStage(){
  addBox(house,0,.22,-5.65,7.9,.38,5.5,0x17191d,.65,.06); rug(0,.43,-5.65,7.2,4.7,0x291f24);
  createPiano(house,-2.8,.65,-5.7,.82); createDrumKit(house,0,.63,-4.35,.84); createGuitarStand(house,-1.1,.62,-6.4,false,.82); createGuitarStand(house,1.2,.62,-6.4,true,.85); createViolinStand(house,2.9,.62,-5.9,.8);
  addBox(house,-3.8,.9,-3.2,1.0,1.2,.7,0x101215,.4,.18); addBox(house,3.8,.9,-3.2,1.0,1.2,.7,0x101215,.4,.18);
  for(let x=-3.2;x<=3.2;x+=1.6){const l=new THREE.SpotLight([0x6cc8ff,0xff6f7d,0xa17dff,0xffc46d,0x7dff9d][Math.round((x+3.2)/1.6)%5],7,10,.5,.45);l.position.set(x,3.2,-8.2);l.target.position.set(x,.4,-5.5);scene.add(l);scene.add(l.target);}
}
function buildDining(){
  rug(-10,5.5,7.5,5.6,0x2d2a21); addBox(house,-10,.65,5.5,4.3,.18,2.3,0x4a3627,.75,0); for(const x of [-11.5,-10.5,-9.5,-8.5]) addBox(house,x,.39,4.4,.55,.75,.55,0x31271f);
  addBox(house,-13.5,1.05,7.4,1.4,2.1,1.1,0x1d2428,.45,.18); addBox(house,-6.55,.8,7.6,1.2,1.6,1.0,0x3a2a1e,.8,0);
  for(const [x,c] of [[-10.7,0xd54c45],[-10,0xe8c95e],[-9.3,0xe9784e]]) house.add(mk(new THREE.SphereGeometry(.22,14,10),material(c,.65,0),x,.95,5.5));
}
function buildChill(){
  rug(0,5.5,7.4,5.7,0x1d3228); addBox(house,-2.4,.45,6.4,2.7,.7,1.0,0x37433c,.85,0); addBox(house,2.4,.45,6.4,2.7,.7,1.0,0x37433c,.85,0);
  // indoor tree
  house.add(mk(new THREE.CylinderGeometry(.22,.3,2.3,10),material(0x4c3422),0,1.15,7.55));
  for(const [x,y,z,s] of [[0,2.6,7.55,1.0],[-.7,2.25,7.45,.7],[.75,2.2,7.45,.75]]){const p=mk(new THREE.SphereGeometry(s,15,10),material(0x2e6044,.9,0),x,y,z);house.add(p);}
  addBox(house,0,.5,4.2,2.3,.45,1.0,0x3d3126); addBox(house,3.65,1.1,7.9,1.6,1.7,.14,0x10161c,.35,.18);
}
function buildLab(){
  rug(10,5.5,7.5,5.7,0x17282f); for(let i=0;i<3;i++){addBox(house,7.5+i*2.5,.7,7.2,1.9,.12,.9,0x26333b,.55,.14); const mon=addBox(house,7.5+i*2.5,1.35,7.55,1.25,.8,.08,0x0a1116,.25,.28);mon.material.emissive=new THREE.Color(0x143849);mon.material.emissiveIntensity=1.1;}
  const globe=new THREE.Group(); globe.position.set(10,1.7,4.55); for(let i=0;i<70;i++){const p=mk(new THREE.SphereGeometry(.025,5,4),new THREE.MeshBasicMaterial({color:Math.random()>.5?0x7ee7ff:0x93ffc3}));const rr=1.1*Math.cbrt(Math.random()),a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);p.position.set(rr*Math.sin(b)*Math.cos(a),rr*.7*Math.cos(b),rr*.7*Math.sin(b)*Math.sin(a));globe.add(p);}house.add(globe);
}
function buildDark(){
  rug(10,-5.5,7.7,5.8,0x0d0e10); const bulb=new THREE.PointLight(0x78808b,.6,5,2);bulb.position.set(10,3,-5.5);scene.add(bulb); addBox(house,10,2.95,-5.5,.12,.12,.12,0xa3a6aa,.4,.1);
  // ugly stains / empty room
  for(let i=0;i<7;i++){const stain=mk(new THREE.CircleGeometry(rand(.12,.4),12),new THREE.MeshBasicMaterial({color:0x171615,transparent:true,opacity:.55,side:THREE.DoubleSide}),rand(6.3,13.7),.095,rand(-8.3,-2.8));stain.rotation.x=-Math.PI/2;house.add(stain);}
}
function createPiano(parent,x,y,z,s=1){
  const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);addBox(g,0,.7,0,2.8,1.1,1.0,0x111315,.35,.18);addBox(g,0,1.28,.18,2.8,.18,1.3,0x161a1f,.35,.15);for(let i=0;i<14;i++){const black=[1,3,6,8,10,13].includes(i%14);addBox(g,-1.25+i*.19,1.39,.48,.17,black?.12:.09,black?.38:.62,black?0x0b0b0c:0xe5e2d8,.45,0);}for(const lx of [-1.05,1.05]) addBox(g,lx,.05,.1,.13,1.2,.13,0x151719);parent.add(g);return g;
}
function createDrumKit(parent,x,y,z,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);const brown=0x5f3228; for(const [dx,dz,r,h] of [[0,0,.62,.7],[-.75,-.2,.4,.45],[.75,-.2,.4,.45],[0,.8,.42,.42]]){const d=mk(new THREE.CylinderGeometry(r,r,h,20),material(brown,.5,.12),dx,h/2,dz);d.rotation.z=Math.PI/2;g.add(d);}for(const dx of [-.8,.8]){addCylinderBetween(g,[dx,0,0],[dx,1.3,.15],.025,0x8c8c8c);const c=mk(new THREE.CylinderGeometry(.58,.58,.035,24),material(0xc8a64a,.35,.35),dx,1.35,.15);g.add(c);}parent.add(g);return g;}
function createGuitarStand(parent,x,y,z,bass=false,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);const body=mk(new THREE.SphereGeometry(.42,18,14),material(bass?0x403265:0x6d2d2f,.42,.18),0,.65,0);body.scale.set(1,.32,1.25);g.add(body);addBox(g,0,1.65,0,.18,1.65,.16,0x5a3a25,.65,.04);addBox(g,0,2.48,0,.32,.35,.16,0x4b3020);addCylinderBetween(g,[.38,0,0],[.38,.55,0],.025,0x24272a);addCylinderBetween(g,[-.38,0,0],[-.38,.55,0],.025,0x24272a);parent.add(g);return g;}
function createViolinStand(parent,x,y,z,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);const m=material(0x8c4a2b,.48,.06);const b1=mk(new THREE.SphereGeometry(.3,16,12),m,0,.7,0);b1.scale.set(1,.3,1.35);g.add(b1);const b2=mk(new THREE.SphereGeometry(.25,16,12),m,0,1.05,0);b2.scale.set(1,.3,1.2);g.add(b2);addBox(g,0,1.65,0,.1,1.25,.1,0x5a3421);addCylinderBetween(g,[.48,.2,0],[.48,1.7,0],.018,0x9a744c);parent.add(g);return g;}

function createRealishFly(f){
  const g=new THREE.Group(); g.userData.flyId=f.id;
  const shell=material(0x272321,.9,.02), dark=material(0x151515,.88,.02), abdomenMat=material(0x393530,.92,.01), eyeMat=material(new THREE.Color(f.eye),.35,.05,{emissive:new THREE.Color(f.eye),emissiveIntensity:.22});
  const thorax=mk(new THREE.SphereGeometry(.28,18,14),shell,0,.03,0);thorax.scale.set(1.05,1,1.22);g.add(thorax);
  const abdomen=mk(new THREE.SphereGeometry(.25,18,14),abdomenMat,0,.01,.48);abdomen.scale.set(.9,.85,1.55);g.add(abdomen);
  for(const zz of [.34,.48,.62]){const band=mk(new THREE.TorusGeometry(.21,.018,6,18),dark,0,.01,zz);band.rotation.x=Math.PI/2;g.add(band);}
  const head=mk(new THREE.SphereGeometry(.23,18,14),dark,0,.04,-.36);head.scale.set(1.12,1,.92);g.add(head);
  const e1=mk(new THREE.SphereGeometry(.12,14,10),eyeMat,.17,.075,-.43), e2=e1.clone();e2.position.x=-.17;g.add(e1,e2);
  const wingMat=new THREE.MeshStandardMaterial({color:0xcfe6e9,transparent:true,opacity:.34,roughness:.25,side:THREE.DoubleSide});
  const w1=mk(new THREE.SphereGeometry(.34,18,9),wingMat,.34,.25,.12);w1.scale.set(1.65,.08,1.12);w1.rotation.z=.26;const w2=w1.clone();w2.position.x=-.34;w2.rotation.z=-.26;g.add(w1,w2);g.userData.wings=[w1,w2];
  // six legs
  const legColor=0x161515; const legRoots=[[-.22,-.05,-.18],[.22,-.05,-.18],[-.24,-.05,.08],[.24,-.05,.08],[-.2,-.05,.28],[.2,-.05,.28]];
  legRoots.forEach(([x,y,z],i)=>{const side=Math.sign(x),front=i<2?-1:i>3?1:0;addCylinderBetween(g,[x,y,z],[x+side*.3,-.28,z+front*.15],.014,legColor);addCylinderBetween(g,[x+side*.3,-.28,z+front*.15],[x+side*.46,-.38,z+front*.26],.011,legColor);});
  // antennae + proboscis + bristles
  addCylinderBetween(g,[-.08,.14,-.52],[-.15,.28,-.68],.008,0x111111); addCylinderBetween(g,[.08,.14,-.52],[.15,.28,-.68],.008,0x111111); addCylinderBetween(g,[0,-.05,-.53],[0,-.15,-.7],.012,0x1c1716);
  for(const p of [[-.12,.25,0],[.1,.26,.08],[-.08,.19,.2],[.12,.18,.24]]) addCylinderBetween(g,p,[p[0]+rand(-.04,.04),p[1]+.13,p[2]+rand(-.03,.03)],.005,0x101010);
  g.scale.setScalar(.72); return g;
}
function createWasp(){
  const g=new THREE.Group();g.userData.isWasp=true; const yellow=material(0xd7a51e,.6,.06), black=material(0x12100f,.82,.03), eye=material(0x351014,.4,.05,{emissive:new THREE.Color(0x4d1010),emissiveIntensity:.35});
  const thorax=mk(new THREE.SphereGeometry(.34,18,14),black,0,0,0);g.add(thorax); const abd=mk(new THREE.SphereGeometry(.37,18,14),yellow,0,0,.6);abd.scale.set(.82,.8,1.5);g.add(abd);
  for(const z of [.44,.68,.87]){const b=mk(new THREE.TorusGeometry(.27,.045,7,18),black,0,0,z);b.rotation.x=Math.PI/2;g.add(b);} const head=mk(new THREE.SphereGeometry(.29,16,12),black,0,.02,-.46);g.add(head);const e1=mk(new THREE.SphereGeometry(.13,12,9),eye,.18,.05,-.58);const e2=e1.clone();e2.position.x=-.18;g.add(e1,e2);
  // mandibles
  addCylinderBetween(g,[-.12,-.06,-.66],[-.24,-.12,-.82],.035,0x211515);addCylinderBetween(g,[.12,-.06,-.66],[.24,-.12,-.82],.035,0x211515);
  const wm=new THREE.MeshStandardMaterial({color:0xdce9e8,transparent:true,opacity:.33,roughness:.18,side:THREE.DoubleSide});const w1=mk(new THREE.SphereGeometry(.48,16,8),wm,.43,.33,.18);w1.scale.set(1.55,.07,1);w1.rotation.z=.35;const w2=w1.clone();w2.position.x=-.43;w2.rotation.z=-.35;g.add(w1,w2);g.userData.wings=[w1,w2];
  // stinger
  const st=mk(new THREE.ConeGeometry(.08,.42,10),black,0,0,1.22);st.rotation.x=Math.PI/2;g.add(st);
  for(const x of [-.24,.24]) for(let j=0;j<3;j++){const z=-.15+j*.34;addCylinderBetween(g,[x,-.05,z],[x+Math.sign(x)*.4,-.38,z+.05],.018,0x141211);}
  g.scale.setScalar(1.35);g.position.set(state.wasp.x,state.wasp.y,state.wasp.z);g.visible=state.wasp.released;return g;
}

buildHouse();

/* =========================================================
   CAMERA CONTROLS — only active over simulation canvas
   ========================================================= */
let dragging=false, dragMode='pan', lastPointer={x:0,y:0};
function updateCameraLook(){camera.lookAt(cameraTarget);}
function orbitCamera(dx,dy){
  const off=camera.position.clone().sub(cameraTarget); let r=off.length(); let theta=Math.atan2(off.x,off.z), phi=Math.acos(clamp(off.y/r,-1,1));theta-=dx*.006;phi=clamp(phi+dy*.006,.18,Math.PI*.48);off.set(r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.cos(theta));camera.position.copy(cameraTarget).add(off);updateCameraLook();
}
function panCamera(dx,dy){
  const forward=cameraTarget.clone().sub(camera.position).normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const flatForward=new THREE.Vector3(forward.x,0,forward.z).normalize();const scale=camera.position.distanceTo(cameraTarget)*.0017;const shift=right.multiplyScalar(-dx*scale).add(flatForward.multiplyScalar(dy*scale));camera.position.add(shift);cameraTarget.add(shift);updateCameraLook();
}
canvas.addEventListener('pointerdown',e=>{dragging=true;lastPointer={x:e.clientX,y:e.clientY};dragMode=(e.button===2||e.ctrlKey)?'orbit':'pan';canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;lastPointer={x:e.clientX,y:e.clientY};if(dragMode==='orbit')orbitCamera(dx,dy);else panCamera(dx,dy);});
canvas.addEventListener('pointerup',e=>{dragging=false;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId)}catch{}});canvas.addEventListener('pointercancel',()=>{dragging=false;canvas.classList.remove('dragging')});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const off=camera.position.clone().sub(cameraTarget);const factor=Math.exp(e.deltaY*.001);const newLen=clamp(off.length()*factor,5,48);off.setLength(newLen);camera.position.copy(cameraTarget).add(off);updateCameraLook();},{passive:false});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
canvas.addEventListener('click',e=>{
  if(Math.abs(e.movementX)>3||Math.abs(e.movementY)>3)return;
  const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
  const flyHits=raycaster.intersectObjects(Object.values(flyMeshes),true); if(flyHits.length){let o=flyHits[0].object;while(o.parent&&!o.userData.flyId)o=o.parent;if(o.userData.flyId){selectFly(o.userData.flyId,e.ctrlKey||e.metaKey);return;}}
  const roomHits=raycaster.intersectObjects(roomFloorMeshes,false); if(roomHits.length){const id=roomHits[0].object.userData.roomId;if(id)focusRoom(id,true);}
});
canvas.addEventListener('dblclick',()=>{if(state.focusedFly)focusFlyCamera(state.focusedFly,true)});
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key.toLowerCase()==='f')focusFlyCamera(state.focusedFly,true);if(e.key==='Home'){e.preventDefault();focusWholeHouse();}});
function focusRoom(id,animate=true){const r=ROOM_DEFS[id];state.viewedRoom=id;$('#viewTitle').textContent=r.name;moveCameraTo(new THREE.Vector3(r.x,1.0,r.z),new THREE.Vector3(r.x+8,9,r.z+10),animate);renderRooms();}
function focusFlyCamera(id,animate=true){const f=state.flies[id];if(!f)return;state.viewedRoom=null;$('#viewTitle').textContent=`${f.name} · ${f.role}`;moveCameraTo(new THREE.Vector3(f.x,f.y,f.z),new THREE.Vector3(f.x+5,f.y+4.5,f.z+6),animate);renderRooms();}
function focusWholeHouse(){state.viewedRoom=null;$('#viewTitle').textContent='Whole House';moveCameraTo(new THREE.Vector3(0,.4,0),new THREE.Vector3(23,23,27),true);renderRooms();}
let cameraTween=null;function moveCameraTo(target,pos,animate=true){if(!animate){cameraTarget.copy(target);camera.position.copy(pos);updateCameraLook();return;}cameraTween={start:now(),dur:650,fromT:cameraTarget.clone(),toT:target.clone(),fromP:camera.position.clone(),toP:pos.clone()};}

/* =========================================================
   AUDIO + INSTRUMENT SYNTH
   ========================================================= */
let audioCtx=null;function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
function envGain(g,when,attack,hold,release,peak){g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),when+attack);g.gain.setValueAtTime(Math.max(.0002,peak*.85),when+attack+hold);g.gain.exponentialRampToValueAtTime(.0001,when+attack+hold+release);}
function playInstrument(inst,note,delay=0,velocity=.7){if(!state.audioOn)return;ensureAudio();const when=audioCtx.currentTime+Math.max(0,delay),freq=noteFreq(note);if(inst==='drums'){playDrum(when,velocity);return;}
  const gain=audioCtx.createGain();gain.connect(audioCtx.destination);let osc=audioCtx.createOscillator();let osc2=null;let dur=.34;
  if(inst==='piano'){osc.type='triangle';osc.frequency.value=freq;osc2=audioCtx.createOscillator();osc2.type='sine';osc2.frequency.value=freq*2;const g2=audioCtx.createGain();g2.gain.value=.16;osc2.connect(g2);g2.connect(gain);dur=.42;envGain(gain,when,.008,.03,.38,.055*velocity);}
  if(inst==='guitar'){osc.type='sawtooth';osc.frequency.value=freq;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;osc.disconnect?.();osc.connect(filter);filter.connect(gain);dur=.32;envGain(gain,when,.004,.02,.29,.038*velocity);osc.start(when);osc.stop(when+dur+.05);return;}
  if(inst==='bass'){osc.type='square';osc.frequency.value=freq*.5;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;osc.connect(filter);filter.connect(gain);dur=.42;envGain(gain,when,.01,.05,.36,.04*velocity);osc.start(when);osc.stop(when+dur+.05);return;}
  if(inst==='violin'){osc.type='sawtooth';osc.frequency.value=freq;const lfo=audioCtx.createOscillator(),lg=audioCtx.createGain();lfo.frequency.value=5.3;lg.gain.value=freq*.006;lfo.connect(lg);lg.connect(osc.frequency);lfo.start(when);lfo.stop(when+.52);dur=.5;envGain(gain,when,.06,.2,.25,.026*velocity);}
  osc.connect(gain);osc.start(when);osc.stop(when+dur+.06);if(osc2){osc2.start(when);osc2.stop(when+dur+.06);}
}
function playDrum(when,velocity=.7){
  const g=audioCtx.createGain(),o=audioCtx.createOscillator();o.type='sine';o.frequency.setValueAtTime(100,when);o.frequency.exponentialRampToValueAtTime(42,when+.12);g.gain.setValueAtTime(.05*velocity,when);g.gain.exponentialRampToValueAtTime(.0001,when+.18);o.connect(g);g.connect(audioCtx.destination);o.start(when);o.stop(when+.2);
  const buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.07),audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const src=audioCtx.createBufferSource(),ng=audioCtx.createGain();src.buffer=buffer;ng.gain.value=.018*velocity;src.connect(ng);ng.connect(audioCtx.destination);src.start(when+.01);
}

/* =========================================================
   TASKING, PATHS, AUTONOMY
   ========================================================= */
function taskDuration(value){return value==='auto'?rand(5,10):Number(value)||5;}
function roomPoint(id){const r=ROOM_DEFS[id];return {x:r.x+rand(-1.3,1.3),y:1.3+rand(-.1,.16),z:r.z+rand(-1.2,1.2)};}
function actionAnchor(f,room){const a=INSTRUMENT_ANCHORS[room]?.[f.id];if(a)return {x:a.x,y:1.35,z:a.z};return roomPoint(room);}
function buildPath(f,destRoom){
  const fromRoom=f.room; const dest=ROOM_DEFS[destRoom]; if(!dest)return [];
  const points=[];
  if(fromRoom&&ROOM_DEFS[fromRoom]){const door=ROOM_DEFS[fromRoom].door;points.push({x:door.x,y:1.45,z:door.z});}
  // hallway travel
  points.push({x:f.x,y:1.55,z:0}); points.push({x:dest.x,y:1.55,z:0}); points.push({x:dest.door.x,y:1.45,z:dest.door.z});
  points.push(actionAnchor(f,destRoom)); return points;
}
function assignTask(f,room,duration,source='user',after='auto',label=null){
  f.task={room,remaining:duration,source,after,label:label||`${source==='user'?'Sent':'Going'} to ${ROOM_DEFS[room].name}`,arrived:false};f.path=buildPath(f,room);f.pathIndex=0;f.action='flying';f.actionSince=state.simMinutes;f.wanderTarget=null;
}
function finishTask(f){const old=f.task;f.task=null;f.path=[];f.pathIndex=0;if(old?.after==='stay'){f.action='idle';f.lastDecision=state.simMinutes;return;}f.action='idle';f.lastDecision=0;}
function chooseAutonomousTask(f){
  const n=f.needs; let room='practice',label='Self-chosen practice',dur=rand(5,10);
  if(n.hunger>62){room='dining';label='Getting food';dur=rand(4,7)}
  else if(n.energy<30||n.fatigue>72){room='chill';label='Resting';dur=rand(7,12)}
  else if(n.stressDrive>58||n.fear>45){room='chill';label='Decompressing';dur=rand(6,11)}
  else if(n.social>65){room='chill';label='Socializing';dur=rand(5,10)}
  else if(n.curiosity>78&&Math.random()<.32){room='lab';label='Exploring lab';dur=rand(4,8)}
  else if(Math.random()<.18){room='chill';label='Messing around';dur=rand(4,8)}
  assignTask(f,room,dur,'auto','auto',label);
}
function moveFlyToward(f,target,dt,speed=2.2){
  const dx=target.x-f.x,dy=target.y-f.y,dz=target.z-f.z,dist=Math.hypot(dx,dy,dz);if(dist<.08){f.x=target.x;f.y=target.y;f.z=target.z;return true;}const step=Math.min(dist,speed*dt);f.vx=dx/dist*speed;f.vy=dy/dist*speed;f.vz=dz/dist*speed;f.x+=dx/dist*step;f.y+=dy/dist*step;f.z+=dz/dist*step;return false;
}
function updateFlyPath(f,dt){
  if(!f.path?.length)return false;const target=f.path[f.pathIndex];if(moveFlyToward(f,target,dt,2.3)){f.pathIndex++;if(f.pathIndex>=f.path.length){f.path=[];f.pathIndex=0;f.room=f.task?.room||roomOfPoint(f.x,f.z)||f.room;if(f.task)f.task.arrived=true;beginRoomAction(f);return false;}}return true;
}
function beginRoomAction(f){
  const room=f.room; if(room==='practice')f.action=f.task?.label?.toLowerCase().includes('rehears')?'rehearsing':'practicing';
  else if(room==='stage')f.action=f.task?.label?.toLowerCase().includes('perform')?'performing':'playing';
  else if(room==='dining')f.action='eating';else if(room==='chill')f.action=f.needs.energy<40?'resting':'socializing';else if(room==='lab')f.action='observing brain';else if(room==='dark')f.action='stuck in dark';else f.action='idle';
  f.actionSince=state.simMinutes; f.wanderTarget=null;
}
function roomBehavior(f,simDt,realDt){
  const n=f.needs;
  if(f.room==='dining'){
    n.hunger=clamp(n.hunger-3.1*simDt);n.energy=clamp(n.energy+.8*simDt);n.dopamine=clamp(n.dopamine+.45*simDt);n.mood=clamp(n.mood+.3*simDt);f.action='eating';idleWander(f,realDt,.7);
  } else if(f.room==='chill'){
    const socialPeers=FLY_SPECS.map(s=>state.flies[s.id]).filter(o=>o.id!==f.id&&o.room==='chill').length;
    n.energy=clamp(n.energy+1.25*simDt);n.fatigue=clamp(n.fatigue-1.5*simDt);n.stressDrive=clamp(n.stressDrive-1.15*simDt);n.fear=clamp(n.fear-1.0*simDt);n.mood=clamp(n.mood+.42*simDt);n.social=clamp(n.social-(.7+socialPeers*.25)*simDt);f.action=n.energy<55?'resting':'socializing';idleWander(f,realDt,.65);
  } else if(f.room==='lab'){
    n.curiosity=clamp(n.curiosity-1.0*simDt);n.focus=clamp(n.focus+.45*simDt);f.action='observing brain';idleWander(f,realDt,.55);
  } else if(f.room==='dark'){
    n.stressDrive=clamp(n.stressDrive+.75*simDt);n.mood=clamp(n.mood-.42*simDt);n.social=clamp(n.social+.42*simDt);n.dopamine=clamp(n.dopamine-.3*simDt);f.action=state.wasp.released?'watching wasp':'stuck in dark';idleWander(f,realDt,.45);
  } else if(['practice','stage'].includes(f.room)){
    if(!f.task){idleWander(f,realDt,.5);return;} const anchor=actionAnchor(f,f.room);moveFlyToward(f,anchor,realDt,.85);
  } else idleWander(f,realDt,.5);
}
function idleWander(f,dt,speed=.5){
  const r=ROOM_DEFS[f.room];if(!r)return;if(!f.wanderTarget||Math.hypot(f.wanderTarget.x-f.x,f.wanderTarget.z-f.z)<.2||Math.random()<.002){f.wanderTarget={x:r.x+rand(-r.w*.35,r.w*.35),y:rand(1.05,1.8),z:r.z+rand(-r.d*.3,r.d*.3)};}moveFlyToward(f,f.wanderTarget,dt,speed);
}
function updateNeeds(f,simDt){const n=f.needs;n.hunger=clamp(n.hunger+.115*simDt);n.energy=clamp(n.energy-.065*simDt);n.fatigue=clamp(n.fatigue+.04*simDt);n.social=clamp(n.social+.045*simDt);n.curiosity=clamp(n.curiosity+.022*simDt);n.dopamine=clamp(lerp(n.dopamine,45,simDt*.015));n.octopamine=clamp(lerp(n.octopamine,40,simDt*.018));if(n.hunger>75)n.mood=clamp(n.mood-.08*simDt);if(n.energy<25)n.stressDrive=clamp(n.stressDrive+.07*simDt);if(n.stressDrive<25&&n.hunger<50)n.mood=clamp(n.mood+.025*simDt);n.focus=clamp(n.focus+(f.action.includes('practic')?.05:-.01)*simDt);}

/* =========================================================
   MUSIC LEARNING
   ========================================================= */
function curriculumStyleKey(){return state.curriculum.genreKey||`${Math.round(state.curriculum.tempo/20)*20}-${state.curriculum.type}`;}
function targetAt(f,beatIndex){const notes=state.curriculum.notes.length?state.curriculum.notes:DEFAULT_CURRICULUM.notes;if(f.id==='drums')return notes[beatIndex%notes.length];let target=notes[beatIndex%notes.length];let m=NOTE_TO_MIDI[target]??60;if(f.id==='bass')m-=12;if(f.id==='violin')m+=7;return nearestNaturalNote(clamp(Math.round(m),36,84));}
function policyRow(f,idx){const key=String(idx%16);if(!f.q[key])f.q[key]=Object.fromEntries(NOTE_NAMES.map(n=>[n,0]));return f.q[key];}
function choosePracticeNote(f,target,idx){
  const row=policyRow(f,idx),s=f.skill;const familiarity=f.styleMemory[curriculumStyleKey()]||0;const competence=clamp((s.instrument*.25+s.pitch*.35+(state.curriculum.type==='audio'?s.ear:s.reading)*.25+familiarity*.15)/100,.03,.92);if(Math.random()<competence)return target;
  const explore=Math.random();if(explore<.45){const tm=NOTE_TO_MIDI[target]??60;return nearestNaturalNote(clamp(tm+choice([-5,-3,-2,2,3,5]),36,84));}
  const best=Object.entries(row).sort((a,b)=>b[1]-a[1])[0]?.[0];return best||choice(NOTE_NAMES);
}
function pitchReward(target,note){const d=Math.abs((NOTE_TO_MIDI[target]??60)-(NOTE_TO_MIDI[note]??60));return d===0?1:d<=2?.45:d<=5?.08:-.22;}
function practiceBeat(f,groupPeers=0){
  const c=state.curriculum, beat=f.practiceBeats++, idx=beat%c.notes.length, target=targetAt(f,idx);const note=choosePracticeNote(f,target,idx);const skillTiming=clamp(f.skill.timing/100,.03,.95);const jitter=(1-skillTiming)*rand(-.17,.17);const timingReward=1-Math.min(1,Math.abs(jitter)/.18);const pr=pitchReward(target,note);const groupBonus=groupPeers?clamp(f.skill.ensemble/100,.02,.8)*.2:0;let reward=pr*.72+timingReward*.28+groupBonus;
  if(f.id==='drums')reward=timingReward*.85+groupBonus;
  const row=policyRow(f,idx);row[note]=lerp(row[note]||0,reward,.16);
  const n=f.needs; const condition=clamp((n.energy/100)*(1-n.stressDrive/130)*(n.focus/80),.15,1.2);const styleKey=curriculumStyleKey();const familiarity=f.styleMemory[styleKey]||0;const base=.032*condition*(1+familiarity/180);
  f.skill.instrument=clamp(f.skill.instrument+base*(.35+Math.max(0,reward)));f.skill.timing=clamp(f.skill.timing+base*(.4+timingReward));f.skill.pitch=clamp(f.skill.pitch+base*(.3+Math.max(0,pr)));if(c.type==='audio')f.skill.ear=clamp(f.skill.ear+base*.75);else f.skill.reading=clamp(f.skill.reading+base*.75);if(groupPeers)f.skill.ensemble=clamp(f.skill.ensemble+base*.65*groupPeers);if(Math.random()<.08)f.skill.improv=clamp(f.skill.improv+base*.18);f.styleMemory[styleKey]=clamp(familiarity+base*.22,0,100);f.practiceMinutes+=1/c.tempo;f.recentTarget=target;f.recentNote=note;f.lastReward=reward;f.lastRewardAt=state.simMinutes;n.dopamine=clamp(n.dopamine+Math.max(-2,reward*1.6));n.octopamine=clamp(n.octopamine+.5);n.energy=clamp(n.energy-.15);n.hunger=clamp(n.hunger+.08);
  playInstrument(f.id,note,Math.max(0,jitter),clamp(.4+f.skill.instrument/180,.4,.9));return {target,note,reward};
}
function updatePractice(realNow){
  const beatMs=60000/state.curriculum.tempo; if(realNow-globalLastBeatAt<beatMs/state.speed)return;globalLastBeatAt=realNow;
  const active=FLY_SPECS.map(s=>state.flies[s.id]).filter(f=>['practicing','rehearsing','performing','playing'].includes(f.action)&&['practice','stage'].includes(f.room)&&(!f.task||f.task.arrived));
  for(const f of active){const peers=active.filter(o=>o.id!==f.id&&o.room===f.room).length;practiceBeat(f,peers);if(f.action==='performing')f.performances+=1/16;}
}

/* =========================================================
   WASP AI + PUNISH/FEED VISUALS
   ========================================================= */
function toggleWasp(){state.wasp.released=!state.wasp.released;state.wasp.state=state.wasp.released?'patrol':'absent';state.wasp.target=null;if(waspMesh)waspMesh.visible=state.wasp.released;$('#waspBtn').textContent=state.wasp.released?'Recall Wasp':'Release Wasp';addLog(state.wasp.released?'Wasp released into the Dark Room.':'Wasp recalled.');toast(state.wasp.released?'The wasp now lives in the Dark Room until recalled.':'Wasp removed.');}
function darkRoomFlies(){return FLY_SPECS.map(s=>state.flies[s.id]).filter(f=>f.room==='dark'&&!f.path.length);}
function updateWasp(dt,t){
  if(!state.wasp.released||!waspMesh)return;const w=state.wasp,flies=darkRoomFlies();let target=flies.find(f=>f.id===w.target);if(!target&&flies.length)target=flies.reduce((a,b)=>Math.hypot(a.x-w.x,a.z-w.z)<Math.hypot(b.x-w.x,b.z-w.z)?a:b);
  if(target){w.target=target.id;w.state='chase';target.action='fleeing wasp';target.needs.fear=clamp(target.needs.fear+9*dt);target.needs.stressDrive=clamp(target.needs.stressDrive+5.5*dt);target.needs.octopamine=clamp(target.needs.octopamine+4*dt);const dx=target.x-w.x,dy=target.y-w.y,dz=target.z-w.z,d=Math.hypot(dx,dy,dz)||1;const speed=2.15;w.x+=dx/d*speed*dt;w.y+=dy/d*speed*dt;w.z+=dz/d*speed*dt;
    // target evades within room
    const awayX=(target.x-w.x)/(d||1),awayZ=(target.z-w.z)/(d||1);target.x=clamp(target.x+awayX*2.55*dt+Math.sin(t*.013+target.x)*.022,5.9,14.1);target.z=clamp(target.z+awayZ*2.55*dt+Math.cos(t*.011+target.z)*.022,-8.65,-2.4);target.y=clamp(1.3+Math.sin(t*.015+target.z)*.5,.75,2.45);
  } else {
    w.target=null; if(w.state==='chase')w.state='search';const perches=[[13.6,2.55,-8.3],[6.4,2.25,-8.2],[13.5,1.4,-3.0],[8.8,2.8,-5.6]];let p=perches[Math.floor((t/9000)%perches.length)];if(w.state==='search'&&Math.random()<.003)w.state='patrol';if(Math.random()<.0015){w.state='perch';w.perchUntil=t+rand(2500,6500);}if(w.state==='perch'&&t>w.perchUntil)w.state='patrol';if(w.state==='perch'){} else {const dx=p[0]-w.x,dy=p[1]-w.y,dz=p[2]-w.z,d=Math.hypot(dx,dy,dz)||1;const speed=.75;w.x+=dx/d*speed*dt;w.y+=dy/d*speed*dt;w.z+=dz/d*speed*dt;}}
  waspMesh.position.set(w.x,w.y,w.z);waspMesh.rotation.y=Math.atan2(w.x-(waspMesh.userData.prevX||w.x),w.z-(waspMesh.userData.prevZ||w.z));waspMesh.userData.prevX=w.x;waspMesh.userData.prevZ=w.z;const wings=waspMesh.userData.wings||[];wings.forEach((wing,i)=>wing.rotation.y=Math.sin(t*.06)*(i?-.5:.5));
}
function spawnSwatter(f){
  const g=new THREE.Group();const head=mk(new THREE.BoxGeometry(1.05,.08,.72),material(0x55252a,.45,.05),0,0,0);g.add(head);for(let x=-.38;x<=.38;x+=.19)for(let z=-.24;z<=.24;z+=.16){const h=mk(new THREE.BoxGeometry(.07,.09,.08),material(0x161719),x,.04,z);g.add(h);}addBox(g,0,.04,1.55,.12,.12,2.7,0x3b2b22,.7,.02);g.position.set(f.x,f.y+4,f.z-1.2);g.rotation.x=-.38;house.add(g);transient.push({type:'swatter',obj:g,start:now(),duration:650,target:f});f.punishments++;f.needs.stressDrive=clamp(f.needs.stressDrive+5);f.needs.fear=clamp(f.needs.fear+4);f.needs.dopamine=clamp(f.needs.dopamine-2);f.needs.mood=clamp(f.needs.mood-1.5);f.action='startled';}
function spawnFood(f,food){
  const g=new THREE.Group();let obj;if(food.id==='shit'){obj=mk(new THREE.TorusKnotGeometry(.13,.05,36,8),material(0x4b2f20),0,0,0);}else if(food.id==='sugar'){obj=mk(new THREE.BoxGeometry(.28,.28,.28),material(0xf2eee4),0,0,0);}else if(food.id==='cola'){obj=mk(new THREE.CylinderGeometry(.11,.11,.38,14),material(0xa11d24,.45,.1),0,0,0);}else{obj=mk(new THREE.SphereGeometry(.18,14,10),material(food.id==='apple'?0xd74b45:0xec8d68),0,0,0);}g.add(obj);g.position.set(f.x,f.y+1.0,f.z);house.add(g);transient.push({type:'food',obj:g,start:now(),duration:1200,target:f});f.rewards++;f.needs.hunger=clamp(f.needs.hunger-food.nutrition);f.needs.dopamine=clamp(f.needs.dopamine+food.dopamine);f.needs.mood=clamp(f.needs.mood+food.reward*5);f.needs.stressDrive=clamp(f.needs.stressDrive-food.reward*3);f.lastReward=food.reward;f.lastRewardAt=state.simMinutes;f.action='eating treat';}
function updateTransient(t){
  for(let i=transient.length-1;i>=0;i--){const e=transient[i],p=(t-e.start)/e.duration;if(e.type==='swatter'){const hit=Math.sin(clamp(p,0,1)*Math.PI);e.obj.position.y=e.target.y+4-hit*3.65;e.obj.rotation.x=-.38-hit*.58;}if(e.type==='food'){e.obj.position.y=lerp(e.target.y+1,e.target.y+.05,clamp(p*1.15,0,1));e.obj.scale.setScalar(1-clamp((p-.72)/.28,0,1));}if(p>=1){house.remove(e.obj);transient.splice(i,1);}}
}

/* =========================================================
   LIVE BRAIN PROXY VISUAL
   ========================================================= */
function neuralActivity(f){
  const n=f.needs,a=f.action; const act={optic:25,opticR:25,antennal:12,antennalR:12,mushroom:18,mushroomR:18,central:18,auditory:8,feeding:5,motor:10,dopamine:n.dopamine*.7,aversive:n.stressDrive*.78};
  if(a.includes('flying')||a.includes('fleeing')){act.central=85;act.motor=92;act.optic=72;act.opticR=72;}
  if(a.includes('practic')||a.includes('rehears')||a.includes('perform')||a==='playing'){act.auditory=92;act.mushroom=78;act.mushroomR=78;act.motor=72;act.central=54;}
  if(a.includes('eat')){act.feeding=94;act.antennal=62;act.antennalR=62;act.dopamine=clamp(n.dopamine);}
  if(a.includes('social')){act.mushroom=48;act.antennal=36;act.dopamine=clamp(n.dopamine+.12*n.mood);}
  if(a.includes('dark')||a.includes('wasp')||a.includes('startled')){act.aversive=95;act.central=65;act.motor=a.includes('flee')?98:40;act.optic=70;act.opticR=70;}
  if(a.includes('brain')){act.mushroom=52;act.mushroomR=52;act.central=44;}
  return Object.fromEntries(Object.entries(act).map(([k,v])=>[k,clamp(v+rand(-3,3))]));
}
function drawBrain(canvasEl,f,big=false){
  const ctx=canvasEl.getContext('2d'),w=canvasEl.width,h=canvasEl.height,act=neuralActivity(f);ctx.clearRect(0,0,w,h);ctx.fillStyle='#070b10';ctx.fillRect(0,0,w,h);
  // brain outline
  ctx.save();ctx.translate(w*.5,h*.5);ctx.strokeStyle='rgba(122,157,176,.25)';ctx.lineWidth=big?3:1.2;ctx.beginPath();ctx.ellipse(-w*.16,-h*.03,w*.27,h*.31,-.05,0,Math.PI*2);ctx.ellipse(w*.16,-h*.03,w*.27,h*.31,.05,0,Math.PI*2);ctx.stroke();ctx.restore();
  const pts={};BRAIN_REGIONS.forEach(r=>{pts[r.id]={x:r.x*w,y:r.y*h};});
  const links=[['optic','mushroom'],['opticR','mushroomR'],['antennal','mushroom'],['antennalR','mushroomR'],['mushroom','central'],['mushroomR','central'],['auditory','central'],['dopamine','mushroom'],['dopamine','mushroomR'],['aversive','central'],['central','motor'],['feeding','motor']];
  for(const [a,b] of links){const A=pts[a],B=pts[b];ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.strokeStyle='rgba(77,116,137,.22)';ctx.lineWidth=big?1.4:.8;ctx.stroke();}
  BRAIN_REGIONS.forEach(r=>{const p=pts[r.id],v=act[r.id]||0,rad=(big?10:4)+(v/100)*(big?18:8);const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rad*2.5);glow.addColorStop(0,`rgba(116,255,196,${.35+.5*v/100})`);glow.addColorStop(1,'rgba(60,130,110,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,rad*2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle=`rgba(${Math.round(100+v)},${Math.round(150+v)},${Math.round(160+v*.6)},.95)`;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,rad*.34),0,Math.PI*2);ctx.fill();if(big){ctx.fillStyle='#94a8b6';ctx.font='12px system-ui';ctx.fillText(r.name,p.x+12,p.y-8);}});
  if(big){ctx.fillStyle='#526675';ctx.font='11px ui-monospace';ctx.fillText(state.brainPackMeta?'CONNECTOME PACK TELEMETRY':'BEHAVIOR-TO-REGION ACTIVITY PROXY',16,h-18);}return act;
}
function renderBrainRegionList(f){const act=neuralActivity(f);$('#brainRegionList').innerHTML=BRAIN_REGIONS.map(r=>`<div class="region-row"><span>${escapeHtml(r.name)}</span><div class="bar"><i style="width:${act[r.id]||0}%"></i></div><strong>${Math.round(act[r.id]||0)}</strong></div>`).join('');}

/* =========================================================
   MP3/WAV ANALYSIS + NOTES CURRICULUM
   ========================================================= */
async function analyzeAudioFile(file){
  songAnalysisBusy=true;toast('Analyzing audio locally in your browser…');ensureAudio();const buf=await file.arrayBuffer();const decoded=await audioCtx.decodeAudioData(buf.slice(0));const ch=decoded.getChannelData(0),sr=decoded.sampleRate,duration=decoded.duration;
  // energy envelope for rough tempo
  const hop=Math.max(512,Math.floor(sr*.025)),env=[];for(let i=0;i<ch.length;i+=hop){let sum=0,n=0;for(let j=i;j<Math.min(ch.length,i+hop);j+=4){sum+=ch[j]*ch[j];n++;}env.push(Math.sqrt(sum/Math.max(1,n)));}
  const mean=env.reduce((a,b)=>a+b,0)/env.length;const peaks=[];for(let i=2;i<env.length-2;i++)if(env[i]>mean*1.45&&env[i]>env[i-1]&&env[i]>env[i+1])peaks.push(i*hop/sr);const intervals=[];for(let i=1;i<peaks.length;i++){const d=peaks[i]-peaks[i-1];if(d>.22&&d<1.6)intervals.push(d);}let bpm=100;if(intervals.length){intervals.sort((a,b)=>a-b);let med=intervals[Math.floor(intervals.length/2)];bpm=60/med;while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;bpm=clamp(bpm,55,190);}
  // sample short windows and score natural-note frequencies with a cheap sinusoid correlation
  const maxWindows=36,win=Math.min(2048,Math.floor(sr*.08)),notes=[];let brightness=0,changes=0,last=null;for(let wi=0;wi<maxWindows;wi++){const center=Math.floor((wi+.5)/maxWindows*ch.length);const start=clamp(center-Math.floor(win/2),0,Math.max(0,ch.length-win));let best='C4',bestScore=-1;for(const note of NOTE_NAMES.slice(3,18)){const f=noteFreq(note),step=2*Math.PI*f/sr;let re=0,im=0;for(let j=0;j<win;j+=3){const v=ch[start+j]||0,a=step*j;re+=v*Math.cos(a);im-=v*Math.sin(a);}const score=re*re+im*im;if(score>bestScore){bestScore=score;best=note;}}notes.push(best);if(last&&last!==best)changes++;last=best;
    let diff=0,energy=0;for(let j=start+1;j<Math.min(ch.length,start+win);j+=6){diff+=Math.abs(ch[j]-ch[j-1]);energy+=Math.abs(ch[j]);}brightness+=diff/Math.max(.0001,energy);
  }
  const compact=[];for(const n of notes)if(compact.length<2||n!==compact[compact.length-1])compact.push(n);const bright=brightness/maxWindows>1.05?'bright':'dark';const tempoBin=bpm>130?'fast':bpm<85?'slow':'mid';const dense=changes/maxWindows>.55?'dense':'sparse';const genreKey=`${tempoBin}-${bright}-${dense}`;
  songAnalysisBusy=false;return {type:'audio',name:file.name.replace(/\.[^.]+$/,''),tempo:bpm,notes:(compact.length>=4?compact:notes).slice(0,32),genreKey,sourceSummary:`Audio fingerprint: ${tempoBin} · ${bright} · ${dense}`,duration};
}
async function parseMusicXml(file){const txt=await file.text(),doc=new DOMParser().parseFromString(txt,'application/xml');const notes=[];doc.querySelectorAll('note').forEach(n=>{if(n.querySelector('rest'))return;const step=n.querySelector('pitch > step')?.textContent,alter=Number(n.querySelector('pitch > alter')?.textContent||0),oct=n.querySelector('pitch > octave')?.textContent;if(!step||!oct)return;let tok=step+(alter===1?'#':'')+oct;if(sanitizeNoteToken(tok))notes.push(tok);});return notes;}
function useNotesCurriculum(){const name=$('#notesName').value.trim()||'My exercise',tempo=clamp(Number($('#notesTempo').value)||100,40,240),tokens=$('#notesText').value.replace(/\|/g,' ').split(/[\s,;]+/).map(sanitizeNoteToken).filter(Boolean);if(tokens.length<2){alert('Give me at least two valid notes, e.g. C4 E4 G4 C5.');return;}state.curriculum={type:'notes',name,tempo,notes:tokens,genreKey:`notes-${Math.round(tempo/20)*20}`,sourceSummary:'Written-note curriculum',duration:0};addLog(`Curriculum changed to notes: ${name}.`);renderCurriculum();saveLocal();toast('New written curriculum loaded. Practice now trains against these notes.');}

/* =========================================================
   DIALOGS + BUTTONS
   ========================================================= */
function setupUi(){
  $('#selectAllBtn').onclick=()=>{state.selected=state.selected.length===FLY_SPECS.length?[]:FLY_SPECS.map(s=>s.id);if(state.selected.length){state.focusedFly=state.selected[0];brainViewFlyId=state.focusedFly;}renderAll();};
  $('#sendRoomChoices').innerHTML=ROOM_ORDER.map(id=>`<div class="choice-card ${id==='practice'?'selected':''}" data-send-room="${id}"><b>${ROOM_DEFS[id].name}</b><span>${ROOM_DEFS[id].desc}</span></div>`).join('');document.querySelectorAll('[data-send-room]').forEach(el=>el.onclick=()=>{selectedRoomForSend=el.dataset.sendRoom;document.querySelectorAll('[data-send-room]').forEach(x=>x.classList.toggle('selected',x===el));});
  $('#sendBtn').onclick=()=>$('#sendDialog').showModal();
  $('#confirmSendBtn').onclick=()=>{const fs=selectedFlies(),durVal=$('#sendDuration').value,after=$('#afterTask').value;for(const f of fs){const dur=taskDuration(durVal);assignTask(f,selectedRoomForSend,dur,'user',after,`Commanded: ${ROOM_DEFS[selectedRoomForSend].name}`);}addLog(`${fs.map(f=>f.name).join(', ')} sent to ${ROOM_DEFS[selectedRoomForSend].name}.`);toast('Command accepted. Watch them fly through the house.');renderAll();saveLocal();};
  $('#foodChoices').innerHTML=FOOD.map(x=>`<button value="cancel" class="food-item" data-food="${x.id}"><span class="emoji">${x.emoji}</span><b>${x.name}</b><span>reward ${x.reward.toFixed(2)}</span></button>`).join('');document.querySelectorAll('[data-food]').forEach(b=>b.onclick=()=>{const food=FOOD.find(x=>x.id===b.dataset.food);const fs=selectedFlies();fs.forEach(f=>spawnFood(f,food));addLog(`${fs.map(f=>f.name).join(', ')} received ${food.name}.`);toast(`${food.name}: reward signal delivered.`);renderAll();saveLocal();});
  $('#giveBtn').onclick=()=>$('#giveDialog').showModal();
  $('#punishBtn').onclick=()=>{const fs=selectedFlies();fs.forEach(spawnSwatter);addLog(`${fs.map(f=>f.name).join(', ')} swatted.`);toast('Physical startle + small aversive signal. Yes, you can spam it.');renderAll();saveLocal();};
  $('#waspBtn').onclick=toggleWasp; $('#waspBtn').textContent=state.wasp.released?'Recall Wasp':'Release Wasp';
  $('#rehearseBtn').onclick=()=>{const fs=selectedFlies();for(const f of fs)assignTask(f,'practice',rand(8,12),'user','auto','Group rehearsal');addLog(`${fs.map(f=>f.name).join(', ')} called to rehearsal.`);toast('Selected flies are heading to the Practice Room for a group rehearsal.');renderAll();};
  $('#performBtn').onclick=()=>{const fs=selectedFlies();for(const f of fs)assignTask(f,'stage',rand(5,8),'user','auto','Stage performance');addLog(`${fs.map(f=>f.name).join(', ')} called to the stage.`);toast('Selected flies are heading to the stage. Their current skill decides how ugly this sounds.');renderAll();};
  $('#uploadSongBtn').onclick=()=>$('#songInput').click(); $('#songInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const c=await analyzeAudioFile(file);state.curriculum=c;currentAudioFileName=file.name;addLog(`Analyzed song: ${file.name} · ${Math.round(c.tempo)} BPM · ${c.genreKey}.`);renderCurriculum();saveLocal();toast('Song analyzed. The flies now practice against its timing/pitch fingerprint.');}catch(err){console.error(err);alert(`Could not analyze audio: ${err.message}`);}finally{songAnalysisBusy=false;e.target.value='';}};
  $('#teachNotesBtn').onclick=()=>$('#notesDialog').showModal(); $('#confirmNotesBtn').onclick=useNotesCurriculum; $('#musicXmlInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const notes=await parseMusicXml(file);if(!notes.length)throw new Error('No pitched notes found.');$('#notesText').value=notes.join(' ');$('#notesName').value=file.name.replace(/\.[^.]+$/,'');toast(`Imported ${notes.length} notes from MusicXML.`);}catch(err){alert(err.message);}e.target.value='';};
  $('#pauseBtn').onclick=()=>{state.paused=!state.paused;renderClock();}; $('#speedBtn').onclick=()=>{state.speed=state.speed===1?2:state.speed===2?4:state.speed===4?8:1;renderClock();}; $('#audioBtn').onclick=()=>{state.audioOn=!state.audioOn;if(state.audioOn)ensureAudio();renderClock();};
  $('#saveBtn').onclick=()=>{saveLocal();toast('Saved in this browser.');addLog('Local save written.');}; $('#exportBtn').onclick=exportSave; $('#importSaveInput').onchange=importSave; $('#clearLogBtn').onclick=()=>{state.logs=[];renderLog();};
  $('#brainMini').onclick=()=>openBrain(); $('#closeBrainBtn').onclick=()=>$('#brainDialog').close(); $('#brainFlySelect').innerHTML=FLY_SPECS.map(s=>`<option value="${s.id}">${s.name} · ${s.role}</option>`).join(''); $('#brainFlySelect').value=brainViewFlyId; $('#brainFlySelect').onchange=e=>{brainViewFlyId=e.target.value;renderBrainHeader();};
  $('#cloudBtn').onclick=()=>{loadCloudFields();$('#cloudDialog').showModal();}; $('#cloudSaveSettingsBtn').onclick=saveCloudSettings; $('#cloudUploadBtn').onclick=cloudUpload; $('#cloudDownloadBtn').onclick=cloudDownload;
}
function openBrain(){brainViewFlyId=state.focusedFly;$('#brainFlySelect').value=brainViewFlyId;$('#brainDisclaimer').textContent=state.brainPackMeta?'Using imported connectome-pack metadata + live simulation telemetry.':'Region activity proxy until a MaleCNS brain pack is loaded.';$('#brainDialog').showModal();}
setupUi();

/* =========================================================
   SAVE / CLOUD
   ========================================================= */
function stateForSave(){return JSON.parse(JSON.stringify(state));}
function saveLocal(){try{localStorage.setItem('flyband_v2_state',JSON.stringify(stateForSave()));}catch(e){console.warn(e)}}
function loadLocal(){try{return JSON.parse(localStorage.getItem('flyband_v2_state'))}catch{return null}}
function exportSave(){const blob=new Blob([JSON.stringify(stateForSave(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`flyband-v2-day-${state.day}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importSave(e){const f=e.target.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(obj.version!==2)throw new Error('This is not a V2 save.');state=obj;normalizeState();for(const spec of FLY_SPECS){const m=flyMeshes[spec.id],ff=state.flies[spec.id];if(m)m.position.set(ff.x,ff.y,ff.z);}renderAll();saveLocal();toast('V2 save imported.');}catch(err){alert(err.message)}e.target.value='';}
setInterval(()=>saveLocal(),15000);
const CLOUD_KEY='flyband_v2_cloud';function getCloud(){try{return JSON.parse(localStorage.getItem(CLOUD_KEY))||{}}catch{return {}}}
function saveCloudSettings(){const c={url:$('#supabaseUrl').value.trim().replace(/\/$/,''),key:$('#supabaseKey').value.trim(),name:$('#cloudSaveName').value.trim()||'main'};localStorage.setItem(CLOUD_KEY,JSON.stringify(c));toast('Cloud settings saved on this computer.');}
function loadCloudFields(){const c=getCloud();$('#supabaseUrl').value=c.url||'';$('#supabaseKey').value=c.key||'';$('#cloudSaveName').value=c.name||'main';}
async function supa(path,opts={}){const c=getCloud();if(!c.url||!c.key)throw new Error('Cloud settings are empty.');const r=await fetch(`${c.url}/rest/v1/${path}`,{...opts,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(opts.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(text||`HTTP ${r.status}`);return text?JSON.parse(text):null;}
async function cloudUpload(){saveCloudSettings();const c=getCloud();try{await supa(`flyband_saves?on_conflict=save_name`,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({save_name:c.name,state:stateForSave(),updated_at:new Date().toISOString()})});toast('Cloud save uploaded.');addLog('Cloud save uploaded.');}catch(e){alert(`Cloud upload failed:\n${e.message}\n\nUse the V2 supabase.sql file once in Supabase first.`)}}
async function cloudDownload(){saveCloudSettings();const c=getCloud();try{const rows=await supa(`flyband_saves?save_name=eq.${encodeURIComponent(c.name)}&select=state&limit=1`);if(!rows?.length)throw new Error('No cloud save found.');state=rows[0].state;normalizeState();renderAll();saveLocal();toast('Cloud save downloaded.');location.reload();}catch(e){alert(`Cloud download failed:\n${e.message}`)}}

/* =========================================================
   SIMULATION LOOP
   ========================================================= */
let lastFrame=now(), lastUiRender=0;
function simUpdate(dt,t){
  if(state.paused)return; const simDt=dt*.25*state.speed; // simulated minutes per real second
  state.simMinutes+=simDt;if(state.simMinutes>=1440){state.simMinutes-=1440;state.day++;}
  for(const spec of FLY_SPECS){const f=state.flies[spec.id];updateNeeds(f,simDt);
    const moving=updateFlyPath(f,dt);
    if(!moving){
      if(f.task?.arrived){f.task.remaining-=simDt;if(f.task.remaining<=0)finishTask(f);}
      if(!f.task&&state.settings.autonomy&&state.simMinutes-f.lastDecision>rand(.6,1.4)){f.lastDecision=state.simMinutes;chooseAutonomousTask(f);}
      if(!f.path.length)roomBehavior(f,simDt,dt);
    }
    const mesh=flyMeshes[f.id];if(mesh){mesh.position.set(f.x,f.y,f.z);const speed=Math.hypot(f.vx,f.vz);if(speed>.1)mesh.rotation.y=Math.atan2(f.vx,f.vz);const wings=mesh.userData.wings||[];const flying=f.path.length||f.action==='fleeing wasp'||speed>.65;wings.forEach((w,i)=>w.rotation.y=Math.sin(t*(flying?.045:.014))*(i?-.45:.45));mesh.position.y+=Math.sin(t*.004+spec.id.length)*.015;}
  }
  updateWasp(dt,t);updatePractice(t);worldSpeedSeconds+=dt;
}
function animate(t){
  const dt=Math.min(.05,(t-lastFrame)/1000||.016);lastFrame=t;if(cameraTween){const p=clamp((t-cameraTween.start)/cameraTween.dur,0,1),e=1-Math.pow(1-p,3);cameraTarget.lerpVectors(cameraTween.fromT,cameraTween.toT,e);camera.position.lerpVectors(cameraTween.fromP,cameraTween.toP,e);updateCameraLook();if(p>=1)cameraTween=null;}
  simUpdate(dt,t);updateTransient(t);
  const bf=state.flies[brainViewFlyId]||focusedFly();drawBrain($('#brainMiniCanvas'),bf,false);if($('#brainDialog').open){drawBrain($('#brainBigCanvas'),bf,true);renderBrainRegionList(bf);}
  if(t-lastUiRender>450){lastUiRender=t;renderClock();renderFlyList();renderSelectedSummary();renderStats();renderProgress();renderTaskTicker();renderBrainHeader();}
  renderer.render(scene,camera);requestAnimationFrame(animate);
}
function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();renderAll();requestAnimationFrame(animate);toast('V2 loaded. The flies are autonomous; select one and issue a command.');
