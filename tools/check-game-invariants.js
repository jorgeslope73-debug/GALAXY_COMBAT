'use strict';

const fs=require('fs');

function read(path){return fs.readFileSync(path,'utf8');}
function fail(errors,msg){errors.push(msg);}
function method(source,name){
  const re=new RegExp('^\\s{4}'+name+'\\s*\\([^)]*\\)\\s*\\{','m');
  const m=re.exec(source);
  if(!m)return '';
  const start=m.index,brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,line=false,block=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(line){if(ch==='\n')line=false;continue;}
    if(block){if(ch==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='/'&&next==='/'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){block=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch==='\x60'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  return '';
}
function startBlock(source){
  const a=source.indexOf('const ASTEROID_STARTS=[');
  const b=source.indexOf('const ASTEROID_MAX_ACTIVE',a);
  return a>=0&&b>a?source.slice(a,b):'';
}

const local=read('docs/local-cpu.js');
const host=read('docs/host-physics.js');
const game=read('docs/game.js');
const p2p=read('docs/p2p-network.js');
const core=read('docs/physics-core.js');
const errors=[];

for(const [label,src] of [['local',local],['online',host]]){
  const starts=startBlock(src);
  if(/\[[^\]]*,\s*5\]/.test(starts))fail(errors,label+': el meteorito pequeno solitario tipo 5 ha vuelto a ASTEROID_STARTS');

  const target=method(src,'guidedTargetFor');
  if(!target.includes('PHYSICS_CORE.guidedTargetFor'))fail(errors,label+': guidedTargetFor ya no delega en physics-core');

  const bullets=method(src,'updateBullets');
  if(!bullets.includes('PHYSICS_CORE.projectileAsteroidHit'))fail(errors,label+': colision proyectil-asteroide ya no delega en physics-core');
  if(bullets.includes('for(let aIndex=this.asteroids.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-asteroide');
  if(!bullets.includes('asteroidHit.impactX')||!bullets.includes('asteroidHit.impactY'))fail(errors,label+': misil contra asteroide pierde el punto real de impacto');
  if(!bullets.includes('PHYSICS_CORE.projectileGiantHit'))fail(errors,label+': colision proyectil-gigante ya no delega en physics-core');
  if(bullets.includes('sweptCircles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS,false)'))fail(errors,label+': ha vuelto la deteccion inline proyectil-gigante');
  if(!bullets.includes('giantHit.impactX')||!bullets.includes('giantHit.impactY'))fail(errors,label+': impacto contra gigante pierde el punto real');
  if(!bullets.includes('PHYSICS_CORE.projectileMeteorHit'))fail(errors,label+': colision proyectil-lluvia ya no delega en physics-core');
  if(bullets.includes('for(let m=this.meteors.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-lluvia');
  if(!bullets.includes('this.meteors.splice(meteorHit.index,1)'))fail(errors,label+': el meteorito de lluvia impactado ya no se elimina por indice compartido');
  if(!bullets.includes('meteorHit.impactX')||!bullets.includes('meteorHit.impactY'))fail(errors,label+': impacto contra lluvia pierde el punto real');
  if(!bullets.includes('PHYSICS_CORE.projectilePickupHit'))fail(errors,label+': colision bala-pickup ya no delega en physics-core');
  if(bullets.includes('for(let p=this.pickups.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-pickup');
  if(!bullets.includes('this.pickups.splice(pickupHit.index,1)'))fail(errors,label+': el pickup impactado ya no se elimina por indice compartido');
  if(!bullets.includes('PHYSICS_CORE.projectileFlareHit'))fail(errors,label+': colision proyectil-bengala ya no delega en physics-core');
  if(bullets.includes('for(let f=this.flares.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-bengala');
  if(!bullets.includes('this.flares.splice(flareHit.index,1)'))fail(errors,label+': la bengala impactada ya no se elimina por indice compartido');
  if(!bullets.includes("t:'intercept',index:flareHit.flareOwner,guided:flareHit.guided"))fail(errors,label+': se ha perdido el evento de intercepcion de bengala');
  if(!bullets.includes('PHYSICS_CORE.resolveProjectileInterceptions'))fail(errors,label+': intercepcion proyectil-proyectil ya no delega en physics-core');
  if(bullets.includes('const aMissile=!!a.guided,bMissile=!!b.guided'))fail(errors,label+': han vuelto las reglas inline proyectil-proyectil');
  if(!bullets.includes('destroyedProjectileScratch'))fail(errors,label+': se ha perdido el scratch Set reutilizable de proyectiles');
  if(bullets.includes('splitGiantMeteor'))fail(errors,label+': el meteorito gigante vuelve a fragmentarse por misil');

  const split=method(src,'splitAsteroidByMissile');
  if(!split.includes('PHYSICS_CORE.asteroidMissileFracture'))fail(errors,label+': la fragmentacion ya no delega en physics-core');

  const asteroids=method(src,'updateAsteroids');
  if(asteroids.includes('collidableAsteroids=this.asteroids.filter'))fail(errors,label+': ha vuelto una asignacion filter() al bucle de colisiones de 60 Hz');
  if(!asteroids.includes('if(!b||b.exiting)continue;'))fail(errors,label+': asteroides exiting pueden volver a participar en colisiones');
  if(!asteroids.includes('if(a.fragment===true)'))fail(errors,label+': falta la salida definitiva de fragmentos');

  const update=method(src,'update');
  if(update){
    if(!update.includes('PHYSICS_CORE.refreshGuidedState'))fail(errors,label+': el estado guided/guidedTarget ya no se refresca desde physics-core');
    if(!update.includes('PHYSICS_CORE.tryFireProjectile'))fail(errors,label+': la creacion/consumo de proyectiles ya no delega en physics-core');
    if(update.includes('this.bullets.push({id:uid(),owner:p.index'))fail(errors,label+': ha vuelto la creacion inline de proyectiles');
  }

  const pickup=method(src,'updatePickups');
  if(pickup.includes("pk.type==='mira'")&&!pickup.includes('p.guidedAmmo=(Number(p.guidedAmmo)||0)+1'))fail(errors,label+': pickup de misil no incrementa guidedAmmo');
}

const hostCycle=method(host,'updateHazardCycle');
if(hostCycle.includes('this.giant=null'))fail(errors,'online: el cambio de fase vuelve a borrar el meteorito gigante en seco');
const hostReset=method(host,'resetHazardCycle');
if(hostReset.includes('this.giant=null'))fail(errors,'online: resetHazardCycle vuelve a borrar un gigante en pantalla');
const hostGiant=method(host,'updateGiant');
if(!hostGiant.includes('if(!this.giant&&!giantEnabled)return;'))fail(errors,'online: falta conservar el gigante cuando termina su fase');
if(!hostGiant.includes('this.nextGiant=giantEnabled?rand(130,190):999999'))fail(errors,'online: la salida del gigante no respeta si la fase sigue habilitada');

if(!core.includes('const TARGET_MIN_ALIGN=.8660254038'))fail(errors,'core: falta el cono de adquisicion +/-30 grados');
if(!core.includes('if(align<minAlign)continue;'))fail(errors,'core: la adquisicion puede aceptar objetivos fuera del cono');
if(!core.includes('resolveAsteroidPairCollision'))fail(errors,'core: falta resolver colision asteroide-asteroide');
if(!core.includes('resolveGiantAsteroidCollision'))fail(errors,'core: falta resolver colision gigante-asteroide');
if(!core.includes('function reloadTimeFor'))fail(errors,'core: falta la cadencia compartida de disparo');
if(!core.includes('function bulletSpeedFor'))fail(errors,'core: falta la velocidad compartida de bala');
if(!core.includes('function guidedProjectileSpeedFor'))fail(errors,'core: falta la velocidad compartida de misil');
if(!core.includes('function refreshGuidedState'))fail(errors,'core: falta refrescar guided/guidedTarget de forma compartida');
if(!core.includes('function tryFireProjectile'))fail(errors,'core: falta la creacion compartida de proyectiles');
if(!core.includes('p.guidedAmmo=Math.max(0,(Number(p.guidedAmmo)||0)-1)'))fail(errors,'core: el misil no consume guidedAmmo en el nucleo compartido');
if(!core.includes('p.bullets=Math.max(0,(Number(p.bullets)||0)-1)'))fail(errors,'core: la bala no consume bullets en el nucleo compartido');
if(!core.includes('p.reload=reloadTimeFor(p)'))fail(errors,'core: bala y misil ya no comparten la misma cadencia');
if(!core.includes('function projectileAsteroidHit'))fail(errors,'core: falta la colision compartida proyectil-asteroide');
if(!core.includes('function projectileGiantHit'))fail(errors,'core: falta la colision compartida proyectil-gigante');
if(!core.includes('function projectileMeteorHit'))fail(errors,'core: falta la colision compartida proyectil-lluvia');
if(!core.includes('function projectilePickupHit'))fail(errors,'core: falta la colision compartida proyectil-pickup');
if(!core.includes('function projectileFlareHit'))fail(errors,'core: falta la colision compartida proyectil-bengala');
if(!core.includes('function resolveProjectileInterceptions'))fail(errors,'core: falta la intercepcion compartida proyectil-proyectil');
if(!core.includes('if(Number(a.owner)===Number(b.owner))continue;'))fail(errors,'core: proyectiles del mismo jugador pueden autointerceptarse');
if(!core.includes('if(!aMissile&&!bMissile)continue;'))fail(errors,'core: dos balas normales ya no se atraviesan');
if(!core.includes('sweptCircles(a,missileRadius,b,missileRadius,false)'))fail(errors,'core: falta colision misil-misil');
if(!core.includes('sweptCircles(missile,missileRadius,bullet,bulletRadius,false)'))fail(errors,'core: falta colision bala-misil');
if(!core.includes('flareRadius=12'))fail(errors,'core: la bengala ha perdido su radio de colision compartido');
if(!core.includes('intercept:flareOwner!==projectileOwner'))fail(errors,'core: se ha perdido la distincion de bengala propia/ajena');
if(!core.includes('if(projectile.guided)return null;'))fail(errors,'core: los misiles ya no atraviesan los pickups');
if(!core.includes('pickupRadius=22'))fail(errors,'core: el pickup ha perdido su radio de colision compartido');
if(!core.includes('meteorRadius=14'))fail(errors,'core: la lluvia ha perdido su radio de colision compartido');
if(!core.includes('guided:!!projectile.guided'))fail(errors,'core: la colision compartida no conserva el tipo de proyectil');
if(!core.includes('fracture:!!projectile.guided'))fail(errors,'core: misil contra asteroide ya no activa fragmentacion');
if(!core.includes('impactX:Number(projectile.x)||0'))fail(errors,'core: falta conservar X real del impacto contra asteroide');
if(!core.includes('impactY:Number(projectile.y)||0'))fail(errors,'core: falta conservar Y real del impacto contra asteroide');
if(!core.includes('function asteroidMissileFracture'))fail(errors,'core: falta la fragmentacion compartida por misil');
if(!core.includes('type:Number(asteroid.type)||1'))fail(errors,'core: los fragmentos no conservan la textura original');
if(!core.includes('fragment:true'))fail(errors,'core: los fragmentos no quedan marcados como temporales');
if(local.includes('[...this.asteroids]')||host.includes('[...this.asteroids]'))fail(errors,'fisica: ha vuelto la copia temporal [...this.asteroids] en ruta caliente');

if(!game.includes('const ASTEROID_DUST_MAX=isMobile?24:36'))fail(errors,'render: el polvo de asteroide ha perdido su pool fijo');
if(!game.includes("}else if(e.kind==='asteroidDust'){"))fail(errors,'render: falta consumir el FX local de polvo');
if(!p2p.includes('firstOpenPeer(){'))fail(errors,'P2P: falta busqueda de peer sin array temporal');
if(p2p.includes('[...this.peers.values()].find'))fail(errors,'P2P: ha vuelto la asignacion de array temporal al buscar peer');

if(errors.length){
  console.error('\nGALAXY COMBAT - FALLO DE INVARIANTES\n');
  for(const e of errors)console.error(' - '+e);
  process.exit(1);
}
console.log('Galaxy Combat: invariantes OK - meteoritos, misiles, municion, gigante online, FX y rutas calientes.');
