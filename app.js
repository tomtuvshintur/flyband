import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FLYS = [
  {id:'piano',name:'Tom',role:'Piano',eye:'#5ec5ff'},
  {id:'guitar',name:'Paul',role:'Guitar',eye:'#ff8aa1'},
  {id:'bass',name:'Stuart',role:'Bass',eye:'#c295ff'},
  {id:'drums',name:'Ringo',role:'Drums',eye:'#ffca79'},
  {id:'violin',name:'John',role:'Violin',eye:'#90f08a'},
];
const ROOM_ORDER = ['practice','stage','dining','chill','lab','dark'];
const ROOM_NAMES = {
  practice:'Practice Wing',
  stage:'Stage Hall',
  dining:'Dining Room',
  chill:'Chill Garden',
  lab:'Brain Lab',
  dark:'Dark Room'
};
const ROOM_POS = {
  practice:new THREE.Vector3(-9,0,-4),
  stage:new THREE.Vector3(0,0,-4),
  dining:new THREE.Vector3(9,0,-4),
  chill:new THREE.Vector3(-9,0,6),
  lab:new THREE.Vector3(0,0,6),
  dark:new THREE.Vector3(9,0,6)
};
const TARGET_PATTERN = {
  piano:['C4','E4','G4','C5'],
  guitar:['E4','G4','A4','B4'],
  bass:['C3','C3','G2','G2'],
  drums:['K','S','K','H'],
  violin:['G4','A4','B4','C5']
};
const NOTES = ['C5','B4','A4','G4','F4','E4','D4','C4'];
const FOODS = {
  shit:{reward:.15, hunger:-4, mood:-2},
  apple:{reward:.5,hunger:-12,mood:2},
  peach:{reward:.8,hunger:-18,mood:4},
  sugar:{reward:1.2,hunger:-20,mood:6},
  cola:{reward:1.7,hunger:-26,mood:8, stress:2}
};

const regionDefs = [
  {key:'vision',name:'Visual / Optic',color:'#6fd0ff'},
  {key:'motor',name:'Motor / Descending',color:'#ffcc7b'},
  {key:'reward',name:'Reward / Dopaminergic',color:'#8fff95'},
  {key:'aversion',name:'Aversive / Threat',color:'#ff7e8f'},
  {key:'memory',name:'Memory / Mushroom Body',color:'#ba9aff'},
  {key:'social',name:'Social / Courtship-ish',color:'#ff92db'},
  {key:'homeostasis',name:'Homeostasis / Internal State',color:'#91f3d3'},
  {key:'arousal',name:'Arousal / Octopamine',color:'#ffe58b'}
];

const $ = s => document.querySelector(s);
const roomButtons = $('#roomButtons'), flyList = $('#flyList');
const statusMessage = $('#statusMessage');
let speedBtn = $('#speedBtn'), pauseBtn = $('#pauseBtn');

function clamp(v, min=0, max=100){ return Math.max(min, Math.min(max, v)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function newFly(meta){
  return {
    ...meta,
    selected: meta.id==='piano',
    room: 'practice',
    targetRoom: 'practice',
    position: ROOM_POS.practice.clone().add(new THREE.Vector3(rand(-1,1),1.4+Math.random()*.4,rand(-1,1))),
    velocity: new THREE.Vector3(),
    pathTarget: null,
    skill: rand(4,8),
    timing: rand(3,7),
    control: rand(3,7),
    bandSkill: rand(2,5),
    improv: rand(2,5),
    reading: rand(2,5),
    dopamine: 42,
    stressDrive: 15,
    octopamine: 36,
    energy: 75,
    hunger: 18,
    mood: 65,
    fear: 6,
    fatigue: 10,
    social: 35,
    curiosity: 52,
    focus: 48,
    currentTask: {type:'autonomous', room:'practice', timeLeft: rand(3,6)},
    manualScore: makeEmptyScore(),
    q: {},
    anim:'idle',
    performances:0,
    logTag: meta.name
  };
}

function makeEmptyScore(){
  return Array.from({length:NOTES.length},()=>Array(16).fill(false));
}

const state = {
  day:1, minutes:12*60, paused:false, speed:1,
  viewRoom:'practice',
  flies: Object.fromEntries(FLYS.map(f=>[f.id,newFly(f)])),
  log:[`FlyBand V2 Beta booted.`],
  selected:['piano'],
  doorStates: Object.fromEntries(ROOM_ORDER.map(r=>[r,true])),
  song:null,
  songMeta:null,
  wasp:{
    active:false, room:'dark', mode:'idle',
    position: ROOM_POS.dark.clone().add(new THREE.Vector3(0,2,0)),
    velocity: new THREE.Vector3(),
    targetFly:null,
    perchTimer:0
  },
  lastBrainBurst:{},
};

function selectedFlies(){ return state.selected.map(id=>state.flies[id]).filter(Boolean); }
function primaryFly(){ return state.flies[state.selected[0]] || state.flies.piano; }

function log(msg){
  const line = `[${clockString()}] ${msg}`;
  state.log.unshift(line);
  state.log = state.log.slice(0,90);
  renderLog();
}
function say(msg){ statusMessage.textContent = msg; }

function roomCenter(room){ return ROOM_POS[room].clone(); }
function clockString(){
  let h=Math.floor(state.minutes/60)%24, m=Math.floor(state.minutes%60);
  return `D${state.day} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/* -------- UI -------- */
function renderRooms(){
  roomButtons.innerHTML='';
  ROOM_ORDER.forEach(r=>{
    const b=document.createElement('button');
    b.className='room-btn';
    b.innerHTML=`<span>${ROOM_NAMES[r]}</span><span>${state.doorStates[r]?'Open':'Closed'}</span>`;
    b.onclick=()=>{ focusRoom(r); };
    roomButtons.appendChild(b);
  });
}
function renderFlyList(){
  flyList.innerHTML='';
  FLYS.forEach(meta=>{
    const f=state.flies[meta.id];
    const btn=document.createElement('button');
    btn.className='fly-row'+(state.selected.includes(f.id)?' active':'');
    btn.style.setProperty('--fly',meta.eye);
    btn.innerHTML=`
      <span class="fly-left">
        <span class="eye-dot" style="background:${meta.eye}; color:${meta.eye}"></span>
        <span class="fly-main"><strong>${f.name}</strong><span>${f.role} · ${ROOM_NAMES[f.room]}</span></span>
      </span>
      <span>${Math.round(f.skill)}%</span>`;
    btn.onclick=(e)=>toggleSelect(f.id, e.ctrlKey || e.metaKey);
    flyList.appendChild(btn);
  });
}
function toggleSelect(id, multi=false){
  if(multi){
    if(state.selected.includes(id)) state.selected = state.selected.filter(x=>x!==id);
    else state.selected.push(id);
    if(!state.selected.length) state.selected=[id];
  }else{
    state.selected=[id];
  }
  syncBrainSelects();
  renderFlyList(); renderSelected(); drawBrainMini();
}
function renderSelected(){
  const f=primaryFly();
  $('#headline').textContent = ROOM_NAMES[state.viewRoom];
  $('#clock').textContent = `DAY ${state.day} · ${String(Math.floor(state.minutes/60)%24).padStart(2,'0')}:${String(Math.floor(state.minutes%60)).padStart(2,'0')}`;
  $('#simState').textContent = state.paused ? 'PAUSED' : `RUNNING ${state.speed}×`;

  const box = $('#selectedSummary');
  box.innerHTML = `<div class="summary-box"><b style="font-size:18px">${f.name}</b><div class="tiny">${f.role} · in ${ROOM_NAMES[f.room]} · task: ${taskLabel(f.currentTask)}</div></div>`;
  const statWrap = $('#selectedStats');
  const stats = [
    ['Dopamine',f.dopamine],['Stress Drive',f.stressDrive],['Octopamine',f.octopamine],['Energy',f.energy],
    ['Hunger',100-f.hunger],['Mood',f.mood],['Fear',100-f.fear],['Fatigue',100-f.fatigue],
    ['Social',100-f.social],['Curiosity',f.curiosity],['Focus',f.focus],['Skill',f.skill],
    ['Timing',f.timing],['Control',f.control],['Band Skill',f.bandSkill],['Score Reading',f.reading]
  ];
  statWrap.innerHTML = stats.map(([n,v])=>`<div class="stat-item"><div class="stat-head"><span>${n}</span><b>${v.toFixed(1)}</b></div><div class="bar"><i style="width:${clamp(v)}%"></i></div></div>`).join('');
  $('#brainFlyName').textContent = `${f.name} · ${f.role}`;
}
function taskLabel(task){
  if(!task) return 'none';
  return `${task.type} @ ${ROOM_NAMES[task.room]} · ${task.timeLeft.toFixed(1)}m`;
}
function renderTasks(){
  const panel = $('#taskPanel');
  panel.innerHTML = FLYS.map(meta=>{
    const f=state.flies[meta.id];
    return `<div class="task-card"><b>${f.name}</b> · ${f.role}<br><small>${ROOM_NAMES[f.room]} → ${taskLabel(f.currentTask)}</small></div>`;
  }).join('');
}
function renderLog(){
  $('#logPanel').innerHTML = state.log.map(line=>`<div class="log-line">${line}</div>`).join('');
}
function renderSongCard(){
  const card=$('#songCard');
  if(!state.songMeta){
    card.innerHTML=`<div><b>No song loaded.</b></div><div class="tiny">Upload an MP3 or WAV.</div>`;
  }else{
    card.innerHTML=`<div><b>${state.songMeta.name}</b></div><div class="tiny">Duration ${state.songMeta.duration.toFixed(1)}s · estimated tempo ${state.songMeta.tempo.toFixed(0)} BPM · energy ${state.songMeta.energy.toFixed(1)}</div>`;
  }
}
function syncBrainSelects(){
  const sel = $('#brainFlySelect'), scoreSel = $('#scoreFlySelect');
  sel.innerHTML=''; scoreSel.innerHTML='';
  FLYS.forEach(meta=>{
    const a=document.createElement('option');
    a.value=meta.id;a.textContent=`${meta.name} · ${meta.role}`;
    if(meta.id===primaryFly().id) a.selected=true;
    sel.appendChild(a);
    const b=a.cloneNode(true);
    if(meta.id===primaryFly().id) b.selected=true;
    scoreSel.appendChild(b);
  });
}
renderRooms(); renderFlyList(); renderSelected(); renderTasks(); renderLog(); renderSongCard(); syncBrainSelects();

/* -------- NOTE BOARD -------- */
function buildNoteBoard(){
  const wrap = $('#noteGridWrap');
  const flyId = $('#scoreFlySelect').value || primaryFly().id;
  const score = state.flies[flyId].manualScore;
  const grid=document.createElement('div');
  grid.className='note-grid';
  for(let r=0;r<NOTES.length;r++){
    const lab=document.createElement('div');
    lab.className='note-label'; lab.textContent=NOTES[r]; grid.appendChild(lab);
    for(let c=0;c<16;c++){
      const cell=document.createElement('div');
      cell.className='note-cell'+(score[r][c]?' active':'');
      cell.onclick=()=>{
        score[r][c]=!score[r][c];
        cell.classList.toggle('active',score[r][c]);
      };
      grid.appendChild(cell);
    }
  }
  wrap.innerHTML=''; wrap.appendChild(grid);
}
$('#notesBtn').onclick=()=>{ buildNoteBoard(); $('#notesDialog').showModal(); };
$('#closeNotesDialog').onclick=()=>$('#notesDialog').close();
$('#scoreFlySelect').onchange=buildNoteBoard;
$('#clearScoreBtn').onclick=()=>{ state.flies[$('#scoreFlySelect').value].manualScore = makeEmptyScore(); buildNoteBoard(); };
$('#assignScoreBtn').onclick=()=>{
  const scoreFly = state.flies[$('#scoreFlySelect').value];
  selectedFlies().forEach(f=>f.manualScore = JSON.parse(JSON.stringify(scoreFly.manualScore)));
  log(`Assigned note board from ${scoreFly.name} to selected flies.`);
  say(`Assigned score to selected flies.`);
};

/* -------- THREE.JS WORLD -------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1219);
scene.fog = new THREE.Fog(0x0b1219, 18, 70);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(0, 24, 34);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.target.set(0,2,0);
controls.zoomSpeed=.8;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.listenToKeyEvents(window);
canvas.addEventListener('pointerdown', e=>{
  controls.mouseButtons.LEFT = e.shiftKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
});
canvas.addEventListener('dblclick', ()=>resetCamera());

const hemi = new THREE.HemisphereLight(0xbfdfff,0x25313b,1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff7ee,1.45); sun.position.set(14,20,8); sun.castShadow=true; scene.add(sun);
sun.shadow.camera.top=25; sun.shadow.camera.bottom=-25; sun.shadow.camera.left=-25; sun.shadow.camera.right=25;

const world = new THREE.Group(); scene.add(world);
const flyMeshes = {};
const roomMarkers = {};
const doorMeshes = {};
let swats = [];

function m(color, rough=.85, metal=.05){ return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal}); }
function box(w,h,d,mat){ const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.castShadow=true; mesh.receiveShadow=true; return mesh; }
function cyl(r1,r2,h,mat,s=16){ const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,s),mat); mesh.castShadow=true; mesh.receiveShadow=true; return mesh; }

function buildWorld(){
  while(world.children.length) world.remove(world.children[0]);
  Object.keys(flyMeshes).forEach(k=>delete flyMeshes[k]);
  Object.keys(roomMarkers).forEach(k=>delete roomMarkers[k]);
  Object.keys(doorMeshes).forEach(k=>delete doorMeshes[k]);

  // surrounding terrain
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80,70), new THREE.MeshStandardMaterial({color:0x16222d, roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; world.add(ground);

  for(let i=0;i<16;i++){
    const trunk = cyl(.18,.26,3,m(0x4d392d)); trunk.position.set(rand(-34,34),1.5,rand(-28,28));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(rand(1.4,2.3),16,12), m(choice([0x335f46,0x3b6b51,0x4d7a57]),.92,.01));
    crown.position.set(trunk.position.x,trunk.position.y+2.5,trunk.position.z);
    world.add(trunk,crown);
  }

  // main house shell
  const floorMat = m(0x242f38,.95,.02), wallMat = m(0xe2dbc7,.95,.0), roofMat=m(0x3c4650,.9,.1);
  const houseFloor = box(34,.45,24,floorMat); houseFloor.position.set(0,0,1); world.add(houseFloor);
  const roof = box(34,.2,24,roofMat); roof.position.set(0,5.2,1); world.add(roof);

  // outer walls
  const wallH=5, wallT=.3;
  [[0,2.5,-11,34,wallH,wallT],[0,2.5,13,34,wallH,wallT],[-17,2.5,1,wallT,wallH,24],[17,2.5,1,wallT,wallH,24]]
    .forEach(([x,y,z,w,h,d])=>{ const ww=box(w,h,d,wallMat); ww.position.set(x,y,z); world.add(ww); });

  // internal walls with door openings
  // vertical split x = -5.6 and x=5.6
  addWallSegment(-5.7,2.5,-5.2,.3,5,11.6,wallMat);
  addWallSegment(-5.7,2.5,7.2,.3,5,11.6,wallMat);
  addWallSegment(5.7,2.5,-5.2,.3,5,11.6,wallMat);
  addWallSegment(5.7,2.5,7.2,.3,5,11.6,wallMat);
  // horizontal split z = 1
  addWallSegment(-11.2,2.5,1,11.2,5,.3,wallMat);
  addWallSegment(0,2.5,1,11.2,5,.3,wallMat);
  addWallSegment(11.2,2.5,1,11.2,5,.3,wallMat);

  // room rugs/markers
  ROOM_ORDER.forEach(r=>{
    const center = ROOM_POS[r].clone();
    const rug = box(7.5,.04,6.8,m(choice([0x233444,0x334026,0x403333,0x2e2d45]),1,.0));
    rug.position.set(center.x,.24,center.z);
    world.add(rug);
    roomMarkers[r]=rug;
  });

  // doors
  createDoor('practice', new THREE.Vector3(-5.7,1.5,-4), 'x');
  createDoor('stage', new THREE.Vector3(0,1.5,1), 'z');
  createDoor('dining', new THREE.Vector3(5.7,1.5,-4), 'x');
  createDoor('chill', new THREE.Vector3(-5.7,1.5,6), 'x');
  createDoor('lab', new THREE.Vector3(0,1.5,1), 'z-center');
  createDoor('dark', new THREE.Vector3(5.7,1.5,6), 'x');

  // furniture
  decoratePractice(); decorateStage(); decorateDining(); decorateChill(); decorateLab(); decorateDark();
  buildFlies();
  buildWasp();
}
function addWallSegment(x,y,z,w,h,d,mat){ const a=box(w,h,d,mat); a.position.set(x,y,z); world.add(a); }
function createDoor(room, pos, axis){
  const door = box(axis.startsWith('x')?.18:1.5,3,axis.startsWith('x')?1.5:.18,m(0x6e533d,.82,.08));
  door.position.copy(pos);
  door.userData={room, axis, open:state.doorStates[room]};
  if(state.doorStates[room]) door.rotation.y = axis.startsWith('x') ? Math.PI/2*.72 : 0;
  world.add(door); doorMeshes[room]=door;
}
function decoratePractice(){
  const c=ROOM_POS.practice;
  const piano=box(2.8,.9,1.2,m(0x181c20,.35,.18)); piano.position.set(c.x-2.1,.7,c.z-1.7); world.add(piano);
  for(let i=0;i<10;i++){ const key=box(.22,.08,.45,m(i%2?0xe4e4e4:0x262626,.45,.0)); key.position.set(c.x-3.12+i*.23,1.12,c.z-2.05); world.add(key); }
  const stool=cyl(.3,.35,.48,m(0x242424)); stool.position.set(c.x-1.8,.24,c.z-.8); world.add(stool);
  const guitarAmp=box(1.4,1.5,.9,m(0x15191c)); guitarAmp.position.set(c.x+1.8,.78,c.z-1.2); world.add(guitarAmp);
  const bassAmp=box(1.1,1.3,.8,m(0x171717)); bassAmp.position.set(c.x+2.8,.68,c.z-.3); world.add(bassAmp);
  const drum1=cyl(.7,.72,.7,m(0x6b392a)); drum1.position.set(c.x+1.1,.4,c.z+1.4); world.add(drum1);
  const drum2=cyl(.55,.57,.55,m(0x6b392a)); drum2.position.set(c.x+2.0,.28,c.z+1.8); world.add(drum2);
  const cym = cyl(.65,.65,.05,m(0xcaa25d,.35,.4),24); cym.position.set(c.x+2.4,1.22,c.z+1.0); world.add(cym);
  const violinStand=box(.08,2,.08,m(0x2a2d31)); violinStand.position.set(c.x-.1,1.0,c.z+2.0); world.add(violinStand);
  const sofa=box(2.4,.9,1.1,m(0x253444,.9,.05)); sofa.position.set(c.x-.5,.5,c.z+1.4); world.add(sofa);
}
function decorateStage(){
  const c=ROOM_POS.stage;
  const stage=box(7.1,.7,6.2,m(0x171a1d,.82,.12)); stage.position.set(c.x,.38,c.z); world.add(stage);
  for(let x=-2.4;x<=2.4;x+=1.2){ const spot = new THREE.SpotLight(choice([0x81dbff,0xff83a8,0xb294ff,0x9df18d]),9,14,.55,.45); spot.position.set(c.x+x,4.7,c.z+2.5); spot.target.position.set(c.x+x,.4,c.z); world.add(spot, spot.target); }
  const backdrop=box(6.3,2.5,.16,m(0x111928,.4,.2)); backdrop.position.set(c.x,1.7,c.z-2.8); world.add(backdrop);
  const sign=box(3.8,.7,.12,m(0x223447,.4,.2)); sign.position.set(c.x,3.5,c.z-2.72); world.add(sign);
}
function decorateDining(){
  const c=ROOM_POS.dining;
  const table=box(3.8,.25,2.4,m(0x5d4435,.88,.04)); table.position.set(c.x,.92,c.z); world.add(table);
  for(const dx of [-1.2,0,1.2]){ const fruit = new THREE.Mesh(new THREE.SphereGeometry(.25,14,10), m(choice([0xd97060,0xf0b357,0x8bc56f]),.6,.02)); fruit.position.set(c.x+dx,1.22,c.z+rand(-.4,.4)); world.add(fruit); }
  for(const [dx,dz] of [[-1.6,-1.1],[1.6,-1.1],[-1.6,1.1],[1.6,1.1]]){ const chair=box(.8,.85,.8,m(0x2a3138)); chair.position.set(c.x+dx,.45,c.z+dz); world.add(chair); }
  const fridge=box(1.1,2.4,1,m(0xd7ddd9,.95,.0)); fridge.position.set(c.x+2.6,1.2,c.z-2.2); world.add(fridge);
}
function decorateChill(){
  const c=ROOM_POS.chill;
  const grass=box(7.2,.12,6.2,m(0x2c4a34,.96,.0)); grass.position.set(c.x,.28,c.z); world.add(grass);
  for(let i=0;i<3;i++){ const trunk=cyl(.16,.22,2.1,m(0x50392b)); trunk.position.set(c.x-2.5+i*2.2,1.05,c.z+choice([-1.4,.3,1.5])); world.add(trunk); const canopy=new THREE.Mesh(new THREE.SphereGeometry(1.1,16,12),m(0x426f47,.95,.01)); canopy.position.set(trunk.position.x,2.85,trunk.position.z); world.add(canopy); }
  const bench=box(2.2,.28,.8,m(0x6e5a47)); bench.position.set(c.x+2.0,.72,c.z+1.8); world.add(bench);
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,.08,32), new THREE.MeshStandardMaterial({color:0x1e5f76, roughness:.35, metalness:.0})); pond.position.set(c.x+1.6,.31,c.z-1.3); world.add(pond);
}
function decorateLab(){
  const c=ROOM_POS.lab;
  for(let i=0;i<3;i++){ const desk=box(2.2,.14,1.1,m(0x25313d,.8,.06)); desk.position.set(c.x-2.4+i*2.4,.84,c.z-1.7); world.add(desk); const mon=box(1.3,.85,.09,m(0x0f1720,.32,.22)); mon.position.set(c.x-2.4+i*2.4,1.56,c.z-2.15); world.add(mon); }
  const bigMon=box(2.6,1.4,.1,m(0x0d1720,.32,.22)); bigMon.position.set(c.x,1.8,c.z+2.2); world.add(bigMon);
}
function decorateDark(){
  const c=ROOM_POS.dark;
  const matWall=m(0x111113,1,0);
  const cot=box(1.8,.25,.8,matWall); cot.position.set(c.x-1.4,.4,c.z-1.4); world.add(cot);
  const bulb=new THREE.PointLight(0x67707c,.9,7); bulb.position.set(c.x,3.6,c.z); world.add(bulb);
}

/* -------- Fly and wasp models -------- */
function makeFly(meta){
  const g=new THREE.Group();
  const bodyMat=m(0x232528,.55,.05), dark=m(0x17191b,.65,.03), wingMat = new THREE.MeshStandardMaterial({color:0xdaf4ff, transparent:true, opacity:.42, roughness:.2});
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(.28,18,14), bodyMat); abdomen.scale.set(1,1,1.35); abdomen.position.set(0,0,0.2); g.add(abdomen);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(.24,18,14), dark); thorax.position.set(0,0,-0.15); g.add(thorax);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.17,18,14), dark); head.position.set(0,0,-0.48); g.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({color: new THREE.Color(meta.eye), emissive: new THREE.Color(meta.eye), emissiveIntensity:.25, roughness:.3});
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(.08,10,10), eyeMat); eye1.position.set(.10,.03,-.56); g.add(eye1);
  const eye2 = eye1.clone(); eye2.position.x=-.10; g.add(eye2);
  const wing1 = new THREE.Mesh(new THREE.SphereGeometry(.23,12,10), wingMat); wing1.scale.set(1.8,.12,1.1); wing1.position.set(.25,.11,-.05); wing1.rotation.z=.52; wing1.rotation.y=.25; g.add(wing1);
  const wing2 = wing1.clone(); wing2.position.x=-.25; wing2.rotation.z=-.52; wing2.rotation.y=-.25; g.add(wing2);
  // legs
  for(let side of [-1,1]){
    for(let i=0;i<3;i++){
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.42,6), dark);
      leg.position.set(.08*side,-.16,-.1 + i*.18);
      leg.rotation.z = side*.95; leg.rotation.x = .5 - i*.25;
      g.add(leg);
    }
  }
  // antennae
  const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(.006,.012,.23,6), dark); ant1.position.set(.05,.11,-.62); ant1.rotation.x=.9; ant1.rotation.z=.2; g.add(ant1);
  const ant2 = ant1.clone(); ant2.position.x=-.05; ant2.rotation.z=-.2; g.add(ant2);

  g.scale.setScalar(1.35);
  g.userData.wings=[wing1,wing2];
  return g;
}
function buildFlies(){
  FLYS.forEach(meta=>{
    const fly=state.flies[meta.id];
    const mesh=makeFly(meta);
    mesh.position.copy(fly.position);
    world.add(mesh);
    flyMeshes[meta.id]=mesh;
  });
}
function makeWasp(){
  const g = new THREE.Group();
  const yellow=m(0xf0b132,.42,.1), black=m(0x171717,.6,.03), wingMat=new THREE.MeshStandardMaterial({color:0xf4fbff,transparent:true,opacity:.35,roughness:.25});
  const abdomen=new THREE.Mesh(new THREE.SphereGeometry(.35,18,14),yellow); abdomen.scale.set(1,1,1.75); abdomen.position.set(0,0,.35); g.add(abdomen);
  const band=box(.44,.11,.18,black); band.position.set(0,0,.28); g.add(band.clone(), band);
  const thorax=new THREE.Mesh(new THREE.SphereGeometry(.26,18,14),black); thorax.position.set(0,0,-.1); g.add(thorax);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,18,14),black); head.position.set(0,0,-.48); g.add(head);
  const sting=new THREE.Mesh(new THREE.ConeGeometry(.06,.22,9), new THREE.MeshStandardMaterial({color:0xc6b48b})); sting.position.set(0,0,.78); sting.rotation.x=Math.PI; g.add(sting);
  const wing1=new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),wingMat); wing1.scale.set(2.2,.11,1.3); wing1.position.set(.33,.18,.02); wing1.rotation.z=.45; wing1.rotation.y=.35; g.add(wing1);
  const wing2=wing1.clone(); wing2.position.x=-.33; wing2.rotation.z=-.45; wing2.rotation.y=-.35; g.add(wing2);
  const jaw=new THREE.Mesh(new THREE.ConeGeometry(.04,.15,8), new THREE.MeshStandardMaterial({color:0xa46d4d})); jaw.position.set(.05,-.03,-.67); jaw.rotation.x=.9; g.add(jaw);
  const jaw2=jaw.clone(); jaw2.position.x=-.05; g.add(jaw2);
  g.scale.setScalar(1.5);
  g.userData.wings=[wing1,wing2];
  return g;
}
let waspMesh;
function buildWasp(){
  waspMesh = makeWasp();
  waspMesh.position.copy(state.wasp.position);
  world.add(waspMesh);
}

/* -------- Audio -------- */
let audioCtx;
function ensureAudio(){ audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
const FREQ = {C3:130.81,G2:98,C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25};
function tone(freq, t=0, dur=.18, type='sine', gain=.04){
  ensureAudio();
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  o.connect(g); g.connect(audioCtx.destination);
  const now=audioCtx.currentTime+t;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(gain, now+.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
  o.start(now); o.stop(now+dur+.03);
}
function playActionSound(fly, poorFactor=.5){
  if(fly.room!=='practice' && fly.room!=='stage') return;
  const target = TARGET_PATTERN[fly.id];
  const idx = Math.floor(Math.random()*target.length);
  let note = target[idx];
  const quality = clamp(fly.skill/100);
  if(Math.random() > quality) note = choice(Object.keys(FREQ).filter(k=>k!=='G2'&&k!=='C3'));
  if(fly.id==='drums'){
    ensureAudio();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='triangle';
    o.frequency.setValueAtTime(Math.random()<.5?110:180, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(42, audioCtx.currentTime+.09);
    g.gain.setValueAtTime(.07, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime+.12);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+.13);
    return;
  }
  const type = {piano:'triangle', guitar:'sawtooth', bass:'square', violin:'sawtooth'}[fly.id] || 'sine';
  const trans = fly.id==='bass' ? .5 : 1;
  tone(FREQ[note]*trans, 0, .18+.22*quality, type, .03+.03*quality);
}

/* -------- Brain monitor -------- */
const brainNodes = [];
function initBrainNodes(){
  for(const region of regionDefs){
    const cx = rand(.18,.82), cy = rand(.22,.78);
    for(let i=0;i<24;i++){
      const ang = Math.random()*Math.PI*2, rr = Math.random()*.1;
      brainNodes.push({region:region.key, color:region.color, x:cx+Math.cos(ang)*rr, y:cy+Math.sin(ang)*rr, base:Math.random()});
    }
  }
}
initBrainNodes();

function bumpRegions(fly, action){
  const b = state.lastBrainBurst[fly.id] ||= {};
  const add = (k,v)=> b[k] = clamp((b[k]||0)+v, 0, 100);
  if(action==='practice'){ add('motor',35); add('memory',24); add('reward',8); add('focus',25); add('vision',16); }
  if(action==='eat'){ add('reward',40); add('homeostasis',26); add('arousal',10); }
  if(action==='social'){ add('social',32); add('reward',20); add('arousal',16); }
  if(action==='fear'){ add('aversion',44); add('motor',22); add('arousal',30); }
  if(action==='lab'){ add('vision',18); add('memory',10); }
  if(action==='sleep'){ add('homeostasis',24); }
}
function decayBrainBursts(){
  for(const id of Object.keys(state.lastBrainBurst)){
    for(const k of Object.keys(state.lastBrainBurst[id])){
      state.lastBrainBurst[id][k] *= .94;
    }
  }
}
function currentBrainActivity(fly){
  const b = state.lastBrainBurst[fly.id] || {};
  return {
    vision: clamp((b.vision||0) + fly.curiosity*.25 + (state.songMeta?8:0),0,100),
    motor: clamp((b.motor||0) + (fly.currentTask.room==='practice'||fly.currentTask.room==='stage'?25:8),0,100),
    reward: clamp((b.reward||0) + fly.dopamine*.45,0,100),
    aversion: clamp((b.aversion||0) + fly.stressDrive*.55 + fly.fear*.45,0,100),
    memory: clamp((b.memory||0) + fly.reading*.5 + fly.skill*.3,0,100),
    social: clamp((b.social||0) + (fly.room==='chill'?28:8) + (100-fly.social)*.1,0,100),
    homeostasis: clamp((b.homeostasis||0) + fly.hunger*.5 + fly.fatigue*.4,0,100),
    arousal: clamp((b.arousal||0) + fly.octopamine*.48,0,100),
  };
}
function drawBrain(ctx, w, h, fly){
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createRadialGradient(w*.5,h*.5,10,w*.5,h*.5,w*.6);
  grad.addColorStop(0,'rgba(28,44,62,.95)');
  grad.addColorStop(1,'rgba(8,13,20,1)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);

  // silhouette
  ctx.save();
  ctx.translate(w/2,h/2);
  ctx.scale(w*.43,h*.36);
  ctx.fillStyle='rgba(19,29,42,.85)';
  ctx.beginPath();
  ctx.moveTo(-.85,0);
  ctx.bezierCurveTo(-.72,-.65,-.12,-.88,.02,-.64);
  ctx.bezierCurveTo(.18,-.92,.75,-.58,.85,0);
  ctx.bezierCurveTo(.73,.68,.18,.94,.02,.66);
  ctx.bezierCurveTo(-.15,.93,-.72,.62,-.85,0);
  ctx.fill();
  ctx.restore();

  const activity = currentBrainActivity(fly);

  // faint edges
  ctx.strokeStyle='rgba(90,120,150,.09)';
  for(let i=0;i<brainNodes.length-1;i+=2){
    const a=brainNodes[i], b=brainNodes[i+1];
    ctx.beginPath();
    ctx.moveTo(a.x*w,a.y*h);
    ctx.lineTo(b.x*w,b.y*h);
    ctx.stroke();
  }

  for(const n of brainNodes){
    const act = (activity[n.region]||0)/100;
    const r = 1.5 + act*4 + n.base*1.2;
    ctx.fillStyle = n.color;
    ctx.globalAlpha = .12 + act*.85;
    ctx.beginPath();
    ctx.arc(n.x*w,n.y*h,r,0,Math.PI*2);
    ctx.fill();
    if(act>.42){
      ctx.globalAlpha=.08+act*.2;
      ctx.beginPath();
      ctx.arc(n.x*w,n.y*h,r*2.4,0,Math.PI*2);
      ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(255,255,255,.7)';
  ctx.font='11px Inter, sans-serif';
  ctx.fillText('whole-brain proxy wiring plate', 10, 16);
}
function drawBrainMini(){
  const fly = primaryFly();
  drawBrain($('#brainCanvas').getContext('2d'), 260, 170, fly);
}
function drawBrainBig(){
  const id = $('#brainFlySelect').value || primaryFly().id;
  const fly = state.flies[id];
  drawBrain($('#brainBigCanvas').getContext('2d'), 760, 420, fly);
  const act = currentBrainActivity(fly);
  $('#brainRegionList').innerHTML = regionDefs.map(r=>
    `<div class="region-row"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.color};margin-right:8px"></span>${r.name}</span><b>${act[r.key].toFixed(1)}</b></div>`).join('');
  $('#brainChemList').innerHTML = [
    ['Dopamine',fly.dopamine],['Stress Drive',fly.stressDrive],['Octopamine',fly.octopamine],['Fear',fly.fear],['Focus',fly.focus]
  ].map(([n,v])=>`<div class="region-row"><span>${n}</span><b>${v.toFixed(1)}</b></div>`).join('');
}
$('#expandBrainBtn').onclick=()=>{ $('#brainDialog').showModal(); drawBrainBig(); };
$('#closeBrainDialog').onclick=()=>$('#brainDialog').close();
$('#brainFlySelect').onchange=drawBrainBig;

/* -------- Behavior / pathing -------- */
function assignTask(fly, type, room, minutes){
  const duration = minutes==='auto' ? rand(5,10) : parseFloat(minutes || rand(5,10));
  fly.currentTask = {type, room, timeLeft:duration};
  fly.targetRoom = room;
  fly.pathTarget = roomCenter(room).add(new THREE.Vector3(rand(-1.7,1.7), 1.4+Math.random()*.6, rand(-1.5,1.5)));
  log(`${fly.name} sent to ${ROOM_NAMES[room]} for ${duration.toFixed(1)}m.`);
}
function focusRoom(room){
  state.viewRoom = room;
  const c=roomCenter(room);
  controls.target.lerp(new THREE.Vector3(c.x,1.7,c.z),1);
  camera.position.set(c.x+7, 8.2, c.z+8);
  renderSelected();
}
function resetCamera(){
  const c=roomCenter(state.viewRoom);
  controls.target.copy(new THREE.Vector3(c.x,1.5,c.z));
  camera.position.set(c.x+7, 8.2, c.z+8);
}
function flyAutonomy(fly){
  // choose room based on needs if task expired
  if(fly.currentTask.timeLeft > 0) return;
  let next = 'practice';
  if(fly.hunger>58) next='dining';
  else if(fly.energy<30 || fly.fatigue>62) next='dark';
  else if(fly.social>65) next='chill';
  else if(fly.stressDrive>55) next='chill';
  else if(Math.random()<.16) next='lab';
  else if(Math.random()<.28) next='stage';
  assignTask(fly, 'autonomous', next, 'auto');
}
function updateNeeds(fly, dtMin){
  fly.hunger = clamp(fly.hunger + .33*dtMin);
  fly.energy = clamp(fly.energy - .22*dtMin);
  fly.fatigue = clamp(fly.fatigue + .21*dtMin);
  fly.social = clamp(fly.social + .18*dtMin);
  fly.curiosity = clamp(fly.curiosity + .12*dtMin);
  fly.focus = clamp(fly.focus - .10*dtMin);
  fly.mood = clamp(fly.mood - .06*dtMin + (fly.dopamine-50)*.002);
  fly.dopamine = clamp(fly.dopamine - .25*dtMin);
  fly.stressDrive = clamp(fly.stressDrive + (fly.room==='dark'? .26: -.08)*dtMin);
  fly.fear = clamp(fly.fear + (fly.room==='dark' && state.wasp.active ? .7 : -.18)*dtMin);
  fly.octopamine = clamp(fly.octopamine + (fly.currentTask.room==='stage' ? .08 : -.05)*dtMin);
  fly.currentTask.timeLeft = Math.max(0, fly.currentTask.timeLeft - dtMin);
}
function satisfyRoom(fly, dtMin){
  if(fly.room==='dining'){
    fly.hunger=clamp(fly.hunger - .85*dtMin); fly.dopamine=clamp(fly.dopamine + .3*dtMin); bumpRegions(fly,'eat');
  }
  if(fly.room==='chill'){
    fly.social=clamp(fly.social - .8*dtMin); fly.stressDrive=clamp(fly.stressDrive - .35*dtMin); fly.mood=clamp(fly.mood + .24*dtMin); bumpRegions(fly,'social');
  }
  if(fly.room==='dark' && !state.wasp.active){
    fly.energy=clamp(fly.energy + .4*dtMin); fly.fatigue=clamp(fly.fatigue - .5*dtMin); bumpRegions(fly,'sleep');
  }
  if(fly.room==='lab'){ fly.curiosity=clamp(fly.curiosity - .45*dtMin); fly.reading=clamp(fly.reading + .04*dtMin); bumpRegions(fly,'lab'); }
  if(fly.room==='practice'){ practiceLearning(fly, dtMin); }
  if(fly.room==='stage'){ stageLearning(fly, dtMin); }
}
function practiceLearning(fly, dtMin){
  const q = fly.q;
  const step = Math.floor((state.minutes*2)%4);
  const tgt = targetForFly(fly, step);
  let acts = q[step] ||= {};
  let note = choice(Object.keys(FREQ).concat(['K','S','H']));
  if(Math.random() < Math.max(.12, fly.skill/100)) note = tgt;
  const reward = note===tgt ? 1 : -.16;
  acts[note] = (acts[note]||0) + .12*(reward-(acts[note]||0));
  fly.skill = clamp(fly.skill + (.04 + Math.max(0,reward)*.08)*dtMin);
  fly.timing = clamp(fly.timing + (.03 + Math.max(0,reward)*.06)*dtMin);
  fly.control = clamp(fly.control + (.03 + Math.max(0,reward)*.05)*dtMin);
  fly.bandSkill = clamp(fly.bandSkill + .01*dtMin);
  fly.reading = clamp(fly.reading + .01*dtMin);
  fly.focus = clamp(fly.focus + .18*dtMin);
  fly.dopamine = clamp(fly.dopamine + (reward>0?.25:-.04)*dtMin);
  bumpRegions(fly,'practice');
  if(Math.random()<.18*dtMin) playActionSound(fly);
}
function stageLearning(fly, dtMin){
  fly.bandSkill = clamp(fly.bandSkill + .04*dtMin);
  fly.focus = clamp(fly.focus + .14*dtMin);
  fly.octopamine = clamp(fly.octopamine + .18*dtMin);
  bumpRegions(fly,'practice');
  if(Math.random()<.16*dtMin) playActionSound(fly, .4);
}
function targetForFly(fly, step){
  const score = fly.manualScore;
  const col = step % 16;
  for(let r=0;r<score.length;r++) if(score[r][col]) return NOTES[r];
  if(state.songMeta && fly.id!=='drums'){
    const pool = ['C4','D4','E4','F4','G4','A4','B4','C5'];
    return pool[(col + Math.floor(state.songMeta.tempo/20)) % pool.length];
  }
  return TARGET_PATTERN[fly.id][step % TARGET_PATTERN[fly.id].length];
}
function moveFly(fly, dt){
  if(!fly.pathTarget) return;
  const dir = fly.pathTarget.clone().sub(fly.position);
  const dist = dir.length();
  if(dist < .24){
    fly.position.copy(fly.pathTarget);
    fly.room = fly.targetRoom;
    fly.pathTarget = null;
    return;
  }
  dir.normalize();
  const desired = dir.multiplyScalar(2.4 + fly.octopamine/55);
  fly.velocity.lerp(desired, .06);
  fly.position.add(fly.velocity.clone().multiplyScalar(dt));
}
function updateWasp(dt, dtMin){
  const w=state.wasp;
  if(!w.active){
    w.mode='idle';
    // passive ambient wasp in dark room
    const darkCenter = roomCenter('dark').add(new THREE.Vector3(Math.sin(performance.now()*.0016)*2.2, 1.8 + Math.sin(performance.now()*.0025)*.35, Math.cos(performance.now()*.0012)*2.0));
    steerToward(w, darkCenter, 1.6, dt);
    return;
  }
  const darkFly = FLYS.map(meta=>state.flies[meta.id]).filter(f=>f.room==='dark');
  if(!darkFly.length){
    w.targetFly = null;
    w.mode='prowl';
    const roam = roomCenter('dark').add(new THREE.Vector3(Math.sin(performance.now()*.0014)*2.7,1.8+Math.sin(performance.now()*.0019)*.3,Math.cos(performance.now()*.0011)*2.4));
    steerToward(w, roam, 1.9, dt);
    return;
  }
  let nearest = darkFly.sort((a,b)=>a.position.distanceTo(w.position)-b.position.distanceTo(w.position))[0];
  w.targetFly = nearest.id;
  w.mode='chase';
  const target = nearest.position.clone().add(new THREE.Vector3(0,.12,0));
  steerToward(w, target, 3.7, dt);
  nearest.fear = clamp(nearest.fear + .45*dtMin);
  nearest.stressDrive = clamp(nearest.stressDrive + .35*dtMin);
  nearest.dopamine = clamp(nearest.dopamine - .22*dtMin);
  bumpRegions(nearest,'fear');
  // target tries to run within dark room
  nearest.pathTarget = roomCenter('dark').add(new THREE.Vector3(rand(-2.1,2.1), 1.6+Math.random()*.3, rand(-2.0,2.0)));
}
function steerToward(agent, target, speed, dt){
  const dir = target.clone().sub(agent.position);
  if(dir.length()<.06) return;
  dir.normalize();
  const desired = dir.multiplyScalar(speed);
  agent.velocity.lerp(desired, .08);
  agent.position.add(agent.velocity.clone().multiplyScalar(dt));
}

/* -------- Swatters / actions -------- */
function spawnSwatterAt(fly){
  const mesh = box(.24,2.3,.65,m(0x4b3226,.75,.05));
  const paddle = box(1.0,.18,1.2,m(0x7e9ab3,.5,.12));
  paddle.position.set(0,1.0,0); mesh.add(paddle);
  mesh.position.copy(fly.position).add(new THREE.Vector3(0,4,0));
  world.add(mesh);
  swats.push({mesh, flyId:fly.id, life:0, phase:0});
}
function updateSwats(dt){
  swats = swats.filter(s=>{
    s.life += dt;
    const fly = state.flies[s.flyId];
    if(!fly || !flyMeshes[s.flyId]) return false;
    const target = fly.position.clone().add(new THREE.Vector3(0,.25,0));
    if(s.phase===0){
      s.mesh.position.lerp(target.clone().add(new THREE.Vector3(0,1.4,0)), .25);
      if(s.life>.15) s.phase=1;
    }else if(s.phase===1){
      s.mesh.position.lerp(target, .36);
      if(s.life>.32){
        fly.stressDrive = clamp(fly.stressDrive + 6);
        fly.fear = clamp(fly.fear + 9);
        fly.mood = clamp(fly.mood - 3);
        bumpRegions(fly,'fear');
        s.phase=2;
      }
    }else{
      s.mesh.position.y += 5*dt;
      s.mesh.rotation.z += 7*dt;
      if(s.life>.85){ world.remove(s.mesh); return false; }
    }
    return true;
  });
}

/* -------- Input actions -------- */
$('#selectAllBtn').onclick=()=>{ state.selected = FLYS.map(f=>f.id); renderFlyList(); renderSelected(); };
$('#clearSelBtn').onclick=()=>{ state.selected=[primaryFly().id]; renderFlyList(); renderSelected(); };
$('#sendBtn').onclick=()=>{
  const room = $('#sendRoom').value, dur = $('#sendDuration').value;
  selectedFlies().forEach(f=>assignTask(f,'manual',room,dur));
  say(`Sent ${selectedFlies().map(f=>f.name).join(', ')} to ${ROOM_NAMES[room]}.`);
  renderTasks(); renderSelected();
};
$('#cancelTaskBtn').onclick=()=>{ selectedFlies().forEach(f=>f.currentTask.timeLeft=0); say('Manual task cancelled. They go back to instincts.'); };
$('#giveBtn').onclick=()=>{
  const food = FOODS[$('#foodSelect').value];
  const label = $('#foodSelect').selectedOptions[0].textContent;
  selectedFlies().forEach(f=>{
    f.dopamine=clamp(f.dopamine + food.reward*20);
    f.hunger=clamp(f.hunger + (food.hunger || 0));
    f.mood=clamp(f.mood + (food.mood || 0));
    f.stressDrive=clamp(f.stressDrive + (food.stress || 0));
    bumpRegions(f,'eat');
    log(`${f.name} received ${label}.`);
  });
  say(`Fed ${selectedFlies().length} fly/fies with ${label}.`);
  renderSelected();
};
$('#swatBtn').onclick=()=>{
  selectedFlies().forEach(f=>spawnSwatterAt(f));
  say(`Swatter deployed on selected flies.`);
};
$('#waspBtn').onclick=()=>{
  state.wasp.active=true;
  say(`Wasp released in the dark room.`);
  log(`Dark-room wasp is now active.`);
};
$('#closeDoorBtn').onclick=()=>setDoor(primaryFly().room, false);
$('#openDoorBtn').onclick=()=>setDoor(primaryFly().room, true);
function setDoor(room, isOpen){
  state.doorStates[room]=isOpen;
  const d = doorMeshes[room];
  if(d) d.userData.open = isOpen;
  say(`${ROOM_NAMES[room]} door ${isOpen?'opened':'closed'}.`);
  renderRooms();
}
$('#pauseBtn').onclick=()=>state.paused=!state.paused;
$('#speedBtn').onclick=()=>{ state.speed = state.speed===1?4:state.speed===4?10:1; speedBtn.textContent=`${state.speed}×`; };
$('#resetCamBtn').onclick=resetCamera;
$('#saveBtn').onclick=()=>saveLocal();
$('#exportBtn').onclick=()=>exportSave();
$('#importInput').onchange=importSave;

function saveLocal(){ localStorage.setItem('flyband_v2beta', JSON.stringify(serializeState())); say('Saved locally.'); log('Local save written.'); }
function serializeState(){
  return {
    day:state.day, minutes:state.minutes, speed:state.speed, paused:state.paused, viewRoom:state.viewRoom,
    selected:state.selected, doorStates:state.doorStates, songMeta:state.songMeta, log:state.log,
    flies: Object.fromEntries(FLYS.map(meta=>[meta.id,{
      ...state.flies[meta.id],
      position: state.flies[meta.id].position.toArray(),
      velocity: state.flies[meta.id].velocity.toArray(),
      pathTarget: state.flies[meta.id].pathTarget ? state.flies[meta.id].pathTarget.toArray() : null
    }]))
  };
}
function reviveState(data){
  if(!data) return;
  ['day','minutes','speed','paused','viewRoom','selected','doorStates','songMeta','log'].forEach(k=>{ if(data[k]!==undefined) state[k]=data[k]; });
  for(const meta of FLYS){
    const src=data.flies?.[meta.id]; if(!src) continue;
    state.flies[meta.id] = {...state.flies[meta.id], ...src};
    state.flies[meta.id].position = new THREE.Vector3(...src.position);
    state.flies[meta.id].velocity = new THREE.Vector3(...src.velocity);
    state.flies[meta.id].pathTarget = src.pathTarget ? new THREE.Vector3(...src.pathTarget) : null;
  }
}
(function bootSaved(){ try{ const raw=localStorage.getItem('flyband_v2beta'); if(raw) reviveState(JSON.parse(raw)); }catch{} })();
function exportSave(){
  const blob = new Blob([JSON.stringify(serializeState(), null, 2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='flyband-v2beta-save.json'; a.click();
}
async function importSave(e){
  const file=e.target.files?.[0]; if(!file) return;
  try{ reviveState(JSON.parse(await file.text())); say('Save imported.'); log('Imported external save.'); renderAll(); }
  catch(err){ alert('Import failed: '+err.message); }
  e.target.value='';
}

/* -------- Audio file parsing -------- */
$('#audioInput').onchange = async (e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  const arr = await file.arrayBuffer();
  ensureAudio();
  const buf = await audioCtx.decodeAudioData(arr.slice(0));
  const samples = buf.getChannelData(0);
  let energy=0;
  for(let i=0;i<samples.length;i+=2048){ energy += Math.abs(samples[i]); }
  energy /= (samples.length/2048);
  // crude tempo estimate via peak intervals
  let peaks=[];
  for(let i=1024;i<samples.length-1024;i+=1024){
    let v=Math.abs(samples[i]);
    if(v>.25) peaks.push(i/buf.sampleRate);
  }
  let intervals={};
  for(let i=1;i<Math.min(peaks.length,200);i++){
    const dt=peaks[i]-peaks[i-1];
    if(dt>.2 && dt<1.2){
      const bpm = 60/dt;
      const rounded = Math.round(bpm);
      intervals[rounded] = (intervals[rounded]||0)+1;
    }
  }
  let tempo = 108;
  if(Object.keys(intervals).length){
    tempo = +Object.entries(intervals).sort((a,b)=>b[1]-a[1])[0][0];
    while(tempo<70) tempo*=2;
    while(tempo>180) tempo/=2;
  }
  state.songMeta = {name:file.name, duration:buf.duration, tempo, energy:energy*100};
  say(`Loaded ${file.name}. Training stimuli updated.`);
  renderSongCard();
  log(`Loaded song ${file.name}.`);
};

/* -------- Render/update loop -------- */
function renderAll(){ renderRooms(); renderFlyList(); renderSelected(); renderTasks(); renderLog(); renderSongCard(); syncBrainSelects(); drawBrainMini(); }
buildWorld();
focusRoom(state.viewRoom); resetCamera(); renderAll();

window.addEventListener('resize', onResize);
function onResize(){
  const rect = canvas.getBoundingClientRect();
  camera.aspect = rect.width/rect.height; camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}
onResize();

function updateDoors(dt){
  for(const [room, door] of Object.entries(doorMeshes)){
    const open = state.doorStates[room];
    if(door.userData.axis.startsWith('x')){
      const target = open ? Math.PI/2*.72 : 0;
      door.rotation.y += (target-door.rotation.y)*.12;
    }else{
      const target = open ? Math.PI/2*.72 : 0;
      door.rotation.y += (target-door.rotation.y)*.12;
    }
  }
}
function updateMeshes(time){
  for(const meta of FLYS){
    const fly=state.flies[meta.id], mesh=flyMeshes[meta.id];
    if(!mesh) continue;
    mesh.position.copy(fly.position);
    const forward = fly.velocity.length()>0.01 ? fly.velocity.clone().normalize() : new THREE.Vector3(0,0,1);
    mesh.rotation.y = Math.atan2(forward.x, forward.z); // fixed so they face the direction they're moving
    const wingSpeed = 16 + fly.octopamine*.18 + (fly.fear*.25);
    const amp = .4 + fly.octopamine*.004;
    mesh.userData.wings[0].rotation.y = Math.sin(time*.03*wingSpeed)*amp + .35;
    mesh.userData.wings[1].rotation.y = -Math.sin(time*.03*wingSpeed)*amp - .35;
    mesh.position.y += Math.sin(time*.006 + meta.id.length)*.005;
  }
  if(waspMesh){
    waspMesh.position.copy(state.wasp.position);
    const fwd = state.wasp.velocity.length()>0.01 ? state.wasp.velocity.clone().normalize() : new THREE.Vector3(0,0,1);
    waspMesh.rotation.y = Math.atan2(fwd.x, fwd.z);
    waspMesh.userData.wings[0].rotation.y = Math.sin(time*.06)*.65 + .4;
    waspMesh.userData.wings[1].rotation.y = -Math.sin(time*.06)*.65 - .4;
  }
}
let last = performance.now();
function animate(now){
  const dt = Math.min(.033, (now-last)/1000); last=now;
  if(!state.paused){
    const dtMin = dt * state.speed * 1.2;
    state.minutes += dtMin;
    if(state.minutes>=1440){ state.minutes-=1440; state.day++; }
    FLYS.forEach(meta=>{
      const fly=state.flies[meta.id];
      updateNeeds(fly, dtMin);
      satisfyRoom(fly, dtMin);
      flyAutonomy(fly);
      moveFly(fly, dt*state.speed);
    });
    decayBrainBursts();
    updateWasp(dt*state.speed, dtMin);
    updateSwats(dt*state.speed);
    updateDoors(dt);
  }
  updateMeshes(now);
  controls.update();
  renderer.render(scene, camera);
  if(Math.random()<.08){ renderSelected(); renderTasks(); drawBrainMini(); if($('#brainDialog').open) drawBrainBig(); }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

setInterval(()=>{ saveLocal(); }, 15000);

// initial brain draw
drawBrainMini();

