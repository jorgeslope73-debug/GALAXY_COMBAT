'use strict';
(() => {
  const PHYSICS_CORE=window.GalaxyPhysicsCore;
  if(!PHYSICS_CORE)throw new Error('GalaxyPhysicsCore no cargado');
  const W=1920,H=1080,TICK_HZ=60,DT=1/TICK_HZ,STEP_MS=1000/TICK_HZ;
  const DRAG_PER_TICK=Math.pow(0.35,DT);
  const IDLE_CONTROL=Object.freeze({turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});
  const SCORE_TO_WIN=5;
  const SHIP_RADIUS=24,ASTEROID_RADIUS=45,GIANT_RADIUS=135,PICKUP_RADIUS=22,BULLET_RADIUS=4,MISSILE_HIT_RADIUS=12,SMALL_METEOR_RADIUS=14;
  const SPAWN_PROTECTION_SECONDS=3,SPAWN_MATERIALIZE_SECONDS=1.15,BRUTAL_SHOT_DISTANCE=850;
  const FLARE_HOLD_SECONDS=.22,FLARE_LIFE_SECONDS=3,FLARE_LAUNCH_COOLDOWN=.5,FLARE_RADIUS=12,FLARE_DECOY_TRIGGER=700;
  const FLARE_CPU_USE_COOLDOWN=.95,FLARE_CPU_KEEP_COOLDOWN=.42;
  const FLARE_CPU_MISSILE_REACTION_MIN=1,FLARE_CPU_MISSILE_REACTION_MAX=2;
  const CPU_ARMED_WARNING_SECONDS=1;
  const SHOCKWAVE_RADIUS=220,SHOCKWAVE_SAFE_DISTANCE=285,SHOCKWAVE_STANDOFF_DISTANCE=350;
  const UFO_RADIUS=30,UFO_HP=1,UFO_FIRST_MIN=35,UFO_FIRST_MAX=60,UFO_REPEAT_MIN=75,UFO_REPEAT_MAX=120;
  const ASTEROID_STARTS=[
    [160,430,300,1],[30,930,10,3],[1800,30,210,4],
    [1500,150,160,2],[1300,430,200,6]
  ];
  const ASTEROID_MAX_ACTIVE=5;
  let nextEntityId=1;
  const uid=()=>nextEntityId++;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const randint=(a,b)=>Math.floor(rand(a,b+1));
  const dist2=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;};
  const circles=(a,ar,b,br)=>{const rr=ar+br;return dist2(a,b)<=rr*rr;};
  // Colision continua barata: trabaja con distancias al cuadrado, evita sqrt y
  // descarta primero por la caja del segmento. Solo añade una division cuando
  // el movimiento realmente puede cruzar el radio de colision.
  const prevX=o=>Number.isFinite(o&&o.px)?o.px:o.x;
  const prevY=o=>Number.isFinite(o&&o.py)?o.py:o.y;
  const wrapDelta=(d,size)=>d>size*.5?d-size:(d<-size*.5?d+size:d);
  const sweptCircles=(a,ar,b,br,wrap=false)=>{
    const rr=ar+br,rr2=rr*rr;
    const ax1=a.x,ay1=a.y,bx1=b.x,by1=b.y;
    const ax0=prevX(a),ay0=prevY(a),bx0=prevX(b),by0=prevY(b);
    let r0x,r0y,r1x,r1y;
    if(wrap){
      r0x=wrapDelta(bx0-ax0,W);r0y=wrapDelta(by0-ay0,H);
      const raw1x=wrapDelta(bx1-ax1,W),raw1y=wrapDelta(by1-ay1,H);
      r1x=r0x+wrapDelta(raw1x-r0x,W);r1y=r0y+wrapDelta(raw1y-r0y,H);
    }else{
      // Si alguno acaba de atravesar un borde con wrap, no trazamos una linea
      // gigante por toda la arena: en ese unico tick usamos el solape final.
      if(Math.abs(ax1-ax0)>W*.5||Math.abs(ay1-ay0)>H*.5||Math.abs(bx1-bx0)>W*.5||Math.abs(by1-by0)>H*.5)return circles(a,ar,b,br);
      r0x=bx0-ax0;r0y=by0-ay0;r1x=bx1-ax1;r1y=by1-ay1;
    }
    if(r1x*r1x+r1y*r1y<=rr2||r0x*r0x+r0y*r0y<=rr2)return true;
    if((r0x>rr&&r1x>rr)||(r0x<-rr&&r1x<-rr)||(r0y>rr&&r1y>rr)||(r0y<-rr&&r1y<-rr))return false;
    const vx=r1x-r0x,vy=r1y-r0y,vv=vx*vx+vy*vy;
    if(vv<=1e-9)return false;
    const t=-(r0x*vx+r0y*vy)/vv;
    if(t<=0||t>=1)return false;
    const cx=r0x+vx*t,cy=r0y+vy*t;
    return cx*cx+cy*cy<=rr2;
  };
  const dirFromRot=rot=>{const r=rot*Math.PI/180;return{x:-Math.sin(r),y:-Math.cos(r)};};
  const normalize=(x,y)=>{const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};};
  const round1=v=>Math.round(v*10)/10,round2=v=>Math.round(v*100)/100,round3=v=>Math.round(v*1000)/1000;
  // Si la inercia actual ya atraviesa un pickup, la CPU deja de acelerar y
  // entra recta por deslizamiento. Solo se cancela si hay un obstaculo peligroso
  // dentro de ese corredor antes de llegar al objeto.
  const pickupRunThroughPlan=(cpu,pk,asteroids,meteors,giant,players)=>{
    if(!cpu||!pk)return null;
    const dx=pk.x-cpu.x,dy=pk.y-cpu.y,d2=dx*dx+dy*dy;
    if(d2<1)return{clear:true,aligned:true,x:pk.x,y:pk.y};
    const distance=Math.sqrt(d2),ux=dx/distance,uy=dy/distance;
    const vx=Number(cpu.vx)||0,vy=Number(cpu.vy)||0,speed2=vx*vx+vy*vy,speed=Math.sqrt(speed2);
    // El punto de mira queda detras del pickup para obligar a atravesarlo.
    // A mayor velocidad, mayor margen de salida para que no empiece a girar antes de recogerlo.
    const overshoot=95+Math.min(95,speed*.24);
    const tx=pk.x+ux*overshoot,ty=pk.y+uy*overshoot;
    const sx=tx-cpu.x,sy=ty-cpu.y,seg2=sx*sx+sy*sy||1;
    const hazard=(h,r)=>{
      if(!h)return false;
      const hx=h.x-cpu.x,hy=h.y-cpu.y;
      const t=(hx*sx+hy*sy)/seg2;
      if(t<=0||t>=1)return false;
      const cx=hx-sx*t,cy=hy-sy*t;
      const rr=SHIP_RADIUS+r+12;
      return cx*cx+cy*cy<=rr*rr;
    };
    for(const a of asteroids)if(hazard(a,a.r||ASTEROID_RADIUS))return{clear:false,aligned:false,x:pk.x,y:pk.y};
    for(const m of meteors)if(hazard(m,m.r||SMALL_METEOR_RADIUS))return{clear:false,aligned:false,x:pk.x,y:pk.y};
    if(giant&&hazard(giant,giant.r||GIANT_RADIUS))return{clear:false,aligned:false,x:pk.x,y:pk.y};
    for(const p of players){
      if(!p||p===cpu||p.dead)continue;
      if(hazard(p,SHIP_RADIUS))return{clear:false,aligned:false,x:pk.x,y:pk.y};
    }
    let aligned=false;
    if(speed2>30*30){
      const vux=vx/speed,vuy=vy/speed,along=dx*vux+dy*vuy;
      const capture=SHIP_RADIUS+PICKUP_RADIUS-5;
      const lateral2=Math.max(0,d2-along*along);
      aligned=along>0&&lateral2<=capture*capture;
    }
    return{clear:true,aligned,x:tx,y:ty};
  };
  const safeName=(v,fallback='JUGADOR')=>{
    const s=String(v||'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16);
    return s||fallback;
  };
  function spawnArea(index){
    const left=index%2===0,top=index<2;
    const panelX=left?10:W-216,panelY=top?5:H-190,centerX=panelX+64,gap=90,spreadY=100;
    const nearY=top?panelY+153+28+SHIP_RADIUS+gap:panelY-SHIP_RADIUS-gap;
    return{
      minX:Math.max(SHIP_RADIUS+12,centerX-28),
      maxX:Math.min(W-SHIP_RADIUS-12,centerX+28),
      minY:top?nearY:nearY-spreadY,
      maxY:top?nearY+spreadY:nearY,
      rot:left?270:90
    };
  }

  class GalaxyHostPhysics{
    constructor({onState,onEvent,code='P2P',rankRound=1,rankHostToken='',hostEpoch=1}={}){
      this.onState=typeof onState==='function'?onState:()=>{};
      this.onEvent=typeof onEvent==='function'?onEvent:()=>{};
      this.code=String(code||'P2P');
      this.rankRound=Math.max(1,Number(rankRound)||1);
      this.rankHostToken=String(rankHostToken||'');
      this.hostEpoch=Math.max(1,Number(hostEpoch)||1);
      this.rankReportSent=false;
      this.rankReportAttempts=0;
      this.players=[];
      this.controls=new Map();
      this.destroyedProjectileScratch=new Set();
      // V19.79 PERF-2: array temporal reutilizable. Evita crear un filter()
      // nuevo 60 veces por segundo para localizar las CPU de la sala.
      this.cpuScratch=[];
      this.started=false;
      this.finished=false;
      this.winner=null;
      this.difficulty='medio';
      this.huntTargetIndex=-1;
      this.huntUntil=0;
      this.huntStartsAt=0;
      this.huntThresholdActive=false;
      this.seq=0;
      this.fxClock=0;
      this.fxSeq=0;
      this.fxEvents=[];
      this.fxLastHit=new Map();
      this.bullets=[];
      this.flares=[];
      this.pickups=[];
      this.activeShockwaves=[];
      this.meteors=[];
      this.giant=null;
      this.ufo=null;
      this.asteroids=[];
      this.nextPickup=1;
      this.firstShower=rand(150,210);
      this.showerLeft=0;
      this.nextMeteor=0;
      this.nextShower=0;
      this.noDeathTime=0;
      // V21.37 ONLINE: ciclo ambiental progresivo. Solo reinicia peligros,
      // nunca jugadores, bajas, armamento ni puntuacion.
      this.hazardCycleAge=0;
      this.hazardCycleDuration=360;
      this.nextGiant=999999;
      this.nextUfo=999999;
      this.lastNow=0;
      this.accumulator=0;
      this.tickCount=0;
      this.perfDebug=typeof location!=='undefined'&&new URLSearchParams(location.search).get('debug')==='1';
      this.perfTickMs=0;this.perfTickMax=0;this.perfTicks=0;this.perfCatchupDrops=0;
      this.resetAsteroids();
    }
    emit(msg){try{this.onEvent(msg);}catch(_){}}
    hazardStage(){
      const t=Math.max(0,Number(this.hazardCycleAge)||0);
      // Fases con descansos intermedios. El tope sigue siendo 5 asteroides.
      if(t<60)return {asteroids:1,shower:false,giant:false,ufo:false,rest:false};
      if(t<120)return {asteroids:2,shower:false,giant:false,ufo:false,rest:false};
      if(t<165)return {asteroids:3,shower:false,giant:false,ufo:false,rest:false};
      if(t<195)return {asteroids:2,shower:false,giant:false,ufo:false,rest:true};
      if(t<240)return {asteroids:3,shower:false,giant:true,ufo:false,rest:false};
      if(t<285)return {asteroids:4,shower:true,giant:true,ufo:true,rest:false};
      if(t<315)return {asteroids:2,shower:false,giant:false,ufo:false,rest:true};
      return {asteroids:5,shower:true,giant:true,ufo:true,rest:false};
    }
    hazardProfile(){
      const stage=this.hazardStage();
      return{
        asteroidMin:stage.asteroids,
        asteroidInitialMin:12,asteroidInitialMax:18,
        asteroidRespawnMin:5,asteroidRespawnMax:11,
        asteroidPopulationMin:18,asteroidPopulationMax:30,
        firstShowerMin:18,firstShowerMax:28,
        showerRepeatMin:55,showerRepeatMax:85,
        showerDuration:stage.rest?0:7,
        meteorIntervalMin:.32,meteorIntervalMax:.48
      };
    }
    resetHazardCycle(){
      this.hazardCycleAge=0;
      this.meteors=[];
      // V21.93: el reinicio del ciclo tampoco hace desaparecer un gigante
      // que ya este atravesando la escena; terminara su salida normalmente.
      this.ufo=null;
      this.showerLeft=0;
      this.nextMeteor=0;
      this.firstShower=999999;
      this.nextShower=0;
      this.nextGiant=999999;
      this.nextUfo=999999;
      this.resetAsteroids();
    }
    updateHazardCycle(dt){
      this.hazardCycleAge=(Number(this.hazardCycleAge)||0)+dt;
      if(this.hazardCycleAge>=this.hazardCycleDuration){
        this.resetHazardCycle();
        return;
      }
      const stage=this.hazardStage();
      const target=clamp(Number(stage.asteroids)||1,1,ASTEROID_MAX_ACTIVE);
      if(this.asteroidTargetCount!==target){
        this.asteroidTargetCount=target;
        if(this.asteroids.length<target)this.nextAsteroidSpawn=Math.min(this.nextAsteroidSpawn,3);
        else if(this.asteroids.length>target){
          const excess=this.asteroids.length-target;
          const candidates=this.asteroids.filter(a=>!a.exiting&&a.exitDelay<0);
          for(let i=0;i<Math.min(excess,candidates.length);i++)candidates[i].exitDelay=rand(.5,2.5);
        }
      }
      if(stage.shower&&this.firstShower>900000&&this.nextShower<=0)this.firstShower=rand(18,28);
      if(!stage.shower){this.firstShower=999999;this.nextShower=0;this.showerLeft=0;this.meteors=[];}
      if(stage.giant&&this.nextGiant>900000&&!this.giant)this.nextGiant=rand(12,24);
      // V21.93: al terminar una fase con gigante no borramos el que ya esta
      // cruzando la pantalla. Solo bloqueamos nuevas apariciones.
      if(!stage.giant)this.nextGiant=999999;
      if(stage.ufo&&this.nextUfo>900000&&!this.ufo)this.nextUfo=rand(18,32);
      if(!stage.ufo){this.nextUfo=999999;this.ufo=null;}
    }
    resetAsteroids(){
      // V19.54: el primer asteroide entra desde un borde y trayectoria aleatorios.
      const profile=this.hazardProfile();
      this.asteroids=[];
      this.spawnAsteroidFromEdge(randint(0,ASTEROID_STARTS.length-1),true);
      this.nextAsteroidIndex=1;
      this.nextAsteroidSpawn=rand(profile.asteroidInitialMin,profile.asteroidInitialMax);
      this.asteroidRampComplete=true;
      this.asteroidTargetCount=clamp(Number(this.hazardStage().asteroids)||1,1,ASTEROID_MAX_ACTIVE);
      this.nextAsteroidPopulationChange=999999;
    }
    spawnAsteroidFromEdge(templateIndex,fullyRandom=false){
      const idx=clamp(Math.round(Number(templateIndex)||0),0,ASTEROID_STARTS.length-1);
      let [targetX,targetY,rot,type]=ASTEROID_STARTS[idx];
      const edge=ASTEROID_RADIUS*2;
      let start;
      if(fullyRandom){
        targetX=rand(W*.18,W*.82);
        targetY=rand(H*.18,H*.82);
        const side=randint(0,3);
        if(side===0)start={x:-edge,y:rand(60,H-60)};
        else if(side===1)start={x:W+edge,y:rand(60,H-60)};
        else if(side===2)start={x:rand(60,W-60),y:-edge};
        else start={x:rand(60,W-60),y:H+edge};
        rot=rand(0,360);
      }else{
        const choices=[
          {d:targetX,x:-edge,y:clamp(targetY+rand(-110,110),70,H-70)},
          {d:W-targetX,x:W+edge,y:clamp(targetY+rand(-110,110),70,H-70)},
          {d:targetY,x:clamp(targetX+rand(-150,150),70,W-70),y:-edge},
          {d:H-targetY,x:clamp(targetX+rand(-150,150),70,W-70),y:H+edge}
        ];
        choices.sort((a,b)=>a.d-b.d);
        start=choices[0];
      }
      const n=normalize(targetX-start.x,targetY-start.y);
      this.asteroids.push({
        id:uid(),x:start.x,y:start.y,rot,type,
        vx:n.x*80,vy:n.y*80,r:ASTEROID_RADIUS,exiting:false,exitDelay:-1
      });
    }
    resolveAsteroidPairCollision(a,b){
      return PHYSICS_CORE.resolveAsteroidPairCollision(a,b,ASTEROID_RADIUS,190);
    }
    resolveGiantAsteroidCollision(g,a){
      return PHYSICS_CORE.resolveGiantAsteroidCollision(g,a,GIANT_RADIUS,ASTEROID_RADIUS,190);
    }
    splitAsteroidByMissile(asteroid,ownerIndex=-1,impactX=null,impactY=null){
      if(!asteroid)return false;
      const index=this.asteroids.indexOf(asteroid);
      if(index<0)return false;

      const result=PHYSICS_CORE.asteroidMissileFracture(asteroid,impactX,impactY,{
        defaultRadius:ASTEROID_RADIUS,
        fragmentRadius:28,
        rand,
        uid
      });
      if(!result)return false;

      this.asteroids.splice(index,1);
      if(result.fragments&&result.fragments.length){
        for(const fragment of result.fragments)this.asteroids.push(fragment);
      }

      const owner=Number.isInteger(ownerIndex)?ownerIndex:-1;
      this.emitExplosionAt(result.destroyOnly?result.hitX:result.x,result.destroyOnly?result.hitY:result.y,owner);
      this.emitAsteroidDustAt(result.hitX,result.hitY,owner);
      this.emit({t:'sound',kind:'impact'});
      return true;
    }
    asteroidPopulationUnits(){
      let normal=0;
      const groups=new Set();
      for(const a of this.asteroids){
        if(!a)continue;
        if(a.fragment===true){
          if(a.fragmentGroup)groups.add(String(a.fragmentGroup));
          else groups.add('fragment-'+String(a.id));
        }else if(!a.exiting)normal++;
      }
      return normal+groups.size;
    }
    normalAsteroidCount(){
      let count=0;
      for(const a of this.asteroids)if(a&&a.fragment!==true&&!a.exiting)count++;
      return count;
    }
    spawnProgressiveAsteroid(){
      if(this.asteroidPopulationUnits()>=ASTEROID_MAX_ACTIVE){
        const profile=this.hazardProfile();
        this.asteroidRampComplete=true;
        this.asteroidTargetCount=ASTEROID_MAX_ACTIVE;
        this.nextAsteroidSpawn=999999;
        this.nextAsteroidPopulationChange=rand(profile.asteroidPopulationMin,profile.asteroidPopulationMax);
        return;
      }
      const profile=this.hazardProfile();
      this.spawnAsteroidFromEdge(this.nextAsteroidIndex);
      this.nextAsteroidIndex++;
      if(this.asteroidPopulationUnits()>=ASTEROID_MAX_ACTIVE){
        this.asteroidRampComplete=true;
        this.asteroidTargetCount=ASTEROID_MAX_ACTIVE;
        this.nextAsteroidSpawn=999999;
        this.nextAsteroidPopulationChange=rand(profile.asteroidPopulationMin,profile.asteroidPopulationMax);
      }else{
        this.nextAsteroidSpawn=rand(profile.asteroidInitialMin,profile.asteroidInitialMax);
      }
    }
    beginAsteroidExit(a){
      if(!a||a.exiting)return;
      const edge=ASTEROID_RADIUS*3;
      const targets=[
        {x:-edge,y:rand(50,H-50)},{x:W+edge,y:rand(50,H-50)},
        {x:rand(50,W-50),y:-edge},{x:rand(50,W-50),y:H+edge}
      ];
      const target=targets[randint(0,targets.length-1)];
      const n=normalize(target.x-a.x,target.y-a.y);
      a.exiting=true;a.exitDelay=-1;a.vx=n.x*90;a.vy=n.y*90;
    }
    chooseAsteroidPopulation(){
      const current=this.asteroidPopulationUnits();
      const profile=this.hazardProfile();
      const minAsteroids=clamp(Math.round(Number(profile.asteroidMin)||1),1,ASTEROID_MAX_ACTIVE);
      let target=randint(minAsteroids,ASTEROID_MAX_ACTIVE);
      if(target===current){
        if(minAsteroids===ASTEROID_MAX_ACTIVE)target=ASTEROID_MAX_ACTIVE;
        else if(current>=ASTEROID_MAX_ACTIVE)target=randint(minAsteroids,ASTEROID_MAX_ACTIVE-1);
        else target=Math.max(minAsteroids,current+1);
      }
      this.asteroidTargetCount=target;
      this.nextAsteroidPopulationChange=rand(profile.asteroidPopulationMin,profile.asteroidPopulationMax);
      if(target<current){
        const pool=this.asteroids.filter(a=>a&&a.fragment!==true&&!a.exiting);
        for(let i=pool.length-1;i>0;i--){
          const j=randint(0,i),tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;
        }
        const leaving=current-target;
        for(let i=0;i<leaving;i++)pool[i].exitDelay=rand(i*2.2,i*2.2+5.5);
        this.nextAsteroidSpawn=999999;
      }else{
        this.nextAsteroidSpawn=rand(profile.asteroidRespawnMin,profile.asteroidRespawnMax);
      }
    }
    updateAsteroidPopulation(){
      const profile=this.hazardProfile();
      const target=clamp(Number(this.asteroidTargetCount)||1,1,ASTEROID_MAX_ACTIVE);
      const transitioning=this.asteroids.some(a=>a.exiting||a.exitDelay>=0);
      if(!transitioning&&this.asteroids.length<target){
        this.nextAsteroidSpawn-=DT;
        if(this.nextAsteroidSpawn<=0){
          this.spawnAsteroidFromEdge(this.nextAsteroidIndex++);
          this.nextAsteroidSpawn=rand(profile.asteroidInitialMin,profile.asteroidInitialMax);
        }
      }
    }
    makePlayer(index,name,cpu){
      return{
        index,name:safeName(name,cpu?'CPU':'JUGADOR '+(index+1)),cpu,
        x:0,y:0,rot:0,vx:0,vy:0,thrust:false,
        bullets:5,cadence:30,speed:1,kills:0,deaths:0,
        reload:0,shield:0,camo:0,protection:SPAWN_PROTECTION_SECONDS,spawnFx:SPAWN_MATERIALIZE_SECONDS,spawnAnchorX:0,spawnAnchorY:0,
        guided:false,guidedTarget:-1,guidedAmmo:0,joystickRocketHeld:false,flare:0,flareHold:0,flareGesture:false,specialReleaseLock:false,shockwave:false,shockReachAt:0,shockExplodeAt:0,shockOwner:-1,flarePending:null,nextFlareDecision:0,nextFlareAllowed:0,
        dead:false,respawn:0,lastControlAt:Date.now(),lastSpawn:null,
        cpuFireDelay:cpu?CPU_ARMED_WARNING_SECONDS:0,
        difficulty:this.difficulty,aiControl:null
      };
    }
    start(playerList=[]){
      const list=(Array.isArray(playerList)?playerList:[]).filter(p=>p&&Number.isInteger(Number(p.i))).slice(0,4);
      if(list.length<2)return false;
      this.players=[];
      this.controls.clear();
      this.seq=0;this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;this.ufo=null;this.activeShockwaves=[];
      this.nextPickup=1;this.firstShower=999999;this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.hazardCycleAge=0;this.hazardCycleDuration=360;this.nextGiant=999999;this.nextUfo=999999;
      this.rankReportSent=false;this.rankReportAttempts=0;
      this.huntTargetIndex=-1;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const item of list){
        const index=Number(item.i),isCpu=!!item.cpu;
        const player=this.makePlayer(index,item.n||(isCpu?'CPU '+(index+1):'JUGADOR '+(index+1)),isCpu);
        if(isCpu)player.difficulty='dificil';
        this.placeAtSpawn(player);
        this.players.push(player);
        this.controls.set(index,{turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});
      }
      this.players.sort((a,b)=>a.index-b.index);
      this.started=true;this.finished=false;this.winner=null;
      this.lastNow=0;this.accumulator=0;this.tickCount=0;
      return true;
    }
    stop(){this.started=false;this.lastNow=0;this.accumulator=0;}
    setControl(index,turn,thrust,fire,actions={}){
      const i=Number(index),p=this.players.find(x=>x.index===i);
      if(!p||p.cpu)return false;
      let c=this.controls.get(i);
      if(!c){c={turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false};this.controls.set(i,c);}
      const seq=Math.max(0,Number(actions&&actions.controlSeq)||0);
      if(seq>0){
        const last=Math.max(0,Number(c.controlSeq)||0);
        if(seq<=last)return false;
        c.controlSeq=seq;
      }
      c.turn=clamp(Number(turn)||0,-1,1);c.thrust=!!thrust;c.fire=!!fire;c.directFire=actions.directFire===true;
      c.rocket=actions.rocket===true;c.flare=actions.flare===true;c.shock=actions.shock===true;
      p.lastControlAt=Date.now();
      return true;
    }
    resetControlSequence(index){
      const c=this.controls.get(Number(index));
      if(!c)return false;
      c.controlSeq=0;
      c.rocketPulse=false;c.flarePulse=false;c.shockPulse=false;
      if(c.actionIds)c.actionIds={rocket:0,flare:0,shock:0};
      return true;
    }
    applyInputAction(index,kind,actionId){
      const i=Number(index),p=this.players.find(x=>x.index===i);
      if(!p||p.cpu)return false;
      const action=String(kind||'');
      if(!['rocket','flare','shock'].includes(action))return false;
      let c=this.controls.get(i);
      if(!c){c={turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false};this.controls.set(i,c);}
      if(!c.actionIds)c.actionIds={rocket:0,flare:0,shock:0};
      const id=Math.max(1,Number(actionId)||1);
      if(id<=Math.max(0,Number(c.actionIds[action])||0))return false;
      c.actionIds[action]=id;
      c[action+'Pulse']=true;
      p.lastControlAt=Date.now();
      return true;
    }
    syncRoster(playerList=[]){
      const list=(Array.isArray(playerList)?playerList:[]).filter(x=>x&&Number.isInteger(Number(x.i))).slice(0,4);
      let changed=false;

      // El roster recibido del servidor es la autoridad. Si un humano abandona
      // una partida sin CPU, su plaza deja de existir y debe desaparecer tambien
      // de la fisica, del HUD y de cualquier proyectil/objetivo asociado.
      const activeIndices=new Set(list.map(item=>Number(item.i)));
      const removedIndices=this.players.filter(p=>!activeIndices.has(p.index)).map(p=>p.index);
      if(removedIndices.length){
        const removedSet=new Set(removedIndices);
        this.players=this.players.filter(p=>!removedSet.has(p.index));
        this.bullets=this.bullets.filter(b=>!removedSet.has(Number(b.owner)));
        for(const index of removedIndices)this.controls.delete(index);
        for(const p of this.players){
          if(removedSet.has(Number(p.guidedTarget))){
            p.guidedTarget=-1;
            p.guided=false;
          }
        }
        if(removedSet.has(Number(this.huntTargetIndex))){
          this.huntTargetIndex=-1;
          this.huntUntil=0;
          this.huntStartsAt=0;
          this.huntThresholdActive=false;
        }
        changed=true;
      }

      for(const item of list){
        const index=Number(item.i),isCpu=!!item.cpu;
        let p=this.players.find(x=>x.index===index);
        if(!p){
          p=this.makePlayer(index,item.n||(isCpu?'CPU '+(index+1):'JUGADOR '+(index+1)),isCpu);
          if(isCpu)p.difficulty='dificil';
          this.placeAtSpawn(p);this.players.push(p);this.controls.set(index,{turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});changed=true;continue;
        }
        const wasCpu=!!p.cpu;
        const nextName=safeName(item.n||(isCpu?'CPU '+(index+1):'JUGADOR '+(index+1)),isCpu?'CPU':'JUGADOR '+(index+1));
        if(wasCpu&&!isCpu){
          // V20.8: relevo atomico CPU -> HUMANO.
          // No reutilizamos el objeto de la CPU: desaparece por completo junto
          // con su IA, decisiones temporales y cualquier control residual.
          this.bullets=this.bullets.filter(b=>Number(b.owner)!==index);
          this.flares=this.flares.filter(flare=>Number(flare.owner)!==index);
          this.controls.delete(index);

          const human=this.makePlayer(index,nextName,false);
          human.difficulty=this.difficulty;
          human.aiControl=null;
          human.lastControlAt=0;
          this.placeAtSpawn(human);

          const slot=this.players.indexOf(p);
          if(slot>=0)this.players[slot]=human;
          else this.players.push(human);
          this.controls.set(index,{turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});

          // Si la CPU sustituida era objetivo de una decision de caza de IA,
          // se recalculara en el siguiente tick usando ya la entidad humana.
          if(Number(this.huntTargetIndex)===index){
            this.huntTargetIndex=-1;
            this.huntUntil=0;
            this.huntStartsAt=0;
            this.huntThresholdActive=false;
          }
          changed=true;
          continue;
        }
        if(wasCpu!==isCpu||p.name!==nextName){
          p.cpu=isCpu;p.name=nextName;p.difficulty=isCpu?'dificil':this.difficulty;p.aiControl=null;
          p.lastControlAt=Date.now();this.controls.set(index,{turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});
          changed=true;
        }
      }
      this.players.sort((a,b)=>a.index-b.index);
      if(changed)this.onState(this.publicState());
      return changed;
    }
    handleMessage(msg){
      if(!msg||typeof msg!=='object')return true;
      if(msg.t==='ctrl'){this.setControl(msg.i,msg.turn,msg.thrust,msg.fire,msg);return true;}
      if(msg.t==='restart'){
        if(this.restart()){
          this.emit({t:'restarted',rankRound:this.rankRound});
          this.onState(this.publicState());
        }
        return true;
      }
      if(msg.t==='leave'){this.stop();return true;}
      return true;
    }
    advance(now){
      if(!this.started||this.finished)return;
      if(!Number.isFinite(now))now=performance.now();
      if(!this.lastNow){this.lastNow=now;return;}
      let elapsed=now-this.lastNow;this.lastNow=now;
      if(!Number.isFinite(elapsed)||elapsed<0)elapsed=STEP_MS;
      this.accumulator+=Math.min(100,elapsed);
      let steps=0,publishState=false;
      while(this.accumulator>=STEP_MS&&steps<5){
        const perfStart=this.perfDebug?performance.now():0;
        this.update(DT);
        if(this.perfDebug){
          const tickMs=performance.now()-perfStart;
          this.perfTickMs+=tickMs;this.perfTicks++;
          if(tickMs>this.perfTickMax)this.perfTickMax=tickMs;
        }
        this.accumulator-=STEP_MS;
        this.tickCount++;
        // V20.16 PERF: publicar estado cada 3 ticks = 20 snapshots/s.
        // La simulacion sigue ejecutando todos los ticks a 60 Hz.
        if((this.tickCount%3)===0||this.finished)publishState=true;
        steps++;
        if(this.finished)break;
      }
      if(steps===5&&this.accumulator>=STEP_MS){
        if(this.perfDebug)this.perfCatchupDrops++;
        this.accumulator%=STEP_MS;
      }
      // Si el navegador llega tarde podemos recuperar varios ticks de fisica
      // en esta llamada. Construir un snapshot por cada tick recuperado creaba
      // arrays/objetos temporales justo cuando el frame ya iba retrasado.
      // Publicamos solo el estado final mas reciente.
      if(publishState)this.onState(this.publicState());
    }
    restart(){
      if(!this.finished||this.players.length<2)return false;
      this.started=false;this.finished=false;this.winner=null;this.seq=0;this.rankReportSent=false;
      this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;this.ufo=null;this.activeShockwaves=[];
      this.nextPickup=1;this.firstShower=999999;this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.hazardCycleAge=0;this.hazardCycleDuration=360;this.nextGiant=999999;this.nextUfo=999999;
      this.huntTargetIndex=-1;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const p of this.players)p.dead=true;
      for(const p of this.players){
        p.bullets=5;p.cadence=30;p.speed=1;p.kills=0;p.deaths=0;p.reload=0;p.guided=false;p.guidedTarget=-1;p.guidedAmmo=0;p.joystickRocketHeld=false;p.flare=0;p.flareHold=0;p.flareGesture=false;p.specialReleaseLock=false;p.shockwave=false;p.shockReachAt=0;p.shockExplodeAt=0;p.shockOwner=-1;p.flarePending=null;p.nextFlareDecision=0;p.nextFlareAllowed=0;
        p.shield=0;p.camo=0;p.spawnFx=SPAWN_MATERIALIZE_SECONDS;p.protection=SPAWN_PROTECTION_SECONDS;p.respawn=0;
        p.lastControlAt=Date.now();p.lastSpawn=null;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
        this.controls.set(p.index,{turn:0,thrust:false,fire:false,controlSeq:0,rocketPulse:false,flarePulse:false,shockPulse:false});
        this.placeAtSpawn(p);p.dead=false;
      }
      this.started=true;this.lastNow=0;this.accumulator=0;this.tickCount=0;
      this.rankRound=Math.max(1,Number(this.rankRound)||1)+1;
      return true;
    }
    reportRankedVictory(winnerIndex){
      if(this.rankReportSent||this.code==='LOCAL')return;
      const base=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').replace(/\/$/,'');
      if(!base||!this.rankHostToken)return;
      this.rankReportSent=true;
      this.rankReportAttempts++;
      const retry=()=>{
        if(this.rankReportAttempts>=3)return;
        this.rankReportSent=false;
        setTimeout(()=>{
          if(this.finished&&Number(this.winner)===Number(winnerIndex))this.reportRankedVictory(winnerIndex);
        },1200*this.rankReportAttempts);
      };
      try{
        fetch(base+'/api/rank-result',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            roomCode:this.code,
            winnerIndex:Number(winnerIndex),
            rankRound:this.rankRound,
            hostToken:this.rankHostToken
          }),
          cache:'no-store',keepalive:true
        }).then(res=>{
          if(!res.ok)throw new Error('HTTP '+res.status);
          return res.json().catch(()=>({ok:true}));
        }).catch(err=>{
          console.warn('[Galaxy Combat] No se pudo registrar el resultado:',err&&err.message||err);
          retry();
        });
      }catch(err){
        console.warn('[Galaxy Combat] Error enviando resultado:',err&&err.message||err);
        retry();
      }
    }
    emitShipImpact(player,source=null,destroyed=false){
      if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y))return;
      if(player.dead&&!destroyed)return;
      if(!destroyed){
        const last=this.fxLastHit.get(player.index);
        if(last!==undefined&&this.fxClock-last<0.18)return;
        this.fxLastHit.set(player.index,this.fxClock);
      }
      let x=player.x,y=player.y;
      if(!destroyed&&source&&Number.isFinite(source.x)&&Number.isFinite(source.y)){
        const n=normalize(source.x-x,source.y-y);x+=n.x*SHIP_RADIUS;y+=n.y*SHIP_RADIUS;
      }
      this.fxEvents.push({
        id:++this.fxSeq,i:player.index,x:+x.toFixed(1),y:+y.toFixed(1),
        kind:destroyed?'explosion':'hit',hidden:!destroyed&&player.camo>0,at:this.fxClock
      });
      if(this.fxEvents.length>32)this.fxEvents.splice(0,this.fxEvents.length-32);
    }
    emitExplosionAt(x,y,ownerIndex=0){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const i=Number.isInteger(ownerIndex)&&ownerIndex>=0&&ownerIndex<4?ownerIndex:0;
      this.fxEvents.push({
        id:++this.fxSeq,i,x:+x.toFixed(1),y:+y.toFixed(1),
        kind:'explosion',hidden:false,at:this.fxClock
      });
      if(this.fxEvents.length>32)this.fxEvents.splice(0,this.fxEvents.length-32);
    }
    emitRocketDisintegrateAt(x,y,ownerIndex=0){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const i=Number.isInteger(ownerIndex)&&ownerIndex>=0&&ownerIndex<4?ownerIndex:0;
      this.fxEvents.push({
        id:++this.fxSeq,i,x:+x.toFixed(1),y:+y.toFixed(1),
        kind:'disintegrate',hidden:false,at:this.fxClock
      });
      if(this.fxEvents.length>32)this.fxEvents.splice(0,this.fxEvents.length-32);
    }
    emitAsteroidDustAt(x,y,ownerIndex=0){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const i=Number.isInteger(ownerIndex)&&ownerIndex>=0&&ownerIndex<4?ownerIndex:0;
      this.fxEvents.push({
        id:++this.fxSeq,i,x:+x.toFixed(1),y:+y.toFixed(1),
        kind:'asteroidDust',hidden:false,at:this.fxClock
      });
      if(this.fxEvents.length>32)this.fxEvents.splice(0,this.fxEvents.length-32);
    }
    dropDefeatedLoadout(victim){
      if(!victim)return;
      const types=[];
      // V21.34: al abatir a un rival, su equipo reaparece como botin alrededor
      // del punto de muerte. Las muertes por entorno no llaman a esta funcion.
      if((Number(victim.bullets)||0)>0)types.push((Number(victim.bullets)||0)>=3?'ammo3':'ammo1');
      if((Number(victim.guidedAmmo)||0)>0||victim.guided)types.push('mira');
      if((Number(victim.flare)||0)>0)types.push('flare');
      if(victim.shockwave)types.push('shockwave');
      if((Number(victim.cadence)||30)<30)types.push('cadence');
      if((Number(victim.speed)||1)>1)types.push('speed');
      if((Number(victim.shield)||0)>0)types.push('shield');
      if((Number(victim.camo)||0)>0)types.push('camo');
      if(!types.length)return;
      const count=types.length;
      const base=Math.random()*Math.PI*2;
      for(let i=0;i<count;i++){
        const angle=base+(Math.PI*2*i/count);
        const radius=count===1?0:32+10*(i%2);
        this.pickups.push({
          id:uid(),type:types[i],
          x:clamp(victim.x+Math.cos(angle)*radius,70,W-70),
          y:clamp(victim.y+Math.sin(angle)*radius,70,H-70),
          phase:rand(0,Math.PI*2)
        });
      }
      // Permitimos temporalmente mas objetos cuando proceden de una baja,
      // pero mantenemos un limite razonable para no cargar la partida.
      while(this.pickups.length>12)this.pickups.shift();
    }
    destroyShip(victim,attacker=null,weaponTheft=false,scorePenalty=false){
      if(victim.dead||this.finished)return;
      if(victim.protection>0||victim.shield>0){this.emitShipImpact(victim,attacker,false);return;}
      victim.dead=true;victim.respawn=.7;victim.vx=victim.vy=0;victim.deaths++;
      // V21.28: una onda pertenece a la vida que la lanzo. Si esa nave muere,
      // su frente deja de tener fisica inmediatamente y no puede matar despues
      // de la explosion ni reactivarse cuando la nave reaparece.
      for(const wave of this.activeShockwaves){
        if(wave&&Number(wave.owner)===Number(victim.index))wave.cancelled=true;
      }
      if(victim.cpu)victim.flarePending=null;
      // V20.11: solo penalizan las muertes provocadas por el propio jugador,
      // por el entorno/choque o por una colision fisica marcada expresamente.
      // Ser abatido por la bala, misil o bengala de OTRO jugador no resta puntos.
      if(!attacker||attacker===victim||scorePenalty)victim.kills=Math.max(0,victim.kills-1);

      // V21.33: la embestida con escudo conserva su efecto de colision/baja,
      // pero ya no roba ni transfiere armamento o mejoras del rival.
      // V21.34: solo una baja causada por otro jugador deja el armamento del
      // derrotado repartido en el punto de muerte. Entorno/meteoritos no dejan botin.
      if(attacker&&attacker!==victim)this.dropDefeatedLoadout(victim);

      victim.bullets=0;victim.cadence=30;victim.speed=1;victim.shield=0;victim.camo=0;victim.reload=0;victim.guided=false;victim.guidedTarget=-1;victim.guidedAmmo=0;victim.joystickRocketHeld=false;victim.flareHold=0;victim.flareGesture=false;victim.specialReleaseLock=false;victim.shockwave=false;victim.shockReachAt=0;victim.shockExplodeAt=0;victim.shockOwner=-1;
      this.noDeathTime=0;this.emitShipImpact(victim,null,true);this.emit({t:'sound',kind:'impact'});
      if(attacker&&attacker!==victim){
        attacker.kills++;
        if(attacker.kills>=SCORE_TO_WIN){
          this.finished=true;this.winner=attacker.index;
          this.emit({t:'victory',winner:this.winner});
          this.reportRankedVictory(this.winner);
        }
      }
    }
    placeAtSpawn(p){
      const area=spawnArea(p.index);
      const obstacles=this.asteroids.map(a=>({x:a.x,y:a.y,r:a.r}));
      for(const m of this.meteors)obstacles.push({x:m.x,y:m.y,r:SMALL_METEOR_RADIUS});
      if(this.giant)obstacles.push({x:this.giant.x,y:this.giant.y,r:GIANT_RADIUS});
      for(const other of this.players)if(other.index!==p.index&&!other.dead)obstacles.push({x:other.x,y:other.y,r:SHIP_RADIUS});
      let best=null,bestScore=-Infinity;
      for(let attempt=0;attempt<24;attempt++){
        const candidate={x:rand(area.minX,area.maxX),y:rand(area.minY,area.maxY)};
        let clearance=Infinity;
        for(const o of obstacles)clearance=Math.min(clearance,Math.hypot(candidate.x-o.x,candidate.y-o.y)-SHIP_RADIUS-o.r-12);
        const tooSimilar=p.lastSpawn&&dist2(candidate,p.lastSpawn)<28*28;
        const score=(clearance>=0?10000:0)+Math.min(1000,clearance)-(tooSimilar?1000:0);
        if(score>bestScore){best=candidate;bestScore=score;}
        if(clearance>=0&&!tooSimilar){best=candidate;break;}
      }
      p.x=best.x;p.y=best.y;p.px=p.x;p.py=p.y;p.rot=area.rot;p.vx=0;p.vy=0;p.lastSpawn={x:p.x,y:p.y};p.spawnAnchorX=p.x;p.spawnAnchorY=p.y;
    }
    respawnPlayer(p){
      this.placeAtSpawn(p);p.dead=false;p.respawn=0;p.spawnFx=SPAWN_MATERIALIZE_SECONDS;p.protection=SPAWN_PROTECTION_SECONDS;
      p.bullets=1;p.cadence=30;p.speed=1;p.shield=0;p.camo=0;p.reload=this.reloadTime(p);p.guided=false;p.guidedTarget=-1;p.guidedAmmo=0;p.joystickRocketHeld=false;p.flareHold=0;p.flareGesture=false;p.specialReleaseLock=false;p.shockwave=false;p.shockReachAt=0;p.shockExplodeAt=0;p.shockOwner=-1;p.flarePending=null;p.nextFlareDecision=0;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
    }
    deployShockwave(p){
      if(!p||p.dead||!p.shockwave)return false;
      p.shockwave=false;
      const radius=SHOCKWAVE_RADIUS;
      const radius2=radius*radius;
      // V21.55: los meteoritos pequenos de la lluvia se destruyen cuando el
      // frente visible de la onda los alcanza. Solo limpiamos aqui los que ya
      // tocan el radio inicial para que ninguno quede atrapado dentro del aro.
      const initialMeteorReach=28+SMALL_METEOR_RADIUS;
      const initialMeteorReach2=initialMeteorReach*initialMeteorReach;
      for(let i=this.meteors.length-1;i>=0;i--){
        const m=this.meteors[i];
        const dx=m.x-p.x,dy=m.y-p.y;
        if(dx*dx+dy*dy<=initialMeteorReach2){
          this.emitRocketDisintegrateAt(m.x,m.y,p.index);
          this.meteors.splice(i,1);
        }
      }
      for(const a of this.asteroids){
        const dx=wrapDelta(a.x-p.x,W),dy=wrapDelta(a.y-p.y,H);
        const d2=dx*dx+dy*dy;
        if(d2<=radius2&&d2>1){
          const d=Math.sqrt(d2),strength=150*(1-d/radius)+55;
          a.vx+=(dx/d)*strength;a.vy+=(dy/d)*strength;
          a.x+=(dx/d)*5;a.y+=(dy/d)*5;
        }
      }
      if(!Array.isArray(this.activeShockwaves))this.activeShockwaves=[];
      this.activeShockwaves.push({
        owner:p.index,x:p.x,y:p.y,born:this.fxClock,prevRadius:28,hitMask:0,
        killCount:0,perfectNotified:false
      });
      if(this.giant){
        const g=this.giant,dx=wrapDelta(g.x-p.x,W),dy=wrapDelta(g.y-p.y,H),d2=dx*dx+dy*dy;
        if(d2<=radius2&&d2>1){
          const d=Math.sqrt(d2),strength=48*(1-d/radius)+18;
          g.vx+=(dx/d)*strength;g.vy+=(dy/d)*strength;
        }
      }
      this.fxEvents.push({id:++this.fxSeq,i:p.index,x:+p.x.toFixed(1),y:+p.y.toFixed(1),kind:'shockwave',hidden:false,at:this.fxClock});
      if(this.fxEvents.length>32)this.fxEvents.splice(0,this.fxEvents.length-32);
      this.emit({t:'sound',kind:'shockwave'});
      return true;
    }
    deployFlares(p){
      if(!p||p.dead||(Number(p.flare)||0)<=0)return false;
      // V20.80: cooldown real por nave. Ningun control ni IA puede saltarse
      // el segundo minimo entre dos cargas de bengalas.
      if(this.fxClock<(Number(p.nextFlareAllowed)||0))return false;
      p.nextFlareAllowed=this.fxClock+FLARE_LAUNCH_COOLDOWN;
      p.flare=Math.max(0,(Number(p.flare)||0)-1);
      const spreads=[-24,0,24];
      for(const spread of spreads){
        const d=dirFromRot((p.rot+180+spread+360)%360);
        const speed=rand(145,195);
        this.flares.push({
          id:uid(),owner:p.index,
          x:p.x+d.x*30,y:p.y+d.y*30,px:p.x,py:p.y,
          vx:p.vx+d.x*speed,vy:p.vy+d.y*speed,
          life:FLARE_LIFE_SECONDS,ownerSafe:.35,angle:rand(0,360),
          // V20.30: cada bengala conserva el abanico de salida pero recibe
          // una firma de movimiento propia. Se usa despues para una deriva
          // suave y una ondulacion mas erratica al final, sin jitter aleatorio.
          wobblePhase:rand(0,Math.PI*2),
          wobbleRate:rand(2.8,4.4),
          wobbleAmp:rand(17,24),
          wobbleMix:rand(.55,1.45),
          driftBias:rand(-4.5,4.5)
        });
      }
      return true;
    }
    incomingGuidedMissile(index){
      const targetIndex=Number(index);
      for(const b of this.bullets){
        // V19.65: la CPU reacciona en cuanto OTRO jugador lanza un misil
        // teledirigido cuyo objetivo es ella. No espera a que entre en un radio.
        if(!b.guided||b.decoyed||Number(b.target)!==targetIndex)continue;
        if(Number(b.owner)===targetIndex)continue;
        return true;
      }
      return false;
    }
    findCpuFlareThreat(cpu){
      if(!cpu||cpu.dead||cpu.protection>0)return null;
      let best=null,bestScore=Infinity;
      const consider=(threat,score)=>{if(threat&&score<bestScore){best=threat;bestScore=score;}};
      for(const b of this.bullets){
        if(!b.guided||b.decoyed||Number(b.target)!==Number(cpu.index)||Number(b.owner)===Number(cpu.index))continue;
        const distance=Math.hypot(b.x-cpu.x,b.y-cpu.y);
        if(distance>1150)continue;
        consider({kind:'g',distance,critical:distance<460},Math.max(0,distance-260)/700);
      }
      for(const b of this.bullets){
        if(Number(b.owner)===Number(cpu.index))continue;
        if(b.guided&&!b.decoyed&&Number(b.target)===Number(cpu.index))continue;
        const rx=b.x-cpu.x,ry=b.y-cpu.y,distance=Math.hypot(rx,ry);
        if(distance>660)continue;
        const forward=dirFromRot(cpu.rot),approachSide=distance>1?(forward.x*rx+forward.y*ry)/distance:1;
        // La bengala sale hacia atras: una bala que llega claramente de frente
        // no se considera interceptable y se conserva el recurso.
        if(approachSide>-.05)continue;
        const rvx=(Number(b.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(b.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy;if(vv<1)continue;
        const ttc=-(rx*rvx+ry*rvy)/vv;
        if(ttc<0||ttc>1.05)continue;
        const cx=rx+rvx*ttc,cy=ry+rvy*ttc,closest=Math.hypot(cx,cy);
        if(closest>62)continue;
        consider({kind:'b',distance,ttc,closest,critical:ttc<.34&&closest<46},ttc*.9+closest/130);
      }
      const forward=dirFromRot(cpu.rot);
      for(const rival of this.players){
        if(rival.index===cpu.index||rival.dead||rival.camo>0||rival.protection>0)continue;
        const dx=rival.x-cpu.x,dy=rival.y-cpu.y,distance=Math.hypot(dx,dy);
        const enemyShield=!!(rival.shield>0),limit=enemyShield?360:245;
        if(distance<=1||distance>limit)continue;
        const rear=(forward.x*dx+forward.y*dy)/distance;
        if(rear>-.16)continue;
        const rvx=(Number(rival.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(rival.vy)||0)-(Number(cpu.vy)||0);
        const closing=-(dx*rvx+dy*rvy)/distance;
        if(closing<-35)continue;
        consider({kind:'p',distance,closing,enemyShield,critical:distance<(enemyShield?190:135)},.55+distance/620-(enemyShield?.28:0));
      }
      return best;
    }
    smartCpuFlare(cpu){
      if(!cpu||cpu.dead)return false;

      // V20.42: la CPU no responde instantaneamente a un misil guiado.
      // Una vez decide usar bengala, espera entre 1 y 2 segundos antes de soltarla.
      if(cpu.flarePending){
        const pending=cpu.flarePending;
        const b=this.bullets.find(x=>x.id===pending.projectileId)||null;
        const active=!!(b&&b.guided&&!b.decoyed&&Number(b.target)===Number(cpu.index));
        if(!active){cpu.flarePending=null;cpu.nextFlareDecision=this.fxClock+FLARE_CPU_KEEP_COOLDOWN;return false;}
        if(this.fxClock<Number(pending.executeAt))return false;
        if((Number(cpu.flare)||0)<=0)return false;
        if(this.fxClock<(Number(cpu.nextFlareAllowed)||0)){
          pending.executeAt=Math.max(this.fxClock+.05,Number(cpu.nextFlareAllowed)||0);
          return false;
        }
        cpu.flarePending=null;
        cpu.nextFlareDecision=this.fxClock+FLARE_CPU_USE_COOLDOWN;
        return this.deployFlares(cpu);
      }

      if((Number(cpu.flare)||0)<=0||this.fxClock<(Number(cpu.nextFlareDecision)||0))return false;
      const threat=this.findCpuFlareThreat(cpu);
      if(!threat)return false;
      let use=!!threat.critical;
      if(!use&&threat.kind==='g')use=threat.distance<(cpu.shield>0?650:900);
      else if(!use&&threat.kind==='b')use=Number(threat.ttc)<(cpu.shield>0?.38:.72);
      else if(!use&&threat.kind==='p')use=threat.enemyShield?threat.distance<300:threat.distance<175;
      if((Number(cpu.flare)||0)>1&&threat.kind==='g'&&threat.distance<1050)use=true;
      if(cpu.difficulty==='facil'&&!threat.critical&&Math.random()<.55)use=false;

      if(use&&threat.kind==='g'){
        cpu.flarePending={
          projectileId:threat.projectileId,
          executeAt:this.fxClock+rand(FLARE_CPU_MISSILE_REACTION_MIN,FLARE_CPU_MISSILE_REACTION_MAX)
        };
        cpu.nextFlareDecision=cpu.flarePending.executeAt;
        return false;
      }

      cpu.nextFlareDecision=this.fxClock+(use?FLARE_CPU_USE_COOLDOWN:FLARE_CPU_KEEP_COOLDOWN);
      return use?this.deployFlares(cpu):false;
    }
    resolveFireWithFlare(p,c,dt){
      let fireNow=!!(c&&c.fire);
      if(!p)return fireNow;
      if(p.cpu){
        if(p.shockwave){
          let nearestRival=null,nearestDistance=Infinity;
          for(const rival of this.players){
            if(!rival||rival===p||rival.dead||rival.camo>0)continue;
            const distance=Math.hypot(rival.x-p.x,rival.y-p.y);
            if(distance<nearestDistance){nearestDistance=distance;nearestRival=rival;}
          }
          if(nearestRival&&nearestDistance<=SHOCKWAVE_RADIUS){
            this.deployShockwave(p);
          }else{
            const nearMeteor=this.meteors.some(m=>{const dx=m.x-p.x,dy=m.y-p.y;return dx*dx+dy*dy<95*95;});
            const nearAsteroid=this.asteroids.some(a=>{const dx=a.x-p.x,dy=a.y-p.y;const limit=(Number(a.r)||ASTEROID_RADIUS)+50;return dx*dx+dy*dy<limit*limit;});
            if(!nearestRival&&(nearMeteor||nearAsteroid))this.deployShockwave(p);
          }
        }
        this.smartCpuFlare(p);
        return fireNow;
      }
      // V22.27: las acciones especiales online llegan por reliable una sola vez.
      if(c&&c.flarePulse)this.deployFlares(p);
      if(c&&c.shockPulse)this.deployShockwave(p);
      // Compatibilidad con controles locales/legacy sostenidos.
      const flare=!!(c&&c.flare),shock=!!(c&&c.shock);
      if(flare&&!p.joystickFlareHeld)this.deployFlares(p);
      if(shock&&!p.joystickShockHeld)this.deployShockwave(p);
      p.joystickFlareHeld=flare;p.joystickShockHeld=shock;
      if(c&&c.directFire){
        p.specialReleaseLock=false;p.flareHold=0;p.flareGesture=false;
        return fireNow;
      }
      if(p.specialReleaseLock){
        if(fireNow)return false;
        p.specialReleaseLock=false;p.flareHold=0;p.flareGesture=false;
        return false;
      }
      if(p.flareGesture){
        if(fireNow){
          p.flareHold=(Number(p.flareHold)||0)+dt;
          if(p.flareHold>=FLARE_HOLD_SECONDS){
            if(p.shockwave){
              if(this.deployShockwave(p)){p.specialReleaseLock=true;p.flareGesture=false;p.flareHold=0;}
            }else if(p.flare)this.deployFlares(p);
          }
          return false;
        }
        const hasSpecial=!!p.shockwave||(Number(p.flare)||0)>0;
        const tap=hasSpecial&&(Number(p.flareHold)||0)>0&&(Number(p.flareHold)||0)<FLARE_HOLD_SECONDS;
        p.flareGesture=false;p.flareHold=0;
        return tap;
      }
      if(fireNow&&(p.shockwave||(Number(p.flare)||0)>0)){
        p.flareGesture=true;p.flareHold=dt;
        return false;
      }
      if(!fireNow){p.flareHold=0;p.flareGesture=false;}
      return fireNow;
    }
    updateFlares(dt){
      for(let i=this.flares.length-1;i>=0;i--){
        const f=this.flares[i];
        f.px=f.x;f.py=f.y;

        // V20.30: la inercia original se mantiene. Solo giramos suavemente el
        // vector de velocidad; su modulo no recibe acelerones ni frenazos.
        const age=Math.max(0,FLARE_LIFE_SECONDS-Math.max(0,Number(f.life)||0));
        const progress=clamp(age/FLARE_LIFE_SECONDS,0,1);
        let late=clamp((progress-.60)/.40,0,1);
        late=late*late*(3-2*late); // smoothstep: la ondulacion final entra suave.
        const phase=(Number(f.wobblePhase)||0)+age*(Number(f.wobbleRate)||2.7);
        const amp=Number(f.wobbleAmp)||9;
        const mix=Number(f.wobbleMix)||1;
        const wave1=Math.sin(phase);
        const wave2=Math.sin(phase*1.73+mix*2.15);
        const wave3=Math.sin(phase*.67+mix*4.1);
        // V20.34: ondulacion bastante mas visible desde la salida, pero
        // continua. La segunda onda participa antes y el tramo final sigue
        // mezclando frecuencias para que ninguna bengala repita la misma curva.
        const turnRate=(Number(f.driftBias)||0)
          +wave1*amp*(.72+.28*progress)
          +(wave2*.72)*amp*(.24+.30*progress)
          +(wave2*.78+wave3*.44)*amp*late;
        const turn=turnRate*(Math.PI/180)*dt;
        if(Math.abs(turn)>1e-8){
          const cs=Math.cos(turn),sn=Math.sin(turn);
          const vx=f.vx,vy=f.vy;
          f.vx=vx*cs-vy*sn;
          f.vy=vx*sn+vy*cs;
        }

        f.x+=f.vx*dt;f.y+=f.vy*dt;
        f.vx*=.992;f.vy*=.992;
        f.angle=(f.angle+260*dt)%360;
        f.life-=dt;
        f.ownerSafe=Math.max(0,(Number(f.ownerSafe)||0)-dt);

        // V21.19: una bengala que golpea un asteroide normal/mediano/grande
        // se consume, pero el asteroide no recibe dano ni cambia trayectoria.
        let hitAsteroid=false;
        for(const a of this.asteroids){
          if(!a||!sweptCircles(f,FLARE_RADIUS,a,a.r,false))continue;
          this.emitExplosionAt(f.x,f.y,f.owner);
          this.emit({t:'sound',kind:'impact'});
          hitAsteroid=true;
          break;
        }
        if(hitAsteroid){
          this.flares.splice(i,1);
          continue;
        }

        if(f.life<=0||f.x<-100||f.x>W+100||f.y<-100||f.y>H+100)this.flares.splice(i,1);
      }
    }
    guidedTargetFor(p){
      // Adquisicion comun: cono frontal total de 60 grados (+/-30).
      // Una vez lanzado, el misil mantiene su target; las bengalas siguen
      // gestionandose despues dentro de updateBullets().
      return PHYSICS_CORE.guidedTargetFor(p,this.players,dirFromRot);
    }
    cpuOpeningCollisionAvoidance(cpu,control){
      if(!cpu||!cpu.cpu||cpu.dead||(cpu.difficulty||this.difficulty)!=='dificil'||this.fxClock>8)return null;
      let threat=null,bestRisk=Infinity;
      for(const other of this.players){
        if(!other||other===cpu||!other.cpu||other.dead)continue;
        const dx=wrapDelta(other.x-cpu.x,W),dy=wrapDelta(other.y-cpu.y,H);
        const distance=Math.hypot(dx,dy);
        if(distance<1||distance>380)continue;
        const rvx=(Number(other.vx)||0)-(Number(cpu.vx)||0);
        const rvy=(Number(other.vy)||0)-(Number(cpu.vy)||0);
        const closing=-(dx*rvx+dy*rvy)/distance;
        const previewRot=(cpu.rot+(Number(control&&control.turn)||0)*28+360)%360;
        const heading=dirFromRot(previewRot);
        const intent=control&&control.thrust?(heading.x*dx+heading.y*dy)/distance:0;
        const imminent=distance<175;
        if(!imminent&&closing<18&&intent<.45&&distance>260)continue;
        const ttc=closing>1?distance/closing:8;
        const risk=distance+Math.min(420,ttc*65)-Math.max(0,intent)*85;
        if(risk<bestRisk){bestRisk=risk;threat={other,dx,dy,distance,closing};}
      }
      if(!threat)return null;
      const ux=threat.dx/threat.distance,uy=threat.dy/threat.distance;
      // Cada pareja toma un lado determinista opuesto para romper movimientos
      // simetricos. Mezclamos salida lateral con separacion para no quedarse
      // ambos frenados frente a frente.
      const side=cpu.index<threat.other.index?1:-1;
      const vx=-ux*.42+(-uy)*side;
      const vy=-uy*.42+( ux)*side;
      const targetRot=(Math.atan2(-vx,-vy)*180/Math.PI+360)%360;
      const err=((targetRot-cpu.rot+540)%360)-180;
      const veryClose=threat.distance<145;
      return{
        turn:clamp(err/28,-1,1),
        thrust:veryClose?Math.abs(err)<38:Math.abs(err)<65,
        fire:!!(control&&control.fire)
      };
    }
    // V21.67: capa de seguridad predictiva muy barata para CPU online.
    // Solo interviene ante una trayectoria real de choque y no modifica
    // aprendizaje, fisica, colisiones ni red.
    cpuRockSafetyControl(cpu){
      if(!cpu||cpu.dead||cpu.protection>0)return null;
      let best=null,bestRisk=Infinity;

      const consider=(hazard,radius,kind)=>{
        if(!hazard)return;
        const dx=(Number(hazard.x)||0)-(Number(cpu.x)||0);
        const dy=(Number(hazard.y)||0)-(Number(cpu.y)||0);
        const d2=dx*dx+dy*dy;
        const maxRange=kind==='giant'?760:560;
        if(d2>maxRange*maxRange)return;

        const rvx=(Number(hazard.vx)||0)-(Number(cpu.vx)||0);
        const rvy=(Number(hazard.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy;
        const dot=dx*rvx+dy*rvy;
        const safe=SHIP_RADIUS+Math.max(8,Number(radius)||0)+(kind==='meteor'?26:36);
        const near=safe+72;

        if(dot>=0&&d2>near*near)return;

        let ttc=0,cx=dx,cy=dy;
        if(vv>16){
          ttc=clamp(-dot/vv,0,1.75);
          cx=dx+rvx*ttc;
          cy=dy+rvy*ttc;
        }
        const closest2=cx*cx+cy*cy;
        const trigger=safe+34;
        if(closest2>trigger*trigger&&d2>near*near)return;

        const risk=ttc*145+closest2/(safe*safe)*32+d2/(maxRange*maxRange)*18;
        if(risk<bestRisk){
          bestRisk=risk;
          best={d2,rvx,rvy,ttc,cx,cy,safe};
        }
      };

      for(const a of this.asteroids)consider(a,a.r||ASTEROID_RADIUS,'asteroid');
      for(const m of this.meteors)consider(m,m.r||SMALL_METEOR_RADIUS,'meteor');
      if(this.giant)consider(this.giant,this.giant.r||GIANT_RADIUS,'giant');
      if(!best)return null;

      let ex=-best.cx,ey=-best.cy;
      const el2=ex*ex+ey*ey;
      if(el2<100){
        let ax=-best.rvy,ay=best.rvx;
        const al=Math.hypot(ax,ay)||1;ax/=al;ay/=al;
        const forward=dirFromRot(cpu.rot);
        if(forward.x*ax+forward.y*ay<0){ax=-ax;ay=-ay;}
        ex=ax;ey=ay;
      }else{
        const el=Math.sqrt(el2)||1;ex/=el;ey/=el;
      }

      const targetRot=(Math.atan2(-ex,-ey)*180/Math.PI+360)%360;
      const err=((targetRot-cpu.rot+540)%360)-180;
      const absErr=Math.abs(err);
      const closeLimit=best.safe+42;
      const emergency=best.d2<closeLimit*closeLimit||best.ttc<.42;
      return{
        turn:clamp(err/30,-1,1),
        thrust:!emergency&&absErr<24,
        fire:false
      };
    }

    chooseCpuControls(cpu){
      let rival=null,best=Infinity;
      if(cpu.dead)return IDLE_CONTROL;
      const rockSafety=this.cpuRockSafetyControl(cpu);
      if(rockSafety)return rockSafety;
      const huntGrace=this.huntThresholdActive&&this.fxClock<this.huntStartsAt;
      if(this.huntThresholdActive&&this.fxClock>=this.huntStartsAt){
        const target=this.players.find(p=>p.index===this.huntTargetIndex&&!p.cpu&&!p.dead&&p.camo<=0);
        if(target)rival=target;
      }
      if(!rival){
        let shockBest=Infinity;
        for(const p of this.players){
          if(p.index===cpu.index||p.dead||p.camo>0||!p.shockwave)continue;
          if(huntGrace&&p.index===this.huntTargetIndex)continue;
          const d=dist2(cpu,p);
          if(d<shockBest){shockBest=d;rival=p;}
        }
      }
      if(!rival){
        for(const p of this.players){
          if(p.index===cpu.index||p.dead||p.camo>0)continue;
          if(huntGrace&&p.index===this.huntTargetIndex)continue;
          const d=dist2(cpu,p);
          if(d<best){best=d;rival=p;}
        }
      }
      if(!rival)return IDLE_CONTROL;
      const huntActive=this.huntThresholdActive&&this.fxClock>=this.huntStartsAt&&rival.index===this.huntTargetIndex;
      const dx=rival.x-cpu.x,dy=rival.y-cpu.y,distance=Math.hypot(dx,dy);
      const targetRot=(Math.atan2(-dx,-dy)*180/Math.PI+360)%360;
      let err=((targetRot-cpu.rot+540)%360)-180;
      let desiredX=rival.x,desiredY=rival.y,seekPickup=null,defensiveNoAmmo=false,ramming=false;
      const rivalShielded=rival.shield>0||rival.protection>0,rivalDangerous=rival.shield>0;
      const rivalHasShockwave=!!rival.shockwave;
      if(cpu.bullets===0){
        let bestAmmoScore=Infinity,bestAmmoDistance=Infinity,seekPickupRivalDistance=Infinity;
        for(const pk of this.pickups){
          const isAmmo=pk.type.startsWith('ammo');
          const isHardSight=cpu.difficulty==='dificil'&&pk.type==='mira'&&!cpu.guided;
          if(!isAmmo&&!isHardSight)continue;
          const cpuDistance=Math.sqrt(dist2(cpu,pk)),rivalDistance=Math.sqrt(dist2(rival,pk));
          const danger=Math.max(0,900-rivalDistance),dangerWeight=cpu.shield>0?.45:1.35;
          // En dificil, MIRA cuenta incluso algo mas que una bala suelta:
          // rearma con 1 bala y deja preparado un misil teledirigido.
          const sightBonus=isHardSight?360:0;
          const score=cpuDistance+danger*dangerWeight-sightBonus;
          if(score<bestAmmoScore){bestAmmoScore=score;bestAmmoDistance=cpuDistance;seekPickupRivalDistance=rivalDistance;seekPickup=pk;}
        }
        const ammoDistance=seekPickup?bestAmmoDistance:Infinity;
        const canRam=cpu.shield>0&&!rivalShielded;
        const ramRange=cpu.difficulty==='dificil'?650:(cpu.difficulty==='medio'?520:420);
        const preferRam=canRam&&(!seekPickup||distance<ramRange||(cpu.difficulty==='dificil'&&distance<ammoDistance*.65));
        if(preferRam){seekPickup=null;ramming=true;desiredX=rival.x;desiredY=rival.y;}
        else if(seekPickup){
          defensiveNoAmmo=true;desiredX=seekPickup.x;desiredY=seekPickup.y;
          const cpuToPickup=Math.sqrt(dist2(cpu,seekPickup));
          if(cpu.shield<=0&&seekPickupRivalDistance<520&&cpuToPickup>120){
            const px=seekPickup.x-rival.x,py=seekPickup.y-rival.y,plen=Math.hypot(px,py)||1;
            const detour=Math.min(280,Math.max(80,520-seekPickupRivalDistance));
            desiredX+=px/plen*detour;desiredY+=py/plen*detour;
          }
          if(distance<800){
            const inv=1/(distance||1),flee=(800-distance)*(cpu.shield>0?.55:.95);
            desiredX+=(cpu.x-rival.x)*inv*flee;desiredY+=(cpu.y-rival.y)*inv*flee;
          }
        }else{
          defensiveNoAmmo=true;
          const inv=1/(distance||1),fleeDistance=950;
          desiredX=cpu.x+(cpu.x-rival.x)*inv*fleeDistance;desiredY=cpu.y+(cpu.y-rival.y)*inv*fleeDistance;
        }
      }else if(rivalDangerous){
        let bestD2=Infinity;
        for(const pk of this.pickups){
          if(pk.type!=='shield'&&!pk.type.startsWith('ammo')&&!(pk.type==='flare')&&!(pk.type==='shockwave'&&!cpu.shockwave))continue;
          const d2=dist2(cpu,pk);if(d2<bestD2){bestD2=d2;seekPickup=pk;}
        }
        if(!seekPickup){desiredX=cpu.x-dx;desiredY=cpu.y-dy;}
      }else if(cpu.difficulty==='dificil'){
        const excellentShot=Math.abs(err)<5&&distance<850,closeFight=cpu.bullets>0&&distance<500;
        if(!excellentShot&&!closeFight){
          let bestScore=10;
          for(const pk of this.pickups){
            let value=0;
            if(pk.type==='mira'&&!cpu.guided)value=cpu.bullets<=1?165:145;
            else if(pk.type.startsWith('ammo'))value=cpu.bullets<=2?70:20;
            else if(pk.type==='cadence')value=cpu.cadence>=20?100:35;
            else if(pk.type==='speed')value=cpu.speed<2?55:10;
            else if(pk.type==='shield')value=cpu.shield<=0?95:20;
            else if(pk.type==='flare')value=80;
            else if(pk.type==='shockwave'&&!cpu.shockwave)value=150;
            const score=value-Math.sqrt(dist2(cpu,pk))*.06;
            if(score>bestScore){bestScore=score;seekPickup=pk;}
          }
        }
      }
      if(seekPickup&&!defensiveNoAmmo){desiredX=seekPickup.x;desiredY=seekPickup.y;}
      if(rivalHasShockwave&&!huntActive&&!(seekPickup&&seekPickup.type==='shockwave')){
        ramming=false;defensiveNoAmmo=true;
        const inv=1/(distance||1),ux=(cpu.x-rival.x)*inv,uy=(cpu.y-rival.y)*inv,side=cpu.index%2?1:-1;
        if(distance<SHOCKWAVE_SAFE_DISTANCE+18){desiredX=cpu.x+ux*900+(-uy)*side*180;desiredY=cpu.y+uy*900+(ux)*side*180;}
        else if(distance<SHOCKWAVE_STANDOFF_DISTANCE+70){desiredX=cpu.x+(-uy)*side*260;desiredY=cpu.y+(ux)*side*260;}
        else{desiredX=rival.x+ux*SHOCKWAVE_STANDOFF_DISTANCE;desiredY=rival.y+uy*SHOCKWAVE_STANDOFF_DISTANCE;}
      }
      const pickupRun=seekPickup?pickupRunThroughPlan(cpu,seekPickup,this.asteroids,this.meteors,this.giant,this.players):null;
      if(pickupRun&&pickupRun.clear){desiredX=pickupRun.x;desiredY=pickupRun.y;}
      const ddx=desiredX-cpu.x,ddy=desiredY-cpu.y,dRot=(Math.atan2(-ddx,-ddy)*180/Math.PI+360)%360;
      err=((dRot-cpu.rot+540)%360)-180;
      let avoidX=0,avoidY=0;
      for(const h of this.asteroids){
        const hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||ASTEROID_RADIUS)+90;
        if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
      }
      for(const h of this.meteors){
        const hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||30)+90;
        if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
      }
      if(this.giant){
        const h=this.giant,hx=cpu.x-h.x,hy=cpu.y-h.y,d=Math.hypot(hx,hy),safe=(h.r||GIANT_RADIUS)+90;
        if(d<safe&&d>1){avoidX+=hx/d*(safe-d);avoidY+=hy/d*(safe-d);}
      }
      const avoidMag=Math.hypot(avoidX,avoidY);
      const pickupRunClear=!!(pickupRun&&pickupRun.clear);
      if(!pickupRunClear&&avoidMag>20){const ar=(Math.atan2(-avoidX,-avoidY)*180/Math.PI+360)%360;err=((ar-cpu.rot+540)%360)-180;}
      const turn=pickupRunClear&&pickupRun.aligned?0:clamp(err/38,-1,1);
      const thrust=pickupRunClear?true:!!(Math.abs(err)<60&&(seekPickup||defensiveNoAmmo||ramming||distance>280||avoidMag>20));
      const guidedReady=!!(cpu.guided&&Number.isInteger(cpu.guidedTarget)&&cpu.guidedTarget>=0);
      const fireArc=guidedReady&&cpu.difficulty==='dificil'?30:6;
      const fire=(huntActive||!rivalDangerous)&&!seekPickup&&(cpu.bullets>0||Number(cpu.guidedAmmo)>0)&&cpu.reload<=0&&Math.abs(err)<fireArc&&distance<1350&&(!rivalHasShockwave||distance>SHOCKWAVE_SAFE_DISTANCE);
      const control={turn,thrust,fire};
      return this.cpuOpeningCollisionAvoidance(cpu,control)||control;
    }
    update(dt){
      if(!this.started||this.finished)return;
      this.noDeathTime+=dt;this.fxClock+=dt;
      this.updateHazardCycle(dt);
      if(Array.isArray(this.activeShockwaves)&&this.activeShockwaves.length){
        // V21.16: dos jugadores con ONDA activa se neutralizan entre si.
        // Sus frentes siguen existiendo y pueden afectar a terceros sin onda.
        let activeShockOwnerMask=0;
        for(const activeWave of this.activeShockwaves){
          if(!activeWave||activeWave.cancelled)continue;
          const activeAge=this.fxClock-Number(activeWave.born||0);
          if(activeAge>=0&&activeAge<1.35){
            const oi=Math.max(0,Math.min(3,Number(activeWave.owner)||0));
            activeShockOwnerMask|=(1<<oi);
          }
        }
        let shockWrite=0;
        for(const wave of this.activeShockwaves){
          if(!wave||wave.cancelled)continue;
          const age=this.fxClock-Number(wave.born||0);
          const t=Math.max(0,Math.min(1,age/1.35));
          const eased=1-Math.pow(1-t,3);
          const radius=28+(SHOCKWAVE_RADIUS-28)*eased;
          const previous=Math.max(28,Number(wave.prevRadius)||28);
          const owner=this.players.find(q=>q&&Number(q.index)===Number(wave.owner))||null;
          for(const target of this.players){
            if(!target||target.dead||Number(target.index)===Number(wave.owner))continue;
            const bit=1<<Math.max(0,Math.min(3,Number(target.index)||0));
            if((Number(wave.hitMask)||0)&bit)continue;
            const dx=target.x-wave.x,dy=target.y-wave.y;
            const distance=Math.hypot(dx,dy);
            // La nave explota solo cuando el frente circular visible la alcanza.
            if(distance-SHIP_RADIUS<=radius&&distance+SHIP_RADIUS>=previous){
              wave.hitMask=(Number(wave.hitMask)||0)|bit;
              if(owner){
                const targetHasActiveWave=(activeShockOwnerMask&bit)!==0;
                if(targetHasActiveWave){
                  // V21.22: ambas naves quedan protegidas entre si y reciben
                  // un aviso privado de que sus ondas se han anulado.
                  this.emit({t:'shock-cancel',indices:[owner.index,target.index]});
                }else if(target.shield>0){
                  target.shield=0;
                  this.emitShipImpact(target,owner,false);
                  this.emit({t:'sound',kind:'impact'});
                }else if(target.protection>0){
                  this.emitShipImpact(target,owner,false);
                }else{
                  this.destroyShip(target,owner);
                  // V21.25: una sola onda que elimina a dos o mas rivales
                  // reconoce la jugada sin modificar bajas ni dano.
                  wave.killCount=(Number(wave.killCount)||0)+1;
                  if(wave.killCount>=2&&!wave.perfectNotified){
                    wave.perfectNotified=true;
                    this.emit({t:'shock-perfect',index:owner.index,count:wave.killCount});
                  }
                }
              }
            }
          }
          // V21.38 ONLINE: el frente visible de la onda expansiva tambien
          // destruye el OVNI cuando lo alcanza. No cuenta como baja de jugador.
          if(this.ufo){
            const ux=this.ufo.x-wave.x,uy=this.ufo.y-wave.y;
            const ufoDistance=Math.hypot(ux,uy);
            if(ufoDistance-UFO_RADIUS<=radius&&ufoDistance+UFO_RADIUS>=previous){
              this.destroyUfo(owner?owner.index:-1);
            }
          }
          // V21.55: el aro expansivo destruye los meteoritos pequenos
          // de la lluvia exactamente al cruzar su frente. Mismo comportamiento
          // en local/online y, por tanto, en PC, movil y tablet.
          for(let mi=this.meteors.length-1;mi>=0;mi--){
            const meteor=this.meteors[mi];
            if(!meteor)continue;
            const dx=meteor.x-wave.x,dy=meteor.y-wave.y;
            const distance=Math.hypot(dx,dy);
            if(distance-SMALL_METEOR_RADIUS<=radius&&distance+SMALL_METEOR_RADIUS>=previous){
              // V21.58: el meteorito pequeno se desintegra con el mismo efecto
              // visual que el misil cuando el frente de la onda lo alcanza.
              this.emitRocketDisintegrateAt(meteor.x,meteor.y,owner?owner.index:-1);
              this.meteors.splice(mi,1);
            }
          }
          for(let bi=this.bullets.length-1;bi>=0;bi--){
            const b=this.bullets[bi];
            if(!b)continue;
            const hitRadius=b.guided?MISSILE_HIT_RADIUS:BULLET_RADIUS;
            const dx=b.x-wave.x,dy=b.y-wave.y;
            const distance=Math.hypot(dx,dy);
            if(distance-hitRadius<=radius&&distance+hitRadius>=previous){
              if(b.guided)this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
              this.bullets.splice(bi,1);
            }
          }
          for(let fi=this.flares.length-1;fi>=0;fi--){
            const flare=this.flares[fi];
            if(!flare)continue;
            const dx=flare.x-wave.x,dy=flare.y-wave.y;
            const distance=Math.hypot(dx,dy);
            if(distance-FLARE_RADIUS<=radius&&distance+FLARE_RADIUS>=previous){
              this.emitExplosionAt(flare.x,flare.y,flare.owner);
              this.flares.splice(fi,1);
            }
          }
          wave.prevRadius=radius;
          if(age<1.35)this.activeShockwaves[shockWrite++]=wave;
        }
        this.activeShockwaves.length=shockWrite;
      }
      const cpuPlayers=this.cpuScratch;cpuPlayers.length=0;
      let huntedHuman=null;
      for(const p of this.players){
        if(p.cpu){cpuPlayers.push(p);continue;}
        if(!p.dead&&!huntedHuman&&p.kills>=SCORE_TO_WIN-1&&p.kills<SCORE_TO_WIN)huntedHuman=p;
      }
      const shouldHunt=!!(huntedHuman&&cpuPlayers.length);
      if(shouldHunt&&!this.huntThresholdActive){
        this.huntThresholdActive=true;this.huntTargetIndex=huntedHuman.index;this.huntStartsAt=this.fxClock+3;this.huntUntil=Infinity;
        const cpuIndices=[],cpuAmmoTotals=[];
        for(const cpu of cpuPlayers){
          cpu.bullets+=4;
          cpuIndices.push(cpu.index);
          cpuAmmoTotals.push([cpu.index,cpu.bullets]);
        }
        this.emit({t:'hunt',name:huntedHuman.name,duration:0,graceMs:3000,cpuAmmo:true,cpuAmmoBonus:4,cpuIndices,cpuAmmoTotals});
      }else if(!shouldHunt&&this.huntThresholdActive){
        this.huntThresholdActive=false;this.huntTargetIndex=-1;this.huntStartsAt=0;this.huntUntil=0;
      }
      let fxWrite=0;
      for(const e of this.fxEvents)if(this.fxClock-e.at<=.8)this.fxEvents[fxWrite++]=e;
      this.fxEvents.length=fxWrite;
      const controlNow=Date.now();
      for(const p of this.players){
        if((Number(p.spawnFx)||0)>0){p.spawnFx=Math.max(0,p.spawnFx-dt);p.protection=SPAWN_PROTECTION_SECONDS;}else p.protection=p.protection-dt>1e-9?p.protection-dt:0;
        p.shield=Math.max(0,p.shield-dt);p.camo=Math.max(0,p.camo-dt);p.reload=Math.max(0,p.reload-dt);
        if(p.dead){p.thrust=false;p.respawn-=dt;if(p.respawn<=0)this.respawnPlayer(p);continue;}
        if((Number(p.spawnFx)||0)>0){p.thrust=false;p.vx=0;p.vy=0;p.x=Number(p.spawnAnchorX)||p.x;p.y=Number(p.spawnAnchorY)||p.y;p.px=p.x;p.py=p.y;continue;}
        if(p.cpu){
          // V20.10: la cupula verde avisa durante 1 segundo antes del disparo.
          // El estado visual ARMADO sigue dependiendo solo de reload<=0.
          if(p.bullets>0&&p.reload<=0)p.cpuFireDelay=Math.max(0,(Number(p.cpuFireDelay)||0)-dt);
          else p.cpuFireDelay=CPU_ARMED_WARNING_SECONDS;
        }
        p.px=p.x;p.py=p.y;
        const stored=this.controls.get(p.index)||IDLE_CONTROL;
        let c;
        if(p.cpu){
          // V19.79 PERF-2: la estrategia se decide a 30 Hz, pero movimiento,
          // colisiones, disparo final, bengalas y fisica continúan a 60 Hz.
          if(!p.aiControl||(this.tickCount&1)===0)p.aiControl=this.chooseCpuControls(p);
          c=p.aiControl||IDLE_CONTROL;
        }else c=(controlNow-(p.lastControlAt||0)<=300)?stored:IDLE_CONTROL;
        p.thrust=!!c.thrust;
        p.rot=(p.rot+c.turn*240*dt+360)%360;
        const d=dirFromRot(p.rot);
        if(c.thrust){p.vx+=d.x*(240*p.speed)*dt;p.vy+=d.y*(240*p.speed)*dt;}
        p.vx*=DRAG_PER_TICK;p.vy*=DRAG_PER_TICK;
        const vmax=330*p.speed,sp=Math.hypot(p.vx,p.vy);
        if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
        p.x=(p.x+p.vx*dt+W)%W;p.y=(p.y+p.vy*dt+H)%H;
        PHYSICS_CORE.refreshGuidedState(p,this.players,dirFromRot);
        const rocketHeld=!!(c&&c.rocket);
        const rocketNow=!p.cpu&&(!!(c&&c.rocketPulse)||(rocketHeld&&!p.joystickRocketHeld));
        p.joystickRocketHeld=rocketHeld;
        const fireNow=this.resolveFireWithFlare(p,c,dt);
        const projectile=PHYSICS_CORE.tryFireProjectile(
          p,d,fireNow,rocketNow,!!(c&&c.directFire),
          !!(p.cpu&&(Number(p.cpuFireDelay)||0)>0),
          this.players,dirFromRot,uid,CPU_ARMED_WARNING_SECONDS
        );
        if(projectile){
          this.bullets.push(projectile);
          this.emit({t:'sound',kind:'laser'});
        }
        if(c&&!p.cpu){c.rocketPulse=false;c.flarePulse=false;c.shockPulse=false;}
      }
      this.updateAsteroids(dt);this.updateFlares(dt);this.updateBullets(dt);this.updatePickups(dt);this.updateShower(dt);this.updateMeteors(dt);this.updateGiant(dt);this.updateUfo(dt);this.shipCollisions();
    }
    reloadTime(p){return PHYSICS_CORE.reloadTimeFor(p);}
    bulletSpeed(p){return PHYSICS_CORE.bulletSpeedFor(p);}
    updateAsteroids(){
      this.updateAsteroidPopulation();
      for(let i=this.asteroids.length-1;i>=0;i--){
        const a=this.asteroids[i];
        if(a.exitDelay>=0){
          a.exitDelay-=DT;
          if(a.exitDelay<=0)this.beginAsteroidExit(a);
        }
        a.px=a.x;a.py=a.y;a.x+=a.vx*DT;a.y+=a.vy*DT;
        if(a.exiting){
          if(a.x<-220||a.x>W+220||a.y<-220||a.y>H+220)this.asteroids.splice(i,1);
          continue;
        }
        if(a.fragment===true){
          // V21.90: los fragmentos de misil no rebotan en el borde ni vuelven.
          // Al salir desaparecen; su grupo sigue ocupando una unidad hasta que
          // desaparece el ultimo fragmento.
          if(a.x<-70||a.x>W+70||a.y<-70||a.y>H+70){
            this.asteroids.splice(i,1);
            continue;
          }
        }else{
          if(a.x<-190&&a.vx<0)a.vx*=-1;else if(a.x>W+190&&a.vx>0)a.vx*=-1;
          if(a.y<-190&&a.vy<0)a.vy*=-1;else if(a.y>H+190&&a.vy>0)a.vy*=-1;
        }
      }
      // V21.92 PERF: no crear un array filter() 60 veces por segundo.
      // Recorremos el array real y saltamos los asteroides que ya estan saliendo.
      for(let i=0;i<this.asteroids.length;i++){
        const a=this.asteroids[i];
        if(!a||a.exiting)continue;
        for(let j=i+1;j<this.asteroids.length;j++){
          const b=this.asteroids[j];
          if(!b||b.exiting)continue;
          this.resolveAsteroidPairCollision(a,b);
        }
      }
      for(let i=this.pickups.length-1;i>=0;i--){
        const pk=this.pickups[i];
        for(const a of this.asteroids)if(!a.exiting&&circles(a,a.r,pk,PICKUP_RADIUS)){this.pickups.splice(i,1);break;}
      }
    }
    updateBullets(dt){
      for(const b of this.bullets){
        b.px=b.x;b.py=b.y;
        if(b.guided){
          let aim=null;
          if(Number.isInteger(b.flareTarget)&&b.flareTarget>=0){
            aim=this.flares.find(f=>f.id===b.flareTarget)||null;
            if(!aim){b.flareTarget=-1;b.decoyed=true;}
          }
          if(!aim&&!b.decoyed&&Number.isInteger(b.target)){
            const target=this.players.find(p=>p.index===b.target&&!p.dead);
            if(target){
              // V19.65: una bengala desplegada atrae inmediatamente al misil
              // que iba dirigido a su propietario, aunque el misil aun este lejos.
              let decoy=null,best=Infinity;
              for(const f of this.flares){
                if(Number(f.owner)!==Number(target.index))continue;
                const d2=dist2(b,f);
                if(d2<best){best=d2;decoy=f;}
              }
              if(decoy){b.flareTarget=decoy.id;b.decoyed=true;aim=decoy;}
              if(!aim)aim=target;
            }
          }
          if(aim){
            const dx=aim.x-b.x,dy=aim.y-b.y,distance=Math.hypot(dx,dy),speed=Math.hypot(b.vx,b.vy)||1;
            if(distance>1){
              const desiredX=dx/distance,desiredY=dy/distance,currentX=b.vx/speed,currentY=b.vy/speed;
              const steer=Math.min(.09,3.2*dt);
              const n=normalize(currentX+(desiredX-currentX)*steer,currentY+(desiredY-currentY)*steer);
              b.vx=n.x*speed;b.vy=n.y*speed;
            }
          }

          // V20.31: durante el ultimo segundo el misil empieza a fallar.
          // Conserva la ondulacion erratica de V20.24 y, a partir de 3,2 s,
          // pierde velocidad suavemente hasta llegar aprox. al 45% al final.
          if(b.age>=3){
            const currentSpeed=Math.hypot(b.vx,b.vy)||500;
            const burnout=clamp((b.age-3)/1,0,1);
            const phase=(b.age-3)*16+(Number(b.id)||0)*.73;
            // V20.35: un poco mas de serpenteo al final. Se suma una segunda
            // onda mas lenta para que la trayectoria sea mas organica sin jitter.
            const waveMain=Math.sin(phase)*3.6;
            const waveSlow=Math.sin(phase*.58+(Number(b.id)||0)*.31)*1.05;
            const turn=(waveMain+waveSlow*Math.pow(burnout,1.25))*burnout*dt;
            const cs=Math.cos(turn),sn=Math.sin(turn);
            const vx=b.vx,vy=b.vy;
            b.vx=(vx*cs-vy*sn);
            b.vy=(vx*sn+vy*cs);
            const corrected=Math.hypot(b.vx,b.vy)||1;

            // Frenada solo en los ultimos 0,8 s. smoothstep evita cualquier
            // salto de velocidad al entrar en la fase de agotamiento.
            let slow=clamp((b.age-3.2)/.8,0,1);
            slow=slow*slow*(3-2*slow);
            // V21.48: la frenada final conserva la velocidad propia del misil.
            // Evita que un misil basico de 400 llegue a acelerarse hacia 500.
            const launchSpeed=Math.max(1,Number(b.baseSpeed)||currentSpeed);
            const targetSpeed=launchSpeed*(1-.55*slow);
            const finalSpeed=b.age<3.2?currentSpeed:targetSpeed;
            b.vx=b.vx/corrected*finalSpeed;
            b.vy=b.vy/corrected*finalSpeed;
          }
        }
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;b.travel=(b.travel||0)+Math.hypot(b.vx,b.vy)*dt;
      }
      // V22.12: reglas de intercepcion centralizadas en physics-core.
      // Bala-misil y misil-misil destruyen ambos; bala-bala y mismo dueño no chocan.
      if(this.bullets.length>1){
        const destroyedProjectiles=this.destroyedProjectileScratch;
        destroyedProjectiles.clear();
        PHYSICS_CORE.resolveProjectileInterceptions(
          this.bullets,destroyedProjectiles,sweptCircles,BULLET_RADIUS,MISSILE_HIT_RADIUS,
          (hitX,hitY,missileOwner)=>{
            this.emitRocketDisintegrateAt(hitX,hitY,missileOwner);
            this.emit({t:'sound',kind:'sparkle'});
          }
        );
        if(destroyedProjectiles.size){
          let write=0;
          for(let read=0;read<this.bullets.length;read++){
            const projectile=this.bullets[read];
            if(!destroyedProjectiles.has(projectile))this.bullets[write++]=projectile;
          }
          this.bullets.length=write;
          destroyedProjectiles.clear();
        }
      }

      for(let i=this.bullets.length-1;i>=0;i--){
        const b=this.bullets[i];
        // V20.22: la bala normal mantiene 3 s. El misil guiado dura 4 s,
        // sin cambiar velocidad, giro, dano ni comportamiento de colision.
        const projectileLife=b.guided?4:3;
        const expired=b.age>projectileLife;
        let remove=expired||b.x<-20||b.y<-20||b.x>W+20||b.y>H+20;
        if(expired&&b.guided){
          // El misil agotado no desaparece sin mas: detona y deja el mismo
          // efecto de particulas de explosion, que se desvanece localmente.
          this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
          this.emit({t:'sound',kind:'sparkle'});
        }
        if(!remove){
          const flareHit=PHYSICS_CORE.projectileFlareHit(
            b,this.flares,sweptCircles,BULLET_RADIUS,FLARE_RADIUS
          );
          if(flareHit){
            // Cualquier proyectil queda anulado por una bengala.
            // El misil conserva explosion visual; la bala normal solo desaparece.
            if(flareHit.intercept){
              this.emit({t:'intercept',index:flareHit.flareOwner,guided:flareHit.guided});
            }
            if(flareHit.guided){
              this.emitRocketDisintegrateAt(flareHit.impactX,flareHit.impactY,flareHit.projectileOwner);
              this.emit({t:'sound',kind:'sparkle'});
            }
            this.flares.splice(flareHit.index,1);
            remove=true;
          }
        }
        if(!remove){
          const shipHit=PHYSICS_CORE.projectileShipHit(
            b,this.players,sweptCircles,BULLET_RADIUS,SHIP_RADIUS,BRUTAL_SHOT_DISTANCE,260
          );
          if(shipHit){
            const p=shipHit.target;
            const attacker=shipHit.attacker;
            if(!shipHit.shielded){
              if(shipHit.pointBlank)this.emit({t:'pointblank',index:attacker.index});

              if(shipHit.reward==='brutal'){
                // BRUTAL sigue siendo exclusivo de bala normal a larga distancia.
                attacker.bullets+=10;
                attacker.cadence=1;
                attacker.reload=Math.min(attacker.reload,this.reloadTime(attacker));
                this.emit({t:'brutal',titleKey:'brutal',distance:Math.round(shipHit.travel),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index,ammoBonus:10,cadenceMax:true});
              }else if(shipHit.reward==='goodShot'){
                this.emit({t:'brutal',titleKey:'goodShot',distance:Math.round(shipHit.travel),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index,ammoBonus:0,cadenceMax:false});
              }else if(shipHit.reward==='hunter'){
                this.emit({t:'hunter',index:attacker.index});
              }

              if(shipHit.guided){
                this.emitRocketDisintegrateAt(shipHit.impactX,shipHit.impactY,shipHit.owner);
                this.emit({t:'sound',kind:'sparkle'});
              }
              // El atacante suma su baja; la victima no pierde punto por baja ajena.
              this.destroyShip(p,attacker);
            }else{
              this.emitShipImpact(p,b,false);
              if(shipHit.guided){
                // El misil consume por completo un escudo activo y la nave sobrevive.
                p.shield=0;
                this.emitRocketDisintegrateAt(shipHit.impactX,shipHit.impactY,shipHit.owner);
                this.emit({t:'sound',kind:'sparkle'});
              }
            }
            remove=true;
          }
        }
        if(!remove){
          const ufoHit=PHYSICS_CORE.projectileUfoHit(
            b,this.ufo,sweptCircles,BULLET_RADIUS,UFO_RADIUS,UFO_HP
          );
          if(ufoHit){
            if(ufoHit.guided){
              this.emitRocketDisintegrateAt(ufoHit.impactX,ufoHit.impactY,ufoHit.owner);
              this.emit({t:'sound',kind:'sparkle'});
            }else{
              this.emit({t:'sound',kind:'impact'});
            }
            if(ufoHit.destroyed)this.destroyUfo(ufoHit.owner);
            remove=true;
          }
        }
        if(!remove){
          const asteroidHit=PHYSICS_CORE.projectileAsteroidHit(b,this.asteroids,sweptCircles,BULLET_RADIUS);
          if(asteroidHit){
            if(asteroidHit.fracture){
              this.emitRocketDisintegrateAt(asteroidHit.impactX,asteroidHit.impactY,asteroidHit.owner);
              this.emit({t:'sound',kind:'sparkle'});
              this.splitAsteroidByMissile(
                asteroidHit.asteroid,
                asteroidHit.owner,
                asteroidHit.impactX,
                asteroidHit.impactY
              );
            }
            remove=true;
          }
        }
        if(!remove){
          const giantHit=PHYSICS_CORE.projectileGiantHit(
            b,this.giant,sweptCircles,BULLET_RADIUS,GIANT_RADIUS
          );
          if(giantHit){
            if(giantHit.guided){
              this.emitRocketDisintegrateAt(giantHit.impactX,giantHit.impactY,giantHit.owner);
              this.emit({t:'sound',kind:'sparkle'});
            }else{
              this.emit({t:'sound',kind:'impact'});
            }
            remove=true;
          }
        }
        if(!remove){
          const meteorHit=PHYSICS_CORE.projectileMeteorHit(
            b,this.meteors,sweptCircles,BULLET_RADIUS,SMALL_METEOR_RADIUS
          );
          if(meteorHit){
            if(meteorHit.guided){
              this.emitRocketDisintegrateAt(meteorHit.impactX,meteorHit.impactY,meteorHit.owner);
            }
            this.meteors.splice(meteorHit.index,1);
            remove=true;
            this.emit({t:'sound',kind:meteorHit.guided?'sparkle':'impact'});
          }
        }
        // V22.10: physics-core decide si el proyectil puede afectar al pickup.
        // Las balas normales lo destruyen; los misiles lo atraviesan.
        if(!remove){
          const pickupHit=PHYSICS_CORE.projectilePickupHit(
            b,this.pickups,sweptCircles,BULLET_RADIUS,PICKUP_RADIUS
          );
          if(pickupHit){
            this.pickups.splice(pickupHit.index,1);
            remove=true;
          }
        }
        if(remove)this.bullets.splice(i,1);
      }
    }
    updatePickups(dt){
      this.nextPickup-=dt;
      if(this.nextPickup<=0){
        let type;
        const flarePresent=this.pickups.some(pk=>pk.type==='flare');
        const shockPresent=this.pickups.some(pk=>pk.type==='shockwave');
        // V19.68 prueba de bengalas: si no hay una flotando, tiene ~35% de
        // probabilidad de ser el siguiente pickup para facilitar las pruebas.
        if(!shockPresent&&Math.random()<.04)type='shockwave';
        else if(!flarePresent&&Math.random()<.35)type='flare';
        else if(Math.random()<.50&&!this.pickups.some(pk=>pk.type==='mira'))type='mira';
        else{
          const roll=randint(1,28);
          if(roll<=7)type='ammo3';else if(roll<=16)type='ammo1';else if(roll<=19)type='cadence';else if(roll<=22)type='speed';else if(roll<=25)type='shield';else type='camo';
        }
        this.pickups.push({id:uid(),type,x:rand(100,W-100),y:rand(100,H-100),phase:rand(0,Math.PI*2)});
        if(this.pickups.length>5)this.pickups.shift();
        this.nextPickup=rand(2,5);
      }
      for(const pk of this.pickups)pk.phase+=dt*3;
      for(let i=this.pickups.length-1;i>=0;i--){
        const pk=this.pickups[i];let taken=false;
        for(const p of this.players){
          if(p.dead)continue;
          if(sweptCircles(pk,PICKUP_RADIUS,p,SHIP_RADIUS,false)){
            // V20.66: la esfera no es acumulable. Si ya llevas una carga,
            // no consumes otra esfera flotante; queda disponible para otra nave.
            if(pk.type==='shockwave'&&p.shockwave)continue;
            if(pk.type==='ammo3'){
              const hadBullets=p.bullets>0;
              p.bullets+=6;
              if(!hadBullets)p.reload=Math.max(p.reload,this.reloadTime(p));
            }else if(pk.type==='ammo1'){
              const hadBullets=p.bullets>0;
              p.bullets+=1;
              if(!hadBullets)p.reload=Math.max(p.reload,this.reloadTime(p));
            }
            else if(pk.type==='cadence')p.cadence=Math.max(1,p.cadence-10);
            else if(pk.type==='mira'){
              // V21.85: los misiles se acumulan en su propio contador.
              p.guidedAmmo=(Number(p.guidedAmmo)||0)+1;
              p.guided=true;p.guidedTarget=this.guidedTargetFor(p);
            }
            else if(pk.type==='flare')p.flare=(Number(p.flare)||0)+1;
            else if(pk.type==='shockwave')p.shockwave=true;
            else if(pk.type==='speed')p.speed=Math.min(2,p.speed+.5);
            else if(pk.type==='shield')p.shield=10;
            else if(pk.type==='camo')p.camo=10;
            // V21.05: evento informativo para feedback local de la recogida.
            // No altera el efecto del objeto ni la fisica de la simulacion.
            this.emit({t:'pickup',index:p.index,pickupType:pk.type});
            this.emit({t:'sound',kind:'pickup'});taken=true;break;
          }
        }
        if(taken)this.pickups.splice(i,1);
      }
    }
    updateShower(dt){
      const stage=this.hazardStage();
      if(!stage.shower){this.showerLeft=0;this.meteors=[];return;}
      const profile=this.hazardProfile();
      if(this.showerLeft<=0){
        this.firstShower-=dt;
        if(this.firstShower<=0){this.showerLeft=profile.showerDuration;this.nextMeteor=0;this.firstShower=999999;}
        else if(this.nextShower>0){this.nextShower-=dt;if(this.nextShower<=0){this.showerLeft=profile.showerDuration;this.nextMeteor=0;}}
      }
      if(this.showerLeft>0){
        this.showerLeft=Math.max(0,this.showerLeft-dt);this.nextMeteor-=dt;
        while(this.nextMeteor<=0&&this.showerLeft>0){
          const left=Math.random()<.5,vx=(left?1:-1)*rand(110,220),vy=rand(-55,55);
          this.meteors.push({id:uid(),type:randint(1,3),x:left?-40:W+40,y:rand(40,H-40),vx,vy,angle:rand(0,360)});
          this.nextMeteor+=rand(profile.meteorIntervalMin,profile.meteorIntervalMax);
        }
        if(this.showerLeft<=0)this.nextShower=rand(profile.showerRepeatMin,profile.showerRepeatMax);
      }
    }
    updateMeteors(dt){
      for(let i=this.meteors.length-1;i>=0;i--){
        const m=this.meteors[i];m.px=m.x;m.py=m.y;m.x+=m.vx*dt;m.y+=m.vy*dt;m.angle=(m.angle+120*dt)%360;
        for(const a of this.asteroids)if(circles(m,SMALL_METEOR_RADIUS,a,a.r)){const n=normalize(m.x-a.x,m.y-a.y),dot=m.vx*n.x+m.vy*n.y;if(dot<0){m.vx-=2*dot*n.x;m.vy-=2*dot*n.y;}m.x+=n.x*4;m.y+=n.y*4;}
        if(this.giant&&circles(m,SMALL_METEOR_RADIUS,this.giant,GIANT_RADIUS)){
          const g=this.giant,n=normalize(m.x-g.x,m.y-g.y),rvx=m.vx-g.vx,rvy=m.vy-g.vy,dot=rvx*n.x+rvy*n.y;
          if(dot<0){m.vx=g.vx+(rvx-2*dot*n.x);m.vy=g.vy+(rvy-2*dot*n.y);}
          const dx=m.x-g.x,dy=m.y-g.y,dist=Math.hypot(dx,dy)||1,overlap=SMALL_METEOR_RADIUS+GIANT_RADIUS-dist;
          if(overlap>0){m.x+=n.x*(overlap+2);m.y+=n.y*(overlap+2);}
        }
        for(let k=this.pickups.length-1;k>=0;k--)if(circles(m,SMALL_METEOR_RADIUS,this.pickups[k],PICKUP_RADIUS))this.pickups.splice(k,1);
        let removed=false;
        // V19.71: bengala + meteorito pequeno de tormenta destruye ambos.
        for(let f=this.flares.length-1;f>=0;f--){
          const flare=this.flares[f];
          if(!sweptCircles(m,SMALL_METEOR_RADIUS,flare,FLARE_RADIUS,false))continue;
          this.emitExplosionAt(m.x,m.y,flare.owner);
          this.emit({t:'sound',kind:'impact'});
          this.flares.splice(f,1);
          this.meteors.splice(i,1);
          removed=true;break;
        }
        if(removed)continue;
        for(const p of this.players){
          if(!p.dead&&sweptCircles(m,SMALL_METEOR_RADIUS,p,SHIP_RADIUS,false)){
            if(p.shield>0){this.emitShipImpact(p,m,false);const n=normalize(m.x-p.x,m.y-p.y),dot=m.vx*n.x+m.vy*n.y;m.vx-=2*dot*n.x;m.vy-=2*dot*n.y;}
            else{this.destroyShip(p,null);this.meteors.splice(i,1);removed=true;}
            break;
          }
        }
        if(removed)continue;
        if(m.x<-100||m.x>W+100||m.y<-100||m.y>H+100)this.meteors.splice(i,1);
      }
    }
    updateGiant(dt){
      const giantEnabled=this.hazardStage().giant;
      // V21.93: un gigante ya presente termina siempre su recorrido aunque
      // la fase ambiental haya pasado a descanso. Si no existe y la fase no
      // permite gigantes, simplemente no se genera ninguno nuevo.
      if(!this.giant&&!giantEnabled)return;
      if(!this.giant){
        this.nextGiant-=dt;
        if(this.nextGiant<=0){
          const side=randint(0,3),speed=rand(42,52);let x,y,tx,ty;
          if(side===0){x=-180;y=rand(160,H-160);tx=W+180;ty=clamp(y+rand(-220,220),160,H-160);}
          else if(side===1){x=W+180;y=rand(160,H-160);tx=-180;ty=clamp(y+rand(-220,220),160,H-160);}
          else if(side===2){x=rand(180,W-180);y=-180;tx=clamp(x+rand(-300,300),180,W-180);ty=H+180;}
          else{x=rand(180,W-180);y=H+180;tx=clamp(x+rand(-300,300),180,W-180);ty=-180;}
          const n=normalize(tx-x,ty-y);this.giant={id:uid(),x,y,vx:n.x*speed,vy:n.y*speed,r:GIANT_RADIUS,entered:false};
        }
        return;
      }
      const g=this.giant;g.px=g.x;g.py=g.y;g.x+=g.vx*dt;g.y+=g.vy*dt;
      if(g.x>-GIANT_RADIUS&&g.x<W+GIANT_RADIUS&&g.y>-GIANT_RADIUS&&g.y<H+GIANT_RADIUS)g.entered=true;
      // V19.81: bengala contra meteorito gigante. La bengala explota y se
      // consume; el gigante no recibe dano ni altera su trayectoria.
      for(let f=this.flares.length-1;f>=0;f--){
        const flare=this.flares[f];
        if(!sweptCircles(g,GIANT_RADIUS,flare,FLARE_RADIUS,false))continue;
        this.emitExplosionAt(flare.x,flare.y,flare.owner);
        this.emit({t:'sound',kind:'impact'});
        this.flares.splice(f,1);
      }
      for(const p of this.players)if(!p.dead&&sweptCircles(g,GIANT_RADIUS,p,SHIP_RADIUS,false)){if(p.shield>0||p.protection>0){this.emitShipImpact(p,g,false);const n=normalize(p.x-g.x,p.y-g.y);p.vx=n.x*130;p.vy=n.y*130;p.x+=n.x*8;p.y+=n.y*8;}else this.destroyShip(p,null);}
      for(const a of this.asteroids)this.resolveGiantAsteroidCollision(g,a);
      for(let i=this.pickups.length-1;i>=0;i--)if(circles(g,GIANT_RADIUS,this.pickups[i],PICKUP_RADIUS))this.pickups.splice(i,1);
      if(g.entered&&(g.x<-350||g.x>W+350||g.y<-350||g.y>H+350)){
        this.giant=null;
        this.nextGiant=giantEnabled?rand(130,190):999999;
      }
    }
    spawnUfo(){
      if(this.ufo)return false;
      const side=randint(0,3),margin=90;
      let x,y,tx,ty;
      if(side===0){x=-margin;y=rand(140,H-140);tx=W*.42;ty=clamp(y+rand(-220,220),140,H-140);}
      else if(side===1){x=W+margin;y=rand(140,H-140);tx=W*.58;ty=clamp(y+rand(-220,220),140,H-140);}
      else if(side===2){x=rand(180,W-180);y=-margin;tx=clamp(x+rand(-320,320),180,W-180);ty=H*.42;}
      else{x=rand(180,W-180);y=H+margin;tx=clamp(x+rand(-320,320),180,W-180);ty=H*.58;}
      const n=normalize(tx-x,ty-y);
      this.ufo={
        id:uid(),x,y,px:x,py:y,vx:n.x*145,vy:n.y*145,r:UFO_RADIUS,hp:UFO_HP,
        born:this.fxClock,entered:false,exiting:false,nextSteer:this.fxClock,
        chargeAt:this.fxClock+rand(4.5,8),chargeUntil:0,bounceUntil:0
      };
      return true;
    }
    destroyUfo(ownerIndex=-1){
      const u=this.ufo;
      if(!u)return false;
      const owner=Number.isInteger(ownerIndex)&&ownerIndex>=0&&ownerIndex<4?ownerIndex:0;
      this.emitExplosionAt(u.x,u.y,owner);
      this.emit({t:'sound',kind:'impact'});
      const rewards=['ammo3','flare','mira','shield','cadence','speed'];
      const type=rewards[randint(0,rewards.length-1)];
      this.pickups.push({
        id:uid(),type,
        x:clamp(u.x,80,W-80),y:clamp(u.y,80,H-80),
        phase:rand(0,Math.PI*2)
      });
      if(this.pickups.length>5)this.pickups.shift();
      this.ufo=null;
      this.nextUfo=rand(UFO_REPEAT_MIN,UFO_REPEAT_MAX);
      return true;
    }
    updateUfo(dt){
      if(!this.hazardStage().ufo){this.ufo=null;return;}
      // El entrenamiento autonomo no incorpora el OVNI para no contaminar
      // las metricas de aprendizaje ni gastar simulacion extra.
      if(this.trainingMode)return;
      if(!this.ufo){
        this.nextUfo-=dt;
        if(this.nextUfo<=0)this.spawnUfo();
        return;
      }
      const u=this.ufo;
      u.px=u.x;u.py=u.y;
      const age=this.fxClock-Number(u.born||0);
      if(age>24)u.exiting=true;

      if(this.fxClock>=Number(u.nextSteer||0)){
        u.nextSteer=this.fxClock+.12;

        let target=null,best=Infinity;
        for(const p of this.players){
          // V21.39 ONLINE: el OVNI no detecta jugadores invisibles.
          // No los selecciona, persigue ni carga mientras camo > 0.
          if(!p||p.dead||p.cpu||Number(p.camo)>0)continue;
          const d2=dist2(u,p);
          if(d2<best){best=d2;target=p;}
        }
        if(!target){
          for(const p of this.players){
            if(!p||p.dead||Number(p.camo)>0)continue;
            const d2=dist2(u,p);
            if(d2<best){best=d2;target=p;}
          }
        }

        if(!u.exiting&&target&&this.fxClock>=Number(u.chargeAt||0)){
          u.chargeUntil=this.fxClock+1.35;
          u.chargeAt=this.fxClock+rand(5.5,9);
        }

        let dx,dy,targetSpeed;
        const charging=!u.exiting&&target&&this.fxClock<Number(u.chargeUntil||0);
        if(u.exiting){
          dx=u.x-W*.5;dy=u.y-H*.5;targetSpeed=220;
        }else if(charging){
          dx=target.x-u.x;dy=target.y-u.y;targetSpeed=310;
        }else{
          const phase=age*.72+(Number(u.id)||0)*.41;
          const patrolX=W*.5+Math.sin(phase)*W*.27;
          const patrolY=H*.5+Math.cos(phase*.83)*H*.25;
          dx=patrolX-u.x;dy=patrolY-u.y;targetSpeed=150;
          if(target){
            dx+=((target.x-u.x)*.22);
            dy+=((target.y-u.y)*.22);
          }
        }

        // IA ligera: cada 120 ms suma un vector de evitacion. Maximo 5
        // asteroides normales y solo una pasada por meteoritos/giant.
        let avoidX=0,avoidY=0;
        const avoid=(h,radius,extra,weight)=>{
          if(!h)return;
          const ax=u.x-h.x,ay=u.y-h.y,d=Math.hypot(ax,ay)||1;
          const safe=UFO_RADIUS+radius+extra;
          if(d>=safe)return;
          const k=(safe-d)/safe*weight;
          avoidX+=ax/d*k;avoidY+=ay/d*k;
        };
        for(const a of this.asteroids)avoid(a,Number(a.r)||ASTEROID_RADIUS,125,3.2);
        for(const m of this.meteors)avoid(m,SMALL_METEOR_RADIUS,85,2.2);
        if(this.giant)avoid(this.giant,GIANT_RADIUS,170,4.5);

        if(u.entered){
          if(u.x<100)avoidX+=2.5;else if(u.x>W-100)avoidX-=2.5;
          if(u.y<100)avoidY+=2.5;else if(u.y>H-100)avoidY-=2.5;
        }

        dx+=avoidX*260;dy+=avoidY*260;
        const n=normalize(dx,dy);
        const steer=charging?.34:.24;
        u.vx=u.vx*(1-steer)+n.x*targetSpeed*steer;
        u.vy=u.vy*(1-steer)+n.y*targetSpeed*steer;
      }

      u.x+=u.vx*dt;u.y+=u.vy*dt;
      if(u.x>-UFO_RADIUS&&u.x<W+UFO_RADIUS&&u.y>-UFO_RADIUS&&u.y<H+UFO_RADIUS)u.entered=true;

      // V21.36 ONLINE: una bengala destruye el OVNI al colisionar con el.
      // La bengala se consume y el OVNI genera su recompensa habitual.
      for(let f=this.flares.length-1;f>=0;f--){
        const flare=this.flares[f];
        if(!flare||!sweptCircles(u,UFO_RADIUS,flare,FLARE_RADIUS,false))continue;
        const ownerIndex=Number(flare.owner);
        this.flares.splice(f,1);
        this.destroyUfo(ownerIndex);
        return;
      }

      const bounceFrom=(h,radius,retention=.88)=>{
        if(!h||this.fxClock<Number(u.bounceUntil||0)||!circles(u,UFO_RADIUS,h,radius))return false;
        const n=normalize(u.x-h.x,u.y-h.y);
        const dot=u.vx*n.x+u.vy*n.y;
        if(dot<0){
          u.vx=(u.vx-2*dot*n.x)*retention;
          u.vy=(u.vy-2*dot*n.y)*retention;
        }else{
          u.vx+=n.x*70;u.vy+=n.y*70;
        }
        const d=Math.hypot(u.x-h.x,u.y-h.y)||1;
        const overlap=UFO_RADIUS+radius-d;
        if(overlap>0){u.x+=n.x*(overlap+3);u.y+=n.y*(overlap+3);}
        u.bounceUntil=this.fxClock+.22;
        return true;
      };

      for(const a of this.asteroids)if(bounceFrom(a,Number(a.r)||ASTEROID_RADIUS))break;
      if(this.fxClock>=Number(u.bounceUntil||0)){
        for(const m of this.meteors)if(bounceFrom(m,SMALL_METEOR_RADIUS,.84))break;
      }
      if(this.giant)bounceFrom(this.giant,GIANT_RADIUS,.82);

      // La embestida es peligrosa para la nave, pero el OVNI rebota y sigue.
      for(const p of this.players){
        // V21.28: para una embestida letal exigimos solape real en este tick.
        // A 60 Hz el OVNI no atraviesa una nave; evita muertes entre snapshots
        // que visualmente puedan parecer que no llegaron a tocarse.
        if(!p||p.dead||!circles(u,UFO_RADIUS,p,SHIP_RADIUS))continue;
        if(p.shield>0||p.protection>0){
          this.emitShipImpact(p,u,false);
        }else{
          this.destroyShip(p,null);
        }
        const n=normalize(u.x-p.x,u.y-p.y);
        const speed=Math.max(150,Math.hypot(u.vx,u.vy));
        u.vx=n.x*speed*.86;u.vy=n.y*speed*.86;
        u.x+=n.x*7;u.y+=n.y*7;
        u.bounceUntil=this.fxClock+.25;
        break;
      }

      if(u.entered&&u.exiting&&(u.x<-160||u.x>W+160||u.y<-160||u.y>H+160)){
        this.ufo=null;
        this.nextUfo=rand(UFO_REPEAT_MIN,UFO_REPEAT_MAX);
      }
    }
    shipCollisions(){
      for(const p of this.players){
        if(p.dead)continue;

        // V19.68: las bengalas desplegadas son tambien obstaculos para las naves.
        // La propia nave tiene 0,35 s de gracia al soltarlas para no chocarse
        // instantaneamente con ellas en el punto de salida.
        for(let f=this.flares.length-1;f>=0;f--){
          const flare=this.flares[f];
          if(Number(flare.owner)===Number(p.index)&&(Number(flare.ownerSafe)||0)>0)continue;
          if(!sweptCircles(p,SHIP_RADIUS,flare,FLARE_RADIUS,false))continue;
          const flareOwner=this.players.find(q=>Number(q.index)===Number(flare.owner))||null;
          this.flares.splice(f,1);
          if(p.shield>0||p.protection>0){
            this.emitShipImpact(p,flare,false);
            if(p.shield>0){
              if(flareOwner&&flareOwner!==p)this.emit({t:'shield-break',index:flareOwner.index});
              p.shield=0;
            }
            const n=normalize(p.x-flare.x,p.y-flare.y);
            p.vx=n.x*150;p.vy=n.y*150;
            p.x+=n.x*7;p.y+=n.y*7;
            this.emit({t:'sound',kind:'impact'});
          }else{
            // V19.73: la muerte por bengala suma al jugador que la desplego.
            const attacker=flareOwner&&flareOwner!==p?flareOwner:null;
            if(attacker)this.emit({t:'flare-kill',index:attacker.index});
            this.destroyShip(p,attacker);
          }
          if(p.dead)break;
        }
        if(p.dead)continue;

        for(const a of this.asteroids)if(sweptCircles(p,SHIP_RADIUS,a,a.r,false)){if(p.shield>0){this.emitShipImpact(p,a,false);const n=normalize(p.x-a.x,p.y-a.y),dot=p.vx*n.x+p.vy*n.y;if(dot<0){p.vx-=1.85*dot*n.x;p.vy-=1.85*dot*n.y;}p.x+=n.x*5;p.y+=n.y*5;}else this.destroyShip(p,null);}
      }
      for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
        const a=this.players[i],b=this.players[j];
        // V21.28: no colisionar dos naves que se ven en bordes opuestos.
        // El movimiento sigue haciendo wrap, pero el choque solo existe cuando
        // sus trayectorias se tocan en la misma zona visible de la pantalla.
        // V21.29: a 60 Hz la velocidad maxima no permite atravesar
        // completamente otra nave en un tick. Exigimos solape REAL para que
        // toda embestida corresponda con un contacto visible.
        if(a.dead||b.dead||!circles(a,SHIP_RADIUS,b,SHIP_RADIUS))continue;
        if(a.shield>0||a.protection>0)this.emitShipImpact(a,b,false);
        if(b.shield>0||b.protection>0)this.emitShipImpact(b,a,false);
        if(a.shield>0&&b.shield<=0)this.destroyShip(b,a,true);
        else if(b.shield>0&&a.shield<=0)this.destroyShip(a,b,true);
        else if(a.shield<=0&&b.shield<=0){this.destroyShip(a,null);this.destroyShip(b,null);}
        else{const n=normalize(wrapDelta(a.x-b.x,W),wrapDelta(a.y-b.y,H));a.vx=n.x*120;a.vy=n.y*120;b.vx=-n.x*120;b.vy=-n.y*120;}
      }
    }
    takePerfDebug(){
      if(!this.perfDebug)return null;
      const report={
        tickAvg:this.perfTicks?this.perfTickMs/this.perfTicks:0,
        tickMax:this.perfTickMax,
        catchupDrops:this.perfCatchupDrops
      };
      this.perfTickMs=0;this.perfTickMax=0;this.perfTicks=0;this.perfCatchupDrops=0;
      return report;
    }
    publicState(){
      // V20.17 PERF ONLINE: los impactos/explosiones duran 260-420 ms en
      // pantalla. Mantenerlos indefinidamente hasta el tope de 32 hacia que
      // eventos ya invisibles siguieran viajando en todos los snapshots P2P.
      // Conservamos 2 s de margen para jitter/retrasos y compactamos in-place
      // para no crear otro array temporal.
      if(this.fxEvents.length){
        let write=0;
        for(let read=0;read<this.fxEvents.length;read++){
          const e=this.fxEvents[read];
          if(e&&this.fxClock-Number(e.at)<=2)this.fxEvents[write++]=e;
        }
        if(write!==this.fxEvents.length)this.fxEvents.length=write;
      }
      return{
        t:'state',hostEpoch:this.hostEpoch,seq:++this.seq,round:this.rankRound,code:this.code,mode:'p2p',started:this.started,finished:this.finished,winner:this.winner,
        w:W,h:H,scoreToWin:SCORE_TO_WIN,fxVersion:1,
        fx:this.fxEvents.map(e=>({id:e.id,i:e.i,x:e.x,y:e.y,kind:e.kind,hidden:e.hidden,age:Math.max(0,Math.round((this.fxClock-e.at)*1000))})),
        players:this.players.map(p=>({i:p.index,n:p.name,cpu:p.cpu,x:round1(p.x),y:round1(p.y),r:round1(p.rot),vx:round1(p.vx),vy:round1(p.vy),thrust:!!p.thrust,ammo:p.bullets,armed:!p.dead&&(Number(p.spawnFx)||0)<=0&&p.bullets>0&&p.reload<=0,cad:p.cadence,spd:p.speed,k:p.kills,d:p.deaths,shield:round2(p.shield),camo:round2(p.camo),prot:round2(p.protection),spawnFx:round2(Math.max(0,Number(p.spawnFx)||0)),mira:!!p.guided,ma:Math.max(0,Math.round(Number(p.guidedAmmo)||0)),mt:Number.isInteger(p.guidedTarget)?p.guidedTarget:-1,flare:Math.max(0,Math.round(Number(p.flare)||0)),shock:!!p.shockwave,dead:p.dead,respawn:round3(p.respawn)})),
        asteroids:this.asteroids.map(a=>({id:a.id,x:round1(a.x),y:round1(a.y),type:a.type,r:round1(Number(a.r)||ASTEROID_RADIUS),fragment:!!a.fragment})),
        bullets:this.bullets.map(b=>({id:b.id,o:b.owner,owner:b.owner,x:round1(b.x),y:round1(b.y),vx:round1(b.vx),vy:round1(b.vy),g:!!b.guided,guided:!!b.guided,gt:(!b.decoyed&&Number.isInteger(b.target))?b.target:-1,target:(!b.decoyed&&Number.isInteger(b.target))?b.target:-1,wt:(!b.decoyed&&b.guided&&Number.isInteger(b.target))?b.target:-1})),
        flares:this.flares.map(f=>({id:f.id,o:f.owner,x:round1(f.x),y:round1(f.y),a:round1(f.angle),life:round2(Math.max(0,f.life))})),
        pickups:this.pickups.map((p,idx)=>({id:p.id,type:p.type,x:round1(p.x),y:round1(p.y+Math.cos(p.phase)*3),expiresIn:(idx===0&&this.pickups.length>=5)?round2(Math.max(0,this.nextPickup)):null})),
        meteors:this.meteors.map(m=>({id:m.id,type:m.type,x:round1(m.x),y:round1(m.y),a:round1(m.angle)})),
        giant:this.giant?{x:round1(this.giant.x),y:round1(this.giant.y)}:null,
        ufo:this.ufo?{id:this.ufo.id,x:round1(this.ufo.x),y:round1(this.ufo.y),vx:round1(this.ufo.vx),vy:round1(this.ufo.vy),hp:Math.max(0,Math.round(Number(this.ufo.hp)||0))}:null,
        shower:round2(this.showerLeft),
        nextShower:this.showerLeft>0?0:round1(Math.max(0,Math.min(this.firstShower,this.nextShower||999999)))
      };
    }
  }
  window.GalaxyHostPhysics=GalaxyHostPhysics;
})();
