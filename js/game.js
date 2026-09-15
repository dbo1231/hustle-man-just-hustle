import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const SAVE_KEY = 'hustleFromNothing_v1';
const worldSize = 220;

const defaultState = () => ({
  name:'Blayn', skin:'#b97a58', shirt:'#2563eb', pants:'#1e293b', hair:'#171717',
  cash:350, bank:0, rep:0, energy:5, hunger:100, day:1, hour:8,
  position:{x:-55,z:70},
  skills:{drive:1,clean:1,labor:1,delivery:1,business:1},
  inventory:['Phone'], ownedVehicles:[], ownedBusinesses:[], properties:[],
  jobsDone:0, totalEarned:0, mission:0,
  flags:{jobCenter:false, firstJob:false, boughtBusiness:false, boughtVehicle:false, boughtProperty:false}
});
let state = defaultState();

const jobs = [
  {id:'delivery',name:'Delivery Driver',desc:'Pick up a package and drop it off across town.',pay:95,energy:1,skill:'delivery',rep:2,req:0},
  {id:'lawn',name:'Lawn Crew',desc:'Cut three yards for the neighborhood route.',pay:120,energy:2,skill:'labor',rep:3,req:0},
  {id:'detail',name:'Mobile Detail',desc:'Clean a customer car at the shop.',pay:150,energy:2,skill:'clean',rep:4,req:1},
  {id:'warehouse',name:'Warehouse Shift',desc:'Sort pallets before the morning truck arrives.',pay:180,energy:3,skill:'labor',rep:4,req:2}
];
const businesses = [
  {id:'lawnbiz',name:'Mow Squad',desc:'A tiny lawn-care route. Generates passive daily income.',price:1400,income:125,req:5},
  {id:'detailbiz',name:'Shine Lab',desc:'Your first real detailing bay.',price:3400,income:280,req:12},
  {id:'wash',name:'Quick Wash',desc:'A neighborhood hand-wash spot with strong margins.',price:7500,income:650,req:25},
  {id:'shop',name:'Hustle Mart',desc:'A full retail storefront. Big money, bigger upkeep.',price:22000,income:2100,req:50}
];
const vehicles = [
  {id:'bike',name:'Used Bike',price:650,top:32,bonus:0.1},
  {id:'compact',name:'Old Compact',price:2200,top:44,bonus:0.18},
  {id:'pickup',name:'Work Pickup',price:6200,top:48,bonus:0.35},
  {id:'van',name:'Detail Van',price:11500,top:46,bonus:0.55}
];
const properties = [
  {id:'room',name:'Rent a Room',price:900,rep:3},
  {id:'apartment',name:'Starter Apartment',price:5800,rep:8},
  {id:'house',name:'Small House',price:18500,rep:18},
  {id:'luxury',name:'Hilltop Home',price:65000,rep:45}
];

let scene, camera, renderer, clock, player, playerParts = {}, cityGroup, keys = {}, near = null;
let npcs = [], interactables = [], buildings = [], markers = [];
let selectedJob = null, vehicleMode = false, lastHud = '';
const dayColor = new THREE.Color(0x8fb4d5), nightColor = new THREE.Color(0x172036);
const start = {x:-55,z:70};

function save(){ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); toast('Game saved.'); }
function load(){ try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if(s) state={...defaultState(),...s,skills:{...defaultState().skills,...s.skills},flags:{...defaultState().flags,...s.flags}};}catch(e){} }
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),2200)}
function money(n){return '$'+Math.round(n).toLocaleString();}
function canAfford(v){return state.cash>=v}
function spend(v){if(!canAfford(v)){toast('Not enough cash.');return false} state.cash-=v; return true}
function earn(v){state.cash+=v;state.totalEarned+=v}
function addRep(v){state.rep=Math.max(0,state.rep+v)}

function init3D(){
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fb4d5); scene.fog = new THREE.Fog(0x8fb4d5,120,360);
  camera = new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,700);
  renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; $('#scene').replaceWith(renderer.domElement); renderer.domElement.id='scene';
  clock = new THREE.Clock();
  const hemi=new THREE.HemisphereLight(0xd9efff,0x223344,2.1); scene.add(hemi); const sun=new THREE.DirectionalLight(0xffffff,2.4);sun.position.set(-80,150,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  cityGroup=new THREE.Group();scene.add(cityGroup); buildCity(); buildPlayer(); buildNPCs();
  window.addEventListener('resize',onResize); window.addEventListener('keydown',onKey); window.addEventListener('keyup',e=>keys[e.code]=false);
  animate();
}
function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.05})}
function box(w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.castShadow=true;m.receiveShadow=true;return m}
function cyl(r,h,c,seg=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat(c));m.castShadow=true;m.receiveShadow=true;return m}
function addBuilding(x,z,w,d,h,c,label,kind){const g=new THREE.Group();const b=box(w,h,d,c);b.position.y=h/2;g.add(b);const roof=box(w+.5,.6,d+.5,0x0b1220);roof.position.y=h+.3;g.add(roof);g.position.set(x,0,z);cityGroup.add(g);buildings.push({x,z,w,d,h,label,kind});}
function buildCity(){
  const ground=box(worldSize,.5,worldSize,0x40553d);ground.position.y=-.3;cityGroup.add(ground);
  // road grid
  for(let i=-100;i<=100;i+=40){const h=box(12,.08,worldSize,0x20252b);h.position.set(i,.01,0);cityGroup.add(h);const v=box(worldSize,.08,12,0x20252b);v.position.set(0,.02,i);cityGroup.add(v)}
  // sidewalks / lots
  for(let x=-90;x<=90;x+=40) for(let z=-90;z<=90;z+=40){if(Math.abs(x)<15&&Math.abs(z)<15)continue; const lot=box(30,.15,30,0x657060);lot.position.set(x,.03,z);cityGroup.add(lot)}
  addBuilding(-55,70,20,16,11,0x253246,'JOB CENTER','job');
  addBuilding(55,70,22,16,13,0x3c2d2d,'DEALER','vehicle');
  addBuilding(-55,-70,22,16,10,0x293f4a,'BANK','bank');
  addBuilding(55,-70,24,18,12,0x4c3d27,'REALTY','property');
  addBuilding(0,-5,28,22,17,0x26404a,'BUSINESS HUB','business');
  addBuilding(-90,0,18,18,8,0x2b4f36,'PARK','park');
  addBuilding(90,0,18,18,8,0x4d3449,'GARAGE','garage');
  // street lights
  for(let x=-100;x<=100;x+=20){for(let z=-100;z<=100;z+=40){let p=cyl(.08,5,0x667085,8);p.position.set(x,2.5,z);cityGroup.add(p);let l=cyl(.35,.2,0xffe9a1,8);l.position.set(x,5.15,z);cityGroup.add(l)}}
  markers=[
    {x:-55,z:70,color:0x3b82f6,label:'JOB'}, {x:55,z:70,color:0xf59e0b,label:'DEALER'}, {x:-55,z:-70,color:0x22c55e,label:'BANK'}, {x:55,z:-70,color:0xa78bfa,label:'REALTY'}, {x:0,z:-5,color:0xec4899,label:'BUSINESS'}
  ];
  for(const m of markers){const ring=new THREE.Mesh(new THREE.RingGeometry(1.6,2.2,24),new THREE.MeshBasicMaterial({color:m.color,side:THREE.DoubleSide,transparent:true,opacity:.75}));ring.rotation.x=-Math.PI/2;ring.position.set(m.x,.2,m.z);cityGroup.add(ring); interactables.push({x:m.x,z:m.z,label:m.label,kind:m.label.toLowerCase()})}
}
function buildPlayer(){
  player=new THREE.Group();player.position.set(state.position.x,0,state.position.z);scene.add(player);
  rebuildAvatar();
}
function rebuildAvatar(){ if(playerParts.body) player.remove(...Object.values(playerParts)); playerParts={};
  const legs=new THREE.Group(); const left=box(.42,.9,.42,state.pants);left.position.set(-.25,.45,0);const right=box(.42,.9,.42,state.pants);right.position.set(.25,.45,0);legs.add(left,right);player.add(legs);playerParts.legs=legs;
  const torso=box(1.05,1.25,.6,state.shirt);torso.position.y=1.45;player.add(torso);playerParts.body=torso;
  const head=cyl(.48,.72,state.skin,12);head.rotation.x=Math.PI/2;head.position.y=2.45;player.add(head);playerParts.head=head;
  const hair=cyl(.51,.16,state.hair,12);hair.rotation.x=Math.PI/2;hair.position.y=2.75;player.add(hair);playerParts.hair=hair;
  const arm1=box(.32,.95,.32,state.skin);arm1.position.set(-.72,1.45,0);arm1.rotation.z=-.12;const arm2=box(.32,.95,.32,state.skin);arm2.position.set(.72,1.45,0);arm2.rotation.z=.12;player.add(arm1,arm2);playerParts.arms=new THREE.Group();
}
function buildNPCs(){npcs.forEach(n=>scene.remove(n));npcs=[];for(let i=0;i<16;i++){const n=new THREE.Group();const body=box(.7,1.2,.45,[0x334155,0x7c3aed,0x15803d,0xb45309][i%4]);body.position.y=.9;n.add(body);const head=cyl(.33,.5,[0xc08457,0x7b4b35,0xe2ad84][i%3]);head.rotation.x=Math.PI/2;head.position.y=1.75;n.add(head);n.position.set(-85+(i*23)%170,-82+(i*37)%164);n.userData={baseX:n.position.x,baseZ:n.position.z,phase:i};scene.add(n);npcs.push(n)}}

function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function onKey(e){if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;
  if(e.code==='KeyE') interact(); if(e.code==='KeyP') togglePanel('phone'); if(e.code==='KeyM') togglePanel('map'); if(e.code==='Escape') togglePause(); if(e.code==='KeyF') useVehicle();
}
function movePlayer(dt){
  const v=vehicleMode ? ((keys.ShiftLeft||keys.ShiftRight)?22:15) : ((keys.ShiftLeft||keys.ShiftRight)?14:8); let dx=0,dz=0;if(keys.KeyW||keys.ArrowUp)dz-=1;if(keys.KeyS||keys.ArrowDown)dz+=1;if(keys.KeyA||keys.ArrowLeft)dx-=1;if(keys.KeyD||keys.ArrowRight)dx+=1; if(dx||dz){const len=Math.hypot(dx,dz);dx/=len;dz/=len;player.position.x+=dx*v*dt;player.position.z+=dz*v*dt;player.rotation.y=Math.atan2(dx,dz);state.position.x=player.position.x;state.position.z=player.position.z;state.hunger=Math.max(0,state.hunger-dt*.45); if((keys.ShiftLeft||keys.ShiftRight))state.energy=Math.max(0,state.energy-dt*.55)}
  player.position.x=THREE.MathUtils.clamp(player.position.x,-104,104);player.position.z=THREE.MathUtils.clamp(player.position.z,-104,104);
}
function updateCamera(){const target=new THREE.Vector3(player.position.x,1.7,player.position.z);const back=new THREE.Vector3(Math.sin(player.rotation.y)*7,4.2,Math.cos(player.rotation.y)*7);const desired=target.clone().add(back);camera.position.lerp(desired,.09);camera.lookAt(target)}
function updateNPCs(t){npcs.forEach(n=>{n.position.x=n.userData.baseX+Math.sin(t*.35+n.userData.phase)*3;n.position.z=n.userData.baseZ+Math.cos(t*.27+n.userData.phase)*3})}
function nearest(){let best=null,bestD=999;for(const i of interactables){const d=Math.hypot(player.position.x-i.x,player.position.z-i.z);if(d<bestD){bestD=d;best=i}}return bestD<8?best:null}
function interact(){near=nearest(); if(!near){toast('Nothing nearby.');return} const k=near.kind;
  if(k==='job'){state.flags.jobCenter=true;openJobs(); if(state.mission===0) state.mission=1;}
  else if(k==='vehicle'){openVehicle();}
  else if(k==='bank'){const amount=Math.floor(state.cash*.25); if(amount>0){state.cash-=amount;state.bank+=amount;toast(`Deposited ${money(amount)}.`)}else toast('You need cash first.');}
  else if(k==='property'){openProperty();}
  else if(k==='business'){openBusiness();}
  else toast('Just a landmark.');
}
function useVehicle(){if(!state.ownedVehicles.length){toast('Buy a vehicle first.');return} vehicleMode=!vehicleMode; toast(vehicleMode?'Vehicle mode ON — you move faster.':'Vehicle mode OFF.');}
function updatePrompt(){near=nearest();const p=$('#prompt'); if(near){p.innerHTML=`PRESS <b>E</b> — ${near.label}`;p.classList.remove('hidden')}else p.classList.add('hidden')}

function renderJobs(){const el=$('#jobsList');el.innerHTML=jobs.map(j=>{const lvl=state.skills[j.skill]||1;const locked=state.rep<j.req;return `<div class="list-row"><div><h3>${j.name}</h3><p>${j.desc}<br><span class="money">${money(j.pay)}</span> • ${j.energy}⚡ • +${j.rep} rep • ${j.skill} lv.${lvl}</p></div><button class="smallbtn" data-job="${j.id}" ${locked||state.energy<j.energy?'disabled':''}>${locked?'LOCKED':state.energy<j.energy?'TIRED':'TAKE JOB'}</button></div>`}).join('');$$('[data-job]').forEach(b=>b.onclick=()=>startJob(b.dataset.job))}
function startJob(id){const j=jobs.find(x=>x.id===id);if(!j)return;if(state.energy<j.energy){toast('Too tired. Visit home or wait for morning.');return} state.energy-=j.energy;selectedJob=j;closePanels();missionToJob(j);toast(`Started ${j.name}. Follow the glowing marker.`)}
function missionToJob(j){state.flags.firstJob=true;state.mission=2;state.jobTarget={x: j.id==='delivery'?75 : j.id==='lawn'?-78 : j.id==='detail':78, z:j.id==='warehouse'?78 : j.id==='detail'?2 : -12, id:j.id};
  showJobTarget();}
function showJobTarget(){if(!state.jobTarget)return; let ring=new THREE.Mesh(new THREE.RingGeometry(2,2.7,24),new THREE.MeshBasicMaterial({color:0xfacc15,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(state.jobTarget.x,.25,state.jobTarget.z);ring.userData.job=true;cityGroup.add(ring);interactables.push({x:state.jobTarget.x,z:state.jobTarget.z,label:'JOB TARGET',kind:'jobtarget'});state._ring=ring;}
function completeJob(){if(!selectedJob)return;const j=selectedJob;earn(j.pay*(1+Math.min(.5,(state.skills[j.skill]-1)*.08)));addRep(j.rep);state.jobsDone++;state.skills[j.skill]=Math.min(20,state.skills[j.skill]+1);state.mission=3; selectedJob=null;if(state._ring){cityGroup.remove(state._ring);state._ring=null} interactables=interactables.filter(i=>i.kind!=='jobtarget');toast(`Job complete! +${money(j.pay)} and +${j.rep} rep.`);renderAll()}
function maybeCompleteJob(){if(state.jobTarget&&Math.hypot(player.position.x-state.jobTarget.x,player.position.z-state.jobTarget.z)<7){completeJob();}}

function renderBusiness(){const el=$('#businessList');el.innerHTML=`<div class="statline"><span>Reputation</span><b>${state.rep}</b></div>`+businesses.map(b=>{const own=state.ownedBusinesses.includes(b.id);const locked=state.rep<b.req;return `<div class="list-row"><div><h3>${b.name}</h3><p>${b.desc}<br>${money(b.price)} • +${money(b.income)}/day • req. ${b.req} rep</p></div><button class="smallbtn" data-buybiz="${b.id}" ${own||locked||!canAfford(b.price)?'disabled':''}>${own?'OWNED':locked?'LOCKED':!canAfford(b.price)?'NEED CASH':'BUY'}</button></div>`}).join('');$$('[data-buybiz]').forEach(b=>b.onclick=()=>buyBusiness(b.dataset.buybiz))}
function buyBusiness(id){const b=businesses.find(x=>x.id===id);if(!b||!spend(b.price))return;state.ownedBusinesses.push(id);state.flags.boughtBusiness=true;addRep(Math.floor(b.req/2)+2);earn(0);toast(`${b.name} is yours. It earns money each new day.`);renderAll()}
function renderVehicle(){const el=$('#vehicleList');el.innerHTML=vehicles.map(v=>{const own=state.ownedVehicles.includes(v.id);return `<div class="list-row"><div><h3>${v.name}</h3><p>${money(v.price)} • top speed ${v.top} • hustle bonus +${Math.round(v.bonus*100)}%</p></div><button class="smallbtn" data-buyveh="${v.id}" ${own||!canAfford(v.price)?'disabled':''}>${own?'OWNED':!canAfford(v.price)?'NEED CASH':'BUY'}</button></div>`}).join('');$$('[data-buyveh]').forEach(b=>b.onclick=()=>buyVehicle(b.dataset.buyveh))}
function buyVehicle(id){const v=vehicles.find(x=>x.id===id);if(!v||!spend(v.price))return;state.ownedVehicles.push(id);state.flags.boughtVehicle=true;addRep(2);toast(`${v.name} added to your garage.`);renderAll()}
function renderProperty(){const el=$('#propertyList');el.innerHTML=properties.map(p=>{const own=state.properties.includes(p.id);return `<div class="list-row"><div><h3>${p.name}</h3><p>${money(p.price)} • +${p.rep} reputation • saves your spawn</p></div><button class="smallbtn" data-buyprop="${p.id}" ${own||!canAfford(p.price)?'disabled':''}>${own?'OWNED':!canAfford(p.price)?'NEED CASH':'BUY'}</button></div>`}).join('');$$('[data-buyprop]').forEach(b=>b.onclick=()=>buyProperty(b.dataset.buyprop))}
function buyProperty(id){const p=properties.find(x=>x.id===id);if(!p||!spend(p.price))return;state.properties.push(id);state.flags.boughtProperty=true;addRep(p.rep);toast(`${p.name} purchased.`);renderAll()}
function renderInventory(){const items=[...state.inventory,...state.ownedVehicles.map(x=>vehicles.find(v=>v.id===x)?.name),...state.ownedBusinesses.map(x=>businesses.find(b=>b.id===x)?.name),...state.properties.map(x=>properties.find(p=>p.id===x)?.name)].filter(Boolean);$('#inventoryList').innerHTML=items.length?items.map((x,i)=>`<div class="statline"><span>${i+1}. ${x}</span><b>OWNED</b></div>`).join(''):'<p class="muted">Your pockets are empty.</p>'}
function renderSkills(){const s=state.skills;const rows=[['Driving',s.drive],['Cleaning',s.clean],['Labor',s.labor],['Delivery',s.delivery],['Business',s.business],['Jobs Completed',state.jobsDone],['Total Earned',money(state.totalEarned)],['Current Day',state.day],['Time',String(state.hour).padStart(2,'0')+':00']];$('#skillsList').innerHTML=rows.map(r=>`<div class="statline"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}
function renderAll(){ $('#cash').textContent=money(state.cash);$('#bank').textContent=money(state.bank);$('#rep').textContent=state.rep;$('#energy').textContent=Math.max(0,Math.floor(state.energy));$('#hunger').textContent=Math.round(state.hunger)+'%'; renderJobs();renderBusiness();renderVehicle();renderProperty();renderInventory();renderSkills(); updateMissionText();}
function updateMissionText(){let t='Walk to the blue JOB CENTER.';let p=0;if(state.mission>=1)t='Pick a job from the JOB CENTER.';if(state.mission===2)t='Complete your active job route.';if(state.mission>=3&&state.rep<5)t='Keep working until you have 5 reputation.';if(state.rep>=5&&state.cash<1400)t='Save $1,400 and start your first business.';if(state.cash>=1400&&!state.flags.boughtBusiness)t='Open your PHONE → Business and buy your first company.';if(state.flags.boughtBusiness&&!state.flags.boughtVehicle)t='Buy a vehicle and unlock faster money-making.';if(state.flags.boughtVehicle&&!state.flags.boughtProperty)t='Save up for a place of your own.';if(state.flags.boughtProperty)t='Build your empire: reach 50 reputation.';if(state.rep>=50)t='YOU MADE IT OUT. Now own the city.';$('#missionText').textContent=t;$('#missionProgress').style.width=(state.rep>=50?100:Math.min(100,state.rep*2))+'%';}

function openJobs(){renderJobs();togglePanel('jobs')};function openBusiness(){renderBusiness();togglePanel('business')};function openVehicle(){renderVehicle();togglePanel('vehicle')};function openProperty(){renderProperty();togglePanel('property')};
function togglePanel(name){closePanels();const id=name==='phone'?'phonePanel':name==='jobs'?'jobsPanel':name==='business'?'businessPanel':name==='inventory'?'inventoryPanel':name==='vehicle'?'vehiclePanel':name==='property'?'propertyPanel':name==='skills'?'skillsPanel':name==='map'?'mapPanel':null;if(id){$('#'+id).classList.remove('hidden');if(name==='map')drawMap($('#bigMap'))}}
function closePanels(){$$('.panel').forEach(x=>x.classList.add('hidden'))}
function togglePause(){const p=$('#pausePanel');p.classList.toggle('hidden');}

function drawMinimap(){const c=$('#minimap'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0a0f14';ctx.fillRect(0,0,w,h);const s=w/worldSize;ctx.strokeStyle='#273241';ctx.lineWidth=4;for(let i=-100;i<=100;i+=40){ctx.beginPath();ctx.moveTo((i+110)*s,10);ctx.lineTo((i+110)*s,h-10);ctx.stroke();ctx.beginPath();ctx.moveTo(10,(i+110)*s);ctx.lineTo(w-10,(i+110)*s);ctx.stroke()}markers.forEach(m=>{ctx.fillStyle='#'+m.color.toString(16).padStart(6,'0');ctx.beginPath();ctx.arc((m.x+110)*s,(m.z+110)*s,5,0,Math.PI*2);ctx.fill()});ctx.fillStyle='#fff';ctx.beginPath();ctx.arc((player.position.x+110)*s,(player.position.z+110)*s,5,0,Math.PI*2);ctx.fill()}
function drawMap(c){const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.fillStyle='#0a0f14';ctx.fillRect(0,0,w,h);const sx=w/worldSize,sy=h/worldSize;ctx.strokeStyle='#334155';ctx.lineWidth=15;for(let i=-100;i<=100;i+=40){ctx.beginPath();ctx.moveTo((i+110)*sx,0);ctx.lineTo((i+110)*sx,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,(i+110)*sy);ctx.lineTo(w,(i+110)*sy);ctx.stroke()}markers.forEach(m=>{ctx.fillStyle='#'+m.color.toString(16).padStart(6,'0');ctx.beginPath();ctx.arc((m.x+110)*sx,(m.z+110)*sy,10,0,Math.PI*2);ctx.fill();ctx.fillText(m.label,(m.x+110)*sx+14,(m.z+110)*sy+4)});ctx.fillStyle='#fff';ctx.beginPath();ctx.arc((player.position.x+110)*sx,(player.position.z+110)*sy,9,0,Math.PI*2);ctx.fill()}

function advanceDay(){state.day++;state.hour=8;state.energy=5;state.hunger=100;const income=state.ownedBusinesses.reduce((sum,id)=>sum+(businesses.find(b=>b.id===id)?.income||0),0);if(income){state.bank+=income;toast(`Day ${state.day}: businesses paid ${money(income)}.`)}}
function updateTime(dt){state.hour+=dt*.06;if(state.hour>=24){state.hour=0;advanceDay()}const sun=Math.max(0,Math.sin((state.hour/24)*Math.PI*2-Math.PI/2));scene.background.lerpColors(nightColor,dayColor,sun);scene.fog.color.copy(scene.background)}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if($('#pausePanel').classList.contains('hidden')&&$('#creator').classList.contains('hidden')&&$('#boot').classList.contains('hidden')){movePlayer(dt);maybeCompleteJob();updateNPCs(clock.elapsedTime);updateCamera();updateTime(dt);updatePrompt();drawMinimap();const hud=[state.cash,state.bank,state.rep,Math.floor(state.energy),Math.round(state.hunger),state.mission,state.jobsDone,state.ownedBusinesses.join(','),state.ownedVehicles.join(','),state.properties.join(',')].join('|');if(hud!==lastHud){lastHud=hud;renderAll()}}renderer.render(scene,camera)}

function createGame(){state=defaultState();state.name=$('#nameInput').value.trim()||'Blayn';state.skin=$('#skinInput').value;state.shirt=$('#shirtInput').value;state.pants=$('#pantsInput').value;state.hair=$('#hairInput').value;localStorage.removeItem(SAVE_KEY);$('#boot').classList.add('hidden');$('#creator').classList.add('hidden');$('#gameUI').classList.remove('hidden');init3D();renderAll();toast(`Welcome, ${state.name}. Start with the JOB CENTER.`)}
function continueGame(){load();$('#boot').classList.add('hidden');$('#creator').classList.add('hidden');$('#gameUI').classList.remove('hidden');init3D();renderAll();toast(`Welcome back, ${state.name}.`)}

$('#startBtn').onclick=()=>{$('#boot').classList.add('hidden');$('#creator').classList.remove('hidden')};$('#continueBtn').onclick=()=>{if(localStorage.getItem(SAVE_KEY)) continueGame(); else {toast('No saved game yet.');}};$('#createBtn').onclick=createGame;$('#saveBtn').onclick=save;$('#pauseBtn').onclick=togglePause;$('#resumeBtn').onclick=togglePause;$('#restartBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);location.reload()};
$$('[data-panel]').forEach(b=>b.onclick=()=>togglePanel(b.dataset.panel));$$('.closePanel').forEach(b=>b.onclick=closePanels);
window.addEventListener('beforeunload',()=>localStorage.setItem(SAVE_KEY,JSON.stringify(state)));
load();

// Tiny first-run preview avatar using CSS-ish DOM blocks.
for(const sel of ['#skinInput','#shirtInput','#pantsInput','#hairInput']) $(sel).addEventListener('change',()=>{const p=$('#previewAvatar');p.style.boxShadow=`inset 0 0 0 70px ${$('#shirtInput').value}44`;});
