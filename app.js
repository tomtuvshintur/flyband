import * as THREE from 'three';

const COLORS = {
  practice: 0x26313e,
  stage: 0x1d2028,
  dining: 0x2d3024,
  chill: 0x1c2b25,
  lab: 0x15232b,
  box: 0x08090b
};

const ROOMS = {
  practice: 'Practice Room',
  stage: 'Stage',
  dining: 'Dining Room',
  chill: 'Chill Garden',
  lab: 'Neural Lab',
  box: 'The Box™'
};

const INSTRUMENTS = [
  { id:'piano', name:'Piano', color:'#7ee0ff' },
  { id:'guitar', name:'Electric Guitar', color:'#ff7f8e' },
  { id:'bass', name:'Bass Guitar', color:'#c49cff' },
  { id:'drums', name:'Drums', color:'#ffbd6f' },
  { id:'violin', name:'Violin', color:'#9df18b' },
];

function baseFly(inst, index){
  return {
    id: inst.id,
    name: ['Mozz','Riff','Thump','Bonk','Vee'][index],
    role: inst.name,
    color: inst.color,
    skill: 3 + Math.random()*3,
    timing: 5 + Math.random()*5,
    control: 4 + Math.random()*4,
    improv: 2 + Math.random()*4,
    band: 1,
    energy: 82 + Math.random()*8,
    hunger: 18 + Math.random()*10,
    stress: 6 + Math.random()*5,
    mood: 70,
    practiceMinutes: 0,
    performances: 0,
    rewards: 0,
    punishments: 0,
    q: {},
    lastAction: 'spawned',
    room: 'practice'
  };
}

const defaultState = {
  version: 1,
  day: 1,
  minutes: 12*60,
  speed: 1,
  paused: false,
  room: 'practice',
  selectedFly: 'piano',
  brainPack: null,
  flies: Object.fromEntries(INSTRUMENTS.map((i,n)=>[i.id,baseFly(i,n)])),
  log: [{t: Date.now(), msg:'FlyBand Lab initialized.'}]
};

let state = loadLocal() || defaultState;
normalizeState();

const $ = s => document.querySelector(s);
const flyList = $('#flyList');
const flyCard = $('#flyCard');
const progressPanel = $('#progressPanel');
const logEl = $('#log');
const bandPanel = $('#bandPanel');
const roomTitle = $('#roomTitle');
const message = $('#message');
const brainModeBadge = $('#brainModeBadge');

function normalizeState(){
  if(!state.flies) state.flies = defaultState.flies;
  for(const inst of INSTRUMENTS){
    if(!state.flies[inst.id]) state.flies[inst.id]=baseFly(inst, INSTRUMENTS.indexOf(inst));
  }
  state.log ||= [];
  state.room ||= 'practice';
  state.selectedFly ||= 'piano';
}

function clamp(v,min=0,max=100){ return Math.max(min,Math.min(max,v)); }
function round(v){ return Math.round(v); }
function selected(){ return state.flies[state.selectedFly]; }

function addLog(msg){
  state.log.unshift({t:Date.now(),msg});
  state.log = state.log.slice(0,80);
  renderLog();
}

function setMessage(msg){
  message.textContent = msg;
  clearTimeout(setMessage.timer);
  setMessage.timer = setTimeout(()=>message.textContent='The flies are pretending this is a serious laboratory.',5200);
}

function statRow(name, value){
  return `<div class="statline"><span>${name}</span><div class="bar"><i style="width:${clamp(value)}%"></i></div><b>${round(value)}</b></div>`;
}

function renderFlyList(){
  flyList.innerHTML = '';
  INSTRUMENTS.forEach(inst=>{
    const f=state.flies[inst.id];
    const b=document.createElement('button');
    b.className = inst.id===state.selectedFly?'active':'';
    b.style.setProperty('--fly',inst.color);
    b.innerHTML=`<span><span class="fly-name">${f.name}</span><br><span class="fly-role">${f.role}</span></span><span>${round(f.skill)}%</span>`;
    b.onclick=()=>{ state.selectedFly=inst.id; renderAll(); focusFly(inst.id); };
    flyList.appendChild(b);
  });
}

function renderFlyCard(){
  const f=selected();
  flyCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><b style="font-size:16px;color:${f.color}">${f.name}</b><div class="fly-role">${f.role}</div></div>
      <span class="badge">${moodLabel(f)}</span>
    </div>
    ${statRow('Energy',f.energy)}
    ${statRow('Hunger',100-f.hunger)}
    ${statRow('Mood',f.mood)}
    ${statRow('Stress',100-f.stress)}
    <div class="tiny">Last: ${f.lastAction}</div>`;
}

function renderProgress(){
  const f=selected();
  const items=[['Instrument skill',f.skill],['Timing',f.timing],['Control',f.control],['Improvisation',f.improv],['Band awareness',f.band]];
  progressPanel.innerHTML = items.map(([n,v])=>`
    <div class="progress-row">
      <div class="progress-head"><span>${n}</span><b>${v.toFixed(1)}%</b></div>
      <div class="bar"><i style="width:${clamp(v)}%"></i></div>
    </div>`).join('')+
    `<div class="tiny" style="margin-top:12px">Practice: ${Math.floor(f.practiceMinutes/60)}h ${round(f.practiceMinutes%60)}m · Performances: ${f.performances} · Rewards: ${f.rewards} · Punishments: ${f.punishments}</div>`;
}

function renderBand(){
  bandPanel.innerHTML = INSTRUMENTS.map(i=>{
    const f=state.flies[i.id];
    return `<div class="band-card"><span><b style="color:${f.color}">${f.name}</b> · ${f.role}</span><span>${round(f.skill)}%</span></div>`;
  }).join('');
}

function renderLog(){
  logEl.innerHTML = state.log.slice(0,28).map(x=>{
    const d=new Date(x.t);
    return `<div class="log-row"><span style="color:#657483">${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span> ${escapeHtml(x.msg)}</div>`;
  }).join('');
}

function renderClock(){
  const h=Math.floor(state.minutes/60)%24;
  const m=Math.floor(state.minutes%60);
  $('#clock').textContent=`DAY ${state.day} · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  $('#simStatus').textContent=state.paused?'PAUSED':'SIM RUNNING';
}

function moodLabel(f){
  if(f.stress>75) return 'PANICKED';
  if(f.hunger>80) return 'STARVING';
  if(f.energy<20) return 'EXHAUSTED';
  if(f.mood>80) return 'THRIVING';
  if(f.mood<35) return 'MISERABLE';
  return 'OKAY';
}

function renderAll(){
  roomTitle.textContent=ROOMS[state.room];
  document.querySelectorAll('[data-room]').forEach(b=>b.classList.toggle('active',b.dataset.room===state.room));
  renderFlyList(); renderFlyCard(); renderProgress(); renderBand(); renderLog(); renderClock();
  brainModeBadge.textContent=state.brainPack?'CONNECTOME PACK':'LOCAL LEARNER';
  brainModeBadge.style.color=state.brainPack?'#b8f7cf':'#9cc8dd';
}

function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

/* -------------------- AUDIO -------------------- */
let audioCtx;
function ensureAudio(){
  audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
}
const NOTE_FREQ = {C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25};
const NOTE_NAMES = Object.keys(NOTE_FREQ);

function playTone(freq, t=0, dur=.22, type='sine', gain=.07){
  ensureAudio();
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq; g.gain.value=0.0001;
  o.connect(g); g.connect(audioCtx.destination);
  const now=audioCtx.currentTime+t;
  g.gain.exponentialRampToValueAtTime(gain,now+.01);
  g.gain.exponentialRampToValueAtTime(.0001,now+dur);
  o.start(now); o.stop(now+dur+.03);
}
function playInstrument(inst,note,t=0,dur=.22,vel=.8){
  const f=NOTE_FREQ[note]||440;
  if(inst==='drums'){
    ensureAudio();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='triangle'; o.frequency.setValueAtTime(110,audioCtx.currentTime+t);
    o.frequency.exponentialRampToValueAtTime(42,audioCtx.currentTime+t+.08);
    g.gain.setValueAtTime(.08*vel,audioCtx.currentTime+t);
    g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+t+.12);
    o.connect(g); g.connect(audioCtx.destination); o.start(audioCtx.currentTime+t); o.stop(audioCtx.currentTime+t+.14); return;
  }
  const types={piano:'triangle',guitar:'sawtooth',bass:'square',violin:'sawtooth'};
  const trans={bass:.5,violin:2};
  playTone(f*(trans[inst]||1),t,dur,types[inst]||'sine',.045*vel);
}

/* -------------------- LEARNING -------------------- */
const TARGETS = {
  piano:['C4','E4','G4','C5'],
  guitar:['E4','G4','A4','E4'],
  bass:['C4','C4','G4','G4'],
  drums:['C4','C4','C4','C4'],
  violin:['G4','A4','B4','C5']
};

function chooseAction(f, step){
  const key=String(step%4);
  f.q[key] ||= Object.fromEntries(NOTE_NAMES.map(n=>[n,0]));
  const epsilon=Math.max(.12,.75-(f.skill/100)*.6);
  if(Math.random()<epsilon) return NOTE_NAMES[Math.floor(Math.random()*NOTE_NAMES.length)];
  return Object.entries(f.q[key]).sort((a,b)=>b[1]-a[1])[0][0];
}

function trainTick(f, rewardMultiplier=1){
  if(f.energy<8 || f.hunger>94) return {reward:-.2,note:null};
  const step=Math.floor(f.practiceMinutes/2)%4;
  const action=chooseAction(f,step);
  const target=TARGETS[f.id][step];
  let reward = action===target ? 1 : -.12;
  if(f.id==='drums') reward = Math.random() < (0.22+f.timing/150) ? .6 : -.08;
  reward*=rewardMultiplier;

  const key=String(step); const old=f.q[key][action]||0;
  f.q[key][action]=old + .18*(reward-old);

  f.practiceMinutes+=2;
  f.energy=clamp(f.energy-.35);
  f.hunger=clamp(f.hunger+.22);
  f.stress=clamp(f.stress+.03);
  const positive=Math.max(0,reward);
  f.skill=clamp(f.skill+.04+.08*positive);
  f.control=clamp(f.control+.03+.05*positive);
  f.timing=clamp(f.timing+.025+.06*positive);
  if(Math.random()<.05) f.improv=clamp(f.improv+.03);
  f.lastAction='practicing';
  return {reward,note:action,target};
}

function practiceBurst(f, seconds=7){
  state.room='practice'; buildRoom('practice');
  addLog(`${f.name} started ${f.role.toLowerCase()} practice.`);
  setMessage(`${f.name} is practicing. Nobody has told it the exact notes; it is exploring and receiving internal feedback.`);
  const iterations=18;
  let i=0, total=0;
  const iv=setInterval(()=>{
    const r=trainTick(f, 1);
    if(r.note) playInstrument(f.id,r.note,0,.15,.55);
    total+=r.reward;
    animateFlyAction(f.id,'practice');
    renderAll();
    if(++i>=iterations){
      clearInterval(iv);
      f.mood=clamp(f.mood+(total>4?2:.3));
      addLog(`${f.name} finished practice · reward signal ${total.toFixed(2)}.`);
      autoSave();
    }
  },Math.max(120,(seconds*1000)/iterations));
}

function stagePerformance(all=false){
  state.room='stage'; buildRoom('stage');
  const performers=all?INSTRUMENTS.map(x=>state.flies[x.id]):[selected()];
  performers.forEach(f=>{f.performances++; f.energy=clamp(f.energy-3); f.hunger=clamp(f.hunger+1.2); f.lastAction='performing';});
  addLog(`${all?'The band':performers[0].name} took the stage.`);
  setMessage('Performance started. Judge them afterward with Big Reward, Dark Room, or Wasp.');
  const steps=12, beat=.32;
  performers.forEach((f,pi)=>{
    for(let i=0;i<steps;i++){
      const accuracy=clamp(f.skill/100,.08,.94);
      const target=TARGETS[f.id][i%4];
      const note=Math.random()<accuracy?target:NOTE_NAMES[Math.floor(Math.random()*NOTE_NAMES.length)];
      playInstrument(f.id,note,i*beat + pi*.012,.18,.62);
    }
    animateFlyAction(f.id,'perform');
  });
  renderAll(); autoSave();
}

function rewardFly(f, amount, source){
  f.rewards++;
  f.mood=clamp(f.mood+amount*7);
  f.stress=clamp(f.stress-amount*5);
  f.energy=clamp(f.energy+amount*2);
  reinforceRecent(f, amount*.25);
  f.lastAction=source;
  addLog(`${f.name} received ${source} (+${amount.toFixed(1)} reward).`);
  setMessage(`${f.name}: enormous positive signal. Tiny idiot is delighted.`);
  animateFlyAction(f.id,'reward');
  renderAll(); autoSave();
}

function punishFly(f, amount, source){
  f.punishments++;
  f.mood=clamp(f.mood-amount*6);
  f.stress=clamp(f.stress+amount*9);
  f.energy=clamp(f.energy-amount*2);
  reinforceRecent(f, -amount*.12);
  f.lastAction=source;
  addLog(`${f.name} experienced ${source} (-${amount.toFixed(1)} reward).`);
  setMessage(source==='wasp chase'?'A gigantic wasp has entered the chat.':'The Box™ provides several opportunities for quiet reflection.');
  animateFlyAction(f.id,'punish');
  renderAll(); autoSave();
}

function reinforceRecent(f, delta){
  for(const row of Object.values(f.q)){
    for(const k of Object.keys(row)) row[k]+=Math.sign(row[k]||1)*delta*.01;
  }
}

/* -------------------- THREE.JS WORLD -------------------- */
const canvas=$('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080b10);
scene.fog=new THREE.Fog(0x080b10,16,38);
const camera=new THREE.PerspectiveCamera(46,1,.1,100);
camera.position.set(10,8,12);
camera.lookAt(0,1.4,0);

const hemi=new THREE.HemisphereLight(0x9bb5c9,0x17120f,1.6);
scene.add(hemi);
const key=new THREE.DirectionalLight(0xffffff,2.1);
key.position.set(7,10,5);key.castShadow=true;scene.add(key);
const rim=new THREE.PointLight(0x72f3c1,14,18,2);
rim.position.set(-5,4,-3);scene.add(rim);

let world=new THREE.Group();scene.add(world);
const flyMeshes={};
const activeAnimations=new Map();
let wasp;

function clearWorld(){
  scene.remove(world);
  world.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material && !Array.isArray(o.material))o.material.dispose(); });
  world=new THREE.Group(); scene.add(world);
  Object.keys(flyMeshes).forEach(k=>delete flyMeshes[k]);
}

function mat(color,rough=.72,metal=.08){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});}
function mesh(g,m,x=0,y=0,z=0){
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;return o;
}

function floorAndWalls(color){
  const floor=mesh(new THREE.BoxGeometry(18,.35,12),mat(color),0,-.25,0);world.add(floor);
  const back=mesh(new THREE.BoxGeometry(18,6,.28),mat(0x0e151c),0,2.75,-6);world.add(back);
  const side=mesh(new THREE.BoxGeometry(.28,6,12),mat(0x0c1117),-9,2.75,0);world.add(side);
  for(let i=-7;i<=7;i+=2){
    const strip=mesh(new THREE.BoxGeometry(.025,4.7,.04),mat(0x24303c,1,0),i,2.7,-5.83);world.add(strip);
  }
}

function addPracticeProps(){
  // piano
  const piano=new THREE.Group();
  piano.add(mesh(new THREE.BoxGeometry(3,.8,1.2),mat(0x11151b,.35,.2),-4,.55,-1));
  for(let i=0;i<10;i++) piano.add(mesh(new THREE.BoxGeometry(.24,.08,.55),mat(i%2?0xe4e6e8:0xcdd1d5,.45,0),-5.05+i*.24,1.02,-.72));
  world.add(piano);
  // amps
  world.add(mesh(new THREE.BoxGeometry(1.7,2,1),mat(0x121212),3,1,2));
  world.add(mesh(new THREE.BoxGeometry(1.4,1.6,.8),mat(0x141414),5.1,.8,2.1));
  // drums
  for(const [x,z,s] of [[2,-2,1.1],[3.1,-2.2,.8],[2.6,-1.1,.7]]) world.add(mesh(new THREE.CylinderGeometry(s,s,.8,24),mat(0x4a2c22),x,.55,z));
  // violin stand
  world.add(mesh(new THREE.BoxGeometry(.08,2,.08),mat(0x22272d),6,1, -2.6));
  world.add(mesh(new THREE.BoxGeometry(1.4,.05,.6),mat(0x282f36),6,2,-2.6));
}

function addStageProps(){
  world.add(mesh(new THREE.BoxGeometry(10,.7,5),mat(0x15181c),0,.15,-.6));
  for(const x of [-4.2,-2.1,0,2.1,4.2]){
    const spot=new THREE.SpotLight([0x78d5ff,0xff7f91,0xbd91ff,0xffbe72,0x8df18d][Math.round((x+4.2)/2.1)],14,15,.45,.4);
    spot.position.set(x,5,3.7);spot.target.position.set(x,0,-.6);scene.add(spot);scene.add(spot.target);
  }
  const sign=mesh(new THREE.BoxGeometry(5,.9,.18),mat(0x18232b,.3,.3),0,4,-5.72);world.add(sign);
}

function addDiningProps(){
  world.add(mesh(new THREE.BoxGeometry(5,.35,2.2),mat(0x332b23),0,.7,0));
  for(const x of [-1.5,0,1.5]) world.add(mesh(new THREE.SphereGeometry(.34,20,16),mat([0xf26c5e,0xf4cf61,0x92d36e][x+1.5]),x,1.2,0));
  for(const x of [-3,3]) world.add(mesh(new THREE.BoxGeometry(1,.7,1),mat(0x20272d),x,.35,.4));
}

function addChillProps(){
  for(const [x,z,s] of [[-5,-1,1.5],[4,-2,1.7],[0,3,1.2]]){
    world.add(mesh(new THREE.CylinderGeometry(.25,.35,2.8,12),mat(0x463326),x,1.2,z));
    world.add(mesh(new THREE.SphereGeometry(s,20,16),mat(0x2d5d43),x,3,z));
  }
  for(const [x,z] of [[-2,-2],[2,1],[-4,3]]) world.add(mesh(new THREE.SphereGeometry(.24,16,12),mat(0xe36b5e),x,.3,z));
}

function addLabProps(){
  for(let i=0;i<4;i++){
    const desk=mesh(new THREE.BoxGeometry(3,.15,1.3),mat(0x19242d),-4+i*2.7,.8,-2);world.add(desk);
    const mon=mesh(new THREE.BoxGeometry(1.5,1,.12),mat(0x0d1720,.25,.3),-4+i*2.7,1.55,-2.45);world.add(mon);
  }
  const brain=new THREE.Group();
  for(let i=0;i<90;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(.035,6,5),new THREE.MeshBasicMaterial({color:Math.random()>.55?0x7de0ff:0xa5ffba}));
    const r=1.5*Math.cbrt(Math.random()), a=Math.random()*Math.PI*2, b=Math.acos(2*Math.random()-1);
    p.position.set(r*Math.sin(b)*Math.cos(a),1.7+r*.65*Math.cos(b),r*.7*Math.sin(b)*Math.sin(a));
    brain.add(p);
  }
  world.add(brain);
}

function addBoxProps(){
  const cage=mesh(new THREE.BoxGeometry(4,3.2,4),new THREE.MeshStandardMaterial({color:0x08090b,transparent:true,opacity:.72,roughness:1}),0,1.4,0);world.add(cage);
  const bulb=new THREE.PointLight(0x4a5260,1.1,6);bulb.position.set(0,3,0);world.add(bulb);
}

function createFly(f){
  const g=new THREE.Group();
  const bodyMat=mat(new THREE.Color(f.color),.55,.12);
  const dark=mat(0x12161b,.6,.15);
  const wingMat=new THREE.MeshStandardMaterial({color:0xdff8ff,transparent:true,opacity:.4,roughness:.25});
  const abdomen=mesh(new THREE.SphereGeometry(.34,18,14),bodyMat,0,0,0);abdomen.scale.set(1,1,1.35);g.add(abdomen);
  const thorax=mesh(new THREE.SphereGeometry(.29,18,14),dark,0,.05,-.35);g.add(thorax);
  const head=mesh(new THREE.SphereGeometry(.25,18,14),dark,0,.08,-.68);g.add(head);
  const eyeMat=mat(0x8c2234,.3,.1);
  g.add(mesh(new THREE.SphereGeometry(.11,12,8),eyeMat,.17,.13,-.79));
  g.add(mesh(new THREE.SphereGeometry(.11,12,8),eyeMat,-.17,.13,-.79));
  const wing1=mesh(new THREE.SphereGeometry(.36,16,8),wingMat,.38,.28,-.2);wing1.scale.set(1.6,.15,1);wing1.rotation.z=.35;g.add(wing1);
  const wing2=wing1.clone();wing2.position.x=-.38;wing2.rotation.z=-.35;g.add(wing2);
  // colored "vest" band to tell flies apart
  g.add(mesh(new THREE.TorusGeometry(.33,.065,8,20),bodyMat,0,.02,-.05));
  g.scale.setScalar(1.25);
  g.userData={flyId:f.id,wing1,wing2};
  return g;
}

function placeFlies(){
  const poses=[[-4,1.6,1],[0,1.7,1.3],[3,1.5,-2],[-1,1.5,-1.7],[5,1.7,1.5]];
  INSTRUMENTS.forEach((inst,i)=>{
    const f=state.flies[inst.id], g=createFly(f);
    const p=poses[i];g.position.set(...p);world.add(g);flyMeshes[inst.id]=g;
  });
}

function createWasp(){
  const g=new THREE.Group();
  const yellow=mat(0xf2be3c,.45,.1), black=mat(0x171717);
  g.add(mesh(new THREE.SphereGeometry(.5,16,12),yellow));
  g.add(mesh(new THREE.SphereGeometry(.38,16,12),black,0,0,-.55));
  g.add(mesh(new THREE.SphereGeometry(.33,16,12),yellow,0,0,.55));
  const wmat=new THREE.MeshStandardMaterial({color:0xcfefff,transparent:true,opacity:.35});
  const w1=mesh(new THREE.SphereGeometry(.5,12,8),wmat,.5,.35,0);w1.scale.set(1.5,.13,1);g.add(w1);
  const w2=w1.clone();w2.position.x=-.5;g.add(w2);
  g.scale.setScalar(1.6);g.position.set(0,4,-3);g.visible=false;world.add(g);return g;
}

function buildRoom(room){
  state.room=room;
  clearWorld(); floorAndWalls(COLORS[room]||COLORS.practice);
  if(room==='practice')addPracticeProps();
  if(room==='stage')addStageProps();
  if(room==='dining')addDiningProps();
  if(room==='chill')addChillProps();
  if(room==='lab')addLabProps();
  if(room==='box')addBoxProps();
  placeFlies();wasp=createWasp();
  renderAll();
}

function focusFly(id){
  const g=flyMeshes[id]; if(!g)return;
  const p=g.position;
  camera.position.lerp(new THREE.Vector3(p.x+5,p.y+3.7,p.z+6),.35);
}

function animateFlyAction(id,type){
  const g=flyMeshes[id];if(!g)return;
  activeAnimations.set(id,{type,start:performance.now(),baseY:g.position.y});
  if(type==='punish' && wasp){wasp.visible=true;setTimeout(()=>{if(wasp)wasp.visible=false},4500);}
}

function resize(){
  const r=canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width,r.height,false);
  camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);

function tick3d(t){
  for(const [id,a] of activeAnimations){
    const g=flyMeshes[id]; if(!g)continue;
    const elapsed=(t-a.start)/1000;
    g.position.y=a.baseY+Math.sin(elapsed*10)*.13;
    g.rotation.y=Math.sin(elapsed*5)*.25;
    if(g.userData.wing1){
      g.userData.wing1.rotation.y=Math.sin(elapsed*32)*.5;
      g.userData.wing2.rotation.y=-Math.sin(elapsed*32)*.5;
    }
    if(a.type==='punish') g.position.x+=Math.sin(elapsed*14)*.012;
    if(elapsed>4){g.position.y=a.baseY;g.rotation.set(0,0,0);activeAnimations.delete(id);}
  }
  if(wasp?.visible){
    wasp.position.x=Math.sin(t*.003)*4;wasp.position.y=3+Math.sin(t*.007)*.5;wasp.rotation.y=t*.002;
  }
  // gentle idle
  for(const [id,g] of Object.entries(flyMeshes)){
    if(!activeAnimations.has(id)) g.position.y += Math.sin(t*.002 + id.length)*.0007;
  }
  renderer.render(scene,camera);
  requestAnimationFrame(tick3d);
}

/* -------------------- GAME ACTIONS -------------------- */
document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{buildRoom(b.dataset.room);addLog(`Moved to ${ROOMS[b.dataset.room]}.`);autoSave();});
$('#practiceBtn').onclick=()=>practiceBurst(selected());
$('#performBtn').onclick=()=>stagePerformance(state.room==='stage');
$('#restBtn').onclick=()=>{
  const f=selected(); f.energy=clamp(f.energy+22);f.stress=clamp(f.stress-8);f.hunger=clamp(f.hunger+4);f.lastAction='resting';
  addLog(`${f.name} took a nap.`);setMessage(`${f.name} is doing absolutely nothing with impressive commitment.`);animateFlyAction(f.id,'reward');renderAll();autoSave();
};
$('#feedBtn').onclick=()=>{
  const f=selected();state.room='dining';buildRoom('dining');f.hunger=clamp(f.hunger-42);f.energy=clamp(f.energy+10);rewardFly(f,1.1,'fruit reward');
};
$('#chillBtn').onclick=()=>{
  const f=selected();state.room='chill';buildRoom('chill');f.mood=clamp(f.mood+10);f.stress=clamp(f.stress-14);f.energy=clamp(f.energy+3);f.band=clamp(f.band+.4);f.lastAction='social time';
  addLog(`${f.name} got social time.`);setMessage('Trees, fruit, NPC-fly vibes. Productivity has ceased.');animateFlyAction(f.id,'reward');renderAll();autoSave();
};
$('#boxBtn').onclick=()=>{state.room='box';buildRoom('box');punishFly(selected(),1.0,'The Box™');};
$('#waspBtn').onclick=()=>punishFly(selected(),1.5,'wasp chase');
$('#rewardBtn').onclick=()=>rewardFly(selected(),1.8,'jackpot reward');
$('#pauseBtn').onclick=()=>{state.paused=!state.paused;renderClock();};
$('#speedBtn').onclick=()=>{
  state.speed=state.speed===1?4:state.speed===4?12:1;
  $('#speedBtn').textContent=`${state.speed}×`;
};
$('#saveBtn').onclick=()=>{saveLocal();setMessage('Saved locally.');addLog('Local save written.');};
$('#exportBtn').onclick=exportSave;
$('#importSaveInput').onchange=importSave;
$('#cloudBtn').onclick=()=>$('#cloudDialog').showModal();
$('#cloudSaveSettingsBtn').onclick=saveCloudSettings;
$('#cloudUploadBtn').onclick=cloudUpload;
$('#cloudDownloadBtn').onclick=cloudDownload;
$('#brainPackInput').onchange=importBrainPack;

function simStep(){
  if(!state.paused){
    state.minutes+=.5*state.speed;
    if(state.minutes>=1440){state.minutes-=1440;state.day++;}
    for(const f of Object.values(state.flies)){
      f.hunger=clamp(f.hunger+.006*state.speed);
      f.energy=clamp(f.energy-.004*state.speed);
      if(f.hunger>75)f.mood=clamp(f.mood-.006*state.speed);
      if(f.stress>60)f.mood=clamp(f.mood-.004*state.speed);
      if(f.energy<25)f.stress=clamp(f.stress+.003*state.speed);
      // autonomous tiny practice while in practice room
      if(state.room==='practice' && Math.random()<.004*state.speed && f.energy>25 && f.hunger<80) trainTick(f,.55);
    }
    if(Math.random()<.05) renderAll(); else renderClock();
  }
}
setInterval(simStep,500);
setInterval(autoSave,15000);

/* -------------------- SAVE -------------------- */
function saveLocal(){
  localStorage.setItem('flyband_state',JSON.stringify(state));
}
function loadLocal(){
  try{return JSON.parse(localStorage.getItem('flyband_state'))}catch{return null}
}
function autoSave(){saveLocal();}
function exportSave(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`flyband-save-day-${state.day}.json`;a.click();URL.revokeObjectURL(a.href);
}
async function importSave(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const obj=JSON.parse(await file.text());
    if(!obj.flies)throw new Error('No flies in this save.');
    state=obj;normalizeState();buildRoom(state.room);saveLocal();addLog('Imported save file.');setMessage('Save imported successfully.');
  }catch(err){alert(`Could not import save: ${err.message}`)}
  e.target.value='';
}
async function importBrainPack(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const obj=JSON.parse(await file.text());
    if(!obj.nodes && !obj.edges && !obj.meta) throw new Error('This does not look like a FlyBand brain pack.');
    state.brainPack={meta:obj.meta||{},nodeCount:obj.nodes?.length||obj.meta?.nodeCount||0,edgeCount:obj.edges?.length||obj.meta?.edgeCount||0,importedAt:Date.now()};
    // We deliberately store only summary metadata in localStorage to avoid browser quota blowups.
    window.flybandBrainPack=obj;
    addLog(`Brain pack imported · ${state.brainPack.nodeCount} nodes · ${state.brainPack.edgeCount} edges.`);
    setMessage('Connectome pack loaded for this session. The learner can now use its graph as an action-bias scaffold.');
    renderAll();saveLocal();
  }catch(err){alert(`Brain pack error: ${err.message}`)}
  e.target.value='';
}

/* -------------------- CLOUD: SUPABASE REST -------------------- */
const CLOUD_KEY='flyband_cloud_settings';
function getCloudSettings(){try{return JSON.parse(localStorage.getItem(CLOUD_KEY))||{}}catch{return {}}}
function saveCloudSettings(){
  const cfg={url:$('#supabaseUrl').value.trim().replace(/\/$/,''),key:$('#supabaseKey').value.trim(),name:$('#cloudSaveName').value.trim()||'main'};
  localStorage.setItem(CLOUD_KEY,JSON.stringify(cfg));setMessage('Cloud settings saved on this computer.');
}
function loadCloudFields(){
  const c=getCloudSettings();$('#supabaseUrl').value=c.url||'';$('#supabaseKey').value=c.key||'';$('#cloudSaveName').value=c.name||'main';
}
$('#cloudBtn').addEventListener('click',loadCloudFields);

async function supa(path, options={}){
  const c=getCloudSettings();if(!c.url||!c.key)throw new Error('Cloud settings are empty.');
  const headers={apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(options.headers||{})};
  const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers});
  const text=await r.text();
  if(!r.ok)throw new Error(text||`HTTP ${r.status}`);
  return text?JSON.parse(text):null;
}
async function cloudUpload(){
  saveCloudSettings();const c=getCloudSettings();
  try{
    const payload={save_name:c.name,state,updated_at:new Date().toISOString()};
    await supa(`flyband_saves?on_conflict=save_name`,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    addLog('Cloud save uploaded.');setMessage('Cloud save uploaded.');
  }catch(e){alert(`Cloud upload failed:\n${e.message}\n\nRun the supplied supabase.sql once in Supabase first.`)}
}
async function cloudDownload(){
  saveCloudSettings();const c=getCloudSettings();
  try{
    const rows=await supa(`flyband_saves?save_name=eq.${encodeURIComponent(c.name)}&select=state&limit=1`);
    if(!rows?.length)throw new Error('No cloud save with that name.');
    state=rows[0].state;normalizeState();buildRoom(state.room);saveLocal();addLog('Cloud save downloaded.');setMessage('Cloud save loaded.');
  }catch(e){alert(`Cloud download failed:\n${e.message}`)}
}

/* -------------------- BOOT -------------------- */
buildRoom(state.room);
resize();
renderAll();
requestAnimationFrame(tick3d);
setMessage('FlyBand V1 loaded. Click a fly, then make questionable management decisions.');
