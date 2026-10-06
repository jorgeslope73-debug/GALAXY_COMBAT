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

  window.GalaxyPhysicsCore=Object.freeze({
    TARGET_MIN_ALIGN,
    resolveAsteroidPairCollision,
    resolveGiantAsteroidCollision,
    guidedTargetFor
  });
})();
