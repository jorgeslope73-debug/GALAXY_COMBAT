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
    localVisual:{ready:false},perfStats:null,lastTurnControlSeq:0,lastSubmittedTurn:0,
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
