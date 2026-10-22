'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {engineContext}=require('./check-session-regressions.js');
const clock={now:1000000},ctx=engineContext(clock);
vm.runInContext(fs.readFileSync('docs/motion-prediction.js','utf8'),ctx);
const core=ctx.window.GalaxyPhysicsCore,Prediction=ctx.window.GalaxyMotionPrediction;
const wrap=(a,b,size)=>(b-a+size*1.5)%size-size/2;
function host(){
  const h=new ctx.window.GalaxyHostPhysics({});h.start([{i:0,n:'Pilot'},{i:1,n:'Other'}]);
  Object.assign(h.players[0],{x:500,y:500,rot:0,vx:0,vy:0,spawnFx:0,protection:100,bullets:0});
  Object.assign(h.players[1],{x:1600,y:900,spawnFx:0,protection:100,bullets:0});
  for(const name of ['updateAsteroids','updateFlares','updateBullets','updatePickups','updateShower','updateMeteors','updateGiant','updateUfo','shipCollisions'])h[name]=()=>{};
  return h;
}
// Independently preserve the exact pre-refactor movement order and constants.
const a={x:1918,y:1078,rot:45,vx:150,vy:-90,speed:1.3},b={...a};
for(let tick=0;tick<3600;tick++){
  const c={turn:tick%180<90?1:-.5,thrust:tick%300<200},dt=1/60;
  a.rot=(a.rot+c.turn*240*dt+360)%360;
  const r=a.rot*Math.PI/180;
  if(c.thrust){a.vx+=-Math.sin(r)*(240*a.speed)*dt;a.vy+=-Math.cos(r)*(240*a.speed)*dt;}
  a.vx*=Math.pow(.35,dt);a.vy*=Math.pow(.35,dt);
  const speed=Math.hypot(a.vx,a.vy),max=330*a.speed;
  if(speed>max){a.vx=a.vx/speed*max;a.vy=a.vy/speed*max;}
  a.x=(a.x+a.vx*dt+1920)%1920;a.y=(a.y+a.vy*dt+1080)%1080;
  core.stepShipMovement(b,c);
  for(const k of ['x','y','rot','vx','vy'])assert.equal(b[k],a[k],'integrator parity '+k);
}
const stream=core.createMotionStream(7);
assert(!core.acceptMotionFrames(stream,{v:1,epoch:6,frames:[[1,0,1,0,0]]}));
assert(!core.acceptMotionFrames(stream,{v:1,epoch:7,frames:[[1,0,1,0,0],[2,Infinity,1,0,0]]}));
assert.equal(stream.queue.size,0,'atomic validation');
assert(!core.acceptMotionFrames(stream,{v:1,epoch:7,frames:[[121,0,1,0,0]]}));
assert(core.acceptMotionFrames(stream,{v:1,epoch:7,frames:[[1,1,1,0,0],[2,0,0,0,0]]}));
core.acceptMotionFrames(stream,{v:1,epoch:7,frames:[[1,-1,0,0,0],[2,1,1,0,0]]});
assert.equal(core.consumeMotionFrame(stream).turn,1,'duplicate cannot replace a queued command');
assert.equal(core.consumeMotionFrame(stream).turn,0);
assert.equal(stream.ack,2,'only one tick consumed per call');
for(let i=0;i<8;i++)core.consumeMotionFrame(stream);
assert.equal(stream.last.thrust,false);
assert(core.acceptMotionFrames(stream,{v:1,epoch:7,frames:[[1,1,1,1,0]]}));
assert.equal(stream.queue.size,0,'late command cannot execute again');

function run(fps,up,down,jitter=0,loss=0){
  const h=host(),pred=new Prediction(),ideal={x:500,y:500,rot:0,vx:0,vy:0,speed:1};
  let current=h.publicState().players[0],seq=0,snapshotSeq=0,lastStateSeq=0,nextSend=0,generated=0,maxError=0,maxCorrection=0;
  const inputs=[],states=[];
  for(let frame=0;frame<=240*8;frame++){
    const now=frame*1000/240;clock.now=1000000+now;
    const input={turn:now>=1500&&now<2100?1:now>=3000&&now<3700?-1:0,
      thrust:now>=500&&now<2100||now>=3000&&now<3700,fire:false,directFire:false};
    if(frame%(240/fps)===0){
      pred.advance(now,current,input);
      for(const f of pred.history)if(f[0]>generated){core.stepShipMovement(ideal,{turn:f[1],thrust:!!f[2]});generated=f[0];}
      const error=Math.hypot(wrap(pred.pose.x,ideal.x,1920),wrap(pred.pose.y,ideal.y,1080));
      maxError=Math.max(maxError,error);maxCorrection=Math.max(maxCorrection,pred.stats.correction);
      assert(pred.history.length<=120);assert(Number.isFinite(error));
      if(now+1e-6>=nextSend){
        seq++;nextSend=now+1000/30;
        if(!loss||seq%loss!==0)inputs.push({at:now+Math.max(0,up+[0,1,-.5,.5][seq%4]*jitter),seq,input,motion:pred.packet()});
        inputs.sort((a,b)=>a.at-b.at);
      }
    }
    while(inputs.length&&inputs[0].at<=now+1e-6){const packet=inputs.shift();
      h.setControl(0,packet.input.turn,packet.input.thrust,false,{controlSeq:packet.seq,motion:packet.motion});
    }
    if(frame&&frame%4===0){h.update(1/60);h.tickCount++;
      if(h.tickCount%3===0){snapshotSeq++;
        if(!loss||snapshotSeq%loss!==0)states.push({at:now+Math.max(0,down+[0,-.5,1,.5][snapshotSeq%4]*jitter),seq:snapshotSeq,p:h.publicState().players[0]});
        states.sort((a,b)=>a.at-b.at);
      }
    }
    while(states.length&&states[0].at<=now+1e-6){const s=states.shift();if(s.seq>lastStateSeq){current=s.p;lastStateSeq=s.seq;}}
    assert(h.players[0].motionStream.queue.size<=120);
  }
  if(!jitter&&!loss)assert(maxError<1e-7,'exact replay without starvation '+JSON.stringify({fps,up,down,maxError}));
  assert(maxError<15,'bounded prediction with jitter/loss');
  assert(maxCorrection<4,'corrections remain small in the jitter scenario');
  return {fps,up,down,jitter,loss,maxError:+maxError.toFixed(4),maxCorrection:+maxCorrection.toFixed(4)};
}
const results=[];
for(const fps of [30,60,120])for(const scenario of [[0,0],[50,50],[100,100],[20,120],[100,100,30,7]])results.push(run(fps,...scenario));

const h=host(),p=h.players[0],epoch=p.motionStream.epoch;
h.setControl(0,1,true,false,{controlSeq:1,motion:{v:1,epoch,frames:[[1,1,1,0,0],[2,1,1,0,0]]}});
h.update(1/60);assert.equal(p.motionStream.ack,1);
h.setControl(0,0,false,false,{controlSeq:2});
assert.notEqual(p.motionStream.epoch,epoch,'fallback disables old stream');
assert(!p.motionStream.active);
const oldEpoch=p.motionStream.epoch;h.respawnPlayer(p);
assert.notEqual(p.motionStream.epoch,oldEpoch,'respawn retires old commands');
const predictor=new Prediction();p.spawnFx=0;const s=h.publicState().players[0];
predictor.advance(0,s,{turn:0,thrust:false,fire:true});
predictor.advance(5,s,{turn:0,thrust:false,fire:false});
predictor.advance(17,s,{turn:0,thrust:false,fire:false});
assert.equal(predictor.history[0][3],1,'short fire edge survives until a tick');
predictor.advance(34,s,{turn:0,thrust:false,fire:false});
assert.equal(predictor.history[1][3],0,'fire pulse not duplicated');
predictor.advance(40,{...s,dead:true},{turn:0,thrust:false,fire:false});assert(!predictor.ready);
const recovery=new Prediction();
recovery.advance(0,s,{turn:0,thrust:false,fire:false});
recovery.advance(1000,{...s,motion:{...s.motion,ack:60}},{turn:0,thrust:false,fire:false});
assert.equal(recovery.tick,60,'host ahead after suspension rebases the client clock');
assert.equal(recovery.history.length,0);
recovery.advance(1017,{...s,motion:{...s.motion,ack:60}},{turn:0,thrust:false,fire:false});
assert.equal(recovery.history[0][0],61);
const correction=new Prediction();
const monotonic=new Prediction();
monotonic.advance(0,s,{turn:0,thrust:false,fire:false});
monotonic.advance(17,s,{turn:1,thrust:false,fire:false});
monotonic.advance(16,s,{turn:1,thrust:false,fire:false});
monotonic.advance(33,s,{turn:1,thrust:false,fire:false});
assert.equal(monotonic.tick,1,'stale RAF after an input event must not add elapsed time');
correction.advance(0,s,{turn:0,thrust:false,fire:false});
const corrected={...s,motion:{...s.motion,x:s.motion.x+10}};
correction.advance(1,corrected,{turn:0,thrust:false,fire:false});
assert.equal(correction.pose.x,corrected.motion.x,'authority corrected immediately in physics');
assert(Math.abs(correction.sample().x-s.motion.x)<1e-8,'only visual offset preserves continuity');
correction.advance(18,corrected,{turn:0,thrust:false,fire:false});
assert(Math.abs(correction.pose.x-corrected.motion.x)<1e-8,'visual correction never changes future physics');
const resetHost=host(),resetPlayer=resetHost.players[0],resetEpoch=resetPlayer.motionStream.epoch;
resetHost.setControl(0,1,true,false,{controlSeq:1,motion:{v:1,epoch:resetEpoch,frames:Array.from({length:60},(_,i)=>[i+1,1,1,0,0])}});
assert.notEqual(resetPlayer.motionStream.epoch,resetEpoch,'large backlog requests resynchronization, not fast-forward');
assert.equal(resetPlayer.x,500);
resetHost.finished=true;resetHost.restart(2);
assert.notEqual(resetPlayer.motionStream.epoch,resetEpoch,'round restart retires commands');
console.log('Motion prediction OK: integrator parity, replay, bounds, lifecycle and short pulses.');
console.log(JSON.stringify(results));
