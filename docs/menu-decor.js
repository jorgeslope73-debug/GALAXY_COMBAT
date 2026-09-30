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
  const PARTICLE_MAX=isMobile?90:160;
  const PROJECTILE_MAX=isMobile?3:5;
  const SHIP_SIZE=isMobile?72:62;
  const VERSION='V20.5';

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const angleDelta=(a,b)=>((b-a+540)%360)-180;
  const forward=rot=>{
    const r=rot*Math.PI/180;
    return{x:-Math.sin(r),y:-Math.cos(r)};
  };

  const assets={};
  const assetUrls={
    meteor1:'assets/sprites/asteroide1.png',
    meteor2:'assets/sprites/asteroide2.png',
    meteor3:'assets/sprites/asteroide3.png',
    meteor4:'assets/sprites/asteroide5.png',
    meteor5:'assets/sprites/asteroide6.png',
    giant:'assets/sprites/asteroidegrande_270.png',
    ship1:'assets/sprites/coete1a.png',
    ship2:'assets/sprites/coete2a.png',
    ship3:'assets/sprites/coete3a.png',
    ship4:'assets/sprites/coete4a.png',
    rocket1:'assets/sprites/coeteA.png',
    rocket2:'assets/sprites/coeteB.png',
    rocket3:'assets/sprites/coeteC.png',
    rocket4:'assets/sprites/coeteD.png'
  };
  for(const [key,url] of Object.entries(assetUrls)){
    const im=new Image();
    im.decoding='async';
    im.src=url+'?v='+VERSION;
    assets[key]=im;
  }

  const particles=Array.from({length:PARTICLE_MAX},()=>({
    life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0,color:'#fff',rock:false,rot:0,spin:0
  }));
  let particleCursor=0;

  function particle(x,y,vx,vy,life,size,color,rock=false){
    const p=particles[particleCursor];
    particleCursor=(particleCursor+1)%PARTICLE_MAX;
    p.life=p.maxLife=life;
    p.x=x;p.y=y;p.vx=vx;p.vy=vy;
    p.size=size;p.color=color;p.rock=rock;
    p.rot=rand(0,Math.PI*2);p.spin=rand(-4,4);
  }

  function explosion(x,y,color='#ff9854',amount=isMobile?7:10){
    for(let i=0;i<amount;i++){
      const a=rand(0,Math.PI*2),s=rand(35,145);
      particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(.35,.72),rand(2.5,6.5),i%3===0?'#ffe39a':color,false);
    }
  }

  function rockBurst(x,y,nx=0,ny=1,amount=isMobile?3:5){
    const tx=-ny,ty=nx;
    for(let i=0;i<amount;i++){
      const spread=rand(-1.2,1.2);
      const dx=nx+tx*spread,dy=ny+ty*spread,len=Math.hypot(dx,dy)||1;
      const s=rand(24,82);
      particle(x+rand(-5,5),y+rand(-5,5),dx/len*s,dy/len*s,rand(1.1,2),rand(2.5,6),'#8b8f96',true);
    }
  }

  const meteorSprites=['meteor1','meteor2','meteor3','meteor4','meteor5'];
  const meteors=[];
  let meteorId=0;

  function spawnMeteor(m=null){
    const obj=m||{};
    const side=Math.floor(rand(0,4));
    const size=rand(isMobile?38:42,isMobile?96:132);
    const giantChance=!isMobile&&Math.random()<.10;
    obj.id=obj.id||(++meteorId);
    obj.size=giantChance?rand(135,175):size;
    obj.sprite=giantChance?'giant':meteorSprites[Math.floor(rand(0,meteorSprites.length))];
    obj.rot=rand(0,360);obj.spin=rand(-16,16);
    const speed=rand(22,58)*(giantChance?.72:1);
    let tx,ty;
    if(side===0){obj.x=-obj.size;obj.y=rand(60,H-60);tx=W+obj.size;ty=rand(80,H-80);}
    else if(side===1){obj.x=W+obj.size;obj.y=rand(60,H-60);tx=-obj.size;ty=rand(80,H-80);}
    else if(side===2){obj.x=rand(80,W-80);obj.y=-obj.size;tx=rand(80,W-80);ty=H+obj.size;}
    else{obj.x=rand(80,W-80);obj.y=H+obj.size;tx=rand(80,W-80);ty=-obj.size;}
    const dx=tx-obj.x,dy=ty-obj.y,d=Math.hypot(dx,dy)||1;
    obj.vx=dx/d*speed;obj.vy=dy/d*speed;
    obj.radius=obj.size*.42;
    return obj;
  }
  for(let i=0;i<METEOR_COUNT;i++){
    const m=spawnMeteor();
    m.x=rand(0,W);m.y=rand(0,H);
    meteors.push(m);
  }

  const shipColors=['#5ae1ff','#ff50a5','#5aff78','#ffdc46'];
  const ships=[null,null];
  function randomShipColor(exclude=-1,other=-1){
    const choices=[0,1,2,3].filter(i=>i!==exclude&&i!==other);
    return choices[Math.floor(rand(0,choices.length))]??0;
  }
  function respawnShip(slot,oldColor=-1){
    const other=ships[1-slot];
    const color=randomShipColor(oldColor,other&&other.alive?other.color:-1);
    const fromLeft=slot===0;
    ships[slot]={
      slot,color,alive:true,hp:2,
      x:fromLeft?rand(130,420):rand(W-420,W-130),
      y:rand(180,H-180),
      vx:0,vy:0,rot:fromLeft?270:90,
      speed:rand(72,105),
      fireAt:performance.now()+rand(700,1800),
      weave:rand(0,Math.PI*2),
      respawnAt:0
    };
  }
  respawnShip(0);
  respawnShip(1);

  const projectiles=[];
  let projectileId=0;

  function fireRocket(ship,now){
    if(projectiles.length>=PROJECTILE_MAX||!ship||!ship.alive)return;
    const target=ships[1-ship.slot];
    if(!target||!target.alive)return;
    const f=forward(ship.rot);
    projectiles.push({
      id:++projectileId,owner:ship.slot,color:ship.color,target:target.slot,
      x:ship.x+f.x*34,y:ship.y+f.y*34,
      vx:f.x*220,vy:f.y*220,
      life:5
    });
    for(let i=0;i<(isMobile?3:5);i++){
      particle(ship.x-f.x*22,ship.y-f.y*22,-f.x*rand(20,70)+rand(-12,12),-f.y*rand(20,70)+rand(-12,12),rand(.2,.4),rand(2,4),'#ffb65d');
    }
    ship.fireAt=now+rand(isMobile?1900:1450,isMobile?3400:2800);
  }

  function destroyShip(ship,now){
    if(!ship||!ship.alive)return;
    ship.alive=false;
    ship.respawnAt=now+rand(1100,1900);
    explosion(ship.x,ship.y,shipColors[ship.color],isMobile?10:14);
  }

  const pairCooldown=new Map();
  function meteorCollisions(now){
    for(let i=0;i<meteors.length;i++){
      const a=meteors[i];
      for(let j=i+1;j<meteors.length;j++){
        const b=meteors[j];
        const dx=b.x-a.x,dy=b.y-a.y;
        const rr=a.radius+b.radius,d2=dx*dx+dy*dy;
        if(d2>rr*rr)continue;
        const d=Math.sqrt(d2)||1,nx=dx/d,ny=dy/d;
        const key=a.id<b.id?a.id+'-'+b.id:b.id+'-'+a.id;
        const last=pairCooldown.get(key)||0;
        if(now-last>700){
          pairCooldown.set(key,now);
          const hitX=a.x+nx*a.radius,hitY=a.y+ny*a.radius;
          rockBurst(hitX,hitY,-nx,-ny,isMobile?3:5);
        }
        const av=a.vx*nx+a.vy*ny,bv=b.vx*nx+b.vy*ny;
        const rel=av-bv;
        if(rel>0){
          a.vx-=rel*nx*.55;a.vy-=rel*ny*.55;
          b.vx+=rel*nx*.55;b.vy+=rel*ny*.55;
        }
        const overlap=rr-d;
        a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;
        b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
      }
    }
  }

  function updateShips(dt,now){
    for(let i=0;i<2;i++){
      let s=ships[i];
      if(!s.alive){
        if(now>=s.respawnAt)respawnShip(i,s.color);
        continue;
      }
      const target=ships[1-i];
      if(!target||!target.alive)continue;

      const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy)||1;
      const desired=(Math.atan2(-dx,-dy)*180/Math.PI+360)%360;
      const weave=Math.sin(now*.00065+s.weave)*22;
      const err=angleDelta(s.rot,(desired+weave+360)%360);
      s.rot=(s.rot+clamp(err,-72*dt,72*dt)+360)%360;

      const f=forward(s.rot);
      const desiredSpeed=s.speed*(d<220?.55:1);
      const dvx=f.x*desiredSpeed,dvy=f.y*desiredSpeed;
      const follow=1-Math.exp(-1.9*dt);
      s.vx+=(dvx-s.vx)*follow;
      s.vy+=(dvy-s.vy)*follow;
      s.x+=s.vx*dt;s.y+=s.vy*dt;

      if(s.x<-70)s.x=W+70;else if(s.x>W+70)s.x=-70;
      if(s.y<-70)s.y=H+70;else if(s.y>H+70)s.y=-70;

      if(now>=s.fireAt&&d<1100)fireRocket(s,now);

      // Rastro decorativo muy ligero.
      if(Math.random()<dt*(isMobile?7:10)){
        particle(s.x-f.x*26,s.y-f.y*26,-f.x*rand(18,45)+rand(-8,8),-f.y*rand(18,45)+rand(-8,8),rand(.3,.55),rand(1.8,3.8),shipColors[s.color]);
      }

      // Choques decorativos nave/meteorito.
      for(const m of meteors){
        const mx=s.x-m.x,my=s.y-m.y,rr=m.radius+18;
        if(mx*mx+my*my<=rr*rr){
          const len=Math.hypot(mx,my)||1,nx=mx/len,ny=my/len;
          rockBurst(m.x+nx*m.radius,m.y+ny*m.radius,nx,ny,isMobile?3:4);
          destroyShip(s,now);
          break;
        }
      }
    }
  }

  function updateProjectiles(dt,now){
    for(let i=projectiles.length-1;i>=0;i--){
      const p=projectiles[i];
      p.life-=dt;
      if(p.life<=0){projectiles.splice(i,1);continue;}

      const target=ships[p.target];
      if(target&&target.alive){
        const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
        const desiredX=dx/d,desiredY=dy/d;
        const speed=Math.hypot(p.vx,p.vy)||220;
        const currentX=p.vx/speed,currentY=p.vy/speed;
        const steer=1-Math.exp(-2.2*dt);
        let nx=currentX+(desiredX-currentX)*steer;
        let ny=currentY+(desiredY-currentY)*steer;
        const n=Math.hypot(nx,ny)||1;nx/=n;ny/=n;
        p.vx=nx*speed;p.vy=ny*speed;

        if(d<28){
          target.hp--;
          explosion(p.x,p.y,shipColors[p.color],isMobile?6:9);
          if(target.hp<=0)destroyShip(target,now);
          projectiles.splice(i,1);
          continue;
        }
      }

      p.x+=p.vx*dt;p.y+=p.vy*dt;

      // Cohete contra meteorito: solo decorativo.
      let hitMeteor=false;
      for(const m of meteors){
        const dx=p.x-m.x,dy=p.y-m.y,rr=m.radius+7;
        if(dx*dx+dy*dy<=rr*rr){
          const d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d;
          explosion(p.x,p.y,'#ff9854',isMobile?5:7);
          rockBurst(p.x,p.y,nx,ny,isMobile?2:4);
          hitMeteor=true;break;
        }
      }
      if(hitMeteor){projectiles.splice(i,1);continue;}

      const speed=Math.hypot(p.vx,p.vy)||1;
      const fx=-p.vx/speed,fy=-p.vy/speed;
      if(Math.random()<dt*(isMobile?12:18)){
        particle(p.x+fx*12,p.y+fy*12,fx*rand(18,55)+rand(-8,8),fy*rand(18,55)+rand(-8,8),rand(.28,.5),rand(1.5,3.5),'#ff9b52');
      }
    }
  }

  function updateMeteors(dt){
    for(const m of meteors){
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.rot=(m.rot+m.spin*dt+360)%360;
      const margin=m.size*1.6;
      if(m.x<-margin||m.x>W+margin||m.y<-margin||m.y>H+margin)spawnMeteor(m);
    }
  }

  function updateParticles(dt){
    for(const p of particles){
      if(p.life<=0)continue;
      p.life-=dt;
      if(p.life<=0)continue;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=Math.pow(.42,dt);p.vy*=Math.pow(.42,dt);
      p.rot+=p.spin*dt;
    }
  }

  function drawImageCentered(im,x,y,size,rotDeg=0,alpha=1){
    if(!(im&&im.complete&&im.naturalWidth))return false;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(x,y);
    ctx.rotate(rotDeg*Math.PI/180);
    ctx.drawImage(im,-size/2,-size/2,size,size);
    ctx.restore();
    return true;
  }

  function drawFallbackShip(s){
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.rotate(-s.rot*Math.PI/180);
    ctx.fillStyle=shipColors[s.color];
    ctx.globalAlpha=.86;
    ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(16,20);ctx.lineTo(0,13);ctx.lineTo(-16,20);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function drawParticles(){
    for(const p of particles){
      if(p.life<=0)continue;
      const t=clamp(p.life/p.maxLife,0,1);
      const size=Math.max(.5,p.size*(.3+.7*t));
      ctx.globalAlpha=Math.min(.82,t*.82);
      if(p.rock){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
        ctx.fillStyle=p.color;
        ctx.beginPath();
        ctx.moveTo(-size,-size*.35);ctx.lineTo(size*.25,-size);
        ctx.lineTo(size,size*.18);ctx.lineTo(size*.1,size*.82);
        ctx.lineTo(-size*.8,size*.48);ctx.closePath();ctx.fill();ctx.restore();
      }else{
        ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation='source-over';

    drawParticles();

    for(const m of meteors){
      const im=assets[m.sprite];
      if(!drawImageCentered(im,m.x,m.y,m.size,m.rot,.74)){
        ctx.globalAlpha=.55;ctx.fillStyle='#8b8f96';ctx.beginPath();ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }
    }

    for(const p of projectiles){
      const im=assets['rocket'+(p.color+1)];
      const rot=(Math.atan2(-p.vx,-p.vy)*180/Math.PI+360)%360;
      if(!drawImageCentered(im,p.x,p.y,isMobile?28:32,-rot,.85)){
        ctx.strokeStyle='#ff9b52';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.05,p.y-p.vy*.05);ctx.stroke();
      }
    }

    for(const s of ships){
      if(!s||!s.alive)continue;
      const im=assets['ship'+(s.color+1)];
      if(!drawImageCentered(im,s.x,s.y,SHIP_SIZE,-s.rot,.80))drawFallbackShip(s);
    }
  }

  let lastAt=0,lastPaint=0,raf=0;
  function resize(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,isMobile?1.05:1.3);
    const maxW=isMobile?1100:1500;
    const targetW=Math.max(480,Math.min(maxW,Math.round(rect.width*dpr)));
    const targetH=Math.max(270,Math.round(rect.height*dpr));
    if(canvas.width!==targetW||canvas.height!==targetH){
      canvas.width=targetW;canvas.height=targetH;
    }
    const scale=Math.max(canvas.width/W,canvas.height/H);
    const ox=(canvas.width-W*scale)/2,oy=(canvas.height-H*scale)/2;
    ctx.setTransform(scale,0,0,scale,ox,oy);
  }

  let resizeTimer=0;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(resize,120);
  },{passive:true});

  function loop(now){
    raf=requestAnimationFrame(loop);
    if(document.hidden||menu.classList.contains('hidden')){
      lastAt=0;lastPaint=0;
      return;
    }

    const targetFrameMs=reducedMotion?100:(isMobile?42:33);
    if(lastPaint&&now-lastPaint<targetFrameMs)return;
    lastPaint=now;

    if(!lastAt){lastAt=now;resize();render();return;}
    const dt=Math.min(.05,Math.max(0,(now-lastAt)/1000));
    lastAt=now;

    if(!reducedMotion){
      updateMeteors(dt);
      meteorCollisions(now);
      updateShips(dt,now);
      updateProjectiles(dt,now);
      updateParticles(dt);
    }else{
      updateMeteors(dt*.35);
      updateParticles(dt);
    }
    render();
  }

  resize();
  raf=requestAnimationFrame(loop);
})();
