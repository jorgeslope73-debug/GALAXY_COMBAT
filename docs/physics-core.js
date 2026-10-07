'use strict';
(() => {
  const TARGET_MIN_ALIGN=.8660254038; // cos(30 grados)

  function limitRockSpeed(rock,maxSpeed){
    const speed=Math.hypot(Number(rock.vx)||0,Number(rock.vy)||0);
    if(speed>maxSpeed&&speed>0){
      rock.vx*=maxSpeed/speed;
      rock.vy*=maxSpeed/speed;
    }
  }

  function resolveAsteroidPairCollision(a,b,defaultRadius=45,maxSpeed=190){
    if(!a||!b||a.exiting||b.exiting)return false;
    const ra=Number(a.r)||defaultRadius,rb=Number(b.r)||defaultRadius;
    const dx=b.x-a.x,dy=b.y-a.y,minDist=ra+rb,d2=dx*dx+dy*dy;

    // Los dos fragmentos de una misma rotura se dejan separar por el impulso
    // inicial. Cuando ya han alcanzado distancia normal vuelven a comportarse
    // como dos asteroides independientes.
    if(a.fragmentGroup&&a.fragmentGroup===b.fragmentGroup){
      if(!a.fragmentPairReleased||!b.fragmentPairReleased){
        if(d2>=(minDist+2)*(minDist+2)){
          a.fragmentPairReleased=true;
          b.fragmentPairReleased=true;
        }else return false;
      }
    }

    if(d2>=minDist*minDist)return false;
    const d=Math.sqrt(d2)||.0001,nx=dx/d,ny=dy/d;
    const overlap=minDist-d;
    const massA=Math.max(1,ra*ra),massB=Math.max(1,rb*rb);
    const invA=1/massA,invB=1/massB,invSum=invA+invB;

    const correction=(overlap+.6)/invSum;
    a.x-=nx*correction*invA;a.y-=ny*correction*invA;
    b.x+=nx*correction*invB;b.y+=ny*correction*invB;

    const rvx=b.vx-a.vx,rvy=b.vy-a.vy;
    const closing=rvx*nx+rvy*ny;
    if(closing<0){
      const restitution=.84;
      const impulse=-(1+restitution)*closing/invSum;
      a.vx-=impulse*invA*nx;a.vy-=impulse*invA*ny;
      b.vx+=impulse*invB*nx;b.vy+=impulse*invB*ny;
    }

    limitRockSpeed(a,maxSpeed);
    limitRockSpeed(b,maxSpeed);
    return true;
  }

  function resolveGiantAsteroidCollision(g,a,giantRadius,defaultRadius=45,maxSpeed=190){
    if(!g||!a||a.exiting)return false;
    const ar=Number(a.r)||defaultRadius;
    const dx=a.x-g.x,dy=a.y-g.y,minDist=giantRadius+ar,d2=dx*dx+dy*dy;
    if(d2>=minDist*minDist)return false;
    const d=Math.sqrt(d2)||.0001,nx=dx/d,ny=dy/d;
    const overlap=minDist-d;

    a.x+=nx*(overlap+1.2);a.y+=ny*(overlap+1.2);
    const rvx=a.vx-g.vx,rvy=a.vy-g.vy,closing=rvx*nx+rvy*ny;
    if(closing<0){
      const bounce=-(1.58)*closing;
      a.vx+=nx*bounce;a.vy+=ny*bounce;
    }else{
      a.vx+=nx*12;a.vy+=ny*12;
    }

    limitRockSpeed(a,maxSpeed);
    return true;
  }

  function guidedTargetFor(p,players,dirFromRot,minAlign=TARGET_MIN_ALIGN){
    if(!p||p.dead||!Array.isArray(players)||typeof dirFromRot!=='function')return -1;
    const forward=dirFromRot(p.rot);
    let bestIndex=-1,bestAlign=-2,bestDistance=Infinity;

    for(const target of players){
      if(!target||target.index===p.index||target.dead)continue;
      const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy);
      if(distance<1)continue;
      const align=(forward.x*dx+forward.y*dy)/distance;
      if(align<minAlign)continue;
      if(align>bestAlign+1e-6||(Math.abs(align-bestAlign)<=1e-6&&distance<bestDistance)){
        bestAlign=align;
        bestDistance=distance;
        bestIndex=target.index;
      }
    }
    return bestIndex;
  }


  function reloadTimeFor(p){
    const cadence=Number(p&&p.cadence)||30;
    return Math.max(.5,cadence/8)*.5;
  }

  function bulletSpeedFor(p){
    const cadence=Number(p&&p.cadence)||30;
    return cadence>=30?500:(cadence>=20?750:(cadence>=10?900:1000));
  }

  function guidedProjectileSpeedFor(p){
    const cadence=Number(p&&p.cadence)||30;
    return cadence>=30?400:(cadence>=20?460:(cadence>=10?520:580));
  }

  function refreshGuidedState(p,players,dirFromRot){
    if(!p)return -1;
    p.guided=Number(p.guidedAmmo)>0;
    p.guidedTarget=p.guided?guidedTargetFor(p,players,dirFromRot):-1;
    return p.guidedTarget;
  }

  function tryFireProjectile(p,d,fireNow,rocketNow,directFire,cpuBlocked,players,dirFromRot,uid,cpuFireDelaySeconds=0){
    if(!p||!d)return null;

    const rocketReady=!!rocketNow&&Number(p.guidedAmmo)>0;
    const guided=rocketReady?true:(directFire?false:!!p.guided);
    const hasAmmo=guided?Number(p.guidedAmmo)>0:Number(p.bullets)>0;

    // Mantener exactamente la misma puerta de disparo en local y online:
    // accion valida, municion de su reserva, recarga terminada y CPU armada.
    if((!fireNow&&!rocketReady)||!hasAmmo||!(Number(p.reload)<=0)||cpuBlocked)return null;

    const projectileSpeed=guided?guidedProjectileSpeedFor(p):bulletSpeedFor(p);
    const makeId=typeof uid==='function'?uid:(()=>Math.floor(Math.random()*1e9));
    const projectile={
      id:makeId(),owner:p.index,
      x:p.x+d.x*35,y:p.y+d.y*35,
      vx:d.x*projectileSpeed,vy:d.y*projectileSpeed,
      age:0,travel:0,guided,
      target:guided?p.guidedTarget:-1,
      flareTarget:-1,decoyed:false,
      baseSpeed:projectileSpeed
    };

    // V22.06: balas y misiles consumen siempre su contador independiente.
    if(guided){
      p.guidedAmmo=Math.max(0,(Number(p.guidedAmmo)||0)-1);
      refreshGuidedState(p,players,dirFromRot);
    }else{
      p.bullets=Math.max(0,(Number(p.bullets)||0)-1);
    }

    // Una sola cadencia comun para ambos tipos de proyectil.
    p.reload=reloadTimeFor(p);
    if(p.cpu)p.cpuFireDelay=Number(cpuFireDelaySeconds)||0;
    return projectile;
  }


  function projectileAsteroidHit(projectile,asteroids,sweptCircles,projectileRadius=4){
    if(!projectile||!Array.isArray(asteroids)||typeof sweptCircles!=='function')return null;
    for(let i=asteroids.length-1;i>=0;i--){
      const asteroid=asteroids[i];
      if(!asteroid)continue;
      const asteroidRadius=Number(asteroid.r)||45;
      if(!sweptCircles(projectile,projectileRadius,asteroid,asteroidRadius,false))continue;
      return {
        asteroid,
        index:i,
        fracture:!!projectile.guided,
        owner:Number(projectile.owner),
        impactX:Number(projectile.x)||0,
        impactY:Number(projectile.y)||0
      };
    }
    return null;
  }


  function projectileGiantHit(projectile,giant,sweptCircles,projectileRadius=4,giantRadius=135){
    if(!projectile||!giant||typeof sweptCircles!=='function')return null;
    if(!sweptCircles(projectile,projectileRadius,giant,giantRadius,false))return null;
    return {
      giant,
      guided:!!projectile.guided,
      owner:Number(projectile.owner),
      impactX:Number(projectile.x)||0,
      impactY:Number(projectile.y)||0
    };
  }


  function projectileMeteorHit(projectile,meteors,sweptCircles,projectileRadius=4,meteorRadius=14){
    if(!projectile||!Array.isArray(meteors)||typeof sweptCircles!=='function')return null;
    for(let i=meteors.length-1;i>=0;i--){
      const meteor=meteors[i];
      if(!meteor)continue;
      if(!sweptCircles(projectile,projectileRadius,meteor,meteorRadius,false))continue;
      return {
        meteor,
        index:i,
        guided:!!projectile.guided,
        owner:Number(projectile.owner),
        impactX:Number(projectile.x)||0,
        impactY:Number(projectile.y)||0
      };
    }
    return null;
  }


  function projectilePickupHit(projectile,pickups,sweptCircles,projectileRadius=4,pickupRadius=22){
    if(!projectile||!Array.isArray(pickups)||typeof sweptCircles!=='function')return null;

    // V22.10: los misiles atraviesan cualquier pickup y no se consumen.
    if(projectile.guided)return null;

    for(let i=pickups.length-1;i>=0;i--){
      const pickup=pickups[i];
      if(!pickup)continue;
      if(!sweptCircles(projectile,projectileRadius,pickup,pickupRadius,false))continue;
      return {pickup,index:i};
    }
    return null;
  }


  function projectileFlareHit(projectile,flares,sweptCircles,projectileRadius=4,flareRadius=12){
    if(!projectile||!Array.isArray(flares)||typeof sweptCircles!=='function')return null;
    for(let i=flares.length-1;i>=0;i--){
      const flare=flares[i];
      if(!flare)continue;
      if(!sweptCircles(projectile,projectileRadius,flare,flareRadius,false))continue;
      const projectileOwner=Number(projectile.owner);
      const flareOwner=Number(flare.owner);
      return {
        flare,
        index:i,
        guided:!!projectile.guided,
        projectileOwner,
        flareOwner,
        intercept:flareOwner!==projectileOwner,
        impactX:Number(projectile.x)||0,
        impactY:Number(projectile.y)||0
      };
    }
    return null;
  }

  function asteroidMissileFracture(asteroid,impactX,impactY,opts={}){
    if(!asteroid)return null;
    const defaultRadius=Number(opts.defaultRadius)||45;
    const fragmentRadius=Number(opts.fragmentRadius)||28;
    const rand=typeof opts.rand==='function'?opts.rand:((a,b)=>a+Math.random()*(b-a));
    const uid=typeof opts.uid==='function'?opts.uid:(()=>Math.floor(Math.random()*1e9));

    const radius=Number(asteroid.r)||defaultRadius;
    const x=Number(asteroid.x)||0,y=Number(asteroid.y)||0;
    const vx=Number(asteroid.vx)||0,vy=Number(asteroid.vy)||0;
    const hitX=Number.isFinite(Number(impactX))?Number(impactX):x;
    const hitY=Number.isFinite(Number(impactY))?Number(impactY):y;
    const isSmall=radius<=30||asteroid.fragment===true;

    if(isSmall){
      return {destroyOnly:true,x,y,hitX,hitY,fragments:[]};
    }

    let nx=hitX-x,ny=hitY-y;
    let len=Math.hypot(nx,ny);
    if(len<.001){
      nx=-(vx||1);ny=-(vy||0);
      len=Math.hypot(nx,ny)||1;
    }
    nx/=len;ny/=len;

    const splitX=-ny,splitY=nx;
    const fragmentGroup='split-'+uid();
    const fragments=[];

    for(const sign of [-1,1]){
      const sideSpeed=sign*rand(70,100);
      const impactKick=rand(34,58);
      const fx=x+splitX*sign*fragmentRadius-nx*5;
      const fy=y+splitY*sign*fragmentRadius-ny*5;
      fragments.push({
        id:uid(),x:fx,y:fy,px:fx,py:fy,rot:rand(0,360),
        type:Number(asteroid.type)||1,
        vx:vx*.62+splitX*sideSpeed-nx*impactKick,
        vy:vy*.62+splitY*sideSpeed-ny*impactKick,
        r:fragmentRadius,fragment:true,fragmentGroup,
        fragmentPairReleased:false,exiting:false,exitDelay:-1
      });
    }

    return {destroyOnly:false,x,y,hitX,hitY,fragments};
  }

  window.GalaxyPhysicsCore=Object.freeze({
    TARGET_MIN_ALIGN,
    resolveAsteroidPairCollision,
    resolveGiantAsteroidCollision,
    guidedTargetFor,
    reloadTimeFor,
    bulletSpeedFor,
    guidedProjectileSpeedFor,
    refreshGuidedState,
    tryFireProjectile,
    projectileAsteroidHit,
    projectileGiantHit,
    projectileMeteorHit,
    projectilePickupHit,
    projectileFlareHit,
    asteroidMissileFracture
  });
})();
