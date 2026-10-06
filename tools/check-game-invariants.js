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
    if(line){if(ch==='\\n')line=false;continue;}
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
const errors=[];

for(const [label,src] of [['local',local],['online',host]]){
  const starts=startBlock(src);
  if(/\[[^\]]*,\s*5\]/.test(starts))fail(errors,label+': el meteorito pequeno solitario tipo 5 ha vuelto a ASTEROID_STARTS');

  const target=method(src,'guidedTargetFor');
  if(!target.includes('const minAlign=.8660254038'))fail(errors,label+': falta el cono de adquisicion de misil +/-30 grados');
  if(!target.includes('if(align<minAlign)continue;'))fail(errors,label+': el target puede adquirirse fuera del cono de 60 grados');

  const bullets=method(src,'updateBullets');
  if(!bullets.includes('this.splitAsteroidByMissile(a,Number(b.owner),b.x,b.y)'))fail(errors,label+': misil contra asteroide no usa punto real de impacto');
  if(bullets.includes('splitGiantMeteor'))fail(errors,label+': el meteorito gigante vuelve a fragmentarse por misil');

  const split=method(src,'splitAsteroidByMissile');
  if(!split.includes('type:Number(asteroid.type)||1'))fail(errors,label+': los fragmentos no conservan la textura del asteroide original');
  if(!split.includes('fragment:true'))fail(errors,label+': los fragmentos no estan marcados como temporales');

  const asteroids=method(src,'updateAsteroids');
  if(asteroids.includes('collidableAsteroids=this.asteroids.filter'))fail(errors,label+': ha vuelto una asignacion filter() al bucle de colisiones de 60 Hz');
  if(!asteroids.includes('if(!b||b.exiting)continue;'))fail(errors,label+': asteroides exiting pueden volver a participar en colisiones');
  if(!asteroids.includes('if(a.fragment===true)'))fail(errors,label+': falta la salida definitiva de fragmentos');

  const update=method(src,'update');
  if(update){
    if(!update.includes('p.guidedAmmo=Math.max(0,(Number(p.guidedAmmo)||0)-1)'))fail(errors,label+': disparar misil no descuenta guidedAmmo');
    if(!update.includes('p.bullets=Math.max(0,(Number(p.bullets)||0)-1)'))fail(errors,label+': disparar bala no descuenta bullets por separado');
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
