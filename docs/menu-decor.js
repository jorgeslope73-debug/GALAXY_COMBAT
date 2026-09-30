'use strict';
(() => {
  const menu=document.getElementById('menu');
  const canvas=document.getElementById('menuDecor');
  if(!menu||!canvas)return;

  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;

  const W=1920,H=1080;
  const isMobile=document.documentElement.classList.contains('handheld-device')||
    matchMedia('(pointer:coarse)').matches||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const METEOR_COUNT=reducedMotion?2:(isMobile?3:5);
  const PARTICLE_MAX=isMobile?42:72;
  const VERSION='V20.6';

  const rand=(a,b)=>a+Math.random()*(b-a);

  const assets={};
  const assetUrls={
    meteor1:'assets/sprites/asteroide1.png',
    meteor2:'assets/sprites/asteroide2.png',
    meteor3:'assets/sprites/asteroide3.png',
    meteor4:'assets/sprites/asteroide5.png',
    meteor5:'assets/sprites/asteroide6.png',
    giant:'assets/sprites/asteroidegrande_270.png'
  };
  for(const [key,url] of Object.entries(assetUrls)){
    const im=new Image();
    im.decoding='async';
    im.src=url+'?v='+VERSION;
    assets[key]=im;
  }

  const particles=Array.from({length:PARTICLE_MAX},()=>({
    life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0,rot:0,spin:0
  }));
  let particleCursor=0;

  function emitRock(x,y,vx,vy,life,size){
    const p=particles[particleCursor];
    particleCursor=(particleCursor+1)%PARTICLE_MAX;
    p.life=p.maxLife=life;
    p.x=x;p.y=y;p.vx=vx;p.vy=vy;
    p.size=size;
    p.rot=rand(0,Math.PI*2);
    p.spin=rand(-4,4);
  }

  function rockBurst(x,y,nx,ny){
    const amount=isMobile?3:5;
    const tx=-ny,ty=nx;
    for(let i=0;i<amount;i++){
      const spread=rand(-1.15,1.15);
      const dx=nx+tx*spread,dy=ny+ty*spread;
      const len=Math.hypot(dx,dy)||1;
      const speed=rand(24,70);
      emitRock(
        x+rand(-4,4),y+rand(-4,4),
        dx/len*speed,dy/len*speed,
        rand(1.2,2),rand(2.5,5.5)
      );
    }
  }

  const meteorSprites=['meteor1','meteor2','meteor3','meteor4','meteor5'];
  const meteors=[];
  const contactCooldown=new Map();
  let meteorId=0;

  function spawnMeteor(m=null,initial=false){
    const obj=m||{};
    const side=Math.floor(rand(0,4));
    const giantChance=!isMobile&&Math.random()<.10;
    obj.id=obj.id||(++meteorId);
    obj.size=giantChance?rand(135,175):rand(isMobile?42:48,isMobile?92:128);
    obj.sprite=giantChance?'giant':meteorSprites[Math.floor(rand(0,meteorSprites.length))];
    obj.rot=rand(0,360);
    obj.spin=rand(-13,13);
    obj.radius=obj.size*.41;

    const speed=rand(22,52)*(giantChance?.72:1);
    let tx,ty;
    if(side===0){obj.x=-obj.size;obj.y=rand(60,H-60);tx=W+obj.size;ty=rand(90,H-90);}
    else if(side===1){obj.x=W+obj.size;obj.y=rand(60,H-60);tx=-obj.size;ty=rand(90,H-90);}
    else if(side===2){obj.x=rand(80,W-80);obj.y=-obj.size;tx=rand(80,W-80);ty=H+obj.size;}
    else{obj.x=rand(80,W-80);obj.y=H+obj.size;tx=rand(80,W-80);ty=-obj.size;}

    const dx=tx-obj.x,dy=ty-obj.y,d=Math.hypot(dx,dy)||1;
    obj.vx=dx/d*speed;
    obj.vy=dy/d*speed;

    if(initial){
      obj.x=rand(0,W);
      obj.y=rand(0,H);
    }
    return obj;
  }

  for(let i=0;i<METEOR_COUNT;i++)meteors.push(spawnMeteor(null,true));

  function updateMeteors(dt){
    for(const m of meteors){
      m.x+=m.vx*dt;
      m.y+=m.vy*dt;
      m.rot=(m.rot+m.spin*dt+360)%360;

      const margin=m.size*1.7;
      if(m.x<-margin||m.x>W+margin||m.y<-margin||m.y>H+margin){
        spawnMeteor(m,false);
      }
    }
  }

  function collideMeteors(now){
    for(let i=0;i<meteors.length;i++){
      const a=meteors[i];
      for(let j=i+1;j<meteors.length;j++){
        const b=meteors[j];
        const dx=b.x-a.x,dy=b.y-a.y;
        const rr=a.radius+b.radius;
        const d2=dx*dx+dy*dy;
        if(d2>rr*rr)continue;

        const d=Math.sqrt(d2)||1;
        const nx=dx/d,ny=dy/d;
        const key=a.id<b.id?a.id+'-'+b.id:b.id+'-'+a.id;
        const last=contactCooldown.get(key)||0;

        if(now-last>750){
          contactCooldown.set(key,now);
          rockBurst(a.x+nx*a.radius,a.y+ny*a.radius,-nx,-ny);
        }

        const av=a.vx*nx+a.vy*ny;
        const bv=b.vx*nx+b.vy*ny;
        const rel=av-bv;
        if(rel>0){
          a.vx-=rel*nx*.48;a.vy-=rel*ny*.48;
          b.vx+=rel*nx*.48;b.vy+=rel*ny*.48;
        }

        const overlap=rr-d;
        a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;
        b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
      }
    }

    if(contactCooldown.size>24){
      for(const [key,t] of contactCooldown){
        if(now-t>5000)contactCooldown.delete(key);
      }
    }
  }

  function updateParticles(dt){
    for(const p of particles){
      if(p.life<=0)continue;
      p.life-=dt;
      if(p.life<=0)continue;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.vx*=Math.pow(.48,dt);
      p.vy*=Math.pow(.48,dt);
      p.rot+=p.spin*dt;
    }
  }

  // Mantiene siempre la proporcion nativa del PNG.
  function drawSpriteAspect(im,x,y,size,rotDeg=0,alpha=1){
    if(!(im&&im.complete&&im.naturalWidth&&im.naturalHeight))return false;

    const aspect=im.naturalWidth/im.naturalHeight;
    let w=size,h=size;
    if(aspect>=1)h=size/aspect;
    else w=size*aspect;

    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(x,y);
    ctx.rotate(rotDeg*Math.PI/180);
    ctx.drawImage(im,-w/2,-h/2,w,h);
    ctx.restore();
    return true;
  }

  function drawParticles(){
    ctx.fillStyle='#8a8d92';
    for(const p of particles){
      if(p.life<=0)continue;
      const t=Math.max(0,Math.min(1,p.life/p.maxLife));
      const size=Math.max(.5,p.size*(.35+.65*t));
      ctx.globalAlpha=Math.min(.78,t*.78);
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(-size,-size*.35);
      ctx.lineTo(size*.28,-size);
      ctx.lineTo(size,size*.2);
      ctx.lineTo(size*.1,size*.8);
      ctx.lineTo(-size*.8,size*.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';

    drawParticles();

    for(const m of meteors){
      const im=assets[m.sprite];
      if(!drawSpriteAspect(im,m.x,m.y,m.size,m.rot,.76)){
        ctx.globalAlpha=.5;
        ctx.fillStyle='#83878e';
        ctx.beginPath();
        ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);
        ctx.fill();
        ctx.globalAlpha=1;
      }
    }
  }

  function resize(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;

    const dpr=Math.min(window.devicePixelRatio||1,isMobile?1.05:1.25);
    const maxW=isMobile?1100:1500;
    const targetW=Math.max(480,Math.min(maxW,Math.round(rect.width*dpr)));
    const targetH=Math.max(270,Math.round(rect.height*dpr));

    if(canvas.width!==targetW||canvas.height!==targetH){
      canvas.width=targetW;
      canvas.height=targetH;
    }

    const scale=Math.max(canvas.width/W,canvas.height/H);
    const ox=(canvas.width-W*scale)/2;
    const oy=(canvas.height-H*scale)/2;
    ctx.setTransform(scale,0,0,scale,ox,oy);
  }

  let resizeTimer=0;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(resize,120);
  },{passive:true});

  let lastAt=0,lastPaint=0;
  function loop(now){
    requestAnimationFrame(loop);

    if(document.hidden||menu.classList.contains('hidden')){
      lastAt=0;
      lastPaint=0;
      return;
    }

    const targetFrameMs=reducedMotion?100:(isMobile?42:33);
    if(lastPaint&&now-lastPaint<targetFrameMs)return;
    lastPaint=now;

    if(!lastAt){
      lastAt=now;
      resize();
      render();
      return;
    }

    const dt=Math.min(.05,Math.max(0,(now-lastAt)/1000));
    lastAt=now;

    updateMeteors(reducedMotion?dt*.35:dt);
    if(!reducedMotion)collideMeteors(now);
    updateParticles(dt);
    render();
  }

  resize();
  requestAnimationFrame(loop);
})();
