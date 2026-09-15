(() => {
  'use strict';
  const SAVE_KEY = 'hustleFromNothing_v3';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const stateDefault = () => ({
    name:'Blayn', skin:'#b97a58', shirt:'#2563eb', pants:'#1e293b', hair:'#171717',
    cash:350, bank:0, rep:0, energy:100, hunger:100, day:1, hour:8,
    x:-55, z:70, jobsDone:0, totalEarned:0,
    vehicles:[], selectedVehicle:null, businesses:[], properties:[],
    skills:{delivery:1,labor:1,clean:1,drive:1,business:1}
  });
  let state = stateDefault();
  let started = false, paused = false, activeJob = null, jobTarget = null, keys = {};
  let threeReady = false, renderer = null, scene = null, camera = null, player = null, world = null;
  let last = performance.now(), toastTimer = null;

  const jobs = [
    {id:'delivery', name:'Delivery Driver', desc:'Take a package across town.', pay:95, energy:15, rep:2, skill:'delivery', x:75, z:70},
    {id:'lawn', name:'Lawn Crew', desc:'Cut lawns for a neighborhood route.', pay:120, energy:20, rep:3, skill:'labor', x:-75, z:5},
    {id:'detail', name:'Mobile Detail', desc:'Clean a customer vehicle.', pay:150, energy:20, rep:4, skill:'clean', req:1, x:75, z:5},
    {id:'warehouse', name:'Warehouse Shift', desc:'Sort pallets before the morning truck.', pay:180, energy:30, rep:4, skill:'labor', req:2, x:75, z:-70}
  ];
  const vehicles = [
    {id:'bike', name:'Used Bike', price:650, speed:1.25},
    {id:'compact', name:'Old Compact', price:2200, speed:1.45},
    {id:'pickup', name:'Work Pickup', price:6200, speed:1.7},
    {id:'van', name:'Detail Van', price:11500, speed:1.6}
  ];
  const businesses = [
    {id:'mow', name:'Mow Squad', price:1400, income:125, req:5},
    {id:'shine', name:'Shine Lab', price:3400, income:280, req:12},
    {id:'wash', name:'Quick Wash', price:7500, income:650, req:25},
    {id:'mart', name:'Hustle Mart', price:22000, income:2100, req:50}
  ];
  const properties = [
    {id:'room', name:'Rent a Room', price:900, rep:3},
    {id:'apartment', name:'Starter Apartment', price:5800, rep:8},
    {id:'house', name:'Small House', price:18500, rep:18},
    {id:'luxury', name:'Hilltop Home', price:65000, rep:45}
  ];

  const money = (n) => '$' + Math.round(Number(n)||0).toLocaleString();
  const hide = (id) => document.getElementById(id)?.classList.add('hidden');
  const show = (id) => document.getElementById(id)?.classList.remove('hidden');
  const toast = (msg) => {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  };

  function updateHUD(){
    const vals = {
      '#cash':money(state.cash), '#bank':money(state.bank), '#rep':state.rep,
      '#energy':Math.round(state.energy), '#hunger':Math.round(state.hunger)+'%'
    };
    Object.entries(vals).forEach(([sel,v]) => { const e=$(sel); if(e)e.textContent=v; });
    const mission = $('#missionText');
    const progress = $('#missionProgress');
    if(activeJob && jobTarget){
      const d=Math.hypot(state.x-jobTarget.x,state.z-jobTarget.z);
      if(mission)mission.textContent=`Go to the yellow marker • ${Math.ceil(d)}m away.`;
      if(progress)progress.style.width=Math.max(0,Math.min(100,100-d/1.8))+'%';
    }else if(!state.vehicles.length){
      if(mission)mission.textContent='Get your first job, then buy your first vehicle.';
      if(progress)progress.style.width=Math.min(100,state.jobsDone*12)+'%';
    }else if(!state.businesses.length){
      if(mission)mission.textContent='Build reputation and save for your first business.';
      if(progress)progress.style.width=Math.min(100,state.rep*2)+'%';
    }else{
      if(mission)mission.textContent='Keep grinding. Own the city.';
      if(progress)progress.style.width='100%';
    }
  }

  function save(silent=false){
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); if(!silent)toast('Game saved.'); }
    catch(e){ console.error(e); toast('Save failed.'); }
  }
  function load(){
    try{
      const raw=localStorage.getItem(SAVE_KEY); if(!raw)return false;
      const s=JSON.parse(raw);
      state=Object.assign(stateDefault(),s,{skills:Object.assign(stateDefault().skills,s.skills||{})});
      return true;
    }catch(e){ console.error(e); return false; }
  }

  function closePanels(){
    ['phonePanel','jobsPanel','businessPanel','inventoryPanel','vehiclePanel','propertyPanel','skillsPanel','mapPanel','pausePanel'].forEach(hide);
    paused=false;
  }
  function openPanel(name){
    ['phonePanel','jobsPanel','businessPanel','inventoryPanel','vehiclePanel','propertyPanel','skillsPanel','mapPanel'].forEach(hide);
    if(name==='phone')show('phonePanel');
    if(name==='jobs'){show('jobsPanel');renderJobs();}
    if(name==='business'){show('businessPanel');renderBusinesses();}
    if(name==='inventory'){show('inventoryPanel');renderInventory();}
    if(name==='vehicle'){show('vehiclePanel');renderVehicles();}
    if(name==='property'){show('propertyPanel');renderProperties();}
    if(name==='skills'){show('skillsPanel');renderSkills();}
    if(name==='map'){show('mapPanel');drawBigMap();}
  }

  function renderJobs(){
    const el=$('#jobsList'); if(!el)return;
    el.innerHTML=jobs.map(j=>{
      const locked=state.rep<(j.req||0), tired=state.energy<j.energy;
      return `<div class="list-row"><div><h3>${j.name}</h3><p>${j.desc}<br><span class="money">${money(j.pay)}</span> • ${j.energy}⚡ • +${j.rep} rep</p></div><button class="smallbtn" data-job="${j.id}" ${locked||tired?'disabled':''}>${locked?'LOCKED':tired?'TIRED':'TAKE JOB'}</button></div>`;
    }).join('');
    $$('[data-job]').forEach(b=>b.addEventListener('click',()=>startJob(b.dataset.job)));
  }
  function startJob(id){
    const j=jobs.find(x=>x.id===id); if(!j)return;
    if(state.energy<j.energy)return toast('You need more energy.');
    state.energy-=j.energy; state.skills[j.skill]=(state.skills[j.skill]||1)+0.2;
    activeJob=j; jobTarget={x:j.x,z:j.z}; closePanels();
    toast(`${j.name} started. Follow the yellow marker.`); updateHUD();
  }
  function finishJob(){
    if(!activeJob)return;
    const j=activeJob, reward=j.pay+Math.floor((state.skills[j.skill]||1)*5);
    state.cash+=reward; state.totalEarned+=reward; state.rep+=j.rep; state.jobsDone++;
    activeJob=null; jobTarget=null; save(true); updateHUD(); toast(`Job complete! +${money(reward)}.`);
  }

  function renderBusinesses(){
    const el=$('#businessList'); if(!el)return;
    el.innerHTML=businesses.map(b=>{
      const owned=state.businesses.includes(b.id), locked=state.rep<b.req;
      return `<div class="list-row"><div><h3>${b.name}</h3><p>${owned?'Owned • '+money(b.income)+'/day':money(b.price)+' • '+money(b.income)+'/day • requires '+b.req+' rep'}</p></div><button class="smallbtn" data-business="${b.id}" ${owned||locked||state.cash<b.price?'disabled':''}>${owned?'OWNED':locked?'LOCKED':state.cash<b.price?'TOO EXPENSIVE':'BUY'}</button></div>`;
    }).join('');
    $$('[data-business]').forEach(b=>b.addEventListener('click',()=>buyBusiness(b.dataset.business)));
  }
  function buyBusiness(id){
    const b=businesses.find(x=>x.id===id); if(!b||state.businesses.includes(id))return;
    if(state.rep<b.req)return toast('Build more reputation first.');
    if(state.cash<b.price)return toast('Not enough cash.');
    state.cash-=b.price; state.businesses.push(id); save(true); renderBusinesses(); updateHUD(); toast(`${b.name} is yours.`);
  }
  function renderInventory(){
    const el=$('#inventoryList'); if(!el)return;
    const items=['📱 Phone','👕 Starter Outfit',...state.vehicles.map(id=>'🚗 '+(vehicles.find(v=>v.id===id)?.name||id)),...state.businesses.map(id=>'🏢 '+(businesses.find(b=>b.id===id)?.name||id)),...state.properties.map(id=>'🏠 '+(properties.find(p=>p.id===id)?.name||id))];
    el.innerHTML=items.map(i=>`<div class="statline"><span>${i}</span><b>OWNED</b></div>`).join('');
  }
  function renderVehicles(){
    const el=$('#vehicleList'); if(!el)return;
    el.innerHTML=vehicles.map(v=>{
      const owned=state.vehicles.includes(v.id), active=state.selectedVehicle===v.id;
      return `<div class="list-row"><div><h3>${v.name}</h3><p>${owned?(active?'Currently equipped':'Owned'):money(v.price)+' • speed '+v.speed.toFixed(2)+'x'}</p></div><button class="smallbtn" data-vehicle="${v.id}" ${!owned&&state.cash<v.price?'disabled':''}>${active?'EQUIPPED':owned?'SELECT':'BUY'}</button></div>`;
    }).join('');
    $$('[data-vehicle]').forEach(b=>b.addEventListener('click',()=>handleVehicle(b.dataset.vehicle)));
  }
  function handleVehicle(id){
    const v=vehicles.find(x=>x.id===id); if(!v)return;
    if(!state.vehicles.includes(id)){if(state.cash<v.price)return toast('Not enough cash.');state.cash-=v.price;state.vehicles.push(id);state.selectedVehicle=id;toast(`${v.name} purchased.`)}
    else {state.selectedVehicle=id;toast(`${v.name} equipped.`)}
    save(true);renderVehicles();renderInventory();updateHUD();
  }
  function renderProperties(){
    const el=$('#propertyList'); if(!el)return;
    el.innerHTML=properties.map(p=>{const owned=state.properties.includes(p.id);return `<div class="list-row"><div><h3>${p.name}</h3><p>${owned?'Owned • +'+p.rep+' rep':money(p.price)+' • +'+p.rep+' rep'}</p></div><button class="smallbtn" data-property="${p.id}" ${owned||state.cash<p.price?'disabled':''}>${owned?'OWNED':state.cash<p.price?'TOO EXPENSIVE':'BUY'}</button></div>`}).join('');
    $$('[data-property]').forEach(b=>b.addEventListener('click',()=>buyProperty(b.dataset.property)));
  }
  function buyProperty(id){const p=properties.find(x=>x.id===id);if(!p||state.properties.includes(id))return;if(state.cash<p.price)return toast('Not enough cash.');state.cash-=p.price;state.properties.push(id);state.rep+=p.rep;save(true);renderProperties();renderInventory();updateHUD();toast(`${p.name} purchased.`)}
  function renderSkills(){const el=$('#skillsList');if(!el)return;el.innerHTML=Object.entries(state.skills).map(([k,v])=>`<div class="statline"><span>${k[0].toUpperCase()+k.slice(1)}</span><b>LV ${Math.floor(v)}</b></div>`).join('')+`<div class="statline"><span>Jobs completed</span><b>${state.jobsDone}</b></div><div class="statline"><span>Total earned</span><b>${money(state.totalEarned)}</b></div>`}

  function createPlayer3D(){
    if(!threeReady||!scene)return;
    if(player)scene.remove(player);
    player=new THREE.Group(); player.position.set(state.x,0,state.z);
    const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.8});
    const leg1=new THREE.Mesh(new THREE.BoxGeometry(.42,.9,.42),mat(state.pants)); leg1.position.x=-.25;leg1.position.y=.45;
    const leg2=leg1.clone(); leg2.position.x=.25;
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.2,.6),mat(state.shirt)); body.position.y=1.45;
    const head=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),mat(state.skin)); head.position.y=2.35;
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,0,Math.PI/2),mat(state.hair)); hair.position.y=2.58;
    player.add(leg1,leg2,body,head,hair); player.traverse(o=>{if(o.isMesh)o.castShadow=true}); scene.add(player);
  }

  function init3D(){
    if(!window.THREE){threeReady=false;return;}
    try{
      threeReady=true;
      const canvas=$('#scene');
      scene=new THREE.Scene(); scene.background=new THREE.Color(0x8fb4d5); scene.fog=new THREE.Fog(0x8fb4d5,90,320);
      camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,700); camera.position.set(state.x,7,state.z+7);
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}); renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true;
      scene.add(new THREE.HemisphereLight(0xdcefff,0x2a352b,2.1));
      const sun=new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(-70,130,60); sun.castShadow=true; scene.add(sun);
      world=new THREE.Group(); scene.add(world);
      const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.85});
      const ground=new THREE.Mesh(new THREE.BoxGeometry(220,.5,220),mat(0x40553d));ground.position.y=-.35;ground.receiveShadow=true;world.add(ground);
      for(let i=-100;i<=100;i+=40){const a=new THREE.Mesh(new THREE.BoxGeometry(12,.08,220),mat(0x20252a));a.position.set(i,.02,0);world.add(a);const b=new THREE.Mesh(new THREE.BoxGeometry(220,.08,12),mat(0x20252a));b.position.set(0,.02,i);world.add(b)}
      const buildings=[[-55,70,20,16,11,0x253246], [55,70,22,16,13,0x3c2d2d], [-55,-70,22,16,10,0x293f4a], [55,-70,24,18,12,0x4c3d27], [0,-5,28,22,17,0x26404a], [90,0,18,18,8,0x4d3449], [-90,0,18,18,8,0x2b4f36]];
      buildings.forEach(([x,z,w,d,h,c])=>{const g=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));b.position.y=h/2;b.castShadow=true;b.receiveShadow=true;g.add(b);const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.5,.5,d+.5),mat(0x0b1118));roof.position.y=h+.25;g.add(roof);g.position.set(x,0,z);world.add(g)});
      createPlayer3D();
      window.addEventListener('resize',()=>{if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
    }catch(e){console.error(e);threeReady=false;renderer=null;toast('3D mode failed to start — menu still works.');}
  }
  function render3D(){
    if(!threeReady||!renderer||!scene||!camera||!player)return;
    const dt=Math.min((performance.now()-last)/1000,.05);
    const speed=(state.selectedVehicle? (vehicles.find(v=>v.id===state.selectedVehicle)?.speed||1.25):1)* (keys.ShiftLeft||keys.ShiftRight?14:9);
    let dx=0,dz=0;if(keys.KeyW||keys.ArrowUp)dz-=1;if(keys.KeyS||keys.ArrowDown)dz+=1;if(keys.KeyA||keys.ArrowLeft)dx-=1;if(keys.KeyD||keys.ArrowRight)dx+=1;
    if(dx||dz){const l=Math.hypot(dx,dz);dx/=l;dz/=l;state.x=Math.max(-104,Math.min(104,state.x+dx*speed*dt));state.z=Math.max(-104,Math.min(104,state.z+dz*speed*dt));player.position.x=state.x;player.position.z=state.z;player.rotation.y=Math.atan2(dx,dz);state.hunger=Math.max(0,state.hunger-dt*.4);if(keys.ShiftLeft||keys.ShiftRight)state.energy=Math.max(0,state.energy-dt*.5)}
    const target=new THREE.Vector3(state.x,1.5,state.z), desired=new THREE.Vector3(state.x+Math.sin(player.rotation.y)*7,4.3,state.z+Math.cos(player.rotation.y)*7); camera.position.lerp(desired,.1);camera.lookAt(target);renderer.render(scene,camera);
  }

  function drawBigMap(){
    const c=$('#bigMap'); if(!c)return; const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#121923';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#303b48';ctx.lineWidth=34;
    for(let i=-100;i<=100;i+=40){const x=(i+110)/220*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();const y=(i+110)/220*h;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    const pts=[[-55,70,'JOB'],[55,70,'CAR'],[-55,-70,'BANK'],[55,-70,'HOME'],[0,-5,'BIZ']];pts.forEach(([x,z,l])=>{const px=(x+110)/220*w,py=(z+110)/220*h;ctx.fillStyle='#60a5fa';ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.fillText(l,px+12,py+4)});
    const px=(state.x+110)/220*w,py=(state.z+110)/220*h;ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(px,py,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(state.name,px+12,py-8);
  }
  function openPhoneFromKeyboard(){openPanel('phone')}

  function bind(){
    $('#startBtn')?.addEventListener('click',()=>{hide('boot');show('creator');});
    $('#continueBtn')?.addEventListener('click',()=>{if(!load())return toast('No saved game yet.');startGame(true);});
    $('#createBtn')?.addEventListener('click',()=>{state.name=($('#nameInput')?.value||'Blayn').trim()||'Blayn';state.skin=$('#skinInput')?.value||state.skin;state.shirt=$('#shirtInput')?.value||state.shirt;state.pants=$('#pantsInput')?.value||state.pants;state.hair=$('#hairInput')?.value||state.hair;startGame(false);});
    ['skinInput','shirtInput','pantsInput','hairInput'].forEach(id=>$( '#'+id)?.addEventListener('change',updateCreatorPreview));
    $('#saveBtn')?.addEventListener('click',()=>save(false));
    $('#pauseBtn')?.addEventListener('click',togglePause);
    $('#resumeBtn')?.addEventListener('click',togglePause);
    $('#restartBtn')?.addEventListener('click',()=>{localStorage.removeItem(SAVE_KEY);location.reload();});
    $$('[data-panel]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.panel)));
    $$('.closePanel').forEach(b=>b.addEventListener('click',()=>closePanels()));
    window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyP')openPhoneFromKeyboard();if(e.code==='KeyM')openPanel('map');if(e.code==='Escape')togglePause();if(e.code==='KeyE')tryInteract();});
    window.addEventListener('keyup',e=>keys[e.code]=false);
  }
  function togglePause(){if(!started)return;paused=!paused;if(paused)show('pausePanel');else hide('pausePanel');}
  function tryInteract(){
    if(!started||paused)return;
    const nearJobCenter=Math.hypot(state.x+55,state.z-70)<10;
    if(nearJobCenter)openPanel('jobs');
    else if(Math.hypot(state.x-55,state.z-70)<10)openPanel('vehicle');
    else if(Math.hypot(state.x+55,state.z+70)<10){const amt=Math.floor(state.cash*.25);if(amt>0){state.cash-=amt;state.bank+=amt;updateHUD();toast(`Deposited ${money(amt)}.`)}else toast('You need cash first.');}
    else if(Math.hypot(state.x-55,state.z+70)<10)openPanel('property');
    else if(Math.hypot(state.x,state.z+5)<12)openPanel('business');
    else toast('Nothing nearby.');
  }

  function updateCreatorPreview(){
    const el=$('#previewAvatar'); if(!el)return;const skin=$('#skinInput')?.value||'#b97a58',shirt=$('#shirtInput')?.value||'#2563eb',pants=$('#pantsInput')?.value||'#1e293b',hair=$('#hairInput')?.value||'#171717';
    el.innerHTML=`<div style="position:absolute;left:50%;top:24px;transform:translateX(-50%);width:64px;height:64px;border-radius:50%;background:${skin};box-shadow:inset 0 12px 0 ${hair}"></div><div style="position:absolute;left:50%;top:82px;transform:translateX(-50%);width:94px;height:94px;border-radius:18px;background:${shirt}"></div><div style="position:absolute;left:50%;top:174px;transform:translateX(-50%);width:80px;height:60px;border-radius:14px;background:${pants}"></div>`;
  }
  function startGame(isContinue){
    if(!isContinue){state=Object.assign(stateDefault(),state,{name:state.name,skin:state.skin,shirt:state.shirt,pants:state.pants,hair:state.hair});}
    started=true;paused=false;activeJob=null;jobTarget=null;hide('boot');hide('creator');show('gameUI');
    try{init3D();}catch(e){console.error(e)}
    updateHUD(); updateCreatorPreview(); toast(isContinue?`Welcome back, ${state.name}.`:`Welcome, ${state.name}. Start at the JOB CENTER.`); save(true);
  }

  function loop(now){
    const dt=(now-last)/1000;last=now;
    if(started&&!paused){
      render3D();
      if(activeJob&&jobTarget&&Math.hypot(state.x-jobTarget.x,state.z-jobTarget.z)<6)finishJob();
      if(state.hunger<=10&&Math.floor(now/1000)%5===0)state.energy=Math.max(0,state.energy-.01);
      updateHUD();
    }
    requestAnimationFrame(loop);
  }

  bind(); load(); updateCreatorPreview();
  window.addEventListener('beforeunload',()=>{if(started)save(true)});
  requestAnimationFrame(loop);
})();
