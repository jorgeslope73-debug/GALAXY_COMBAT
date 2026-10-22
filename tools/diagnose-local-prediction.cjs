'use strict';
// Diagnostico local: ejecuta la prediccion visual real con snapshots retrasados.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const game=fs.readFileSync('docs/game.js','utf8');
const start=game.indexOf('  function drawShip(');
const end=game.indexOf('      x=localVisual.x;y=localVisual.y;r=localVisual.r;',start);
const source=game.slice(start,end)+'return {...localVisual};}}';
function trial(delay,ack=true,hz=60){
  const ctx=vm.createContext({myIndex:1,isHost:false,isMobile:false,localCpuActive:false,roomCode:'TEST',
    W:1920,H:1080,lastStateTime:0,lastControlTurn:0,lastControlTurnChangedAt:0,lastControlThrust:false,
    localVisual:{ready:false},perfStats:null,lastTurnControlSeq:0,lastSubmittedTurn:0,lastMotionControlSeq:0,lastSubmittedThrust:false,
    wrappedDelta:(a,b,size)=>{let d=b-a;if(d>size/2)d-=size;else if(d<-size/2)d+=size;return d;},
    angleDelta:(a,b)=>(b-a+540)%360-180});
  vm.runInContext(source,ctx);
  let current=null,previous=null,atStop=0,min=Infinity,max=-Infinity;
  for(let frame=0;frame<=hz*2.5;frame++){
    const now=frame*1000/hz,turn=now>=500&&now<1000?1:0;
    if(turn!==ctx.lastControlTurn){ctx.lastControlTurn=turn;ctx.lastControlTurnChangedAt=now;ctx.lastSubmittedTurn=turn;ctx.lastTurnControlSeq++;}
    if(!current||Math.floor(now/50)>Math.floor(ctx.lastStateTime/50)){
      // Mismo retraso de ida y vuelta, sin perdida ni variacion de velocidad.
      const hostObservedTime=now-2*delay;
      previous=current;current={i:1,x:500,y:500,r:240*Math.max(0,Math.min(.5,(hostObservedTime-500)/1000)),vx:0,vy:0,spd:1,dead:false};
      if(ack)current.appliedControlSeq=hostObservedTime>=1000?2:hostObservedTime>=500?1:0;
      ctx.lastStateTime=now;
    }
    const v=ctx.drawShip(current,previous,1,now);
    if(frame===hz)atStop=v.r;
    if(now>=1000){min=Math.min(min,v.r);max=Math.max(max,v.r);}
  }
  return {oneWayDelayMs:delay,angleAtRelease:atStop,minimumAfterRelease:min,maximumAfterRelease:max,uncommandedRotation:max-min};
}
const legacy=trial(200,false);
assert(legacy.uncommandedRotation>40,'reproducir regresion sin ACK');
for(const hz of [30,60,120])for(const delay of [0,50,150,200]){
  const result=trial(delay,true,hz);
  assert(result.uncommandedRotation<.01,JSON.stringify({hz,...result}));
}
if(require.main===module)console.log(JSON.stringify({legacy,withAck:trial(200)},null,2));

function releaseContext(){
  const ctx=vm.createContext({myIndex:1,isHost:false,isMobile:false,localCpuActive:false,roomCode:'TEST',
    W:1920,H:1080,lastStateTime:0,lastControlTurn:0,lastControlTurnChangedAt:0,lastControlThrust:false,
    localVisual:{ready:true,index:1,x:500,y:500,r:0,vx:60,vy:0,lastAt:0},perfStats:null,
    lastTurnControlSeq:0,lastSubmittedTurn:0,lastMotionControlSeq:2,lastSubmittedThrust:false,
    wrappedDelta:(a,b,size)=>(b-a+size*1.5)%size-size/2,
    angleDelta:(a,b)=>(b-a+540)%360-180});
  vm.runInContext(source,ctx);return ctx;
}
for(const hz of [30,60,120]){
  const ctx=releaseContext(),dt=1/hz;
  const stale={i:1,x:490,y:500,r:0,vx:80,vy:0,spd:1,thrust:true,appliedControlSeq:1};
  let expectedX=500,expectedVx=60;
  for(let frame=1;frame<=Math.round(hz*.2);frame++){
    const now=frame*1000/hz;
    if(frame%2===0)ctx.lastStateTime=now; // siguen llegando estados previos a la liberacion
    expectedVx*=Math.pow(.35,dt);expectedX+=expectedVx*dt;
    const visual=ctx.drawShip(stale,null,1,now);
    assert(Math.abs(visual.vx-expectedVx)<1e-8,'estado sin ACK no reinyecta velocidad al soltar');
    assert(Math.abs(visual.x-expectedX)<1e-8,'estado sin ACK no arrastra posicion al soltar');
  }
  const beforeError=ctx.localVisual.x-490;
  ctx.lastStateTime=220;
  ctx.drawShip({...stale,thrust:false,appliedControlSeq:2},null,1,220);
  assert(ctx.localVisual.x-490<beforeError,'al confirmar, retomar reconciliacion autoritativa');
}
// Estado confirmado en inercia: el mismo snapshot no debe acelerar la nave entre frames.
const coast=releaseContext();coast.lastMotionControlSeq=1;
const coasting={i:1,x:500,y:500,r:0,vx:60,vy:0,spd:1,thrust:false,appliedControlSeq:1};
for(let tick=1;tick<=3;tick++){
  const visual=coast.drawShip(coasting,null,1,tick*1000/60);
  assert(Math.abs(visual.vx-60*Math.pow(.35,tick/60))<1e-8,'drag de la referencia y prediccion alineados');
  assert(visual.lastError<1e-8,'sin correcciones ficticias al extrapolar la inercia');
}
const teleport=releaseContext();
teleport.drawShip({...coasting,x:800,appliedControlSeq:1},null,1,16);
assert(teleport.localVisual.x>799,'correccion grande inmediata incluso con liberacion pendiente');
const stalled=releaseContext();stalled.localVisual.lastAt=280;
stalled.drawShip({...coasting,x:490,vx:0,appliedControlSeq:1},null,1,300);
assert(stalled.localVisual.x<500,'no aplazar correcciones indefinidamente si la red se detiene');
