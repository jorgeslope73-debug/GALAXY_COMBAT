/* Small, image-free impact bursts. Pure rendering: no changes to game physics. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GalaxyImpactFX = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const MAX_BURSTS = 32;
  const MAX_SEEN = 256;
  const durationFor = kind => kind === 'explosion' ? 420 : 260;
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  let glowSpriteCanvas=null;
  function getGlowSprite(){
    if(glowSpriteCanvas)return glowSpriteCanvas;
    if(typeof document==='undefined'||!document.createElement)return null;
    const c=document.createElement('canvas');
    c.width=64;c.height=64;
    const g=c.getContext('2d');
    if(!g)return null;
    const r=32;
    const glow=g.createRadialGradient(r,r,0,r,r,r);
    glow.addColorStop(0,'rgba(255,250,215,0.95)');
    glow.addColorStop(0.28,'rgba(255,201,85,0.8)');
    glow.addColorStop(0.62,'rgba(255,94,32,0.38)');
    glow.addColorStop(1,'rgba(235,45,12,0)');
    g.fillStyle=glow;g.fillRect(0,0,64,64);
    glowSpriteCanvas=c;
    return c;
  }

  function makeParticle(){return {dx:0,dy:0,distance:0,size:0,hot:false};}
  function makeBurst(){
    const particles=new Array(12);
    for(let i=0;i<particles.length;i++)particles[i]=makeParticle();
    return {x:0,y:0,kind:'hit',duration:0,born:0,particles,particleCount:0,key:''};
  }

  class GalaxyImpactFX {
    constructor() {
      getGlowSprite();
      this.pool=new Array(MAX_BURSTS);
      for(let i=0;i<MAX_BURSTS;i++)this.pool[i]=makeBurst();
      this.bursts=[];
      this.freeBursts=[];
      this.seen=new Set();
      this.previousPlayers=new Map();
      this.serverExplosions=[false,false,false,false];
      this.reset();
    }

    reset() {
      this.bursts.length=0;
      this.freeBursts.length=0;
      for(let i=0;i<this.pool.length;i++)this.freeBursts.push(this.pool[i]);
      this.seen.clear();
      this.previousPlayers.clear();
      this.serverExplosions[0]=this.serverExplosions[1]=this.serverExplosions[2]=this.serverExplosions[3]=false;
      this.room = '';
      this.lastSeq = -1;
    }

    remember(key) {
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      while (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value);
      return true;
    }

    enqueue(event, key, localIndex, now) {
      if (!this.remember(key)) return;
      if (event.hidden && event.i !== localIndex) return;
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) return;
      if (Math.abs(event.x) > 10000 || Math.abs(event.y) > 10000) return;
      const kind = event.kind === 'explosion' ? 'explosion' : 'hit';
      const duration = durationFor(kind);
      const age = Number.isFinite(event.age) ? Math.max(0, event.age) : 0;
      if (age >= duration) return;
      let seed = 2166136261;
      for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
      const random = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      };
      // Particle shapes are generated once per burst, reusing a fixed object pool.
      const count = kind === 'explosion' ? 12 : 7;
      let burst=this.freeBursts.pop();
      if(!burst){
        // If every slot is in use, recycle the oldest visual effect rather than
        // allocating another burst/particle array and forcing Safari GC later.
        burst=this.bursts.shift();
      }
      burst.x=event.x;burst.y=event.y;burst.kind=kind;burst.duration=duration;
      burst.born=now-age;burst.key=key;burst.particleCount=count;
      for (let i = 0; i < count; i++) {
        const angle = TAU * (i + random() * 0.65) / count;
        const particle=burst.particles[i];
        particle.dx=Math.cos(angle);particle.dy=Math.sin(angle);
        particle.distance=kind === 'explosion' ? 16 + random() * 18 : 9 + random() * 12;
        particle.size=1.2 + random() * (kind === 'explosion' ? 2.1 : 1.0);
        particle.hot=random() > 0.45;
      }
      this.bursts.push(burst);
    }

    consume(snapshot, localIndex, now = clock()) {
      if (!snapshot || !Array.isArray(snapshot.players) || !Number.isFinite(now)) return;
      if (typeof snapshot.code === 'string' && snapshot.code !== this.room) {
        this.reset(); this.room = snapshot.code;
      }
      if (Number.isFinite(snapshot.seq)) {
        // WebSocket preserves message order. A lower sequence therefore means
        // the room started a new match/epoch (restart() resets seq and fx ids).
        // Clear the dedup history immediately so new impacts are not mistaken
        // for old events from the previous match.
        if (snapshot.seq < this.lastSeq) {
          for(let i=0;i<this.bursts.length;i++)this.freeBursts.push(this.bursts[i]);
          this.bursts.length=0;
          this.seen.clear();
          this.previousPlayers.clear();
          this.lastSeq = -1;
        }
        if (snapshot.seq === this.lastSeq) return;
        this.lastSeq = snapshot.seq;
      }
      const serverExplosions=this.serverExplosions;
      serverExplosions[0]=serverExplosions[1]=serverExplosions[2]=serverExplosions[3]=false;
      if (snapshot.fxVersion === 1 && Array.isArray(snapshot.fx)) {
        const start=Math.max(0,snapshot.fx.length-MAX_BURSTS);
        for (let idx=start;idx<snapshot.fx.length;idx++) {
          const event=snapshot.fx[idx];
          if (!event || !Number.isSafeInteger(event.id) || event.id < 1) continue;
          if (!Number.isInteger(event.i) || event.i < 0 || event.i > 3) continue;
          if (event.kind !== 'explosion' && event.kind !== 'hit') continue;
          // Record only still-visible explosion events. If one was lost/delayed,
          // the state transition fallback below will recreate the death burst.
          if (event.kind === 'explosion') {
            const age = Number.isFinite(event.age) ? Math.max(0, event.age) : 0;
            if (age < durationFor('explosion')) serverExplosions[event.i]=true;
          }
          this.enqueue(event, 'fx:' + event.id, localIndex, now);
        }
      }

      // Robust death fallback: even with fxVersion=1, a transient WebSocket/state
      // hiccup must not make the ship vanish without exploding. If a player has
      // just changed from alive to dead and this snapshot carries no usable
      // explosion event for that player, create the same short burst locally.
      for (const player of snapshot.players) {
        if (!player || !Number.isInteger(player.i)) continue;
        const previous = this.previousPlayers.get(player.i);
        const deathCount = Number.isFinite(player.d) ? player.d : 0;
        const justDied = player.dead && (!previous || !previous.dead || previous.deaths < deathCount);
        if (justDied && !serverExplosions[player.i]) {
          const age = Number.isFinite(player.respawn) ? Math.max(0, (0.7 - player.respawn) * 1000) : 0;
          this.enqueue({i: player.i, x: player.x, y: player.y,
            kind: 'explosion', age}, 'death-fallback:' + (snapshot.code || '') + ':' + player.i + ':' + deathCount, localIndex, now);
        }
      }
      for (const player of snapshot.players) {
        if (!player || !Number.isInteger(player.i)) continue;
        let previous=this.previousPlayers.get(player.i);
        if(!previous){previous={dead:false,deaths:0};this.previousPlayers.set(player.i,previous);}
        previous.dead=!!player.dead;
        previous.deaths=Number.isFinite(player.d)?player.d:0;
      }
    }

    draw(ctx, now = clock()) {
      if (!ctx || !Number.isFinite(now)) return;
      let write=0;
      for(let i=0;i<this.bursts.length;i++){
        const e=this.bursts[i];
        if(now-e.born<e.duration)this.bursts[write++]=e;
        else this.freeBursts.push(e);
      }
      this.bursts.length=write;
      if (!this.bursts.length) return;
      ctx.save();
      try {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const burst of this.bursts) {
          const t = Math.max(0, Math.min(1, (now - burst.born) / burst.duration));
          const fade = (1 - t) * (1 - t);
          const large = burst.kind === 'explosion';
          const eased = 1 - Math.pow(1 - t, 2);
          const radius = (large ? 9 : 5) + eased * (large ? 20 : 11);
          const glowSprite=getGlowSprite();
          ctx.globalAlpha=fade;
          if(glowSprite){
            ctx.drawImage(glowSprite,burst.x-radius,burst.y-radius,radius*2,radius*2);
          }else{
            const glow=ctx.createRadialGradient(burst.x,burst.y,0,burst.x,burst.y,radius);
            glow.addColorStop(0,'rgba(255,250,215,0.95)');
            glow.addColorStop(0.28,'rgba(255,201,85,0.8)');
            glow.addColorStop(0.62,'rgba(255,94,32,0.38)');
            glow.addColorStop(1,'rgba(235,45,12,0)');
            ctx.fillStyle=glow;ctx.beginPath();ctx.arc(burst.x,burst.y,radius,0,TAU);ctx.fill();
          }

          ctx.lineWidth = large ? 1.8 : 1.2;
          ctx.strokeStyle = '#ffc56c'; ctx.globalAlpha = fade * 0.65;
          ctx.beginPath(); ctx.arc(burst.x, burst.y, (large ? 4 : 2) + eased * (large ? 26 : 15), 0, TAU); ctx.stroke();
          for (let pi=0;pi<burst.particleCount;pi++) {
            const p=burst.particles[pi];
            const distance = 3 + p.distance * eased;
            const x = burst.x + p.dx * distance, y = burst.y + p.dy * distance;
            ctx.globalAlpha = fade;
            ctx.strokeStyle = p.hot ? '#ffe6a1' : '#ff963f';
            ctx.lineWidth = p.size * (1 - t * 0.65);
            ctx.beginPath(); ctx.moveTo(x - p.dx * (large ? 5 : 3), y - p.dy * (large ? 5 : 3)); ctx.lineTo(x, y); ctx.stroke();
          }
          if (t < 0.24) {
            ctx.globalAlpha = (1 - t / 0.24) * 0.8;
            ctx.fillStyle = '#fff8e2'; ctx.beginPath();
            ctx.arc(burst.x, burst.y, (large ? 5 : 3) * (1 - t), 0, TAU); ctx.fill();
          }
        }
      } finally {
        ctx.restore();
      }
    }
  }
  return GalaxyImpactFX;
});
