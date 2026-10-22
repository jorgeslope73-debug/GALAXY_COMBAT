'use strict';
(() => {
  const core=window.GalaxyPhysicsCore,STEP=1000/60;
  const delta=(a,b,size)=>(b-a+size*1.5)%size-size/2;
  const neutral=()=>({turn:0,thrust:false,fire:false,directFire:false});
  class GalaxyMotionPrediction{
    constructor(){this.reset();}
    reset(){
      this.ready=false;this.epoch=0;this.tick=0;this.ack=0;this.history=[];
      this.pose=null;this.input=neutral();this.firePulse=false;this.lastAt=0;this.accumulator=0;
      this.offset={x:0,y:0,r:0};this.lastSnapshot=null;
      this.stats={correction:0,replayed:0,droppedTime:0};
    }
    fromPlayer(p){const m=p.motion;return{x:m.x,y:m.y,rot:m.rot,vx:m.vx,vy:m.vy,speed:Number(p.spd)||1};}
    valid(p){
      const m=p&&p.motion;
      return !!(m&&m.v===1&&Number.isSafeInteger(m.epoch)&&Number.isSafeInteger(m.ack)&&m.ack>=0&&
        ['x','y','rot','vx','vy'].every(k=>Number.isFinite(m[k]))&&!p.dead&&!(p.spawnFx>0));
    }
    reconcile(p){
      const m=p.motion;
      if(m.ack<this.ack)return;
      const old=this.pose;
      this.ack=m.ack;this.tick=Math.max(this.tick,this.ack);
      this.history=this.history.filter(f=>f[0]>this.ack);
      const next=this.fromPlayer(p);
      for(const f of this.history)core.stepShipMovement(next,{turn:f[1],thrust:!!f[2]});
      this.stats.replayed=this.history.length;
      const dx=delta(next.x,old.x,1920),dy=delta(next.y,old.y,1080),dr=delta(next.rot,old.rot,360);
      this.stats.correction=Math.hypot(dx,dy);
      // Correction is display-only: never feed it back into the next physics tick.
      if(this.stats.correction>48||Math.abs(dr)>55)this.offset={x:0,y:0,r:0};
      else{
        this.offset.x+=dx;this.offset.y+=dy;this.offset.r+=dr;
        if(Math.hypot(this.offset.x,this.offset.y)>48||Math.abs(this.offset.r)>55)this.offset={x:0,y:0,r:0};
      }
      this.pose=next;
    }
    advance(now,p,input){
      if(!this.valid(p)){this.reset();return;}
      if(!this.ready||this.epoch!==p.motion.epoch){
        this.reset();this.ready=true;this.epoch=p.motion.epoch;this.tick=this.ack=p.motion.ack;
        this.pose=this.fromPlayer(p);this.lastAt=now;this.lastSnapshot=p;
        this.input={...input};this.firePulse=!!input.fire;return;
      }
      const elapsed=Math.max(0,now-this.lastAt);this.lastAt=now;
      const decay=Math.exp(-12*elapsed/1000);
      this.offset.x*=decay;this.offset.y*=decay;this.offset.r*=decay;
      this.accumulator+=Math.min(100,elapsed);
      if(elapsed>100)this.stats.droppedTime+=elapsed-100;
      let count=0;
      while(this.accumulator+1e-7>=STEP&&count<6&&this.history.length<120){
        const f=[++this.tick,this.input.turn,this.input.thrust?1:0,(this.input.fire||this.firePulse)?1:0,this.input.directFire?1:0];
        this.firePulse=false;this.history.push(f);
        core.stepShipMovement(this.pose,{turn:f[1],thrust:!!f[2]});
        this.accumulator=Math.max(0,this.accumulator-STEP);count++;
      }
      if(this.accumulator>=STEP){this.stats.droppedTime+=this.accumulator;this.accumulator=0;}
      if(p!==this.lastSnapshot){this.reconcile(p);this.lastSnapshot=p;}
      if(input.fire&&!this.input.fire)this.firePulse=true;
      this.input={...input};
    }
    packet(){return {v:1,epoch:this.epoch,frames:this.history.slice(-60)};}
    sample(){
      if(!this.ready)return null;
      const pose={...this.pose};
      if(this.accumulator>0)core.stepShipMovement(pose,this.input,this.accumulator/1000);
      return{x:(pose.x+this.offset.x+1920)%1920,y:(pose.y+this.offset.y+1080)%1080,
        r:(pose.rot+this.offset.r+360)%360,vx:pose.vx,vy:pose.vy};
    }
  }
  window.GalaxyMotionPrediction=GalaxyMotionPrediction;
})();
