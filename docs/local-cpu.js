'use strict';
(() => {
  const W=1920,H=1080,TICK_HZ=60,DT=1/TICK_HZ,STEP_MS=1000/TICK_HZ;
  const DRAG_PER_TICK=Math.pow(0.35,DT);
  const IDLE_CONTROL=Object.freeze({turn:0,thrust:false,fire:false});
  const SCORE_TO_WIN=5;
  const SHIP_RADIUS=24,ASTEROID_RADIUS=45,GIANT_RADIUS=135,PICKUP_RADIUS=22,BULLET_RADIUS=4,SMALL_METEOR_RADIUS=14;
  const SPAWN_PROTECTION_SECONDS=3,BRUTAL_SHOT_DISTANCE=850;
  const ASTEROID_STARTS=[
    [160,430,300,1],[30,930,10,3],[1800,30,210,4],
    [1500,150,160,2],[500,430,160,5],[1300,430,200,6]
  ];
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
      this.started=false;
      this.finished=false;
      this.winner=null;
      this.difficulty='medio';
      this.cpuCount=1;
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
      this.pickups=[];
      this.meteors=[];
      this.giant=null;
      this.asteroids=[];
      this.nextPickup=1;
      this.firstShower=rand(120,180);
      this.showerLeft=0;
      this.nextMeteor=0;
      this.nextShower=0;
      this.noDeathTime=0;
      this.nextGiant=rand(50,80);
      this.lastNow=0;
      this.accumulator=0;
      this.tickCount=0;
      this.brain=null;
      this.trainingMode=false;
      this.learningByCpu=new Map();
      this.meteorLearningByCpu=new Map();
      this.learningSent=false;
      this.resetAsteroids();
    }
    emit(msg){try{this.onEvent(msg);}catch(_){}}
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
      const side=(forward.x*dy-forward.y*dx)>=0?0:1;
      return{meteor:m,dist,closing,ttc,closest,side};
    }
    meteorLearningContext(cpu,threat){
      const side=threat&&threat.side?1:0;
      const velocity=threat&&threat.closing>130?1:0;
      const distance=threat&&threat.dist<190?0:1;
      return 'meteor-s'+side+'-v'+velocity+'-d'+distance;
    }
    recordLearning(cpu,context,action){
      if(this.difficulty!=='dificil'||!cpu||!cpu.cpu)return;
      let map=this.learningByCpu.get(cpu.index);
      if(!map){map=new Map();this.learningByCpu.set(cpu.index,map);}
      const key=context+'|'+action;
      const item=map.get(key)||{context,action,uses:0};
      item.uses=Math.min(50,item.uses+1);
      map.set(key,item);
    }
    recordMeteorLearning(cpu,context,action,reward){
      if(this.difficulty!=='dificil'||!cpu||!cpu.cpu||!context||!action)return;
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

      if(!cpu.meteorDecision||cpu.meteorDecision.meteorId!==threat.meteor.id){
        if(cpu.meteorDecision)this.settleMeteorDecision(cpu,.25);
        const context=this.meteorLearningContext(cpu,threat);
        const actions=['meteor_left','meteor_right','meteor_brake'];
        let action=threat.side===0?'meteor_right':'meteor_left';
        if(threat.dist<135&&threat.closing>170)action='meteor_brake';
        if(this.difficulty==='dificil'){
          const hasLearned=!!(this.brain&&Array.isArray(this.brain.strategies)&&this.brain.strategies.some(e=>e&&e.context===context&&actions.includes(e.action)));
          if(hasLearned)action=this.chooseBrainAction(context,actions,this.trainingMode?.30:.14);
          else if(Math.random()<(this.trainingMode?.34:.16))action=actions[randint(0,actions.length-1)];
        }
        cpu.meteorDecision={meteorId:threat.meteor.id,context,action,started:this.fxClock};
      }

      const action=cpu.meteorDecision.action;
      const awayTurn=threat.side===0?-1:1;
      if(action==='meteor_brake')return{turn:awayTurn,thrust:false,fire:false};
      return{turn:action==='meteor_left'?1:-1,thrust:true,fire:false};
    }
    buildLearningDeltas(){
      if(this.difficulty!=='dificil')return [];
      const general=[],meteor=[];
      const human=this.players.find(p=>!p.cpu);
      for(const cpu of this.players.filter(p=>p.cpu)){
        const won=this.winner===cpu.index;
        let reward=(cpu.kills-cpu.deaths)/Math.max(2,SCORE_TO_WIN);
        if(won)reward+=1.2;
        if(human&&this.winner===human.index)reward-=.35;
        reward=clamp(reward,-2,2);
        const map=this.learningByCpu.get(cpu.index);
        if(map)for(const item of map.values())general.push({context:item.context,action:item.action,uses:Math.min(4,item.uses),reward:+reward.toFixed(3)});
        const meteorMap=this.meteorLearningByCpu.get(cpu.index);
        if(meteorMap)for(const item of meteorMap.values()){
          const avg=item.uses?item.total/item.uses:0;
          meteor.push({context:item.context,action:item.action,uses:Math.min(4,item.uses),reward:+clamp(avg,-2,2).toFixed(3)});
        }
      }
      return meteor.slice(0,10).concat(general.slice(0,14)).slice(0,24);
    }
    resetAsteroids(){
      this.asteroids=ASTEROID_STARTS.map(([x,y,rot,type])=>{
        const d=dirFromRot(rot);
        return{id:uid(),x,y,rot,type,vx:d.x*80,vy:d.y*80,r:ASTEROID_RADIUS};
      });
    }
    makePlayer(index,name,cpu){
      return{
        index,name:safeName(name,cpu?'CPU':'JUGADOR '+(index+1)),cpu,
        x:0,y:0,rot:0,vx:0,vy:0,thrust:false,
        bullets:5,cadence:30,speed:1,kills:0,deaths:0,
        reload:0,shield:0,camo:0,protection:SPAWN_PROTECTION_SECONDS,
        dead:false,respawn:0,lastControlAt:Date.now(),lastSpawn:null,
        difficulty:this.difficulty,
        tactic:'scatter',tacticUntil:0,tacticTurn:(Math.random()<.5?-1:1),tacticSeed:Math.random(),
        resourceTargetId:null,meteorDecision:null
      };
    }
    start(name='JUGADOR',difficulty='medio',cpuCount=1,brain=null){
      this.trainingMode=false;
      this.difficulty=String(difficulty||'medio');
      this.brain=this.difficulty==='dificil'&&brain&&typeof brain==='object'?brain:null;
      this.learningByCpu.clear();
      this.meteorLearningByCpu.clear();
      this.learningSent=false;
      this.cpuCount=clamp(Math.round(Number(cpuCount)||1),1,3);
      this.huntTargetIndex=0;
      this.huntUntil=0;
      this.huntStartsAt=0;
      this.huntThresholdActive=false;
      this.players=[];
      this.controls.clear();
      this.seq=0;this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.pickups=[];this.meteors=[];this.giant=null;
      this.nextPickup=1;this.firstShower=rand(120,180);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);
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
      this.difficulty='dificil';
      this.brain=brain&&typeof brain==='object'?brain:null;
      this.learningByCpu.clear();
      this.meteorLearningByCpu.clear();
      this.learningSent=false;
      this.cpuCount=4;
      this.huntTargetIndex=0;
      this.huntUntil=0;
      this.huntStartsAt=0;
      this.huntThresholdActive=false;
      this.players=[];
      this.controls.clear();
      this.seq=0;this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.pickups=[];this.meteors=[];this.giant=null;
      this.nextPickup=1;this.firstShower=rand(120,180);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);
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
    setControl(turn,thrust,fire){
      const p=this.players[0];
      if(!p)return false;
      this.controls.set(0,{turn:clamp(Number(turn)||0,-1,1),thrust:!!thrust,fire:!!fire});
      p.lastControlAt=Date.now();
      return true;
    }
    handleMessage(msg){
      if(!msg||typeof msg!=='object')return true;
      if(msg.t==='ctrl'){this.setControl(msg.turn,msg.thrust,msg.fire);return true;}
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
      let steps=0;
      while(this.accumulator>=STEP_MS&&steps<5){
        this.update(DT);
        this.accumulator-=STEP_MS;
        this.tickCount++;
        if((this.tickCount&1)===0||this.finished)this.onState(this.publicState());
        steps++;
        if(this.finished)break;
      }
      if(steps===5&&this.accumulator>=STEP_MS)this.accumulator%=STEP_MS;
    }
    restart(){
      if(!this.finished||this.players.length<2)return false;
      this.started=false;this.finished=false;this.winner=null;this.seq=0;
      this.learningByCpu.clear();this.meteorLearningByCpu.clear();this.learningSent=false;
      this.fxClock=0;this.fxSeq=0;this.fxEvents=[];this.fxLastHit.clear();
      this.bullets=[];this.pickups=[];this.meteors=[];this.giant=null;
      this.nextPickup=1;this.firstShower=rand(120,180);this.showerLeft=0;this.nextMeteor=0;this.nextShower=0;
      this.noDeathTime=0;this.nextGiant=rand(50,80);
      this.huntTargetIndex=0;this.huntUntil=0;this.huntStartsAt=0;this.huntThresholdActive=false;
      this.resetAsteroids();
      for(const p of this.players)p.dead=true;
      for(const p of this.players){
        p.bullets=5;p.cadence=30;p.speed=1;p.kills=0;p.deaths=0;p.reload=0;
        p.shield=0;p.camo=0;p.protection=SPAWN_PROTECTION_SECONDS;p.respawn=0;
        p.lastControlAt=Date.now();p.lastSpawn=null;p.resourceTargetId=null;p.meteorDecision=null;
        if(p.cpu){
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
    destroyShip(victim,attacker=null){
      if(victim.dead||this.finished)return;
      if(victim.protection>0||victim.shield>0){this.emitShipImpact(victim,attacker,false);return;}
      victim.dead=true;victim.respawn=.7;victim.vx=victim.vy=0;victim.deaths++;
      if(!attacker||attacker===victim)victim.kills=Math.max(0,victim.kills-1);
      victim.bullets=0;victim.cadence=30;victim.speed=1;victim.shield=0;victim.camo=0;victim.reload=0;
      this.noDeathTime=0;this.emitShipImpact(victim,null,true);this.emit({t:'sound',kind:'impact'});
      if(attacker&&attacker!==victim){
        attacker.kills++;
        if(attacker.kills>=SCORE_TO_WIN){
          this.finished=true;this.winner=attacker.index;
          if(this.difficulty==='dificil'&&!this.learningSent){
            this.learningSent=true;
            const deltas=this.buildLearningDeltas();
            if(deltas.length)this.emit({t:'cpu-learning',deltas});
          }
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
      p.x=best.x;p.y=best.y;p.px=p.x;p.py=p.y;p.rot=area.rot;p.vx=0;p.vy=0;p.lastSpawn={x:p.x,y:p.y};
    }
    respawnPlayer(p){
      this.placeAtSpawn(p);p.dead=false;p.respawn=0;p.protection=SPAWN_PROTECTION_SECONDS;
      p.bullets=1;p.cadence=30;p.speed=1;p.shield=0;p.camo=0;p.reload=0;
      if(p.cpu){p.resourceTargetId=null;p.meteorDecision=null;}
    }
    chooseCpuControls(cpu){
      if(cpu.dead)return IDLE_CONTROL;

      const meteorControl=this.chooseMeteorControls(cpu);
      if(meteorControl)return meteorControl;

      let rival=null;
      const huntGrace=this.huntThresholdActive&&this.fxClock<this.huntStartsAt;
      if(this.huntUntil>this.fxClock&&this.fxClock>=this.huntStartsAt){
        rival=this.players.find(p=>p.index===this.huntTargetIndex&&!p.dead&&p.camo<=0)||null;
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
          if(pk.type!=='shield'&&!pk.type.startsWith('ammo'))continue;
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

        let hasUsefulPickup=false;
        for(const pk of this.pickups){
          if(pk.type==='shield'||pk.type.startsWith('ammo')){hasUsefulPickup=true;break;}
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
        const locked=cpu.resourceTargetId==null?null:this.pickups.find(pk=>pk.id===cpu.resourceTargetId);
        if(locked&&(locked.type==='shield'||locked.type.startsWith('ammo')))return locked;
        let bestPk=null,bestScore=Infinity;
        for(const pk of this.pickups){
          if(pk.type!=='shield'&&!pk.type.startsWith('ammo'))continue;
          let score=Math.sqrt(dist2(cpu,pk));
          if(preferShield&&pk.type==='shield')score-=260;
          if(cpu.bullets===0&&pk.type.startsWith('ammo'))score-=320;
          if(cpu.bullets<=2&&pk.type.startsWith('ammo'))score-=130;
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
      if(cpu.shield>0){
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
      const inFiringArc=Math.abs(aimErr)<7&&distance<1350;
      const fire=cpu.bullets>0&&cpu.reload<=0&&inFiringArc&&(huntActive||!rivalDangerous);
      return{turn,thrust,fire};
    }
    update(dt){
      if(!this.started||this.finished)return;
      this.noDeathTime+=dt;this.fxClock+=dt;
      const human=this.trainingMode?null:(this.players.find(p=>!p.cpu)||null);
      const cpuPlayers=this.trainingMode?[]:this.players.filter(p=>p.cpu);
      const huntScore=SCORE_TO_WIN-1;
      const shouldHunt=!!(!this.trainingMode&&cpuPlayers.length&&human&&!this.finished&&human.kills>=huntScore&&human.kills<SCORE_TO_WIN);
      if(shouldHunt&&!this.huntThresholdActive){
        this.huntThresholdActive=true;
        this.huntTargetIndex=human.index;
        this.huntStartsAt=this.fxClock+3;
        this.huntUntil=Infinity;
        const cpuIndices=[];
        for(const cpu of cpuPlayers){cpu.bullets+=3;cpuIndices.push(cpu.index);}
        this.emit({t:'hunt',name:human.name,duration:0,graceMs:3000,cpuAmmo:true,cpuAmmoBonus:3,cpuIndices});
      }else if(!shouldHunt&&this.huntThresholdActive){
        this.huntThresholdActive=false;
        this.huntStartsAt=0;
        this.huntUntil=0;
      }
      let fxWrite=0;
      for(const e of this.fxEvents)if(this.fxClock-e.at<=.8)this.fxEvents[fxWrite++]=e;
      this.fxEvents.length=fxWrite;
      for(const p of this.players){
        p.protection=p.protection-dt>1e-9?p.protection-dt:0;
        p.shield=Math.max(0,p.shield-dt);p.camo=Math.max(0,p.camo-dt);p.reload=Math.max(0,p.reload-dt);
        if(p.dead){p.thrust=false;p.respawn-=dt;if(p.respawn<=0)this.respawnPlayer(p);continue;}
        p.px=p.x;p.py=p.y;
        const stored=this.controls.get(p.index)||IDLE_CONTROL;
        const c=p.cpu?this.chooseCpuControls(p):((Date.now()-(p.lastControlAt||0)<=300)?stored:IDLE_CONTROL);
        p.thrust=!!c.thrust;
        p.rot=(p.rot+c.turn*240*dt+360)%360;
        const d=dirFromRot(p.rot);
        if(c.thrust){p.vx+=d.x*(240*p.speed)*dt;p.vy+=d.y*(240*p.speed)*dt;}
        p.vx*=DRAG_PER_TICK;p.vy*=DRAG_PER_TICK;
        const vmax=330*p.speed,sp=Math.hypot(p.vx,p.vy);
        if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
        p.x=(p.x+p.vx*dt+W)%W;p.y=(p.y+p.vy*dt+H)%H;

        // Comprobacion final de disparo DESPUES de aplicar el giro de este frame.
        // Antes la IA decidia "disparo" con la rotacion anterior y la bala se
        // generaba con la rotacion ya modificada; en maniobras/evitacion podia
        // salir desviada. Ahora solo dispara si el morro final apunta de verdad
        // a un rival visible dentro del alcance.
        let fireNow=!!c.fire;
        if(p.cpu&&fireNow){
          fireNow=false;
          for(const target of this.players){
            if(target.index===p.index||target.dead||target.camo>0)continue;
            if(this.huntThresholdActive&&this.fxClock<this.huntStartsAt&&target.index===this.huntTargetIndex)continue;
            const tx=target.x-p.x,ty=target.y-p.y,td=Math.hypot(tx,ty);
            if(td<=0||td>=1350)continue;
            const dot=(d.x*tx+d.y*ty)/td;
            if(dot>=Math.cos(7*Math.PI/180)){fireNow=true;break;}
          }
        }
        if(fireNow&&p.bullets>0&&p.reload<=0){
          this.bullets.push({id:uid(),owner:p.index,x:p.x+d.x*35,y:p.y+d.y*35,vx:d.x*this.bulletSpeed(p),vy:d.y*this.bulletSpeed(p),age:0,travel:0});
          p.bullets--;p.reload=Math.max(.5,p.cadence/8);this.emit({t:'sound',kind:'laser'});
        }
      }
      this.updateAsteroids(dt);this.updateBullets(dt);this.updatePickups(dt);this.updateShower(dt);this.updateMeteors(dt);this.updateGiant(dt);this.shipCollisions();
    }
    bulletSpeed(p){return p.cadence>=30?500:p.cadence>=20?750:p.cadence>=10?900:1000;}
    updateAsteroids(){
      for(const a of this.asteroids){
        a.px=a.x;a.py=a.y;a.x+=a.vx*DT;a.y+=a.vy*DT;
        if(a.x<-190&&a.vx<0)a.vx*=-1;else if(a.x>W+190&&a.vx>0)a.vx*=-1;
        if(a.y<-190&&a.vy<0)a.vy*=-1;else if(a.y>H+190&&a.vy>0)a.vy*=-1;
      }
      for(let i=0;i<this.asteroids.length;i++)for(let j=i+1;j<this.asteroids.length;j++){
        const a=this.asteroids[i],b=this.asteroids[j];
        if(circles(a,a.r,b,b.r)){
          const n=normalize(b.x-a.x,b.y-a.y),rel=(a.vx-b.vx)*n.x+(a.vy-b.vy)*n.y;
          if(rel>0){const an=a.vx*n.x+a.vy*n.y,bn=b.vx*n.x+b.vy*n.y;a.vx+=(bn-an)*n.x;a.vy+=(bn-an)*n.y;b.vx+=(an-bn)*n.x;b.vy+=(an-bn)*n.y;}
          a.x-=n.x*2;b.x+=n.x*2;a.y-=n.y*2;b.y+=n.y*2;
        }
      }
      for(let i=this.pickups.length-1;i>=0;i--){
        const pk=this.pickups[i];
        for(const a of this.asteroids)if(circles(a,a.r,pk,PICKUP_RADIUS)){this.pickups.splice(i,1);break;}
      }
    }
    updateBullets(dt){
      for(const b of this.bullets){b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;b.travel=(b.travel||0)+Math.hypot(b.vx,b.vy)*dt;}
      for(let i=this.bullets.length-1;i>=0;i--){
        const b=this.bullets[i];let remove=b.age>3||b.x<-20||b.y<-20||b.x>W+20||b.y>H+20;
        if(!remove){
          for(const p of this.players){
            if(p.index===b.owner||p.dead||p.protection>0)continue;
            if(sweptCircles(b,BULLET_RADIUS,p,SHIP_RADIUS,false)){
              const attacker=this.players.find(q=>q.index===b.owner)||null;
              if(p.shield<=0){
                const brutal=attacker&&attacker!==p&&(b.travel||0)>=BRUTAL_SHOT_DISTANCE;
                if(brutal)this.emit({t:'brutal',distance:Math.round(b.travel||0),shooter:attacker.name||('J'+(attacker.index+1)),shooterIndex:attacker.index});
                this.destroyShip(p,attacker);
              }else this.emitShipImpact(p,b,false);
              remove=true;break;
            }
          }
        }
        if(!remove)for(const a of this.asteroids)if(sweptCircles(b,BULLET_RADIUS,a,a.r,false)){remove=true;break;}
        if(!remove&&this.giant&&sweptCircles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS,false)){remove=true;this.emit({t:'sound',kind:'impact'});}
        if(!remove)for(let m=this.meteors.length-1;m>=0;m--)if(sweptCircles(b,BULLET_RADIUS,this.meteors[m],SMALL_METEOR_RADIUS,false)){this.meteors.splice(m,1);remove=true;this.emit({t:'sound',kind:'impact'});break;}
        if(!remove)for(let p=this.pickups.length-1;p>=0;p--)if(sweptCircles(b,BULLET_RADIUS,this.pickups[p],PICKUP_RADIUS,false)){this.pickups.splice(p,1);remove=true;break;}
        if(remove)this.bullets.splice(i,1);
      }
    }
    updatePickups(dt){
      this.nextPickup-=dt;
      if(this.nextPickup<=0){
        const roll=randint(1,28);let type;
        if(roll<=7)type='ammo3';else if(roll<=16)type='ammo1';else if(roll<=19)type='cadence';else if(roll<=22)type='speed';else if(roll<=25)type='shield';else type='camo';
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
            if(pk.type==='ammo3'){p.bullets+=6;p.reload=Math.max(p.reload,Math.max(.5,p.cadence/8));}else if(pk.type==='ammo1'){p.bullets+=1;p.reload=Math.max(p.reload,Math.max(.5,p.cadence/8));}
            else if(pk.type==='cadence')p.cadence=Math.max(1,p.cadence-10);
            else if(pk.type==='speed')p.speed=Math.min(2,p.speed+.5);
            else if(pk.type==='shield')p.shield=10;
            else if(pk.type==='camo')p.camo=10;
            if(p.cpu&&p.resourceTargetId===pk.id)p.resourceTargetId=null;
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
        if(this.showerLeft<=0)this.nextShower=rand(120,180);
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
      for(const p of this.players)if(!p.dead&&sweptCircles(g,GIANT_RADIUS,p,SHIP_RADIUS,false)){if(p.shield>0||p.protection>0){this.emitShipImpact(p,g,false);const n=normalize(p.x-g.x,p.y-g.y);p.vx=n.x*130;p.vy=n.y*130;p.x+=n.x*8;p.y+=n.y*8;}else this.destroyShip(p,null);}
      for(const a of this.asteroids)if(circles(g,GIANT_RADIUS,a,a.r)){const n=normalize(a.x-g.x,a.y-g.y);a.vx+=n.x*25;a.vy+=n.y*25;a.x+=n.x*5;a.y+=n.y*5;}
      for(let i=this.pickups.length-1;i>=0;i--)if(circles(g,GIANT_RADIUS,this.pickups[i],PICKUP_RADIUS))this.pickups.splice(i,1);
      if(g.entered&&(g.x<-350||g.x>W+350||g.y<-350||g.y>H+350)){this.giant=null;this.nextGiant=rand(130,190);}
    }
    shipCollisions(){
      for(const p of this.players){
        if(p.dead)continue;
        for(const a of this.asteroids)if(sweptCircles(p,SHIP_RADIUS,a,a.r,false)){if(p.shield>0){this.emitShipImpact(p,a,false);const n=normalize(p.x-a.x,p.y-a.y),dot=p.vx*n.x+p.vy*n.y;if(dot<0){p.vx-=1.85*dot*n.x;p.vy-=1.85*dot*n.y;}p.x+=n.x*5;p.y+=n.y*5;}else this.destroyShip(p,null);}
      }
      for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
        const a=this.players[i],b=this.players[j];if(a.dead||b.dead||!sweptCircles(a,SHIP_RADIUS,b,SHIP_RADIUS,true))continue;
        if(a.shield>0||a.protection>0)this.emitShipImpact(a,b,false);
        if(b.shield>0||b.protection>0)this.emitShipImpact(b,a,false);
        if(a.shield>0&&b.shield<=0)this.destroyShip(b,a);
        else if(b.shield>0&&a.shield<=0)this.destroyShip(a,b);
        else if(a.shield<=0&&b.shield<=0){this.destroyShip(a,null);this.destroyShip(b,null);}
        else{const n=normalize(wrapDelta(a.x-b.x,W),wrapDelta(a.y-b.y,H));a.vx=n.x*120;a.vy=n.y*120;b.vx=-n.x*120;b.vy=-n.y*120;}
      }
    }
    publicState(){
      return{
        t:'state',seq:++this.seq,code:'LOCAL',mode:'cpu',started:this.started,finished:this.finished,winner:this.winner,
        w:W,h:H,scoreToWin:SCORE_TO_WIN,fxVersion:1,
        fx:this.fxEvents.map(e=>({id:e.id,i:e.i,x:e.x,y:e.y,kind:e.kind,hidden:e.hidden,age:Math.max(0,Math.round((this.fxClock-e.at)*1000))})),
        players:this.players.map(p=>({i:p.index,n:p.name,cpu:p.cpu,x:+p.x.toFixed(1),y:+p.y.toFixed(1),r:+p.rot.toFixed(1),vx:+p.vx.toFixed(1),vy:+p.vy.toFixed(1),thrust:!!p.thrust,ammo:p.bullets,armed:!p.dead&&p.bullets>0&&p.reload<=0,cad:p.cadence,spd:p.speed,k:p.kills,d:p.deaths,shield:+p.shield.toFixed(2),camo:+p.camo.toFixed(2),prot:+p.protection.toFixed(2),dead:p.dead,respawn:+p.respawn.toFixed(3)})),
        asteroids:this.asteroids.map(a=>({id:a.id,x:+a.x.toFixed(1),y:+a.y.toFixed(1),type:a.type})),
        bullets:this.bullets.map(b=>({id:b.id,o:b.owner,x:+b.x.toFixed(1),y:+b.y.toFixed(1),vx:+b.vx.toFixed(1),vy:+b.vy.toFixed(1)})),
        pickups:this.pickups.map((p,idx)=>({id:p.id,type:p.type,x:+p.x.toFixed(1),y:+(p.y+Math.cos(p.phase)*3).toFixed(1),expiresIn:(idx===0&&this.pickups.length>=5)?+Math.max(0,this.nextPickup).toFixed(2):null})),
        meteors:this.meteors.map(m=>({id:m.id,type:m.type,x:+m.x.toFixed(1),y:+m.y.toFixed(1),a:+m.angle.toFixed(1)})),
        giant:this.giant?{x:+this.giant.x.toFixed(1),y:+this.giant.y.toFixed(1)}:null,
        shower:+this.showerLeft.toFixed(2),
        nextShower:this.showerLeft>0?0:+Math.max(0,Math.min(this.firstShower,this.nextShower||999999)).toFixed(1)
      };
    }
  }
  window.GalaxyLocalCpu=GalaxyLocalCpu;
})();