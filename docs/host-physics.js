'use strict';
(() => {
  const W=1920,H=1080,TICK_HZ=60,DT=1/TICK_HZ,STEP_MS=1000/TICK_HZ;
  const DRAG_PER_TICK=Math.pow(0.35,DT);
  const IDLE_CONTROL=Object.freeze({turn:0,thrust:false,fire:false});
  const SCORE_TO_WIN=5;
  const SHIP_RADIUS=24,ASTEROID_RADIUS=45,GIANT_RADIUS=162,PICKUP_RADIUS=22,BULLET_RADIUS=4,MISSILE_HIT_RADIUS=12,SMALL_METEOR_RADIUS=14;
  const SPAWN_PROTECTION_SECONDS=3,SPAWN_MATERIALIZE_SECONDS=1.15,BRUTAL_SHOT_DISTANCE=850;
  const FLARE_HOLD_SECONDS=.22,FLARE_LIFE_SECONDS=3,FLARE_RADIUS=12,FLARE_DECOY_TRIGGER=700;
  const FLARE_CPU_USE_COOLDOWN=.95,FLARE_CPU_KEEP_COOLDOWN=.42;
  const FLARE_CPU_MISSILE_REACTION_MIN=1,FLARE_CPU_MISSILE_REACTION_MAX=2;
  const CPU_ARMED_WARNING_SECONDS=1;
  const ASTEROID_STARTS=[
    [160,430,300,1],[30,930,10,3],[1800,30,210,4],
    [1500,150,160,2],[500,430,160,5],[1300,430,200,6]
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
  // V20.44: para roca contra roca usamos el mismo radio visual de la portada:
  // 48,5% del tamano dibujado. Esto evita rebotar antes de que los sprites se toquen.
  const asteroidDrawSize=a=>Number(a&&a.type)===5?112:120;
  const asteroidRockRadius=a=>asteroidDrawSize(a)*.485;
  const GIANT_ROCK_RADIUS=324*.485;
  // V20.46: asteroide6.png (type 5) es una variante algo mas pequena y rara.
  // Conservamos exactamente el mismo numero total de asteroides y los mismos
  // tiempos de entrada; solo cambia la distribucion visual de variantes.
  const randomAsteroidTemplateIndex=()=>{
    // Type 5 recibe aprox. la mitad de peso que el resto.
    const bag=[0,0,1,1,2,2,3,3,4,5,5];
    return bag[randint(0,bag.length-1)];
  };
  // V20.43: colision de roca inspirada en la portada. Resuelve el impulso
  // solo sobre la normal del choque y corrige todo el solapamiento en el mismo
  // tick. La masa permite que el gigante apenas se desvie frente al mediano.
  const resolveRockCollision=(a,ar,b,br,massA=1,massB=1)=>{
    if(!a||!b)return false;

    const ax=Number(a.x),ay=Number(a.y),bx=Number(b.x),by=Number(b.y);
    ar=Number(ar);br=Number(br);massA=Number(massA);massB=Number(massB);
    // V20.48: nunca dejamos que un dato corrupto/temporal propague NaN a toda
    // la simulacion. Una roca invalida simplemente no resuelve este contacto.
    if(!Number.isFinite(ax)||!Number.isFinite(ay)||!Number.isFinite(bx)||!Number.isFinite(by)||
       !Number.isFinite(ar)||!Number.isFinite(br)||ar<=0||br<=0||
       !Number.isFinite(massA)||!Number.isFinite(massB)||massA<=0||massB<=0)return false;

    let dx=bx-ax,dy=by-ay;
    const rr=ar+br,d2=dx*dx+dy*dy;
    if(!Number.isFinite(d2)||d2>rr*rr)return false;

    let d=Math.sqrt(Math.max(0,d2));
    let nx,ny;
    if(d>1e-6){
      nx=dx/d;ny=dy/d;
    }else{
      // Centros coincidentes: primero intentamos la velocidad relativa y, si
      // tambien es cero, elegimos una direccion determinista por id.
      const rvx=(Number(a.vx)||0)-(Number(b.vx)||0);
      const rvy=(Number(a.vy)||0)-(Number(b.vy)||0);
      const rl=Math.hypot(rvx,rvy);
      if(Number.isFinite(rl)&&rl>1e-6){
        nx=rvx/rl;ny=rvy/rl;
      }else{
        const seed=((Number(a.id)||1)*31+(Number(b.id)||2)*17)%360;
        const rad=seed*Math.PI/180;
        nx=Math.cos(rad);ny=Math.sin(rad);
      }
      d=0;
    }

    let avx=Number(a.vx)||0,avy=Number(a.vy)||0;
    let bvx=Number(b.vx)||0,bvy=Number(b.vy)||0;
    const closing=(avx-bvx)*nx+(avy-bvy)*ny;
    if(Number.isFinite(closing)&&closing>0){
      const invA=1/Math.max(.01,massA),invB=1/Math.max(.01,massB);
      const impulse=(2*closing)/(invA+invB);
      a.vx=avx-impulse*invA*nx;a.vy=avy-impulse*invA*ny;
      b.vx=bvx+impulse*invB*nx;b.vy=bvy+impulse*invB*ny;
    }

    const overlap=Math.max(0,rr-d);
    if(Number.isFinite(overlap)&&overlap>0){
      const invA=1/Math.max(.01,massA),invB=1/Math.max(.01,massB);
      const invSum=invA+invB;
      // El +0.35 mantiene contacto visual sin abrir un hueco perceptible.
      const separation=overlap+.35;
      const moveA=separation*(invA/invSum),moveB=separation*(invB/invSum);
      a.x=ax-nx*moveA;a.y=ay-ny*moveA;
      b.x=bx+nx*moveB;b.y=by+ny*moveB;
    }

    // Fail-safe: un contacto multiple nunca debe disparar velocidades enormes.
    // En condiciones normales (80 px/s medianos, 42-52 gigante) no interviene.
    const capSpeed=(o,max)=>{
      let vx=Number(o.vx)||0,vy=Number(o.vy)||0;
      if(!Number.isFinite(vx)||!Number.isFinite(vy)){o.vx=0;o.vy=0;return;}
      const sp=Math.hypot(vx,vy);
      if(sp>max&&sp>0){o.vx=vx/sp*max;o.vy=vy/sp*max;}
    };
    capSpeed(a,massA>=5?90:180);
    capSpeed(b,massB>=5?90:180);
    return true;
  };
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
    constructor({onState,onEvent,code='P2P',rankRound=1,rankHostToken=''}={}){
      this.onState=typeof onState==='function'?onState:()=>{};
      this.onEvent=typeof onEvent==='function'?onEvent:()=>{};
      this.code=String(code||'P2P');
      this.rankRound=Math.max(1,Number(rankRound)||1);
      this.rankHostToken=String(rankHostToken||'');
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
      this.meteors=[];
      this.giant=null;
      this.asteroids=[];
      this.nextPickup=1;
      this.firstShower=rand(150,210);
      this.showerLeft=0;
      this.nextMeteor=0;
      this.nextShower=0;
      this.noDeathTime=0;
      this.nextGiant=rand(50,80);
      this.lastNow=0;
      this.accumulator=0;
      this.tickCount=0;
      this.resetAsteroids();
    }
    emit(msg){try{this.onEvent(msg);}catch(_){}}
    resetAsteroids(){
      // V19.54: el primer asteroide entra desde un borde y trayectoria aleatorios.
      this.asteroids=[];
      this.spawnAsteroidFromEdge(randomAsteroidTemplateIndex(),true);
      this.nextAsteroidIndex=1;
      this.nextAsteroidSpawn=rand(18,24);
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
        // V20.47: rotacion muy leve, similar a la portada pero mas discreta.
        // Cada roca conserva su sentido y velocidad durante toda su vida.
        spin:(Math.random()<.5?-1:1)*rand(2,7),
        vx:n.x*80,vy:n.y*80,r:(type===5?112:120)*.485,exiting:false,exitDelay:-1
      });
    }
    spawnProgressiveAsteroid(){
      if(this.asteroids.length>=ASTEROID_MAX_ACTIVE)return;
      this.spawnAsteroidFromEdge(randomAsteroidTemplateIndex());
      this.nextAsteroidIndex++;
      if(this.asteroids.length>=ASTEROID_MAX_ACTIVE){
        this.asteroidRampComplete=true;
        this.asteroidTargetCount=ASTEROID_MAX_ACTIVE;
        this.nextAsteroidSpawn=999999;
        this.nextAsteroidPopulationChange=rand(22,48);
      }else{
        this.nextAsteroidSpawn=rand(18,24);
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
      const current=this.asteroids.length;
      let target=randint(1,ASTEROID_MAX_ACTIVE);
      if(target===current)target=target===ASTEROID_MAX_ACTIVE?randint(1,ASTEROID_MAX_ACTIVE-1):target+1;
      this.asteroidTargetCount=target;
      this.nextAsteroidPopulationChange=rand(22,48);
      if(target<current){
        const pool=this.asteroids.slice();
        for(let i=pool.length-1;i>0;i--){
          const j=randint(0,i),tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;
        }
        const leaving=current-target;
        for(let i=0;i<leaving;i++)pool[i].exitDelay=rand(i*2.2,i*2.2+5.5);
        this.nextAsteroidSpawn=999999;
      }else{
        this.nextAsteroidSpawn=rand(4,12);
      }
    }
    updateAsteroidPopulation(){
      if(!this.asteroidRampComplete){
        this.nextAsteroidSpawn-=DT;
        if(this.nextAsteroidSpawn<=0)this.spawnProgressiveAsteroid();
        return;
      }
      const transitioning=this.asteroids.some(a=>a.exiting||a.exitDelay>=0);
      if(!transitioning&&this.asteroids.length<this.asteroidTargetCount){
        this.nextAsteroidSpawn-=DT;
        if(this.nextAsteroidSpawn<=0){
          this.spawnAsteroidFromEdge(randomAsteroidTemplateIndex());
          this.nextAsteroidSpawn=this.asteroids.length<this.asteroidTargetCount?rand(4,12):999999;
        }
        return;
      }
      if(!transitioning&&this.asteroids.length===this.asteroidTargetCount){
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
        guided:false,guidedTarget:-1,flare:0,flareHold:0,flareGesture:false,flarePending:null,nextFlareDecision:0,nextFlareAllowed:0,
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
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;
      this.nextPickup=1;this.firstShower=rand(150,210);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);
      this.rankReportSent=false;this.rankReportAttempts=0;
      this.huntTargetIndex=-1;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const item of list){
        const index=Number(item.i),isCpu=!!item.cpu;
        const player=this.makePlayer(index,item.n||(isCpu?'CPU '+(index+1):'JUGADOR '+(index+1)),isCpu);
        if(isCpu)player.difficulty='dificil';
        this.placeAtSpawn(player);
        this.players.push(player);
        this.controls.set(index,{turn:0,thrust:false,fire:false});
      }
      this.players.sort((a,b)=>a.index-b.index);
      this.started=true;this.finished=false;this.winner=null;
      this.lastNow=0;this.accumulator=0;this.tickCount=0;
      return true;
    }
    stop(){this.started=false;this.lastNow=0;this.accumulator=0;}
    setControl(index,turn,thrust,fire){
      const i=Number(index),p=this.players.find(x=>x.index===i);
      // V20.8: una plaza CPU nunca acepta controles externos. Cuando el roster
      // confirme el relevo se crea una entidad humana nueva y desde ese momento
      // sus controles si son validos. Evita cualquier solapamiento CPU/humano.
      if(!p||p.cpu)return false;
      // Reutiliza el objeto de control: los controles llegan ~30 veces/s y no
      // necesitan generar un objeto nuevo en cada paquete.
      let c=this.controls.get(i);
      if(!c){c={turn:0,thrust:false,fire:false};this.controls.set(i,c);}
      c.turn=clamp(Number(turn)||0,-1,1);c.thrust=!!thrust;c.fire=!!fire;
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
          this.placeAtSpawn(p);this.players.push(p);this.controls.set(index,{turn:0,thrust:false,fire:false});changed=true;continue;
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
          this.controls.set(index,{turn:0,thrust:false,fire:false});

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
          p.lastControlAt=Date.now();this.controls.set(index,{turn:0,thrust:false,fire:false});
          changed=true;
        }
      }
      this.players.sort((a,b)=>a.index-b.index);
      if(changed)this.onState(this.publicState());
      return changed;
    }
    handleMessage(msg){
      if(!msg||typeof msg!=='object')return true;
      if(msg.t==='ctrl'){this.setControl(msg.i,msg.turn,msg.thrust,msg.fire);return true;}
      if(msg.t==='restart'){
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
        this.update(DT);
        this.accumulator-=STEP_MS;
        this.tickCount++;
        // V20.16 PERF: publicar estado cada 3 ticks = 20 snapshots/s.
        // La simulacion sigue ejecutando todos los ticks a 60 Hz.
        if((this.tickCount%3)===0||this.finished)publishState=true;
        steps++;
        if(this.finished)break;
      }
      if(steps===5&&this.accumulator>=STEP_MS)this.accumulator%=STEP_MS;
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
      this.bullets=[];this.flares=[];this.pickups=[];this.meteors=[];this.giant=null;
      this.nextPickup=1;this.firstShower=rand(150,210);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);
      this.huntTargetIndex=-1;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const p of this.players)p.dead=true;
      for(const p of this.players){
        p.bullets=5;p.cadence=30;p.speed=1;p.kills=0;p.deaths=0;p.reload=0;p.guided=false;p.guidedTarget=-1;p.flare=0;p.flareHold=0;p.flareGesture=false;p.flarePending=null;p.nextFlareDecision=0;p.nextFlareAllowed=0;
        p.shield=0;p.camo=0;p.spawnFx=SPAWN_MATERIALIZE_SECONDS;p.protection=SPAWN_PROTECTION_SECONDS;p.respawn=0;
        p.lastControlAt=Date.now();p.lastSpawn=null;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
        this.controls.set(p.index,{turn:0,thrust:false,fire:false});
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
    destroyShip(victim,attacker=null,weaponTheft=false,scorePenalty=false){
      if(victim.dead||this.finished)return;
      if(victim.protection>0||victim.shield>0){this.emitShipImpact(victim,attacker,false);return;}
      victim.dead=true;victim.respawn=.7;victim.vx=victim.vy=0;victim.deaths++;
      if(victim.cpu)victim.flarePending=null;
      // V20.11: solo penalizan las muertes provocadas por el propio jugador,
      // por el entorno/choque o por una colision fisica marcada expresamente.
      // Ser abatido por la bala, misil o bengala de OTRO jugador no resta puntos.
      if(!attacker||attacker===victim||scorePenalty)victim.kills=Math.max(0,victim.kills-1);

      // ROBO DE ARMAMENTO solo ocurre por EMBESTIDA: un jugador con
      // escudo activo choca fisicamente con un rival sin escudo y lo destruye.
      // Las bajas por bala o misil nunca roban armamento aunque el tirador
      // lleve escudo.
      if(weaponTheft&&attacker&&attacker!==victim&&attacker.shield>0){
        const stolenAmmo=Math.max(0,Math.floor(Number(victim.bullets)||0));
        attacker.bullets+=stolenAmmo;
        if(Number(victim.cadence)<Number(attacker.cadence))attacker.cadence=victim.cadence;
        if(Number(victim.speed)>Number(attacker.speed))attacker.speed=victim.speed;
        if(Number(victim.camo)>Number(attacker.camo))attacker.camo=victim.camo;
        if(victim.guided&&!attacker.guided){
          attacker.guided=true;
          attacker.guidedTarget=this.guidedTargetFor(attacker);
        }
        this.emit({t:'weapon-theft',index:attacker.index,name:attacker.name,ammo:stolenAmmo});
      }

      victim.bullets=0;victim.cadence=30;victim.speed=1;victim.shield=0;victim.camo=0;victim.reload=0;victim.guided=false;victim.guidedTarget=-1;victim.flareHold=0;victim.flareGesture=false;
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
      p.bullets=1;p.cadence=30;p.speed=1;p.shield=0;p.camo=0;p.reload=this.reloadTime(p);p.guided=false;p.guidedTarget=-1;p.flareHold=0;p.flareGesture=false;p.flarePending=null;p.nextFlareDecision=0;p.aiControl=null;p.cpuFireDelay=p.cpu?CPU_ARMED_WARNING_SECONDS:0;
    }
    deployFlares(p){
      if(!p||p.dead||(Number(p.flare)||0)<=0)return false;
      // V19.72: cooldown real por nave. Ningun control ni IA puede saltarse
      // los 3 segundos minimos entre dos cargas de bengalas.
      if(this.fxClock<(Number(p.nextFlareAllowed)||0))return false;
      p.nextFlareAllowed=this.fxClock+3;
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
        this.smartCpuFlare(p);
        return fireNow;
      }
      if(p.flareGesture){
        if(fireNow){
          p.flareHold=(Number(p.flareHold)||0)+dt;
          if(p.flare&&p.flareHold>=FLARE_HOLD_SECONDS)this.deployFlares(p);
          return false;
        }
        const tap=!!p.flare&&(Number(p.flareHold)||0)>0&&(Number(p.flareHold)||0)<FLARE_HOLD_SECONDS;
        p.flareGesture=false;p.flareHold=0;
        return tap;
      }
      if(fireNow&&p.flare){
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
        if(f.life<=0||f.x<-100||f.x>W+100||f.y<-100||f.y>H+100)this.flares.splice(i,1);
      }
    }
    guidedTargetFor(p){
      if(!p||p.dead)return -1;
      const forward=dirFromRot(p.rot);
      // La mira puede revelar FANTASMAS solo dentro de un cono frontal de 60
      // grados (aprox. +/-30). Los rivales visibles conservan el comportamiento
      // anterior y pueden ser elegidos aunque esten fuera de ese cono.
      const ghostMinAlign=.8660254038;
      let bestIndex=-1,bestAlign=-2,bestDistance=Infinity;
      for(const target of this.players){
        if(!target||target.index===p.index||target.dead)continue;
        const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy);
        if(distance<1)continue;
        const align=(forward.x*dx+forward.y*dy)/distance;
        if(target.camo>0&&align<ghostMinAlign)continue;
        if(align>bestAlign+1e-6||(Math.abs(align-bestAlign)<=1e-6&&distance<bestDistance)){
          bestAlign=align;bestDistance=distance;bestIndex=target.index;
        }
      }
      return bestIndex;
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
      let rival=null,best=Infinity;
      if(cpu.dead)return IDLE_CONTROL;
      const huntGrace=this.huntThresholdActive&&this.fxClock<this.huntStartsAt;
      if(this.huntThresholdActive&&this.fxClock>=this.huntStartsAt){
        const target=this.players.find(p=>p.index===this.huntTargetIndex&&!p.cpu&&!p.dead&&p.camo<=0);
        if(target)rival=target;
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
          const sightBonus=isHardSight?220:0;
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
          if(pk.type!=='shield'&&!pk.type.startsWith('ammo')&&!(pk.type==='flare'))continue;
          const d2=dist2(cpu,pk);if(d2<bestD2){bestD2=d2;seekPickup=pk;}
        }
        if(!seekPickup){desiredX=cpu.x-dx;desiredY=cpu.y-dy;}
      }else if(cpu.difficulty==='dificil'){
        const excellentShot=Math.abs(err)<5&&distance<850,closeFight=cpu.bullets>0&&distance<500;
        if(!excellentShot&&!closeFight){
          let bestScore=10;
          for(const pk of this.pickups){
            let value=0;
            if(pk.type==='mira'&&!cpu.guided)value=cpu.bullets<=1?125:105;
            else if(pk.type.startsWith('ammo'))value=cpu.bullets<=2?85:25;
            else if(pk.type==='cadence')value=cpu.cadence>=20?100:35;
            else if(pk.type==='speed')value=cpu.speed<2?55:10;
            else if(pk.type==='shield')value=cpu.shield<=0?95:20;
            else if(pk.type==='flare')value=80;
            const score=value-Math.sqrt(dist2(cpu,pk))*.06;
            if(score>bestScore){bestScore=score;seekPickup=pk;}
          }
        }
      }
      if(seekPickup&&!defensiveNoAmmo){desiredX=seekPickup.x;desiredY=seekPickup.y;}
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
      const fire=(huntActive||!rivalDangerous)&&!seekPickup&&cpu.bullets>0&&cpu.reload<=0&&Math.abs(err)<fireArc&&distance<1350;
      const control={turn,thrust,fire};
      return this.cpuOpeningCollisionAvoidance(cpu,control)||control;
    }
    update(dt){
      if(!this.started||this.finished)return;
      this.noDeathTime+=dt;this.fxClock+=dt;
      const cpuPlayers=this.cpuScratch;cpuPlayers.length=0;
      let huntedHuman=null;
      for(const p of this.players){
        if(p.cpu){cpuPlayers.push(p);continue;}
        if(!p.dead&&!huntedHuman&&p.kills>=SCORE_TO_WIN-1&&p.kills<SCORE_TO_WIN)huntedHuman=p;
      }
      const shouldHunt=!!(huntedHuman&&cpuPlayers.length);
      if(shouldHunt&&!this.huntThresholdActive){
        this.huntThresholdActive=true;this.huntTargetIndex=huntedHuman.index;this.huntStartsAt=this.fxClock+3;this.huntUntil=Infinity;
        const cpuIndices=[];
        for(const cpu of cpuPlayers){cpu.bullets+=3;cpuIndices.push(cpu.index);}
        this.emit({t:'hunt',name:huntedHuman.name,duration:0,graceMs:3000,cpuAmmo:true,cpuAmmoBonus:3,cpuIndices});
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
        p.guidedTarget=p.guided?this.guidedTargetFor(p):-1;
        const fireNow=this.resolveFireWithFlare(p,c,dt);
        if(fireNow&&p.bullets>0&&p.reload<=0&&(!p.cpu||(Number(p.cpuFireDelay)||0)<=0)){
          const guided=!!p.guided,guidedTarget=guided?p.guidedTarget:-1;
          const projectileSpeed=guided?500:this.bulletSpeed(p);
          this.bullets.push({id:uid(),owner:p.index,x:p.x+d.x*35,y:p.y+d.y*35,vx:d.x*projectileSpeed,vy:d.y*projectileSpeed,age:0,travel:0,guided,target:guidedTarget,flareTarget:-1,decoyed:false});
          if(guided){p.guided=false;p.guidedTarget=-1;}
          p.bullets--;p.reload=this.reloadTime(p);if(p.cpu)p.cpuFireDelay=CPU_ARMED_WARNING_SECONDS;this.emit({t:'sound',kind:'laser'});
        }
      }
      this.updateAsteroids(dt);this.updateFlares(dt);this.updateBullets(dt);this.updatePickups(dt);this.updateShower(dt);this.updateMeteors(dt);this.updateGiant(dt);this.shipCollisions();
    }
    reloadTime(p){
      // V20.15: la recarga global usa la misma espera reducida que antes
      // tenia solo el modo FACIL. No altera la velocidad del proyectil.
      return Math.max(.5,p.cadence/8)*.5;
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
        a.rot=(Number(a.rot)||0)+(Number(a.spin)||0)*DT;
        if(a.rot>=360||a.rot<0)a.rot=(a.rot%360+360)%360;
        if(a.exiting){
          if(a.x<-220||a.x>W+220||a.y<-220||a.y>H+220)this.asteroids.splice(i,1);
          continue;
        }
        if(a.x<-190&&a.vx<0)a.vx*=-1;else if(a.x>W+190&&a.vx>0)a.vx*=-1;
        if(a.y<-190&&a.vy<0)a.vy*=-1;else if(a.y>H+190&&a.vy>0)a.vy*=-1;
      }
      // V20.43: mismo tipo de rebote limpio de la pantalla de inicio:
      // intercambio de la componente normal y separacion completa del solape.
      for(let i=0;i<this.asteroids.length;i++)for(let j=i+1;j<this.asteroids.length;j++){
        const a=this.asteroids[i],b=this.asteroids[j];
        resolveRockCollision(a,asteroidRockRadius(a),b,asteroidRockRadius(b),1,1);
      }
      for(let i=this.pickups.length-1;i>=0;i--){
        const pk=this.pickups[i];
        for(const a of this.asteroids)if(circles(a,a.r,pk,PICKUP_RADIUS)){this.pickups.splice(i,1);break;}
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
            const targetSpeed=500*(1-.55*slow);
            const finalSpeed=b.age<3.2?currentSpeed:targetSpeed;
            b.vx=b.vx/corrected*finalSpeed;
            b.vy=b.vy/corrected*finalSpeed;
          }
        }
        b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;b.travel=(b.travel||0)+Math.hypot(b.vx,b.vy)*dt;
      }
      // V20.12: intercepcion entre proyectiles. Solo colisiona si al menos
      // uno de los dos es misil guiado. Bala-bala sigue atravesandose.
      // Proyectiles del mismo propietario no se destruyen entre si.
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
            if(!a.guided&&!b.guided)continue;

            const ar=a.guided?MISSILE_HIT_RADIUS:BULLET_RADIUS;
            const br=b.guided?MISSILE_HIT_RADIUS:BULLET_RADIUS;
            if(!sweptCircles(a,ar,b,br,false))continue;

            destroyedProjectiles.add(a);
            destroyedProjectiles.add(b);
            const hitX=(a.x+b.x)*.5,hitY=(a.y+b.y)*.5;
            const fxOwner=a.guided?Number(a.owner):Number(b.owner);
            this.emitRocketDisintegrateAt(hitX,hitY,Number.isInteger(fxOwner)?fxOwner:0);
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
            if(sweptCircles(b,BULLET_RADIUS,this.flares[f],FLARE_RADIUS,false)){
              // V19.64: cualquier proyectil queda anulado por una bengala.
              // El misil conserva su explosion visual; la bala normal simplemente
              // desaparece junto con la bengala alcanzada.
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
                const brutal=attacker&&attacker!==p&&(b.travel||0)>=BRUTAL_SHOT_DISTANCE;
                if(brutal)this.emit({t:'brutal',distance:Math.round(b.travel||0),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index});
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
        if(!remove)for(const a of this.asteroids){
          if(sweptCircles(b,BULLET_RADIUS,a,a.r,false)){
            if(b.guided){
              this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
              this.emit({t:'sound',kind:'sparkle'});
            }
            remove=true;break;
          }
        }
        if(!remove&&this.giant&&sweptCircles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS,false)){
          if(b.guided)this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
          remove=true;this.emit({t:'sound',kind:b.guided?'sparkle':'impact'});
        }
        if(!remove)for(let m=this.meteors.length-1;m>=0;m--){
          const meteor=this.meteors[m];
          if(sweptCircles(b,BULLET_RADIUS,meteor,SMALL_METEOR_RADIUS,false)){
            if(b.guided)this.emitRocketDisintegrateAt(b.x,b.y,b.owner);
            this.meteors.splice(m,1);remove=true;this.emit({t:'sound',kind:b.guided?'sparkle':'impact'});break;
          }
        }
        if(!remove)for(let p=this.pickups.length-1;p>=0;p--)if(sweptCircles(b,BULLET_RADIUS,this.pickups[p],PICKUP_RADIUS,false)){this.pickups.splice(p,1);remove=true;break;}
        if(remove)this.bullets.splice(i,1);
      }
    }
    updatePickups(dt){
      this.nextPickup-=dt;
      if(this.nextPickup<=0){
        let type;
        const flarePresent=this.pickups.some(pk=>pk.type==='flare');
        // V19.68 prueba de bengalas: si no hay una flotando, tiene ~35% de
        // probabilidad de ser el siguiente pickup para facilitar las pruebas.
        if(!flarePresent&&Math.random()<.35)type='flare';
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
              if(p.bullets<=0){
                p.bullets=1;
                p.reload=Math.max(p.reload,this.reloadTime(p));
              }
              p.guided=true;p.guidedTarget=this.guidedTargetFor(p);
            }
            else if(pk.type==='flare')p.flare=(Number(p.flare)||0)+1;
            else if(pk.type==='speed')p.speed=Math.min(2,p.speed+.5);
            else if(pk.type==='shield')p.shield=10;
            else if(pk.type==='camo')p.camo=10;
            this.emit({t:'sound',kind:'pickup'});taken=true;break;
          }
        }
        if(taken)this.pickups.splice(i,1);
      }
    }
    updateShower(dt){
      if(this.showerLeft<=0){
        this.firstShower-=dt;
        if(this.firstShower<=0){this.showerLeft=7;this.nextMeteor=0;this.firstShower=999999;}
        else if(this.nextShower>0){this.nextShower-=dt;if(this.nextShower<=0){this.showerLeft=7;this.nextMeteor=0;}}
      }
      if(this.showerLeft>0){
        this.showerLeft=Math.max(0,this.showerLeft-dt);this.nextMeteor-=dt;
        while(this.nextMeteor<=0&&this.showerLeft>0){
          const left=Math.random()<.5,vx=(left?1:-1)*rand(110,220),vy=rand(-55,55);
          this.meteors.push({id:uid(),type:randint(1,3),x:left?-40:W+40,y:rand(40,H-40),vx,vy,angle:rand(0,360)});
          this.nextMeteor+=rand(.28,.42);
        }
        if(this.showerLeft<=0)this.nextShower=rand(140,200);
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
      // V20.43: el choque gigante-mediano usa la misma resolucion fisica
      // que la portada. El gigante tiene masa 9x (radio 3x), por lo que el
      // mediano rebota con claridad y el gigante solo corrige ligeramente.
      for(const a of this.asteroids)resolveRockCollision(g,GIANT_ROCK_RADIUS,a,asteroidRockRadius(a),9,1);
      for(let i=this.pickups.length-1;i>=0;i--)if(circles(g,GIANT_RADIUS,this.pickups[i],PICKUP_RADIUS))this.pickups.splice(i,1);
      if(g.entered&&(g.x<-350||g.x>W+350||g.y<-350||g.y>H+350)){this.giant=null;this.nextGiant=rand(130,190);}
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
            if(p.shield>0)p.shield=0;
            const n=normalize(p.x-flare.x,p.y-flare.y);
            p.vx=n.x*150;p.vy=n.y*150;
            p.x+=n.x*7;p.y+=n.y*7;
            this.emit({t:'sound',kind:'impact'});
          }else{
            // V19.73: la muerte por bengala suma al jugador que la desplego.
            const attacker=flareOwner&&flareOwner!==p?flareOwner:null;
            this.destroyShip(p,attacker);
          }
          if(p.dead)break;
        }
        if(p.dead)continue;

        for(const a of this.asteroids)if(sweptCircles(p,SHIP_RADIUS,a,a.r,false)){if(p.shield>0){this.emitShipImpact(p,a,false);const n=normalize(p.x-a.x,p.y-a.y),dot=p.vx*n.x+p.vy*n.y;if(dot<0){p.vx-=1.85*dot*n.x;p.vy-=1.85*dot*n.y;}p.x+=n.x*5;p.y+=n.y*5;}else this.destroyShip(p,null);}
      }
      for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
        const a=this.players[i],b=this.players[j];if(a.dead||b.dead||!sweptCircles(a,SHIP_RADIUS,b,SHIP_RADIUS,true))continue;
        if(a.shield>0||a.protection>0)this.emitShipImpact(a,b,false);
        if(b.shield>0||b.protection>0)this.emitShipImpact(b,a,false);
        if(a.shield>0&&b.shield<=0)this.destroyShip(b,a,true);
        else if(b.shield>0&&a.shield<=0)this.destroyShip(a,b,true);
        else if(a.shield<=0&&b.shield<=0){this.destroyShip(a,null);this.destroyShip(b,null);}
        else{const n=normalize(wrapDelta(a.x-b.x,W),wrapDelta(a.y-b.y,H));a.vx=n.x*120;a.vy=n.y*120;b.vx=-n.x*120;b.vy=-n.y*120;}
      }
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
        t:'state',seq:++this.seq,round:this.rankRound,code:this.code,mode:'p2p',started:this.started,finished:this.finished,winner:this.winner,
        w:W,h:H,scoreToWin:SCORE_TO_WIN,fxVersion:1,
        fx:this.fxEvents.map(e=>({id:e.id,i:e.i,x:e.x,y:e.y,kind:e.kind,hidden:e.hidden,age:Math.max(0,Math.round((this.fxClock-e.at)*1000))})),
        players:this.players.map(p=>({i:p.index,n:p.name,cpu:p.cpu,x:round1(p.x),y:round1(p.y),r:round1(p.rot),vx:round1(p.vx),vy:round1(p.vy),thrust:!!p.thrust,ammo:p.bullets,armed:!p.dead&&(Number(p.spawnFx)||0)<=0&&p.bullets>0&&p.reload<=0,cad:p.cadence,spd:p.speed,k:p.kills,d:p.deaths,shield:round2(p.shield),camo:round2(p.camo),prot:round2(p.protection),spawnFx:round2(Math.max(0,Number(p.spawnFx)||0)),mira:!!p.guided,mt:Number.isInteger(p.guidedTarget)?p.guidedTarget:-1,flare:Math.max(0,Math.round(Number(p.flare)||0)),dead:p.dead,respawn:round3(p.respawn)})),
        asteroids:this.asteroids.map(a=>({id:a.id,x:round1(a.x),y:round1(a.y),type:a.type,a:round1(Number(a.rot)||0)})),
        bullets:this.bullets.map(b=>({id:b.id,o:b.owner,x:round1(b.x),y:round1(b.y),vx:round1(b.vx),vy:round1(b.vy),g:!!b.guided,gt:(!b.decoyed&&Number.isInteger(b.target))?b.target:-1})),
        flares:this.flares.map(f=>({id:f.id,o:f.owner,x:round1(f.x),y:round1(f.y),a:round1(f.angle),life:round2(Math.max(0,f.life))})),
        pickups:this.pickups.map((p,idx)=>({id:p.id,type:p.type,x:round1(p.x),y:round1(p.y+Math.cos(p.phase)*3),expiresIn:(idx===0&&this.pickups.length>=5)?round2(Math.max(0,this.nextPickup)):null})),
        meteors:this.meteors.map(m=>({id:m.id,type:m.type,x:round1(m.x),y:round1(m.y),a:round1(m.angle)})),
        giant:this.giant?{x:round1(this.giant.x),y:round1(this.giant.y)}:null,
        shower:round2(this.showerLeft),
        nextShower:this.showerLeft>0?0:round1(Math.max(0,Math.min(this.firstShower,this.nextShower||999999)))
      };
    }
  }
  window.GalaxyHostPhysics=GalaxyHostPhysics;
})();