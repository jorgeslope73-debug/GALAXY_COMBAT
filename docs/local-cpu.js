'use strict';
(() => {
  const PHYSICS_CORE=window.GalaxyPhysicsCore;
  if(!PHYSICS_CORE)throw new Error('GalaxyPhysicsCore no cargado');
  const W=1920,H=1080,TICK_HZ=60,DT=1/TICK_HZ,STEP_MS=1000/TICK_HZ;
  const DRAG_PER_TICK=Math.pow(0.35,DT);
  const IDLE_CONTROL=Object.freeze({turn:0,thrust:false,fire:false});
  const SCORE_TO_WIN=5;
  const CAMPAIGN=window.GalaxyCampaign||null;
  const CAMPAIGN_LEVELS=CAMPAIGN&&Number(CAMPAIGN.count)>0?Number(CAMPAIGN.count):5;
  const SHIP_RADIUS=24,ASTEROID_RADIUS=45,GIANT_RADIUS=135,PICKUP_RADIUS=22,BULLET_RADIUS=4,MISSILE_HIT_RADIUS=12,SMALL_METEOR_RADIUS=14;
  const SPAWN_PROTECTION_SECONDS=3,SPAWN_MATERIALIZE_SECONDS=1.15,BRUTAL_SHOT_DISTANCE=850;
  const FLARE_HOLD_SECONDS=.22,FLARE_LIFE_SECONDS=3,FLARE_LAUNCH_COOLDOWN=.5,FLARE_RADIUS=12,FLARE_DECOY_TRIGGER=700;
  const FLARE_CPU_EVAL_SECONDS=1.15,FLARE_CPU_USE_COOLDOWN=.95,FLARE_CPU_KEEP_COOLDOWN=.42;
  const FLARE_CPU_MISSILE_REACTION_MIN=1,FLARE_CPU_MISSILE_REACTION_MAX=2;
  const CPU_ARMED_WARNING_SECONDS=1;
  const CPU_LEARNING_DELTA_MAX=31;
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

  class GalaxyLocalCpu{
    constructor({onState,onEvent}={}){
      this.onState=typeof onState==='function'?onState:()=>{};
      this.onEvent=typeof onEvent==='function'?onEvent:()=>{};
      this.players=[];
      this.controls=new Map();
      this.destroyedProjectileScratch=new Set();
      // V19.79 PERF-2: reutilizamos esta lista para no crear arrays temporales
      // de CPU en cada tick de la simulacion.
      this.cpuScratch=[];
      this.started=false;
      this.finished=false;
      this.winner=null;
      this.difficulty='medio';
      this.cpuCount=1;
      this.campaignLevel=1;
      this.huntTargetIndex=0;
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
      // V21.61: la campaña CPU puede tener hasta tres OVNIs simultáneos.
      // this.ufo conserva el principal para no tocar la física compartida;
      // los demás viven en ufoExtras.
      this.ufoExtras=[];
      this.ufoWaveRemaining=0;
      this.ufoWaveNext=0;
      this.ufoWaveSwarm=false;
      this.ufoWaveSide=-1;
      this.ufoWaveAnchor=.5;
      this.ufoWaveSpawned=0;
      this.ufoWaveTotal=0;
      this.asteroids=[];
      this.nextPickup=1;
      this.firstShower=rand(150,210);
      this.showerLeft=0;
      this.nextMeteor=0;
      this.nextShower=0;
      this.noDeathTime=0;
      this.nextGiant=rand(50,80);
      this.nextUfo=this.ufoLimit()>0?rand(UFO_FIRST_MIN,UFO_FIRST_MAX):999999;
      this.lastNow=0;
      this.accumulator=0;
      this.tickCount=0;
      this.perfDebug=typeof location!=='undefined'&&new URLSearchParams(location.search).get('debug')==='1';
      this.perfTickMs=0;this.perfTickMax=0;this.perfTicks=0;this.perfCatchupDrops=0;
      this.brain=null;
      this.trainingMode=false;
      this.learningEnabled=true;
      this.learningByCpu=new Map();
      this.meteorLearningByCpu=new Map();
      this.flareLearningByCpu=new Map();
      this.humanLearning=new Map();
      this.humanMeteorLearning=new Map();
      // V21.40: aprendizaje humano especifico de ONDA EXPANSIVA.
      // Comparte los contextos shock-train-* con la CPU para alimentar
      // directamente las decisiones futuras de la dificultad DIFICIL.
      this.humanShockLearning=new Map();
      this.humanMeteorDecision=null;
      this.nextHumanObserve=0;
      this.nextHumanShockObserve=0;
      this.learningSent=false;
      this.resetAsteroids();
    }
    emit(msg){try{this.onEvent(msg);}catch(_){}}
    hazardProfile(){
      // V21.80: los parametros ambientales vienen de campaign-config.js.
      // La simulacion no conoce ya niveles concretos.
      const level=clamp(Math.round(Number(this.campaignLevel)||1),1,CAMPAIGN_LEVELS);
      const cfg=CAMPAIGN&&typeof CAMPAIGN.getLevel==='function'?CAMPAIGN.getLevel(level):null;
      if(cfg&&cfg.hazards)return cfg.hazards;
      // Respaldo conservador si el fichero de configuracion no llegase a cargar.
      return{
        asteroidMin:1,
        asteroidInitialMin:18,asteroidInitialMax:24,
        asteroidRespawnMin:4,asteroidRespawnMax:12,
        asteroidPopulationMin:22,asteroidPopulationMax:48,
        firstShowerMin:120,firstShowerMax:160,
        showerRepeatMin:120,showerRepeatMax:160,
        showerDuration:7,
        meteorIntervalMin:.28,meteorIntervalMax:.42,
        giantFirstMin:70,giantFirstMax:100,
        giantRepeatMin:150,giantRepeatMax:200
      };
    }
    brainScore(context,action){
      if(!this.brain||!Array.isArray(this.brain.strategies))return 0;
      const e=this.brain.strategies.find(x=>x&&x.context===context&&x.action===action);
      return e&&Number(e.samples)>0?Number(e.total||0)/Number(e.samples):0;
    }
    chooseBrainAction(context,actions,explore=.2){
      const list=Array.isArray(actions)&&actions.length?actions:['attack'];
      if(!this.brain||Math.random()<explore)return list[randint(0,list.length-1)];
      let best=list[0],bestScore=-Infinity;
      for(const action of list){
        const score=this.brainScore(context,action)+rand(-.16,.16);
        if(score>bestScore){bestScore=score;best=action;}
      }
      return best;
    }
    shockLearningContext(kind,distance){
      const band=distance<SHOCKWAVE_RADIUS?0:(distance<SHOCKWAVE_SAFE_DISTANCE?1:2);
      return 'shock-'+kind+'-d'+band;
    }
    shockwaveOwnerActive(index){
      const target=Number(index);
      if(!Array.isArray(this.activeShockwaves))return false;
      for(const wave of this.activeShockwaves){
        if(Number(wave&&wave.owner)!==target)continue;
        const age=this.fxClock-Number(wave.born||0);
        if(age>=0&&age<1.35)return true;
      }
      return false;
    }
    shockwaveSituation(cpu){
      if(!cpu||cpu.dead||!cpu.shockwave)return null;

      // 1) Ataque: una onda vale especialmente la pena si puede alcanzar a
      // dos o mas rivales vulnerables al mismo tiempo.
      const vulnerable=[];
      for(const rival of this.players){
        if(!rival||rival===cpu||rival.dead||rival.camo>0)continue;
        const distance=Math.hypot(rival.x-cpu.x,rival.y-cpu.y);
        if(distance>SHOCKWAVE_RADIUS+SHIP_RADIUS)continue;
        if(rival.shield>0||rival.protection>0||this.shockwaveOwnerActive(rival.index))continue;
        vulnerable.push({rival,distance});
      }
      if(vulnerable.length>=2){
        const nearest=Math.min(...vulnerable.map(x=>x.distance));
        return{kind:'multi',context:'shock-train-multi',distance:nearest,critical:true,count:vulnerable.length};
      }

      // 2) Defensa contra misil: si viene dirigido a esta CPU, la onda puede
      // actuar como escudo destruyendo el proyectil al cruzar el frente.
      let guidedThreat=null;
      for(const b of this.bullets){
        if(!b||!b.guided||b.decoyed||Number(b.owner)===Number(cpu.index)||Number(b.target)!==Number(cpu.index))continue;
        const distance=Math.hypot(b.x-cpu.x,b.y-cpu.y);
        if(distance<=520&&(!guidedThreat||distance<guidedThreat.distance))guidedThreat={projectile:b,distance};
      }
      if(guidedThreat)return{kind:'missile',context:'shock-train-missile',distance:guidedThreat.distance,critical:guidedThreat.distance<360};

      // 3) Choque inminente con asteroide normal o meteorito pequeno.
      let hazardThreat=null;
      const considerHazard=(h,radius)=>{
        if(!h)return;
        const rx=h.x-cpu.x,ry=h.y-cpu.y;
        const rvx=(Number(h.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(h.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy;
        const dot=rx*rvx+ry*rvy;
        const ttc=vv>1?clamp(-dot/vv,0,1.5):0;
        const cx=rx+rvx*ttc,cy=ry+rvy*ttc;
        const closest=Math.hypot(cx,cy),distance=Math.hypot(rx,ry);
        const collisionRadius=SHIP_RADIUS+radius+16;
        const threatening=distance<collisionRadius+22||(ttc>0&&ttc<=1.35&&closest<collisionRadius);
        if(!threatening)return;
        const score=(ttc>0?ttc:1.5)*220+distance;
        if(!hazardThreat||score<hazardThreat.score)hazardThreat={distance,ttc,score};
      };
      for(const a of this.asteroids)considerHazard(a,Number(a&&a.r)||ASTEROID_RADIUS);
      for(const m of this.meteors)considerHazard(m,SMALL_METEOR_RADIUS);
      if(hazardThreat)return{kind:'asteroid',context:'shock-train-asteroid',distance:hazardThreat.distance,critical:hazardThreat.ttc>0&&hazardThreat.ttc<.75};

      // 4) Defensa contra bala normal con trayectoria de impacto cercana.
      let bulletThreat=null;
      for(const b of this.bullets){
        if(!b||b.guided||Number(b.owner)===Number(cpu.index))continue;
        const rx=b.x-cpu.x,ry=b.y-cpu.y;
        const rvx=(Number(b.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(b.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy;if(vv<=1)continue;
        const dot=rx*rvx+ry*rvy;
        const ttc=-dot/vv;
        if(ttc<=0||ttc>.7)continue;
        const cx=rx+rvx*ttc,cy=ry+rvy*ttc;
        const closest=Math.hypot(cx,cy);
        if(closest>SHIP_RADIUS+BULLET_RADIUS+14)continue;
        const distance=Math.hypot(rx,ry);
        if(!bulletThreat||ttc<bulletThreat.ttc)bulletThreat={distance,ttc};
      }
      if(bulletThreat)return{kind:'bullet',context:'shock-train-bullet',distance:bulletThreat.distance,critical:bulletThreat.ttc<.38};

      // 5) Ataque contra un solo rival vulnerable: útil, pero menos valioso
      // que atrapar a dos juntos o salvarse de una amenaza inmediata.
      if(vulnerable.length===1)return{kind:'single',context:'shock-train-single',distance:vulnerable[0].distance,critical:false,count:1};
      return null;
    }
    learnedShockwaveDecision(situation){
      if(!situation||!this.brain||!Array.isArray(this.brain.strategies))return null;
      const context=String(situation.context||'');
      const useEntry=this.brain.strategies.find(e=>e&&e.context===context&&e.action==='shock_use'&&Number(e.samples)>0);
      const keepEntry=this.brain.strategies.find(e=>e&&e.context===context&&e.action==='shock_keep'&&Number(e.samples)>0);
      if(!useEntry&&!keepEntry)return null;
      const useScore=useEntry?Number(useEntry.total||0)/Number(useEntry.samples||1):-Infinity;
      const keepScore=keepEntry?Number(keepEntry.total||0)/Number(keepEntry.samples||1):-Infinity;
      return useScore>=keepScore;
    }
    learningContext(cpu,rival,distance){
      const ammo=cpu.bullets<=0?0:(cpu.bullets<=2?1:2);
      const shield=cpu.shield>0?1:0;
      const band=distance<400?0:(distance<850?1:2);
      const enemy=(rival&&rival.shield>0)?1:0;
      return 'a'+ammo+'-s'+shield+'-d'+band+'-e'+enemy;
    }
    meteorThreatInfo(cpu,m){
      if(!cpu||!m)return null;
      const dx=m.x-cpu.x,dy=m.y-cpu.y,dist=Math.hypot(dx,dy);
      if(!Number.isFinite(dist)||dist>430)return null;
      const rvx=(m.vx||0)-(cpu.vx||0),rvy=(m.vy||0)-(cpu.vy||0);
      const vv=rvx*rvx+rvy*rvy,dot=dx*rvx+dy*rvy;
      const closing=dist>1?-dot/dist:0;
      const ttc=vv>1?clamp(-dot/vv,0,2.4):0;
      const cx=dx+rvx*ttc,cy=dy+rvy*ttc,closest=Math.hypot(cx,cy);
      const threatening=dist<115||((closing>18||dist<180)&&ttc<=2.2&&closest<105);
      if(!threatening)return null;
      const forward=dirFromRot(cpu.rot);
      // V21.63: el lado se calcula con el punto de maxima aproximacion,
      // no solo con la posicion actual del meteorito. Cero bucles extra.
      const sx=closest>10?cx:dx,sy=closest>10?cy:dy;
      const side=(forward.x*sy-forward.y*sx)>=0?0:1;
      return{meteor:m,dist,closing,ttc,closest,side,cx,cy,rvx,rvy};
    }
    meteorLearningContext(cpu,threat){
      const side=threat&&threat.side?1:0;
      const velocity=threat&&threat.closing>130?1:0;
      const distance=threat&&threat.dist<190?0:1;
      return 'meteor-s'+side+'-v'+velocity+'-d'+distance;
    }
    meteorSafetyControl(cpu,threat){
      if(!cpu||!threat)return null;
      const imminent=(threat.dist<118)||(threat.ttc>0&&threat.ttc<.78&&threat.closest<82);
      if(!imminent)return null;

      // Vector de escape: alejarnos del meteorito en el punto donde ambas
      // trayectorias estarian mas cerca. Si el cruce es casi perfecto usamos
      // la perpendicular a la velocidad relativa que exige menor giro.
      let ex=-Number(threat.cx||0),ey=-Number(threat.cy||0);
      if(Math.hypot(ex,ey)<10){
        const rvx=Number(threat.rvx)||0,rvy=Number(threat.rvy)||0;
        let ax=-rvy,ay=rvx;
        const al=Math.hypot(ax,ay)||1;ax/=al;ay/=al;
        const forward=dirFromRot(cpu.rot);
        if(forward.x*ax+forward.y*ay<0){ax=-ax;ay=-ay;}
        ex=ax;ey=ay;
      }else{
        const el=Math.hypot(ex,ey)||1;ex/=el;ey/=el;
      }

      const targetRot=(Math.atan2(-ex,-ey)*180/Math.PI+360)%360;
      const err=((targetRot-cpu.rot+540)%360)-180;
      const absErr=Math.abs(err);

      // Primero gira/frena; solo vuelve a acelerar cuando ya apunta claramente
      // hacia la salida. Esto evita seguir empujando la nave hacia el cruce.
      return{
        turn:clamp(err/34,-1,1),
        thrust:absErr<30&&threat.dist>72,
        fire:false
      };
    }
    recordLearning(cpu,context,action){
      if(!this.learningEnabled||this.difficulty!=='dificil'||!cpu||!cpu.cpu)return;
      let map=this.learningByCpu.get(cpu.index);
      if(!map){map=new Map();this.learningByCpu.set(cpu.index,map);}
      const key=context+'|'+action;
      const item=map.get(key)||{context,action,uses:0};
      item.uses=Math.min(50,item.uses+1);
      map.set(key,item);
    }
    recordMeteorLearning(cpu,context,action,reward){
      if(!this.learningEnabled||this.difficulty!=='dificil'||!cpu||!cpu.cpu||!context||!action)return;
      let map=this.meteorLearningByCpu.get(cpu.index);
      if(!map){map=new Map();this.meteorLearningByCpu.set(cpu.index,map);}
      const key=context+'|'+action;
      const item=map.get(key)||{context,action,uses:0,total:0};
      item.uses=Math.min(50,item.uses+1);
      item.total=clamp(item.total+clamp(Number(reward)||0,-2,2),-100,100);
      map.set(key,item);
    }
    settleMeteorDecision(cpu,reward){
      const d=cpu&&cpu.meteorDecision;
      if(!d)return;
      this.recordMeteorLearning(cpu,d.context,d.action,reward);
      cpu.meteorDecision=null;
    }
    flareLearningContext(cpu,threat){
      const kind=threat&&['g','b','p'].includes(threat.kind)?threat.kind:'p';
      const distance=Math.max(0,Number(threat&&threat.distance)||9999);
      const band=distance<220?0:(distance<600?1:2);
      const shield=cpu&&cpu.shield>0?1:0;
      const enemy=threat&&threat.enemyShield?1:0;
      return 'flare-'+kind+'-d'+band+'-s'+shield+'-e'+enemy;
    }
    recordFlareLearning(cpu,context,action,reward){
      if(!this.learningEnabled||this.difficulty!=='dificil'||!cpu||!cpu.cpu||!context||!action)return;
      let map=this.flareLearningByCpu.get(cpu.index);
      if(!map){map=new Map();this.flareLearningByCpu.set(cpu.index,map);}
      const key=context+'|'+action;
      const item=map.get(key)||{context,action,uses:0,total:0};
      item.uses=Math.min(50,item.uses+1);
      item.total=clamp(item.total+clamp(Number(reward)||0,-2,2),-100,100);
      map.set(key,item);
    }
    settleFlareDecision(cpu,reward){
      const d=cpu&&cpu.flareDecision;
      if(!d)return;
      this.recordFlareLearning(cpu,d.context,d.action,reward);
      cpu.flareDecision=null;
    }
    findCpuFlareThreat(cpu){
      if(!cpu||cpu.dead||cpu.protection>0)return null;
      let best=null,bestScore=Infinity;
      const consider=(threat,score)=>{if(threat&&score<bestScore){best=threat;bestScore=score;}};

      // Misiles dirigidos: no se gasta la bengala cuando aun estan demasiado lejos.
      for(const b of this.bullets){
        if(!b.guided||b.decoyed||Number(b.target)!==Number(cpu.index)||Number(b.owner)===Number(cpu.index))continue;
        const distance=Math.hypot(b.x-cpu.x,b.y-cpu.y);
        if(distance>1150)continue;
        consider({kind:'g',projectileId:b.id,distance,enemyShield:false,critical:distance<460},Math.max(0,distance-260)/700);
      }

      // Balas en trayectoria de impacto. Se calcula el punto de maxima aproximacion
      // durante el siguiente segundo para evitar reaccionar a proyectiles que pasan lejos.
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
        const dot=rx*rvx+ry*rvy,ttc=-dot/vv;
        if(ttc<0||ttc>1.05)continue;
        const cx=rx+rvx*ttc,cy=ry+rvy*ttc,closest=Math.hypot(cx,cy);
        if(closest>62)continue;
        const critical=ttc<.34&&closest<46;
        consider({kind:'b',projectileId:b.id,distance,ttc,closest,enemyShield:false,critical},ttc*.9+closest/130);
      }

      // Perseguidor por detras: la nube sale hacia atras, por lo que solo se usa
      // ofensivamente cuando existe una posibilidad real de que el rival la atraviese.
      const forward=dirFromRot(cpu.rot);
      for(const rival of this.players){
        if(rival.index===cpu.index||rival.dead||rival.camo>0||rival.protection>0)continue;
        const dx=rival.x-cpu.x,dy=rival.y-cpu.y,distance=Math.hypot(dx,dy);
        const enemyShield=!!(rival.shield>0);
        const limit=enemyShield?360:245;
        if(distance<=1||distance>limit)continue;
        const rear=(forward.x*dx+forward.y*dy)/distance;
        if(rear>-.16)continue;
        const rvx=(Number(rival.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(rival.vy)||0)-(Number(cpu.vy)||0);
        const closing=-(dx*rvx+dy*rvy)/distance;
        if(closing<-35)continue;
        const critical=distance<(enemyShield?190:135);
        consider({kind:'p',rivalIndex:rival.index,distance,closing,enemyShield,critical},.55+distance/620-(enemyShield?.28:0));
      }
      return best;
    }
    updateCpuFlareDecision(cpu){
      const d=cpu&&cpu.flareDecision;
      if(!d)return;
      const age=this.fxClock-d.started;
      if(age<.55)return;
      const used=d.action==='flare_use';
      if(d.kind==='g'){
        const b=this.bullets.find(x=>x.id===d.projectileId)||null;
        const active=!!(b&&b.guided&&!b.decoyed&&Number(b.target)===Number(cpu.index));
        if(!active){this.settleFlareDecision(cpu,used?1.35:.28);return;}
        if(age>=FLARE_CPU_EVAL_SECONDS)this.settleFlareDecision(cpu,used?-.35:-.72);
        return;
      }
      if(d.kind==='b'){
        const b=this.bullets.find(x=>x.id===d.projectileId)||null;
        if(!b){this.settleFlareDecision(cpu,used?.95:.24);return;}
        const rx=b.x-cpu.x,ry=b.y-cpu.y,distance=Math.hypot(rx,ry);
        const rvx=(Number(b.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(b.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy,ttc=vv>1?-(rx*rvx+ry*rvy)/vv:Infinity;
        const cx=Number.isFinite(ttc)?rx+rvx*Math.max(0,Math.min(1.05,ttc)):rx;
        const cy=Number.isFinite(ttc)?ry+rvy*Math.max(0,Math.min(1.05,ttc)):ry;
        const closest=Math.hypot(cx,cy);
        const stillThreatening=distance<700&&ttc>=0&&ttc<=1.05&&closest<68;
        if(!stillThreatening){this.settleFlareDecision(cpu,used?.42:.38);return;}
        if(age>=FLARE_CPU_EVAL_SECONDS)this.settleFlareDecision(cpu,used?-.22:-.42);
        return;
      }
      const rival=this.players.find(p=>p.index===d.rivalIndex&&!p.dead)||null;
      if(!rival){this.settleFlareDecision(cpu,used?.70:.25);return;}
      const dx=rival.x-cpu.x,dy=rival.y-cpu.y,distance=Math.hypot(dx,dy);
      if(d.enemyShield&&rival.shield<=0&&rival.protection<=0){this.settleFlareDecision(cpu,used?1.55:.32);return;}
      const forward=dirFromRot(cpu.rot),rear=distance>1?(forward.x*dx+forward.y*dy)/distance:1;
      const rvx=(Number(rival.vx)||0)-(Number(cpu.vx)||0),rvy=(Number(rival.vy)||0)-(Number(cpu.vy)||0);
      const closing=distance>1?-(dx*rvx+dy*rvy)/distance:0;
      if(distance>d.distance+90||rear>-.05||closing<-35){this.settleFlareDecision(cpu,used?.58:.34);return;}
      if(age>=1.35)this.settleFlareDecision(cpu,used?-.20:-.30);
    }
    smartCpuFlare(cpu){
      if(!cpu||cpu.dead)return false;
      this.updateCpuFlareDecision(cpu);

      // V20.42: si la IA ya decidio usar una bengala contra un misil guiado,
      // conserva ESA decision aprendida pero tarda entre 1 y 2 s en ejecutarla.
      // La espera es solo de reaccion humana; no vuelve a elegir otra accion.
      if(cpu.flarePending){
        const pending=cpu.flarePending;
        const b=this.bullets.find(x=>x.id===pending.projectileId)||null;
        const active=!!(b&&b.guided&&!b.decoyed&&Number(b.target)===Number(cpu.index));
        if(!active){
          cpu.flarePending=null;
          cpu.nextFlareDecision=this.fxClock+FLARE_CPU_KEEP_COOLDOWN;
          return false;
        }
        if(this.fxClock<Number(pending.executeAt))return false;
        if((Number(cpu.flare)||0)<=0)return false;
        if(this.fxClock<(Number(cpu.nextFlareAllowed)||0)){
          pending.executeAt=Math.max(this.fxClock+.05,Number(cpu.nextFlareAllowed)||0);
          return false;
        }
        cpu.flarePending=null;
        cpu.flareDecision={
          context:pending.context,action:'flare_use',kind:'g',projectileId:pending.projectileId,
          rivalIndex:undefined,distance:pending.distance,enemyShield:false,started:this.fxClock
        };
        cpu.nextFlareDecision=this.fxClock+FLARE_CPU_USE_COOLDOWN;
        if(this.deployFlares(cpu))return true;
        cpu.flareDecision=null;
        return false;
      }

      if(cpu.flareDecision||(Number(cpu.flare)||0)<=0||this.fxClock<(Number(cpu.nextFlareDecision)||0))return false;
      const threat=this.findCpuFlareThreat(cpu);
      if(!threat)return false;
      const context=this.flareLearningContext(cpu,threat);
      let action='flare_keep';
      if(threat.critical)action='flare_use';
      else if(threat.kind==='g')action=threat.distance<(cpu.shield>0?650:900)?'flare_use':'flare_keep';
      else if(threat.kind==='b')action=Number(threat.ttc)<(cpu.shield>0?.38:.72)?'flare_use':'flare_keep';
      else if(threat.kind==='p')action=threat.enemyShield?(threat.distance<300?'flare_use':'flare_keep'):(threat.distance<175?'flare_use':'flare_keep');
      if((Number(cpu.flare)||0)>1&&action==='flare_keep'&&threat.kind==='g'&&threat.distance<1050)action='flare_use';

      if(this.difficulty==='dificil'&&!threat.critical){
        const learned=!!(this.brain&&Array.isArray(this.brain.strategies)&&this.brain.strategies.some(e=>e&&e.context===context&&(e.action==='flare_use'||e.action==='flare_keep')));
        if(learned)action=this.chooseBrainAction(context,['flare_use','flare_keep'],this.trainingMode?.24:.08);
        else if(this.trainingMode&&Math.random()<.18)action=Math.random()<.5?'flare_use':'flare_keep';
      }
      if(this.difficulty==='facil'&&!threat.critical&&Math.random()<.55)action='flare_keep';

      // Contra misil guiado, la eleccion aprendida se guarda y se ejecuta tras
      // una reaccion aleatoria de 1-2 s. No se modifica el aprendizaje guardado.
      if(action==='flare_use'&&threat.kind==='g'){
        const reaction=rand(FLARE_CPU_MISSILE_REACTION_MIN,FLARE_CPU_MISSILE_REACTION_MAX);
        cpu.flarePending={
          context,projectileId:threat.projectileId,distance:threat.distance,
          executeAt:this.fxClock+reaction
        };
        cpu.nextFlareDecision=cpu.flarePending.executeAt;
        return false;
      }

      cpu.flareDecision={
        context,action,kind:threat.kind,projectileId:threat.projectileId,
        rivalIndex:threat.rivalIndex,distance:threat.distance,enemyShield:!!threat.enemyShield,
        started:this.fxClock
      };
      cpu.nextFlareDecision=this.fxClock+(action==='flare_use'?FLARE_CPU_USE_COOLDOWN:FLARE_CPU_KEEP_COOLDOWN);
      if(action==='flare_use'){
        if(this.deployFlares(cpu))return true;
        cpu.flareDecision=null;
      }
      return false;
    }
    recordHumanLearning(context,action){
      if(!this.learningEnabled||this.trainingMode||this.difficulty!=='dificil'||!context||!action)return;
      const key=context+'|'+action;
      const item=this.humanLearning.get(key)||{context,action,uses:0};
      item.uses=Math.min(40,item.uses+1);
      this.humanLearning.set(key,item);
    }
    recordHumanShockLearning(context,action){
      if(!this.learningEnabled||this.trainingMode||this.difficulty!=='dificil'||!context||!action)return;
      const key=context+'|'+action;
      const item=this.humanShockLearning.get(key)||{context,action,uses:0};
      item.uses=Math.min(40,item.uses+1);
      this.humanShockLearning.set(key,item);
    }
    recordHumanMeteorLearning(context,action,reward){
      if(!this.learningEnabled||this.trainingMode||this.difficulty!=='dificil'||!context||!action)return;
      const key=context+'|'+action;
      const item=this.humanMeteorLearning.get(key)||{context,action,uses:0,total:0};
      item.uses=Math.min(40,item.uses+1);
      item.total=clamp(item.total+clamp(Number(reward)||0,-2,2),-100,100);
      this.humanMeteorLearning.set(key,item);
    }
    settleHumanMeteorDecision(reward){
      const d=this.humanMeteorDecision;
      if(!d)return;
      this.recordHumanMeteorLearning(d.context,d.action,reward);
      this.humanMeteorDecision=null;
    }
    observeHumanLearning(human,control){
      if(!this.learningEnabled||this.trainingMode||this.difficulty!=='dificil'||!human||human.cpu||human.dead)return;

      // Si una maniobra de meteorito dejo de estar en peligro, la consideramos
      // una demostracion valida. Solo premiamos exitos claros para no contaminar
      // el cerebro con muertes causadas por balas u otros choques.
      if(this.humanMeteorDecision){
        const tracked=this.meteors.find(m=>m.id===this.humanMeteorDecision.meteorId)||null;
        const threat=tracked?this.meteorThreatInfo(human,tracked):null;
        if(!tracked||(!threat&&this.fxClock-this.humanMeteorDecision.started>.35)){
          this.settleHumanMeteorDecision(.7);
        }
      }

      // V21.40: si el humano tiene una onda disponible y aparece una situacion
      // relevante, observar tambien la decision de CONSERVARLA. Se muestrea
      // despacio para que mantenerla varios segundos no domine el aprendizaje.
      if(human.shockwave&&this.fxClock>=(Number(this.nextHumanShockObserve)||0)){
        const shockSituation=this.shockwaveSituation(human);
        if(shockSituation){
          this.nextHumanShockObserve=this.fxClock+.9;
          this.recordHumanShockLearning(shockSituation.context,'shock_keep');
        }
      }

      // Muestreo deliberadamente bajo: 4 Hz. No toca red, DOM ni almacenamiento.
      if(this.fxClock<this.nextHumanObserve)return;
      this.nextHumanObserve=this.fxClock+.25;

      let meteorThreat=null,meteorRisk=Infinity;
      for(const m of this.meteors){
        const info=this.meteorThreatInfo(human,m);
        if(!info)continue;
        const risk=info.ttc*90+info.closest*.7+info.dist*.08;
        if(risk<meteorRisk){meteorRisk=risk;meteorThreat=info;}
      }
      if(meteorThreat&&(!this.humanMeteorDecision||this.humanMeteorDecision.meteorId!==meteorThreat.meteor.id)){
        if(this.humanMeteorDecision)this.settleHumanMeteorDecision(.2);
        let meteorAction='';
        if(!control.thrust)meteorAction='meteor_brake';
        else if(Number(control.turn)>.18)meteorAction='meteor_left';
        else if(Number(control.turn)<-.18)meteorAction='meteor_right';
        if(meteorAction){
          this.humanMeteorDecision={
            meteorId:meteorThreat.meteor.id,
            context:this.meteorLearningContext(human,meteorThreat),
            action:meteorAction,
            started:this.fxClock
          };
        }
      }

      let rival=null,best=Infinity;
      for(const p of this.players){
        if(p.cpu&& !p.dead && p.camo<=0){
          const d=dist2(human,p);
          if(d<best){best=d;rival=p;}
        }
      }
      if(!rival)return;
      const distance=Math.sqrt(best);
      const context=this.learningContext(human,rival,distance);
      const forward=dirFromRot(human.rot);
      const dx=rival.x-human.x,dy=rival.y-human.y;
      const align=distance>1?(forward.x*dx+forward.y*dy)/distance:1;

      let resourceAligned=false;
      if(control.thrust&&(human.bullets<=2||human.shield<=0)){
        let pickup=null,pickupDistance=Infinity;
        for(const pk of this.pickups){
          if(pk.type!=='shield'&&!pk.type.startsWith('ammo'))continue;
          const pd=Math.sqrt(dist2(human,pk));
          if(pd<pickupDistance){pickupDistance=pd;pickup=pk;}
        }
        if(pickup&&pickupDistance<700){
          const px=pickup.x-human.x,py=pickup.y-human.y;
          const pickupAlign=(forward.x*px+forward.y*py)/(pickupDistance||1);
          resourceAligned=pickupAlign>.45;
        }
      }

      let action='';
      if(resourceAligned)action='resource';
      else if(control.fire&&human.bullets>0)action='attack';
      else if(human.bullets===0)action='evade';
      else if(control.thrust&&align>.38)action='attack';
      else if(control.thrust&&align<-.08)action='evade';
      else if(distance<430&&human.shield<=0&&Math.abs(Number(control.turn)||0)>.45)action='evade';

      if(action)this.recordHumanLearning(context,action);
    }
    chooseMeteorControls(cpu){
      if(!cpu||cpu.dead)return null;
      if(cpu.meteorDecision){
        const tracked=this.meteors.find(m=>m.id===cpu.meteorDecision.meteorId)||null;
        const trackedThreat=tracked?this.meteorThreatInfo(cpu,tracked):null;
        if(!tracked||(!trackedThreat&&this.fxClock-cpu.meteorDecision.started>.35)){
          this.settleMeteorDecision(cpu,.55);
        }
      }
      let threat=null,best=Infinity;
      for(const m of this.meteors){
        const info=this.meteorThreatInfo(cpu,m);
        if(!info)continue;
        const risk=info.ttc*90+info.closest*.7+info.dist*.08;
        if(risk<best){best=risk;threat=info;}
      }
      if(!threat)return null;

      // V21.63: una amenaza realmente inmediata se resuelve con geometria
      // determinista. Solo opera sobre el meteorito ya elegido: coste minimo.
      const safety=this.meteorSafetyControl(cpu,threat);
      if(safety)return safety;

      if(!cpu.meteorDecision||cpu.meteorDecision.meteorId!==threat.meteor.id){
        if(cpu.meteorDecision)this.settleMeteorDecision(cpu,.25);
        const context=this.meteorLearningContext(cpu,threat);
        const actions=['meteor_left','meteor_right','meteor_brake'];
        let action=threat.side===0?'meteor_right':'meteor_left';
        if(threat.dist<135&&threat.closing>170)action='meteor_brake';
        if(this.difficulty==='dificil'){
          const learned=actions
            .map(a=>({action:a,score:this.brainScore(context,a)}))
            .sort((a,b)=>b.score-a.score);
          const hasLearned=learned.length&&learned[0].score!==0;
          // En partida real no hay exploracion aleatoria de supervivencia.
          // El azar se conserva exclusivamente en el entrenamiento autonomo.
          if(hasLearned)action=learned[0].action;
          else if(this.trainingMode&&Math.random()<.34)action=actions[randint(0,actions.length-1)];
        }
        cpu.meteorDecision={meteorId:threat.meteor.id,context,action,started:this.fxClock};
      }

      const action=cpu.meteorDecision.action;
      const awayTurn=threat.side===0?-1:1;
      if(action==='meteor_brake')return{turn:awayTurn,thrust:false,fire:false};
      return{turn:action==='meteor_left'?1:-1,thrust:true,fire:false};
    }
    flushLearning(){
      if(this.learningSent||!this.learningEnabled||this.difficulty!=='dificil')return false;
      const deltas=this.buildLearningDeltas();
      this.learningSent=true;
      if(deltas.length)this.emit({t:'cpu-learning',deltas});
      return deltas.length>0;
    }
    buildLearningDeltas(){
      if(!this.learningEnabled||this.difficulty!=='dificil')return [];
      const general=[],shock=[],meteor=[],flare=[],humanGeneral=[],humanMeteor=[],humanShock=[];
      const human=this.players.find(p=>!p.cpu);
      for(const cpu of this.players.filter(p=>p.cpu)){
        const won=this.winner===cpu.index;
        let reward=(cpu.kills-cpu.deaths)/Math.max(2,SCORE_TO_WIN);
        if(won)reward+=1.2;
        if(human&&this.winner===human.index)reward-=.35;
        reward=clamp(reward,-2,2);
        const map=this.learningByCpu.get(cpu.index);
        if(map)for(const item of map.values()){
          const row={context:item.context,action:item.action,uses:Math.min(4,item.uses),reward:+reward.toFixed(3)};
          if(String(item.context||'').startsWith('shock-train-'))shock.push(row);
          else general.push(row);
        }
        const meteorMap=this.meteorLearningByCpu.get(cpu.index);
        if(meteorMap)for(const item of meteorMap.values()){
          const avg=item.uses?item.total/item.uses:0;
          meteor.push({context:item.context,action:item.action,uses:Math.min(4,item.uses),reward:+clamp(avg,-2,2).toFixed(3)});
        }
        const flareMap=this.flareLearningByCpu.get(cpu.index);
        if(flareMap)for(const item of flareMap.values()){
          const avg=item.uses?item.total/item.uses:0;
          flare.push({context:item.context,action:item.action,uses:Math.min(4,item.uses),reward:+clamp(avg,-2,2).toFixed(3)});
        }
      }

      if(human){
        let reward=(human.kills-human.deaths)/Math.max(2,SCORE_TO_WIN);
        if(this.winner===human.index)reward+=1.25;
        else if(this.winner!==null)reward-=.2;
        reward=clamp(reward,-.75,1.8);

        const humanItems=Array.from(this.humanLearning.values()).sort((a,b)=>b.uses-a.uses);
        for(const item of humanItems){
          humanGeneral.push({
            context:item.context,action:item.action,
            uses:Math.min(4,item.uses),
            reward:+reward.toFixed(3)
          });
        }
        const humanMeteorItems=Array.from(this.humanMeteorLearning.values()).sort((a,b)=>b.uses-a.uses);
        for(const item of humanMeteorItems){
          const avg=item.uses?item.total/item.uses:0;
          humanMeteor.push({
            context:item.context,action:item.action,
            uses:Math.min(4,item.uses),
            reward:+clamp(avg,-2,2).toFixed(3)
          });
        }
        const humanShockItems=Array.from(this.humanShockLearning.values()).sort((a,b)=>b.uses-a.uses);
        for(const item of humanShockItems){
          humanShock.push({
            context:item.context,action:item.action,
            uses:Math.min(4,item.uses),
            reward:+reward.toFixed(3)
          });
        }
      }

      // V21.20: las nuevas estrategias de ONDA del entrenamiento autonomo
      // viajan en un bloque propio. No sustituyen ni borran aprendizaje previo.
      flare.sort((a,b)=>b.uses-a.uses||Math.abs(b.reward)-Math.abs(a.reward));
      shock.push(...humanShock);
      shock.sort((a,b)=>b.uses-a.uses||Math.abs(b.reward)-Math.abs(a.reward));
      return flare.slice(0,6)
        .concat(shock.slice(0,7),humanMeteor.slice(0,4),meteor.slice(0,5),humanGeneral.slice(0,4),general.slice(0,5))
        .slice(0,CPU_LEARNING_DELTA_MAX);
    }
    resetAsteroids(){
      // V19.54: el primer asteroide entra desde un borde y trayectoria aleatorios.
      const profile=this.hazardProfile();
      this.asteroids=[];
      this.spawnAsteroidFromEdge(randint(0,ASTEROID_STARTS.length-1),true);
      this.nextAsteroidIndex=1;
      this.nextAsteroidSpawn=rand(profile.asteroidInitialMin,profile.asteroidInitialMax);
      this.asteroidRampComplete=false;
      this.asteroidTargetCount=ASTEROID_MAX_ACTIVE;
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
      if(!this.asteroidRampComplete){
        this.nextAsteroidSpawn-=DT;
        if(this.nextAsteroidSpawn<=0)this.spawnProgressiveAsteroid();
        return;
      }
      const transitioning=this.asteroids.some(a=>a.exiting||a.exitDelay>=0);
      if(!transitioning&&this.asteroidPopulationUnits()<this.asteroidTargetCount){
        this.nextAsteroidSpawn-=DT;
        if(this.nextAsteroidSpawn<=0){
          this.spawnAsteroidFromEdge(randint(0,ASTEROID_STARTS.length-1));
          this.nextAsteroidSpawn=this.asteroidPopulationUnits()<this.asteroidTargetCount?rand(profile.asteroidRespawnMin,profile.asteroidRespawnMax):999999;
        }
        return;
      }
      if(!transitioning&&this.asteroidPopulationUnits()===this.asteroidTargetCount){
        this.nextAsteroidPopulationChange-=DT;
        if(this.nextAsteroidPopulationChange<=0)this.chooseAsteroidPopulation();
      }
    }
    makePlayer(index,name,cpu){
      return{
        index,name:safeName(name,cpu?'CPU':'JUGADOR '+(index+1)),cpu,
        x:0,y:0,rot:0,vx:0,vy:0,thrust:false,
        bullets:5,cadence:30,speed:1,kills:0,deaths:0,
        reload:0,shield:0,camo:0,protection:SPAWN_PROTECTION_SECONDS,spawnFx:SPAWN_MATERIALIZE_SECONDS,spawnAnchorX:0,spawnAnchorY:0,
        guided:false,guidedTarget:-1,guidedAmmo:0,joystickRocketHeld:false,flare:0,flareHold:0,flareGesture:false,specialReleaseLock:false,shockwave:false,shockReachAt:0,shockExplodeAt:0,shockOwner:-1,nextShockLearning:0,
        dead:false,respawn:0,lastControlAt:Date.now(),lastSpawn:null,
        cpuFireDelay:cpu?CPU_ARMED_WARNING_SECONDS:0,
        difficulty:this.difficulty,
        tactic:'scatter',tacticUntil:0,tacticTurn:(Math.random()<.5?-1:1),tacticSeed:Math.random(),
        resourceTargetId:null,meteorDecision:null,flareDecision:null,flarePending:null,nextFlareDecision:0,nextFlareAllowed:0,
        easyNextDecision:0,easyControl:null,aiControl:null
      };
    }
    start(name='JUGADOR',difficulty='medio',cpuCount=1,brain=null,learningEnabled=true,campaignLevel=1){
      this.trainingMode=false;
      this.learningEnabled=learningEnabled!==false;
      this.campaignLevel=clamp(Math.round(Number(campaignLevel)||1),1,CAMPAIGN_LEVELS);
      this.difficulty=String(difficulty||'medio');
      this.brain=this.difficulty==='dificil'&&brain&&typeof brain==='object'?brain:null;
      this.learningByCpu.clear();
      this.meteorLearningByCpu.clear();
      this.flareLearningByCpu.clear();
      this.humanLearning.clear();
      this.humanMeteorLearning.clear();
      this.humanMeteorDecision=null;
      this.nextHumanObserve=0;
      this.learningSent=false;
      this.cpuCount=clamp(Math.round(Number(cpuCount)||1),1,3);
      this.huntTargetIndex=0;
      this.huntUntil=0;
      this.huntStartsAt=0;
      this.huntThresholdActive=false;
      this.players=[];
      this.controls.clear();
      this.seq=0;this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;this.ufo=null;this.ufoExtras=[];this.ufoWaveRemaining=0;this.ufoWaveNext=0;this.ufoWaveSwarm=false;this.ufoWaveSide=-1;this.ufoWaveAnchor=.5;this.ufoWaveSpawned=0;this.ufoWaveTotal=0;this.activeShockwaves=[];
      const hazard=this.hazardProfile();
      this.nextPickup=1;this.firstShower=rand(hazard.firstShowerMin,hazard.firstShowerMax);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(hazard.giantFirstMin,hazard.giantFirstMax);this.nextUfo=this.ufoLimit()>0?rand(UFO_FIRST_MIN,UFO_FIRST_MAX):999999;
      this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      const human=this.makePlayer(0,name,false);
      this.placeAtSpawn(human);
      this.players.push(human);
      this.controls.set(0,{turn:0,thrust:false,fire:false});
      for(let i=1;i<=this.cpuCount;i++){
        const cpu=this.makePlayer(i,'CPU '+i,true);
        cpu.difficulty=this.difficulty;
        if(this.difficulty==='dificil'){
          const opening=this.chooseBrainAction('open3',['attack','evade','resource','scatter'],i===3?.24:.34);
          cpu.tactic=opening;
          cpu.tacticUntil=rand(i===3?1.8:.9,i===3?3.8:2.6);
          if(i===3)this.recordLearning(cpu,'open3',opening);
        }else{
          cpu.tactic='scatter';
          cpu.tacticUntil=rand(.5,2.2);
        }
        this.placeAtSpawn(cpu);
        this.players.push(cpu);
        this.controls.set(i,{turn:0,thrust:false,fire:false});
      }
      this.started=true;this.finished=false;this.winner=null;
      this.lastNow=0;this.accumulator=0;this.tickCount=0;
      return true;
    }
    startTraining(brain=null){
      this.trainingMode=true;
      this.learningEnabled=true;
      this.campaignLevel=1;
      this.difficulty='dificil';
      this.brain=brain&&typeof brain==='object'?brain:null;
      this.learningByCpu.clear();
      this.meteorLearningByCpu.clear();
      this.flareLearningByCpu.clear();
      this.humanLearning.clear();
      this.humanMeteorLearning.clear();
      this.humanMeteorDecision=null;
      this.nextHumanObserve=0;
      this.learningSent=false;
      this.cpuCount=4;
      this.huntTargetIndex=0;
      this.huntUntil=0;
      this.huntStartsAt=0;
      this.huntThresholdActive=false;
      this.players=[];
      this.controls.clear();
      this.seq=0;this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;this.ufo=null;this.ufoExtras=[];this.ufoWaveRemaining=0;this.ufoWaveNext=0;this.ufoWaveSwarm=false;this.ufoWaveSide=-1;this.ufoWaveAnchor=.5;this.ufoWaveSpawned=0;this.ufoWaveTotal=0;this.activeShockwaves=[];
      const hazard=this.hazardProfile();
      this.nextPickup=1;this.firstShower=rand(hazard.firstShowerMin,hazard.firstShowerMax);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);this.nextUfo=this.ufoLimit()>0?rand(UFO_FIRST_MIN,UFO_FIRST_MAX):999999;
      this.resetAsteroids();
      for(let i=0;i<4;i++){
        const cpu=this.makePlayer(i,'CPU '+(i+1),true);
        cpu.difficulty='dificil';
        const opening=this.chooseBrainAction('open3',['attack','evade','resource','scatter'],i===3?.24:.38);
        cpu.tactic=opening;
        cpu.tacticUntil=rand(i===3?1.8:.9,i===3?3.8:2.6);
        if(i===3)this.recordLearning(cpu,'open3',opening);
        this.placeAtSpawn(cpu);
        this.players.push(cpu);
        this.controls.set(i,{turn:0,thrust:false,fire:false});
      }
      this.started=true;this.finished=false;this.winner=null;
      this.lastNow=0;this.accumulator=0;this.tickCount=0;
      return true;
    }
    stop(){this.started=false;this.lastNow=0;this.accumulator=0;}
    setControl(turn,thrust,fire,actions={}){
      const p=this.players[0];
      if(!p)return false;
      let c=this.controls.get(0);
      if(!c){c={turn:0,thrust:false,fire:false};this.controls.set(0,c);}
      c.turn=clamp(Number(turn)||0,-1,1);c.thrust=!!thrust;c.fire=!!fire;c.directFire=actions.directFire===true;c.rocket=actions.rocket===true;c.flare=actions.flare===true;c.shock=actions.shock===true;
      p.lastControlAt=Date.now();
      return true;
    }
    handleMessage(msg){
      if(!msg||typeof msg!=='object')return true;
      if(msg.t==='ctrl'){this.setControl(msg.turn,msg.thrust,msg.fire,msg);return true;}
      if(msg.t==='restart'){
        if(Number.isFinite(Number(msg.level)))this.campaignLevel=clamp(Math.round(Number(msg.level)||1),1,CAMPAIGN_LEVELS);
        if(this.restart()){
          this.emit({t:'restarted'});
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
      // REPETIR nunca descarta aprendizaje pendiente: se envia antes de limpiar
      // la ronda. Si ya se guardo al producirse la victoria, learningSent evita
      // cualquier envio duplicado.
      this.flushLearning();
      this.started=false;this.finished=false;this.winner=null;this.seq=0;
      this.learningByCpu.clear();this.meteorLearningByCpu.clear();this.flareLearningByCpu.clear();
      this.humanLearning.clear();this.humanMeteorLearning.clear();this.humanMeteorDecision=null;this.nextHumanObserve=0;
      this.learningSent=false;
      this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;this.ufo=null;this.ufoExtras=[];this.ufoWaveRemaining=0;this.ufoWaveNext=0;this.ufoWaveSwarm=false;this.ufoWaveSide=-1;this.ufoWaveAnchor=.5;this.ufoWaveSpawned=0;this.ufoWaveTotal=0;this.activeShockwaves=[];
      const hazard=this.hazardProfile();
      this.nextPickup=1;this.firstShower=rand(hazard.firstShowerMin,hazard.firstShowerMax);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(hazard.giantFirstMin,hazard.giantFirstMax);this.nextUfo=this.ufoLimit()>0?rand(UFO_FIRST_MIN,UFO_FIRST_MAX):999999;
      this.huntTargetIndex=0;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const p of this.players)p.dead=true;
      for(const p of this.players){
        p.bullets=5;p.cadence=30;p.speed=1;p.kills=0;p.deaths=0;p.reload=0;p.guided=false;p.guidedTarget=-1;p.guidedAmmo=0;p.joystickRocketHeld=false;p.flare=0;p.flareHold=0;p.flareGesture=false;p.specialReleaseLock=false;p.shockwave=false;p.shockReachAt=0;p.shockExplodeAt=0;p.shockOwner=-1;p.nextShockLearning=0;
        p.shield=0;p.camo=0;p.spawnFx=SPAWN_MATERIALIZE_SECONDS;p.protection=SPAWN_PROTECTION_SECONDS;p.respawn=0;
        p.lastControlAt=Date.now();p.lastSpawn=null;p.resourceTargetId=null;p.meteorDecision=null;p.flareDecision=null;p.flarePending=null;p.nextFlareDecision=0;p.nextFlareAllowed=0;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
        if(p.cpu){
          p.easyNextDecision=0;p.easyControl=null;
          p.tacticSeed=Math.random();p.tacticTurn=Math.random()<.5?-1:1;
          if(this.difficulty==='dificil'){
            const opening=this.chooseBrainAction('open3',['attack','evade','resource','scatter'],p.index===3?.24:.34);
            p.tactic=opening;p.tacticUntil=rand(p.index===3?1.8:.9,p.index===3?3.8:2.6);
            if(p.index===3)this.recordLearning(p,'open3',opening);
          }else{
            p.tactic='scatter';p.tacticUntil=rand(.5,2.2);
          }
        }
        this.controls.set(p.index,{turn:0,thrust:false,fire:false});
        this.placeAtSpawn(p);p.dead=false;
      }
      this.started=true;this.lastNow=0;this.accumulator=0;this.tickCount=0;
      return true;
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
      if(victim.cpu&&victim.flareDecision)this.settleFlareDecision(victim,victim.flareDecision.action==='flare_use'?-.95:-1.55);
      if(victim.cpu)victim.flarePending=null;
      if(!victim.cpu)this.humanMeteorDecision=null;
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
          this.flushLearning();
          this.emit({t:'victory',winner:this.winner});
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
      p.bullets=1;p.cadence=30;p.speed=1;p.shield=0;p.camo=0;p.reload=this.reloadTime(p);p.guided=false;p.guidedTarget=-1;p.guidedAmmo=0;p.joystickRocketHeld=false;p.flareHold=0;p.flareGesture=false;p.specialReleaseLock=false;p.shockwave=false;p.shockReachAt=0;p.shockExplodeAt=0;p.shockOwner=-1;p.nextShockLearning=0;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
      if(p.cpu){p.resourceTargetId=null;p.meteorDecision=null;p.flareDecision=null;p.flarePending=null;p.nextFlareDecision=0;p.easyNextDecision=0;p.easyControl=null;}
    }
    deployShockwave(p){
      if(!p||p.dead||!p.shockwave)return false;
      // V21.40: una activacion humana enseña a la CPU en el mismo contexto
      // tactico que usa el entrenamiento autonomo.
      if(!p.cpu&&this.learningEnabled&&!this.trainingMode&&this.difficulty==='dificil'){
        const shockSituation=this.shockwaveSituation(p);
        if(shockSituation)this.recordHumanShockLearning(shockSituation.context,'shock_use');
      }
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
      // V21.08: cada nave debe esperar al menos medio segundo entre dos
      // lanzamientos de bengalas, aunque tenga varias cargas acumuladas.
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
    resolveFireWithFlare(p,c,dt){
      let fireNow=!!(c&&c.fire);
      if(!p)return fireNow;
      if(p.cpu){
        if(p.shockwave){
          if(this.trainingMode){
            // V21.20: entrenamiento autonomo especifico de ONDA EXPANSIVA.
            // Usa contextos NUEVOS; no borra ni reescribe aprendizaje anterior.
            const situation=this.shockwaveSituation(p);
            if(situation){
              let use=situation.critical||situation.kind==='multi'||situation.kind==='missile'||situation.kind==='asteroid'||situation.kind==='bullet';
              if(situation.kind==='single'){
                // Un solo rival cercano es buen uso, pero en entrenamiento se
                // conserva algo de exploracion para aprender a no malgastarla.
                const learned=!!(this.brain&&Array.isArray(this.brain.strategies)&&this.brain.strategies.some(e=>e&&e.context===situation.context&&e.action==='shock_use'));
                if(learned)use=this.brainScore(situation.context,'shock_use')>=-.05||Math.random()<.18;
                else use=Math.random()<.72;
              }
              if(use){
                this.recordLearning(p,situation.context,'shock_use');
                this.deployShockwave(p);
              }else if(this.fxClock>=(Number(p.nextShockLearning)||0)){
                p.nextShockLearning=this.fxClock+.9;
                this.recordLearning(p,situation.context,'shock_keep');
              }
            }
          }else if(this.difficulty==='dificil'){
            // V21.26: la CPU DIFICIL de la partida real consulta exactamente
            // los contextos aprendidos por el entrenamiento autonomo de ONDA.
            const situation=this.shockwaveSituation(p);
            if(situation){
              const learnedUse=this.learnedShockwaveDecision(situation);
              // Seguridad/tactica: una amenaza critica o dos rivales juntos
              // nunca se ignoran aunque el Brain aun tenga pocas muestras.
              const forceUse=!!situation.critical||situation.kind==='multi';
              const fallbackUse=situation.kind==='missile'||situation.kind==='asteroid'||situation.kind==='bullet'||situation.kind==='single';
              const use=forceUse||(learnedUse===null?fallbackUse:learnedUse);
              if(use){
                this.recordLearning(p,situation.context,'shock_use');
                this.deployShockwave(p);
              }else if(this.fxClock>=(Number(p.nextShockLearning)||0)){
                p.nextShockLearning=this.fxClock+.9;
                this.recordLearning(p,situation.context,'shock_keep');
              }
            }
          }else{
            // FACIL y MEDIO conservan exactamente la logica anterior.
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
        }
        this.smartCpuFlare(p);
        return fireNow;
      }
      // Una carga por pulsacion; el disparo del mando no usa el gesto especial.
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
    chooseCpuControls(cpu){
      if(cpu.dead)return IDLE_CONTROL;

      // FACIL reacciona deliberadamente mas despacio: mantiene la decision
      // anterior durante unas decimas en vez de recalcularla en cada tick.
      if(this.difficulty==='facil'&&cpu.easyControl&&this.fxClock<cpu.easyNextDecision){
        return cpu.easyControl;
      }

      const base=this.chooseCpuControlsBase(cpu);
      const traffic=this.cpuOpeningCollisionAvoidance(cpu,base);
      if(traffic)return traffic;
      if(this.difficulty!=='facil')return base;

      // Degradacion solo de la IA, nunca de las fisicas:
      // gira con menos precision, a veces duda al acelerar y no dispara siempre
      // que encuentra una oportunidad.
      let turn=clamp((Number(base.turn)||0)*.68+rand(-.18,.18),-1,1);
      if(Math.random()<.10)turn=clamp(turn+rand(-.35,.35),-1,1);
      const control={
        turn,
        thrust:!!base.thrust&&Math.random()>.14,
        fire:!!base.fire&&Math.random()>.22
      };
      cpu.easyControl=control;
      cpu.easyNextDecision=this.fxClock+rand(.48,.82);
      return control;
    }
    // V21.67: capa de seguridad predictiva muy barata para CPU.
    // Solo interviene ante una trayectoria real de choque y no modifica
    // aprendizaje, fisica, colisiones ni red.
    cpuRockSafetyControl(cpu){
      if(!cpu||cpu.dead||cpu.protection>0)return null;
      let best=null,bestRisk=Infinity;

      const consider=(h,r,kind)=>{
        if(!h)return;
        const dx=(Number(h.x)||0)-(Number(cpu.x)||0);
        const dy=(Number(h.y)||0)-(Number(cpu.y)||0);
        const d2=dx*dx+dy*dy;
        const maxRange=kind==='giant'?760:560;
        if(d2>maxRange*maxRange)return;

        const rvx=(Number(h.vx)||0)-(Number(cpu.vx)||0);
        const rvy=(Number(h.vy)||0)-(Number(cpu.vy)||0);
        const vv=rvx*rvx+rvy*rvy;
        const dot=dx*rvx+dy*rvy;
        const safe=SHIP_RADIUS+Math.max(8,Number(r)||0)+(kind==='meteor'?26:36);
        const near=safe+72;

        // Si ya se alejan, solo reaccionamos cuando estan realmente encima.
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

        // Menor riesgo = choque mas cercano en tiempo/espacio.
        const risk=ttc*145+closest2/(safe*safe)*32+d2/(maxRange*maxRange)*18;
        if(risk<bestRisk){
          bestRisk=risk;
          best={dx,dy,d2,rvx,rvy,ttc,cx,cy,safe,kind};
        }
      };

      // Asteroides normales: maximo 5.
      for(const a of this.asteroids)consider(a,a.r||ASTEROID_RADIUS,'asteroid');

      // Lluvia: filtro por distancia al cuadrado antes de cualquier raiz.
      for(const m of this.meteors)consider(m,m.r||SMALL_METEOR_RADIUS,'meteor');

      if(this.giant)consider(this.giant,this.giant.r||GIANT_RADIUS,'giant');
      if(!best)return null;

      // Escapamos del punto de maxima aproximacion. Si el cruce es casi
      // perfecto, elegimos la perpendicular que exige menos giro.
      let ex=-best.cx,ey=-best.cy;
      let el2=ex*ex+ey*ey;
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

      // Cuando el choque es inminente, primero deja de empujar y gira.
      // Solo acelera al estar orientada hacia una salida clara.
      return{
        turn:clamp(err/30,-1,1),
        thrust:!emergency&&absErr<24,
        fire:false
      };
    }

    chooseCpuControlsBase(cpu){
      if(cpu.dead)return IDLE_CONTROL;

      const rockSafety=this.cpuRockSafetyControl(cpu);
      if(rockSafety)return rockSafety;

      const meteorControl=this.chooseMeteorControls(cpu);
      if(meteorControl)return meteorControl;

      let rival=null;
      const huntGrace=this.huntThresholdActive&&this.fxClock<this.huntStartsAt;
      if(this.huntUntil>this.fxClock&&this.fxClock>=this.huntStartsAt){
        rival=this.players.find(p=>p.index===this.huntTargetIndex&&!p.dead&&p.camo<=0)||null;
      }
      if(!rival){
        // La esfera convierte a su portador en objetivo prioritario. Las CPU
        // intentan neutralizarlo desde fuera del radio seguro.
        let shockBest=Infinity;
        for(const p of this.players){
          if(p.index===cpu.index||p.dead||p.camo>0||!p.shockwave)continue;
          if(huntGrace&&p.index===this.huntTargetIndex)continue;
          const d=dist2(cpu,p);
          if(d<shockBest){shockBest=d;rival=p;}
        }
      }
      if(!rival){
        let best=Infinity;
        for(const p of this.players){
          if(p.index===cpu.index||p.dead||p.camo>0)continue;
          if(huntGrace&&p.index===this.huntTargetIndex)continue;
          const d=dist2(cpu,p);
          if(d<best){best=d;rival=p;}
        }
      }

      // Primera salida menos predecible: cada CPU gira/abre su trayectoria
      // durante un intervalo distinto antes de comprometerse con una tactica.
      if(cpu.tactic==='scatter'&&this.fxClock<cpu.tacticUntil){
        if(this.difficulty==='dificil'&&cpu.index===3)this.recordLearning(cpu,'open3','scatter');
        const turn=cpu.tacticTurn*(.32+.46*cpu.tacticSeed);
        const thrust=this.fxClock>cpu.tacticUntil*.18;
        return{turn,thrust,fire:false};
      }

      if(!rival){
        // Sin objetivo visible (por ejemplo jugador en FANTASMA): deriva y busca recursos.
        let target=null,best=Infinity;
        for(const pk of this.pickups){
          const useful=pk.type==='shield'||pk.type.startsWith('ammo')||(pk.type==='flare')||(pk.type==='shockwave'&&!cpu.shockwave)||(this.difficulty==='dificil'&&pk.type==='mira'&&!cpu.guided);
          if(!useful)continue;
          const d=dist2(cpu,pk);
          if(d<best){best=d;target=pk;}
        }
        if(!target)return{turn:cpu.tacticTurn*.25,thrust:true,fire:false};
        const dx=target.x-cpu.x,dy=target.y-cpu.y;
        const run=pickupRunThroughPlan(cpu,target,this.asteroids,this.meteors,this.giant,this.players);
        const tx=run&&run.clear?run.x:target.x,ty=run&&run.clear?run.y:target.y;
        const desired=(Math.atan2(-(tx-cpu.x),-(ty-cpu.y))*180/Math.PI+360)%360;
        const err=((desired-cpu.rot+540)%360)-180;
        return{turn:run&&run.clear&&run.aligned?0:clamp(err/38,-1,1),thrust:run&&run.clear?true:Math.abs(err)<70,fire:false};
      }

      const dx=rival.x-cpu.x,dy=rival.y-cpu.y,distance=Math.hypot(dx,dy);
      const rivalShielded=rival.shield>0||rival.protection>0;
      const rivalDangerous=rival.shield>0;
      const rivalHasShockwave=!!rival.shockwave;
      const huntActive=this.huntUntil>this.fxClock&&this.fxClock>=this.huntStartsAt&&rival.index===this.huntTargetIndex;

      // Cuando el humano esta a una baja de ganar, A POR tiene prioridad total:
      // si esta visible, las CPU pueden actuar como kamikazes aunque no tengan
      // municion ni escudo. Fuera de ese caso siguen usando la logica normal.
      if(huntActive){
        cpu.tactic='attack';
        cpu.tacticUntil=this.fxClock+.55;
        cpu.resourceTargetId=null;
      }

      // La decision se "consensua" entre municion, peligro, distancia, escudo,
      // recursos cercanos y una pequena personalidad propia. Se mantiene un
      // corto tiempo para evitar cambios nerviosos cada frame.
      if(!huntActive&&(this.fxClock>=cpu.tacticUntil||cpu.tactic==='scatter')){
        let attackScore=cpu.bullets>0?48:-35;
        let evadeScore=cpu.bullets===0?68:8;
        let resourceScore=0;
        if(cpu.shield>0)attackScore+=34;
        if(rivalDangerous){evadeScore+=48;attackScore-=24;}
        if(distance<420)evadeScore+=cpu.shield>0?-10:22;
        if(distance>900&&cpu.bullets>0)attackScore+=12;
        if(huntActive)attackScore+=38;
        if(cpu.bullets<=1)resourceScore+=58;
        else if(cpu.bullets<=3)resourceScore+=24;
        if(cpu.shield<=0)resourceScore+=22;
        if(this.pickups.some(pk=>pk.type==='shockwave')&&!cpu.shockwave)resourceScore+=82;
        if(rivalHasShockwave){evadeScore+=72;attackScore+=cpu.bullets>0?20:-18;}

        let hasUsefulPickup=false;
        for(const pk of this.pickups){
          if(pk.type==='shield'||pk.type.startsWith('ammo')||(pk.type==='flare')||(pk.type==='shockwave'&&!cpu.shockwave)||(this.difficulty==='dificil'&&pk.type==='mira'&&!cpu.guided)){hasUsefulPickup=true;break;}
        }
        if(!hasUsefulPickup)resourceScore-=40;

        const context=this.learningContext(cpu,rival,distance);
        if(this.difficulty==='dificil'&&this.brain){
          attackScore+=this.brainScore(context,'attack')*30;
          evadeScore+=this.brainScore(context,'evade')*30;
          resourceScore+=this.brainScore(context,'resource')*30;
        }

        const personality=(cpu.tacticSeed-.5)*28;
        attackScore+=personality+rand(-12,12);
        evadeScore-=personality*.45;evadeScore+=rand(-10,10);
        resourceScore+=rand(-9,9);

        if(huntActive&&cpu.bullets>0&&cpu.shield>0)attackScore+=24;

        let tactic='attack',score=attackScore;
        if(evadeScore>score){tactic='evade';score=evadeScore;}
        if(resourceScore>score){tactic='resource';score=resourceScore;}
        cpu.tactic=tactic;
        cpu.tacticUntil=this.fxClock+rand(.85,2.05);
        cpu.tacticTurn=Math.random()<.5?-1:1;
        if(this.difficulty==='dificil')this.recordLearning(cpu,context,tactic);
      }

      let desiredX=rival.x,desiredY=rival.y,seekPickup=null,ramming=false;
      let defensive=false;

      const findResource=(preferShield=false)=>{
        const isUsefulResource=pk=>!!(pk&&(pk.type==='shield'||pk.type.startsWith('ammo')||(pk.type==='flare')||(pk.type==='shockwave'&&!cpu.shockwave)||(this.difficulty==='dificil'&&pk.type==='mira'&&!cpu.guided)));
        const locked=cpu.resourceTargetId==null?null:this.pickups.find(pk=>pk.id===cpu.resourceTargetId);
        if(isUsefulResource(locked))return locked;
        let bestPk=null,bestScore=Infinity;
        for(const pk of this.pickups){
          if(!isUsefulResource(pk))continue;
          let score=Math.sqrt(dist2(cpu,pk));
          if(preferShield&&pk.type==='shield')score-=260;
          if(pk.type==='shockwave'&&!cpu.shockwave)score-=520;
          // V21.11: en dificil la MIRA es un recurso ofensivo de mayor valor
          // que la municion normal. Debe atraer claramente a la CPU salvo
          // que haya una necesidad defensiva inmediata.
          if(this.difficulty==='dificil'&&pk.type==='mira'&&!cpu.guided)score-=cpu.bullets<=1?560:430;
          if(pk.type==='flare')score-=210;
          if(cpu.bullets===0&&pk.type.startsWith('ammo'))score-=260;
          if(cpu.bullets<=2&&pk.type.startsWith('ammo'))score-=90;
          const rivalDistance=Math.sqrt(dist2(rival,pk));
          if(cpu.shield<=0&&rivalDistance<420)score+=(420-rivalDistance)*1.2;
          if(score<bestScore){bestScore=score;bestPk=pk;}
        }
        cpu.resourceTargetId=bestPk?bestPk.id:null;
        return bestPk;
      };

      if(!huntActive&&(cpu.tactic==='resource'||cpu.bullets===0)){
        seekPickup=findResource(cpu.shield<=0);
        if(seekPickup){
          desiredX=seekPickup.x;desiredY=seekPickup.y;defensive=true;
          // Mientras va a por armas/escudo, abre la trayectoria respecto al rival.
          if(distance<760){
            const inv=1/(distance||1),push=(760-distance)*(cpu.shield>0?.35:.82);
            desiredX+=(cpu.x-rival.x)*inv*push;
            desiredY+=(cpu.y-rival.y)*inv*push;
          }
        }else{
          // En los primeros segundos una CPU que eligio buscar recursos espera
          // a que aparezca una mejora en vez de convertir la salida siempre en huida.
          if(this.difficulty==='dificil'&&this.fxClock<2.8){
            return{turn:cpu.tacticTurn*.32,thrust:true,fire:false};
          }
          cpu.tactic='evade';
        }
      }

      if(!huntActive&&cpu.tactic==='evade'&&!seekPickup){
        // Huir no significa escapar para siempre: primero intenta rearmarse o
        // conseguir escudo; si no hay recurso util, crea distancia.
        seekPickup=findResource(cpu.shield<=0);
        if(seekPickup){
          desiredX=seekPickup.x;desiredY=seekPickup.y;defensive=true;
        }else{
          const inv=1/(distance||1);
          const side=cpu.tacticTurn*260;
          desiredX=cpu.x+(cpu.x-rival.x)*inv*900+(-dy/(distance||1))*side;
          desiredY=cpu.y+(cpu.y-rival.y)*inv*900+(dx/(distance||1))*side;
          defensive=true;
        }
      }

      if(!seekPickup&&cpu.tactic!=='resource'&&cpu.bullets>0)cpu.resourceTargetId=null;

      // Con escudo la CPU usa siempre la embestida como opcion ofensiva:
      // deja de huir o buscar recursos y se dirige al rival visible. Si ambos
      // tienen escudo, chocaran y rebotaran segun la fisica normal.
      if(cpu.shield>0&&!rivalHasShockwave){
        cpu.tactic='attack';
        cpu.resourceTargetId=null;
        seekPickup=null;
        ramming=true;
        desiredX=rival.x;desiredY=rival.y;
      }

      if(cpu.tactic==='attack'&&!seekPickup){
        // En A POR la embestida esta permitida incluso sin balas y sin escudo.
        // El modo fantasma sigue mandando: si el humano no es visible, no hay
        // rival y esta rama no conoce su posicion.
        if(huntActive){
          ramming=true;
          desiredX=rival.x;desiredY=rival.y;
        }
        if(ramming){
          desiredX=rival.x;desiredY=rival.y;
        }else if(distance<210&&cpu.shield<=0){
          const inv=1/(distance||1),side=cpu.tacticTurn*230;
          desiredX=cpu.x+(cpu.x-rival.x)*inv*360+(-dy/(distance||1))*side;
          desiredY=cpu.y+(cpu.y-rival.y)*inv*360+(dx/(distance||1))*side;
          defensive=true;
        }
      }

      if(rivalHasShockwave&&!huntActive&&!(seekPickup&&seekPickup.type==='shockwave')){
        ramming=false;defensive=true;
        const inv=1/(distance||1);
        const ux=(cpu.x-rival.x)*inv,uy=(cpu.y-rival.y)*inv;
        const side=cpu.tacticTurn;
        if(distance<SHOCKWAVE_SAFE_DISTANCE+18){
          desiredX=cpu.x+ux*900+(-uy)*side*180;
          desiredY=cpu.y+uy*900+(ux)*side*180;
        }else if(distance<SHOCKWAVE_STANDOFF_DISTANCE+70){
          desiredX=cpu.x+(-uy)*side*260;
          desiredY=cpu.y+(ux)*side*260;
        }else{
          desiredX=rival.x+ux*SHOCKWAVE_STANDOFF_DISTANCE;
          desiredY=rival.y+uy*SHOCKWAVE_STANDOFF_DISTANCE;
        }
        if(this.difficulty==='dificil'&&this.fxClock>=(Number(cpu.nextShockLearning)||0)){
          cpu.nextShockLearning=this.fxClock+.9;
          this.recordLearning(cpu,this.shockLearningContext('threat',distance),'shock_keep_range');
        }
      }

      let pickupDistance=Infinity,pickupRun=null;
      if(seekPickup){
        const px=seekPickup.x-cpu.x,py=seekPickup.y-cpu.y;
        pickupDistance=Math.hypot(px,py);
        pickupRun=pickupRunThroughPlan(cpu,seekPickup,this.asteroids,this.meteors,this.giant,this.players);
        if(pickupRun&&pickupRun.clear){
          desiredX=pickupRun.x;desiredY=pickupRun.y;
        }
      }
      const ddx=desiredX-cpu.x,ddy=desiredY-cpu.y;
      const desiredRot=(Math.atan2(-ddx,-ddy)*180/Math.PI+360)%360;
      let err=((desiredRot-cpu.rot+540)%360)-180;

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

      // Todas las CPU se separan algo entre si; en A POR el efecto es mayor.
      for(const mate of this.players){
        if(!mate.cpu||mate.index===cpu.index||mate.dead)continue;
        const hx=cpu.x-mate.x,hy=cpu.y-mate.y,d=Math.hypot(hx,hy);
        const safe=SHIP_RADIUS*(huntActive?5.2:3.6);
        if(d<safe&&d>1){
          const strength=(safe-d)*(huntActive?1.8:1.15);
          avoidX+=hx/d*strength;avoidY+=hy/d*strength;
          const side=(cpu.index<mate.index?1:-1)*Math.max(0,safe-d)*(huntActive?.55:.28);
          avoidX+=-hy/d*side;avoidY+=hx/d*side;
        }
      }

      const avoidMag=Math.hypot(avoidX,avoidY);
      const pickupRunClear=!!(pickupRun&&pickupRun.clear);
      if(!pickupRunClear&&avoidMag>20){
        const ar=(Math.atan2(-avoidX,-avoidY)*180/Math.PI+360)%360;
        err=((ar-cpu.rot+540)%360)-180;
      }

      // En un corredor limpio acelera HASTA atravesar la mejora.
      // La colision continua del pickup garantiza la recogida incluso a alta velocidad.
      const turn=pickupRunClear&&pickupRun.aligned?0:clamp(err/38,-1,1);
      const thrust=pickupRunClear?true:(huntActive?Math.abs(err)<82:!!(Math.abs(err)<68&&(distance>230||seekPickup||defensive||ramming||avoidMag>20)));

      // Si el rival entra claramente en la linea de tiro, dispara aunque la CPU
      // estuviera buscando un pickup o saliendo de una maniobra defensiva.
      // Conservamos solo las restricciones fisicas reales: tener balas, recarga
      // terminada, rival visible y estar dentro del alcance.
      const aimRot=(Math.atan2(-dx,-dy)*180/Math.PI+360)%360;
      const aimErr=((aimRot-cpu.rot+540)%360)-180;
      const guidedReady=!!(cpu.guided&&Number.isInteger(cpu.guidedTarget)&&cpu.guidedTarget>=0);
      const firingArc=guidedReady&&this.difficulty==='dificil'?30:7;
      const inFiringArc=Math.abs(aimErr)<firingArc&&distance<1350;
      const fire=(cpu.bullets>0||Number(cpu.guidedAmmo)>0)&&cpu.reload<=0&&inFiringArc&&(huntActive||!rivalDangerous)&&(!rivalHasShockwave||distance>SHOCKWAVE_SAFE_DISTANCE);
      return{turn,thrust,fire};
    }
    update(dt){
      if(!this.started||this.finished)return;
      this.noDeathTime+=dt;this.fxClock+=dt;
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
          // V21.61: en campaña CPU la onda comprueba los tres OVNIs
          // posibles. Los extras se revisan primero para que, si cae el principal,
          // su relevo ya haya sido evaluado en este mismo frente expansivo.
          for(let ui=this.ufoExtras.length-1;ui>=0;ui--){
            const extra=this.ufoExtras[ui];
            const ux=extra.x-wave.x,uy=extra.y-wave.y;
            const ufoDistance=Math.hypot(ux,uy);
            if(ufoDistance-UFO_RADIUS<=radius&&ufoDistance+UFO_RADIUS>=previous){
              this.destroyUfo(owner?owner.index:-1,extra);
            }
          }
          if(this.ufo){
            const ux=this.ufo.x-wave.x,uy=this.ufo.y-wave.y;
            const ufoDistance=Math.hypot(ux,uy);
            if(ufoDistance-UFO_RADIUS<=radius&&ufoDistance+UFO_RADIUS>=previous){
              this.destroyUfo(owner?owner.index:-1,this.ufo);
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
      let human=null;
      const cpuPlayers=this.cpuScratch;cpuPlayers.length=0;
      if(!this.trainingMode){
        for(const p of this.players){
          if(p.cpu)cpuPlayers.push(p);
          else if(!human)human=p;
        }
      }
      const huntScore=SCORE_TO_WIN-1;
      const shouldHunt=!!(!this.trainingMode&&cpuPlayers.length&&human&&!this.finished&&human.kills>=huntScore&&human.kills<SCORE_TO_WIN);
      if(shouldHunt&&!this.huntThresholdActive){
        this.huntThresholdActive=true;
        this.huntTargetIndex=human.index;
        this.huntStartsAt=this.fxClock+3;
        this.huntUntil=Infinity;
        const cpuIndices=[],cpuAmmoTotals=[];
        for(const cpu of cpuPlayers){
          cpu.bullets+=4;
          cpuIndices.push(cpu.index);
          cpuAmmoTotals.push([cpu.index,cpu.bullets]);
        }
        this.emit({t:'hunt',name:human.name,duration:0,graceMs:3000,cpuAmmo:true,cpuAmmoBonus:4,cpuIndices,cpuAmmoTotals});
      }else if(!shouldHunt&&this.huntThresholdActive){
        this.huntThresholdActive=false;
        this.huntStartsAt=0;
        this.huntUntil=0;
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
          // V20.10: la CPU queda visualmente ARMADA durante 1 segundo antes
          // de poder soltar la bala. Movimiento, giro y punteria siguen activos.
          if(p.bullets>0&&p.reload<=0)p.cpuFireDelay=Math.max(0,(Number(p.cpuFireDelay)||0)-dt);
          else p.cpuFireDelay=CPU_ARMED_WARNING_SECONDS;
        }
        p.px=p.x;p.py=p.y;
        const stored=this.controls.get(p.index)||IDLE_CONTROL;
        let c;
        if(p.cpu){
          // Estrategia CPU a 30 Hz. La simulacion, colisiones, comprobacion
          // final de disparo y reaccion de bengalas siguen ejecutandose a 60 Hz.
          if(!p.aiControl||(this.tickCount&1)===0)p.aiControl=this.chooseCpuControls(p);
          c=p.aiControl||IDLE_CONTROL;
        }else c=(controlNow-(p.lastControlAt||0)<=300)?stored:IDLE_CONTROL;
        if(!p.cpu)this.observeHumanLearning(p,c);
        p.thrust=!!c.thrust;
        p.rot=(p.rot+c.turn*240*dt+360)%360;
        const d=dirFromRot(p.rot);
        if(c.thrust){p.vx+=d.x*(240*p.speed)*dt;p.vy+=d.y*(240*p.speed)*dt;}
        p.vx*=DRAG_PER_TICK;p.vy*=DRAG_PER_TICK;
        const vmax=330*p.speed,sp=Math.hypot(p.vx,p.vy);
        if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
        p.x=(p.x+p.vx*dt+W)%W;p.y=(p.y+p.vy*dt+H)%H;
        p.guided=Number(p.guidedAmmo)>0;
        p.guidedTarget=p.guided?this.guidedTargetFor(p):-1;

        // Comprobacion final de disparo DESPUES de aplicar el giro de este frame.
        // Antes la IA decidia "disparo" con la rotacion anterior y la bala se
        // generaba con la rotacion ya modificada; en maniobras/evitacion podia
        // salir desviada. Ahora solo dispara si el morro final apunta de verdad
        // a un rival visible dentro del alcance.
        const rocketHeld=!!(c&&c.rocket);
        const rocketNow=!p.cpu&&rocketHeld&&!p.joystickRocketHeld;
        p.joystickRocketHeld=rocketHeld;
        let fireNow=this.resolveFireWithFlare(p,c,dt);
        if(p.cpu&&fireNow){
          fireNow=false;
          for(const target of this.players){
            if(target.index===p.index||target.dead||target.camo>0)continue;
            if(this.huntThresholdActive&&this.fxClock<this.huntStartsAt&&target.index===this.huntTargetIndex)continue;
            const tx=target.x-p.x,ty=target.y-p.y,td=Math.hypot(tx,ty);
            if(td<=0||td>=1350)continue;
            const dot=(d.x*tx+d.y*ty)/td;
            // FACIL abre mucho el cono de disparo: intenta tiros peores y,
            // por tanto, desperdicia mas balas y falla con mayor frecuencia.
            const fireAngle=this.difficulty==='facil'?18:7;
            if(dot>=Math.cos(fireAngle*Math.PI/180)){fireNow=true;break;}
          }
        }
        const rocketReady=rocketNow&&Number(p.guidedAmmo)>0;
        const guided=rocketReady?true:((c&&c.directFire)?false:!!p.guided);
        const hasAmmo=guided?Number(p.guidedAmmo)>0:Number(p.bullets)>0;
        if((fireNow||rocketReady)&&hasAmmo&&p.reload<=0&&(!p.cpu||(Number(p.cpuFireDelay)||0)<=0)){
          // V21.85: balas y misiles son reservas independientes.
          // Ambos usan este mismo reload, por tanto comparten la misma cadencia.
          const guidedTarget=guided?p.guidedTarget:-1;
          const cadence=Number(p.cadence)||30;
          const guidedSpeed=cadence>=30?400:(cadence>=20?460:(cadence>=10?520:580));
          const projectileSpeed=guided?guidedSpeed:this.bulletSpeed(p);
          this.bullets.push({id:uid(),owner:p.index,x:p.x+d.x*35,y:p.y+d.y*35,vx:d.x*projectileSpeed,vy:d.y*projectileSpeed,age:0,travel:0,guided,target:guidedTarget,flareTarget:-1,decoyed:false,baseSpeed:guided?guidedSpeed:projectileSpeed});
          if(guided){
            p.guidedAmmo=Math.max(0,(Number(p.guidedAmmo)||0)-1);
            p.guided=p.guidedAmmo>0;
            p.guidedTarget=p.guided?this.guidedTargetFor(p):-1;
          }else{
            p.bullets=Math.max(0,(Number(p.bullets)||0)-1);
          }
          p.reload=this.reloadTime(p);
          if(p.cpu)p.cpuFireDelay=CPU_ARMED_WARNING_SECONDS;
          this.emit({t:'sound',kind:'laser'});
        }
      }
      this.updateAsteroids(dt);this.updateFlares(dt);this.updateBullets(dt);this.updateExtraUfoProjectileHits();this.updatePickups(dt);this.updateShower(dt);this.updateMeteors(dt);this.updateGiant(dt);this.updateUfo(dt);this.shipCollisions();
    }
    reloadTime(p){
      const base=Math.max(.5,p.cadence/8);
      // V20.15: la recarga a mitad de tiempo se aplica ya a TODOS los modos,
      // humano y CPU. p.cadence y bulletSpeed() permanecen intactos.
      return base*.5;
    }
    bulletSpeed(p){return p.cadence>=30?500:p.cadence>=20?750:p.cadence>=10?900:1000;}
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
      // V21.74: intercepcion entre proyectiles enemigos.
      // Bala normal <-> misil: se destruyen ambos.
      // Misil <-> misil: se destruyen ambos al cruzarse.
      // Bala <-> bala sigue sin colision. Los proyectiles del mismo jugador
      // tampoco chocan entre si para evitar autointercepciones.
      if(this.bullets.length>1){
        const destroyedProjectiles=this.destroyedProjectileScratch;
        destroyedProjectiles.clear();
        for(let i=0;i<this.bullets.length;i++){
          const a=this.bullets[i];
          if(!a||destroyedProjectiles.has(a))continue;
          for(let j=i+1;j<this.bullets.length;j++){
            const b=this.bullets[j];
            if(!b||destroyedProjectiles.has(b))continue;
            if(Number(a.owner)===Number(b.owner))continue;

            const aMissile=!!a.guided,bMissile=!!b.guided;
            // Dos balas normales se atraviesan.
            if(!aMissile&&!bMissile)continue;

            if(aMissile&&bMissile){
              if(!sweptCircles(a,MISSILE_HIT_RADIUS,b,MISSILE_HIT_RADIUS,false))continue;
              destroyedProjectiles.add(a);
              destroyedProjectiles.add(b);
              const hitX=(a.x+b.x)*.5,hitY=(a.y+b.y)*.5;
              this.emitRocketDisintegrateAt(hitX,hitY,Number(a.owner)||0);
              this.emit({t:'sound',kind:'sparkle'});
              break;
            }

            const missile=aMissile?a:b;
            const bullet=aMissile?b:a;
            if(!sweptCircles(missile,MISSILE_HIT_RADIUS,bullet,BULLET_RADIUS,false))continue;

            destroyedProjectiles.add(missile);
            destroyedProjectiles.add(bullet);
            const hitX=(missile.x+bullet.x)*.5,hitY=(missile.y+bullet.y)*.5;
            this.emitRocketDisintegrateAt(hitX,hitY,Number(missile.owner)||0);
            this.emit({t:'sound',kind:'sparkle'});
            break;
          }
        }
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
          for(let f=this.flares.length-1;f>=0;f--){
            const flare=this.flares[f];
            if(sweptCircles(b,BULLET_RADIUS,flare,FLARE_RADIUS,false)){
              // V19.64: cualquier proyectil queda anulado por una bengala.
              // El misil conserva su explosion visual; la bala normal simplemente
              // desaparece junto con la bengala alcanzada.
              if(Number(flare.owner)!==Number(b.owner))this.emit({t:'intercept',index:Number(flare.owner),guided:!!b.guided});
              if(b.guided){
                this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
                this.emit({t:'sound',kind:'sparkle'});
              }
              this.flares.splice(f,1);
              remove=true;break;
            }
          }
        }
        if(!remove){
          for(const p of this.players){
            // Las balas normales no dañan al tirador. El cohete guiado sí:
            // si su trayectoria regresa y alcanza a su dueño, aplica la misma
            // colision/daño que contra cualquier otra nave.
            if((p.index===b.owner&&!b.guided)||p.dead||p.protection>0)continue;
            if(sweptCircles(b,BULLET_RADIUS,p,SHIP_RADIUS,false)){
              const attacker=this.players.find(q=>q.index===b.owner)||null;
              if(p.shield<=0){
                const longShot=attacker&&attacker!==p&&(b.travel||0)>=BRUTAL_SHOT_DISTANCE;
                const pointBlank=attacker&&attacker!==p&&!b.guided&&(b.travel||0)<=260;
                if(pointBlank)this.emit({t:'pointblank',index:attacker.index});
                if(longShot&&!b.guided){
                  // V21.03: recompensa BRUTAL solo para bala normal a larga distancia.
                  // +10 balas y cadencia maxima, con recarga actual adaptada al nuevo valor.
                  attacker.bullets+=10;
                  attacker.cadence=1;
                  attacker.reload=Math.min(attacker.reload,this.reloadTime(attacker));
                  this.emit({t:'brutal',titleKey:'brutal',distance:Math.round(b.travel||0),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index,ammoBonus:10,cadenceMax:true});
                }else if(longShot&&b.guided){
                  // V21.04: un impacto lejano con cohete reconoce la jugada como
                  // BUENA, pero no concede la recompensa exclusiva de BRUTAL.
                  this.emit({t:'brutal',titleKey:'goodShot',distance:Math.round(b.travel||0),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index,ammoBonus:0,cadenceMax:false});
                }else if(b.guided&&attacker&&attacker!==p){
                  // V21.13: baja con misil guiado a distancia normal.
                  // El impacto lejano conserva BUENA para no solapar avisos.
                  this.emit({t:'hunter',index:attacker.index});
                }
                if(b.guided){this.emitRocketDisintegrateAt(b.x,b.y,b.owner);this.emit({t:'sound',kind:'sparkle'});}
                // V20.11: el atacante suma su baja, pero la victima no pierde
                // un punto por haber sido abatida por otro jugador.
                this.destroyShip(p,attacker);
              }else{
                this.emitShipImpact(p,b,false);
                if(b.guided){
                  // V20.23: un misil guiado consume por completo un escudo activo.
                  // La nave sobrevive a ese impacto; las balas normales no rompen
                  // el escudo y la proteccion de aparicion sigue teniendo prioridad.
                  p.shield=0;
                  this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
                  this.emit({t:'sound',kind:'sparkle'});
                }
              }
              remove=true;break;
            }
          }
        }
        if(!remove&&this.ufo&&sweptCircles(b,BULLET_RADIUS,this.ufo,UFO_RADIUS,false)){
          const hitUfo=this.ufo;
          hitUfo.hp=Math.max(0,(Number(hitUfo.hp)||UFO_HP)-(b.guided?2:1));
          if(b.guided){
            this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
            this.emit({t:'sound',kind:'sparkle'});
          }else{
            this.emit({t:'sound',kind:'impact'});
          }
          if(hitUfo.hp<=0)this.destroyUfo(Number(b.owner));
          remove=true;
        }
        if(!remove)for(let aIndex=this.asteroids.length-1;aIndex>=0;aIndex--){
          const a=this.asteroids[aIndex];
          if(!a||!sweptCircles(b,BULLET_RADIUS,a,a.r,false))continue;
          if(b.guided){
            this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
            this.emit({t:'sound',kind:'sparkle'});
            this.splitAsteroidByMissile(a,Number(b.owner),b.x,b.y);
          }
          remove=true;break;
        }
        if(!remove&&this.giant&&sweptCircles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS,false)){
          if(b.guided){
            this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
            this.emit({t:'sound',kind:'sparkle'});
          }else{
            this.emit({t:'sound',kind:'impact'});
          }
          remove=true;
        }
        if(!remove)for(let m=this.meteors.length-1;m>=0;m--){
          const meteor=this.meteors[m];
          if(sweptCircles(b,BULLET_RADIUS,meteor,SMALL_METEOR_RADIUS,false)){
            if(b.guided)this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
            this.meteors.splice(m,1);remove=true;this.emit({t:'sound',kind:b.guided?'sparkle':'impact'});break;
          }
        }
        // V21.52: las BALAS normales destruyen armas/mejoras flotantes.
        // Los MISILES las atraviesan y no se consumen al pasar por encima.
        if(!remove&&!b.guided){
          for(let p=this.pickups.length-1;p>=0;p--){
            if(!sweptCircles(b,BULLET_RADIUS,this.pickups[p],PICKUP_RADIUS,false))continue;
            this.pickups.splice(p,1);
            remove=true;
            break;
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
        const shockChance=this.trainingMode?.20:.04;
        // V19.68 prueba de bengalas: si no hay una flotando, tiene ~35% de
        // probabilidad de ser el siguiente pickup para facilitar las pruebas.
        if(!shockPresent&&Math.random()<shockChance)type='shockwave';
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
            if(p.cpu&&p.resourceTargetId===pk.id)p.resourceTargetId=null;
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
        // V19.71: las bengalas tambien protegen frente a la lluvia. Si una
        // bengala y un meteorito pequeno se cruzan, ambos se consumen.
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
            if(p.cpu&&p.meteorDecision){
              const penalty=p.meteorDecision.meteorId===m.id?(p.shield>0?-.45:-1.6):(p.shield>0?-.25:-1.0);
              this.settleMeteorDecision(p,penalty);
            }
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
        const profile=this.hazardProfile();
        this.nextGiant=this.trainingMode?rand(130,190):rand(profile.giantRepeatMin,profile.giantRepeatMax);
      }
    }
    ufoLimit(){
      if(this.trainingMode)return 0;
      const level=clamp(Math.round(Number(this.campaignLevel)||1),1,CAMPAIGN_LEVELS);
      const cfg=CAMPAIGN&&typeof CAMPAIGN.getLevel==='function'?CAMPAIGN.getLevel(level):null;
      return cfg&&Number.isFinite(Number(cfg.ufos))?Math.max(0,Math.round(Number(cfg.ufos))):clamp(level-1,0,3);
    }
    ufoActiveCount(){return (this.ufo?1:0)+this.ufoExtras.length;}
    isUfoActive(u){return !!u&&(this.ufo===u||this.ufoExtras.includes(u));}
    removeUfo(u){
      if(!u)return false;
      if(this.ufo===u){
        this.ufo=this.ufoExtras.length?this.ufoExtras.shift():null;
        return true;
      }
      const index=this.ufoExtras.indexOf(u);
      if(index<0)return false;
      this.ufoExtras.splice(index,1);
      return true;
    }
    beginUfoWave(){
      const count=this.ufoLimit();
      if(count<=0){this.nextUfo=999999;return false;}
      this.ufoWaveTotal=count;
      this.ufoWaveRemaining=count;
      this.ufoWaveSpawned=0;
      // Aproximadamente la mitad de las oleadas llegan casi juntas como enjambre.
      this.ufoWaveSwarm=Math.random()<.5;
      this.ufoWaveSide=randint(0,3);
      this.ufoWaveAnchor=rand(.30,.70);
      this.ufoWaveNext=0;
      this.nextUfo=999999;
      return true;
    }
    spawnUfo(options={}){
      const limit=this.ufoLimit();
      if(limit<=0||this.ufoActiveCount()>=limit)return false;
      const swarm=!!options.swarm;
      const side=Number.isInteger(options.side)&&options.side>=0&&options.side<=3?options.side:randint(0,3);
      const anchor=clamp(Number(options.anchor)||.5,.2,.8);
      const slot=Math.max(0,Number(options.slot)||0);
      const count=Math.max(1,Number(options.count)||1);
      const margin=90;
      const offset=(slot-(count-1)*.5)*68+rand(-14,14);
      let x,y,tx,ty;
      if(side===0){
        x=-margin;
        y=swarm?clamp(H*anchor+offset,120,H-120):rand(140,H-140);
        tx=W*.42;ty=clamp(y+rand(-180,180),140,H-140);
      }else if(side===1){
        x=W+margin;
        y=swarm?clamp(H*anchor+offset,120,H-120):rand(140,H-140);
        tx=W*.58;ty=clamp(y+rand(-180,180),140,H-140);
      }else if(side===2){
        y=-margin;
        x=swarm?clamp(W*anchor+offset,150,W-150):rand(180,W-180);
        tx=clamp(x+rand(-260,260),180,W-180);ty=H*.42;
      }else{
        y=H+margin;
        x=swarm?clamp(W*anchor+offset,150,W-150):rand(180,W-180);
        tx=clamp(x+rand(-260,260),180,W-180);ty=H*.58;
      }
      const n=normalize(tx-x,ty-y);
      const u={
        id:uid(),x,y,px:x,py:y,vx:n.x*145,vy:n.y*145,r:UFO_RADIUS,hp:UFO_HP,
        born:this.fxClock,entered:false,exiting:false,nextSteer:this.fxClock,
        chargeAt:this.fxClock+rand(4.5,8),chargeUntil:0,bounceUntil:0
      };
      if(!this.ufo)this.ufo=u;
      else this.ufoExtras.push(u);
      return true;
    }
    spawnNextUfoWaveMember(){
      if(this.ufoWaveRemaining<=0)return false;
      const total=Math.max(1,this.ufoWaveTotal||this.ufoLimit());
      const slot=this.ufoWaveSpawned;
      const ok=this.spawnUfo(this.ufoWaveSwarm?{
        swarm:true,side:this.ufoWaveSide,anchor:this.ufoWaveAnchor,slot,count:total
      }:{swarm:false});
      if(!ok){
        this.ufoWaveNext=.5;
        return false;
      }
      this.ufoWaveSpawned++;
      this.ufoWaveRemaining--;
      if(this.ufoWaveRemaining>0){
        // Enjambre: décimas de segundo. Separados: varios segundos y lados distintos.
        this.ufoWaveNext=this.ufoWaveSwarm?rand(.22,.55):rand(3.5,7.5);
      }else{
        this.ufoWaveNext=0;
        this.nextUfo=rand(UFO_REPEAT_MIN,UFO_REPEAT_MAX);
      }
      return true;
    }
    destroyUfo(ownerIndex=-1,target=this.ufo){
      const u=target;
      if(!u||!this.isUfoActive(u))return false;
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
      this.removeUfo(u);
      return true;
    }
    updateExtraUfoProjectileHits(){
      if(!this.ufoExtras.length||!this.bullets.length)return;
      // El OVNI principal sigue usando updateBullets(), idéntico al host online.
      // Aquí solo añadimos las colisiones de los dos OVNIs extra de campaña.
      for(let bi=this.bullets.length-1;bi>=0;bi--){
        const b=this.bullets[bi];
        if(!b)continue;
        let hit=null;
        for(let ui=this.ufoExtras.length-1;ui>=0;ui--){
          const u=this.ufoExtras[ui];
          if(u&&sweptCircles(b,BULLET_RADIUS,u,UFO_RADIUS,false)){hit=u;break;}
        }
        if(!hit)continue;
        hit.hp=Math.max(0,(Number(hit.hp)||UFO_HP)-(b.guided?2:1));
        if(b.guided){
          this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
          this.emit({t:'sound',kind:'sparkle'});
        }else{
          this.emit({t:'sound',kind:'impact'});
        }
        if(hit.hp<=0)this.destroyUfo(Number(b.owner),hit);
        this.bullets.splice(bi,1);
      }
    }
    updateUfo(dt){
      // El entrenamiento autónomo no incorpora OVNIs para no contaminar
      // las métricas de aprendizaje ni gastar simulación extra.
      const limit=this.ufoLimit();
      if(limit<=0){
        this.ufo=null;this.ufoExtras.length=0;
        this.ufoWaveRemaining=0;this.ufoWaveNext=0;this.nextUfo=999999;
        return;
      }

      // Planificador de oleadas. La física de cada OVNI sigue siendo la misma;
      // solo cambia cuántos entran en función del nivel de campaña.
      if(this.ufoWaveRemaining>0){
        this.ufoWaveNext-=dt;
        if(this.ufoWaveNext<=0)this.spawnNextUfoWaveMember();
      }else{
        this.nextUfo-=dt;
        if(this.nextUfo<=0){
          this.beginUfoWave();
          this.spawnNextUfoWaveMember();
        }
      }

      const active=[];
      if(this.ufo)active.push(this.ufo);
      for(const extra of this.ufoExtras)active.push(extra);
      for(const u of active){
        if(this.isUfoActive(u))this.updateSingleUfo(u,dt);
      }

      // V21.68: red de seguridad geométrica. Si dos OVNIs llegan a tocarse
      // pese a la anticipación, se separan suavemente sin explosión ni daño.
      // Máximo 3 parejas, por lo que el coste es despreciable.
      for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i],b=active[j];
        if(!this.isUfoActive(a)||!this.isUfoActive(b))continue;
        const dx=(Number(b.x)||0)-(Number(a.x)||0);
        const dy=(Number(b.y)||0)-(Number(a.y)||0);
        const d2=dx*dx+dy*dy;
        const minDist=UFO_RADIUS*2+6;
        if(d2>=minDist*minDist)continue;
        let nx,ny,d=Math.sqrt(d2);
        if(d<1){
          const side=Number(a.id)<Number(b.id)?1:-1;
          nx=side;ny=0;d=1;
        }else{nx=dx/d;ny=dy/d;}
        const push=(minDist-d)*.5+2;
        a.x-=nx*push;a.y-=ny*push;
        b.x+=nx*push;b.y+=ny*push;

        // Quitamos únicamente la velocidad con la que se aproximan entre sí.
        const rvx=(Number(b.vx)||0)-(Number(a.vx)||0);
        const rvy=(Number(b.vy)||0)-(Number(a.vy)||0);
        const closing=rvx*nx+rvy*ny;
        if(closing<0){
          const impulse=-closing*.34;
          a.vx-=nx*impulse;a.vy-=ny*impulse;
          b.vx+=nx*impulse;b.vy+=ny*impulse;
        }
      }
    }
    updateSingleUfo(u,dt){
      if(!u)return false;
      u.px=u.x;u.py=u.y;
      const age=this.fxClock-Number(u.born||0);
      if(age>24)u.exiting=true;

      if(this.fxClock>=Number(u.nextSteer||0)){
        u.nextSteer=this.fxClock+.12;

        let target=null,best=Infinity;
        for(const p of this.players){
          // V21.62 CPU: el OVNI no detecta jugadores en modo FANTASMA.
          // Mientras camo > 0 no los selecciona, persigue ni carga contra ellos.
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

        // IA ligera: mantiene la evitación existente y suma una separación
        // suave entre OVNIs para que un enjambre no se dibuje uno encima de otro.
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
        // V21.68: separación predictiva entre OVNIs. Además de la distancia
        // actual, mira dónde estarán más cerca durante el próximo segundo.
        // Con un máximo de 3 OVNIs son como mucho 3 comparaciones por maniobra.
        const avoidUfo=(other)=>{
          if(!other||other===u||!this.isUfoActive(other))return;
          const rx=(Number(other.x)||0)-(Number(u.x)||0);
          const ry=(Number(other.y)||0)-(Number(u.y)||0);
          const d2=rx*rx+ry*ry;
          const rvx=(Number(other.vx)||0)-(Number(u.vx)||0);
          const rvy=(Number(other.vy)||0)-(Number(u.vy)||0);
          const vv=rvx*rvx+rvy*rvy;
          let t=0;
          if(vv>9)t=clamp(-(rx*rvx+ry*rvy)/vv,0,1.05);
          const cx=rx+rvx*t,cy=ry+rvy*t;
          const closest2=cx*cx+cy*cy;
          const soft=UFO_RADIUS*2+54;
          const hard=UFO_RADIUS*2+14;
          if(d2>soft*soft&&closest2>soft*soft)return;

          let ax=-cx,ay=-cy;
          if(ax*ax+ay*ay<64){
            // Cruce casi perfecto: cada pareja elige lados opuestos de forma
            // determinista para no decidir la misma maniobra.
            const side=Number(u.id)<Number(other.id)?1:-1;
            ax=-rvy*side;ay=rvx*side;
            if(ax*ax+ay*ay<16){ax=side;ay=.35*side;}
          }
          const al=Math.hypot(ax,ay)||1;
          ax/=al;ay/=al;
          const current=Math.sqrt(d2)||1;
          const closest=Math.sqrt(closest2)||1;
          const urgency=Math.max(
            0,
            (soft-Math.min(current,closest))/soft
          );
          const weight=(current<hard?5.4:3.3)*urgency;
          avoidX+=ax*weight;
          avoidY+=ay*weight;
        };
        if(this.ufo&&this.ufo!==u)avoidUfo(this.ufo);
        for(const other of this.ufoExtras)if(other!==u)avoidUfo(other);

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

      for(let f=this.flares.length-1;f>=0;f--){
        const flare=this.flares[f];
        if(!flare||!sweptCircles(u,UFO_RADIUS,flare,FLARE_RADIUS,false))continue;
        const ownerIndex=Number(flare.owner);
        this.flares.splice(f,1);
        this.destroyUfo(ownerIndex,u);
        return false;
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

      // La embestida mantiene la regla actual: puede matar, pero el OVNI rebota.
      for(const p of this.players){
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
        this.removeUfo(u);
        return false;
      }
      return true;
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
            // V19.73: una baja causada por una bengala pertenece a quien la
            // lanzo. La propia bengala nunca puede conceder una baja a su dueño.
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
      // V21.92: compactar FX locales antiguos igual que online. Evita que
      // eventos invisibles sigan serializandose hasta llenar el limite de 32.
      if(this.fxEvents.length){
        let write=0;
        for(let read=0;read<this.fxEvents.length;read++){
          const e=this.fxEvents[read];
          if(e&&this.fxClock-Number(e.at)<=2)this.fxEvents[write++]=e;
        }
        if(write!==this.fxEvents.length)this.fxEvents.length=write;
      }
      const ufoStates=[];
      if(this.ufo)ufoStates.push(this.ufo);
      for(const extra of this.ufoExtras)ufoStates.push(extra);
      const serializedUfos=ufoStates.map(u=>({
        id:u.id,x:round1(u.x),y:round1(u.y),vx:round1(u.vx),vy:round1(u.vy),
        hp:Math.max(0,Math.round(Number(u.hp)||0))
      }));
      return{
        t:'state',seq:++this.seq,code:'LOCAL',mode:'cpu',started:this.started,finished:this.finished,winner:this.winner,
        w:W,h:H,scoreToWin:SCORE_TO_WIN,fxVersion:1,
        fx:this.fxEvents.map(e=>({id:e.id,i:e.i,x:e.x,y:e.y,kind:e.kind,hidden:e.hidden,age:Math.max(0,Math.round((this.fxClock-e.at)*1000))})),
        players:this.players.map(p=>({i:p.index,n:p.name,cpu:p.cpu,x:round1(p.x),y:round1(p.y),r:round1(p.rot),vx:round1(p.vx),vy:round1(p.vy),thrust:!!p.thrust,ammo:p.bullets,armed:!p.dead&&(Number(p.spawnFx)||0)<=0&&p.bullets>0&&p.reload<=0,cad:p.cadence,spd:p.speed,k:p.kills,d:p.deaths,shield:round2(p.shield),camo:round2(p.camo),prot:round2(p.protection),spawnFx:round2(Math.max(0,Number(p.spawnFx)||0)),mira:!!p.guided,ma:Math.max(0,Math.round(Number(p.guidedAmmo)||0)),mt:Number.isInteger(p.guidedTarget)?p.guidedTarget:-1,flare:Math.max(0,Math.round(Number(p.flare)||0)),shock:!!p.shockwave,dead:p.dead,respawn:round3(p.respawn)})),
        asteroids:this.asteroids.map(a=>({id:a.id,x:round1(a.x),y:round1(a.y),type:a.type,r:round1(Number(a.r)||ASTEROID_RADIUS),fragment:!!a.fragment})),
        bullets:this.bullets.map(b=>({id:b.id,o:b.owner,owner:b.owner,x:round1(b.x),y:round1(b.y),vx:round1(b.vx),vy:round1(b.vy),g:!!b.guided,guided:!!b.guided,gt:(!b.decoyed&&Number.isInteger(b.target))?b.target:-1,target:(!b.decoyed&&Number.isInteger(b.target))?b.target:-1,wt:(!b.decoyed&&b.guided&&Number.isInteger(b.target))?b.target:-1})),
        flares:this.flares.map(f=>({id:f.id,o:f.owner,x:round1(f.x),y:round1(f.y),a:round1(f.angle),life:round2(Math.max(0,f.life))})),
        pickups:this.pickups.map((p,idx)=>({id:p.id,type:p.type,x:round1(p.x),y:round1(p.y+Math.cos(p.phase)*3),expiresIn:(idx===0&&this.pickups.length>=5)?round2(Math.max(0,this.nextPickup)):null})),
        meteors:this.meteors.map(m=>({id:m.id,type:m.type,x:round1(m.x),y:round1(m.y),a:round1(m.angle)})),
        giant:this.giant?{x:round1(this.giant.x),y:round1(this.giant.y)}:null,
        ufo:serializedUfos[0]||null,
        ufos:serializedUfos,
        shower:round2(this.showerLeft),
        nextShower:this.showerLeft>0?0:round1(Math.max(0,Math.min(this.firstShower,this.nextShower||999999)))
      };
    }
  }
  window.GalaxyLocalCpu=GalaxyLocalCpu;
})();
