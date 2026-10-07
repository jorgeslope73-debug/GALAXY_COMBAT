'use strict';

const path=require('path');

// El juego está escrito para navegador, pero la física local no necesita DOM.
// Exponemos window=global y cargamos exactamente los mismos ficheros runtime.
global.window=global;

// RNG determinista: una regresión produce el mismo escenario en CI.
let seed=0x6d2b79f5;
Math.random=()=>{
  seed=(seed+0x6d2b79f5)|0;
  let t=seed;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
};

require(path.join(__dirname,'../docs/campaign-config.js'));
require(path.join(__dirname,'../docs/physics-core.js'));
require(path.join(__dirname,'../docs/local-cpu.js'));

const SIM_SECONDS=Math.max(60,Math.round(Number(process.env.STRESS_SECONDS)||300));
const TICK_HZ=60;
const DT=1/TICK_HZ;
const TOTAL_TICKS=SIM_SECONDS*TICK_HZ;
const W=1920,H=1080;

function die(message){
  throw new Error('[stress] '+message);
}

function finiteDeep(value,label,depth=0,seen=new Set()){
  if(value==null||depth>5)return;
  if(typeof value==='number'){
    if(!Number.isFinite(value))die(label+' contiene numero no finito: '+String(value));
    return;
  }
  if(typeof value!=='object')return;
  if(seen.has(value))return;
  seen.add(value);
  if(Array.isArray(value)){
    for(let i=0;i<value.length;i++)finiteDeep(value[i],label+'['+i+']',depth+1,seen);
    return;
  }
  for(const [key,v] of Object.entries(value)){
    if(typeof v==='function')continue;
    finiteDeep(v,label+'.'+key,depth+1,seen);
  }
}

function speedCheck(label,obj,maxSpeed){
  if(!obj)return;
  const vx=Number(obj.vx)||0,vy=Number(obj.vy)||0;
  const speed=Math.hypot(vx,vy);
  if(!Number.isFinite(speed)||speed>maxSpeed)die(label+' velocidad absurda: '+speed.toFixed(2));
  const x=Number(obj.x),y=Number(obj.y);
  if(Number.isFinite(x)&&Math.abs(x)>20000)die(label+' X fuera de rango: '+x);
  if(Number.isFinite(y)&&Math.abs(y)>20000)die(label+' Y fuera de rango: '+y);
}

const events=[];
const sim=new global.GalaxyLocalCpu({
  onState:()=>{},
  onEvent:e=>{if(e&&e.t)events.push(e.t);}
});

if(!sim.startTraining(null))die('no pudo iniciar entrenamiento de 4 CPU');

// El entrenamiento normal oculta OVNIs para no contaminar aprendizaje.
// En stress queremos la física real completa, así que conservamos las 4 CPU
// pero activamos el perfil de campaña final y deshabilitamos aprendizaje.
sim.trainingMode=false;
sim.learningEnabled=false;
sim.campaignLevel=5;
sim.firstShower=0;
sim.nextShower=0;
sim.nextGiant=0;
sim.nextUfo=0;
sim.nextPickup=0;

if(sim.players.length!==4||!sim.players.every(p=>p&&p.cpu))die('la prueba no arrancó con 4 CPU');

// Evitar que una victoria detenga los 5 minutos simulados.
// Se ejecuta la baja real y solo se reabre la ronda para continuar castigándola.
const realDestroyShip=sim.destroyShip.bind(sim);
sim.destroyShip=(victim,attacker=null,weaponTheft=false,scorePenalty=false)=>{
  realDestroyShip(victim,attacker,weaponTheft,scorePenalty);
  if(sim.finished){
    sim.finished=false;
    sim.winner=null;
    for(const p of sim.players)if((Number(p.kills)||0)>=4)p.kills=2;
  }
};

const coverage={
  missile:false,
  flare:false,
  shockwave:false,
  meteor:false,
  giant:false,
  ufo:false,
  fragment:false,
  pickup:false
};

const maxima={
  bullets:0,flares:0,pickups:0,shockwaves:0,meteors:0,asteroids:0,ufos:0,fx:0
};

const fragmentBorn=new Map();
const offscreenSince=new Map();
let injectedId=900000000;

function equipCpu(){
  for(const p of sim.players){
    if(!p||p.dead)continue;
    p.bullets=Math.max(Number(p.bullets)||0,8);
    p.guidedAmmo=Math.max(Number(p.guidedAmmo)||0,2);
    p.flare=Math.max(Number(p.flare)||0,1);
    p.cpuFireDelay=0;
  }
}

function forceGuidedProjectile(){
  const shooter=sim.players.find(p=>p&&!p.dead);
  const target=sim.players.find(p=>p&&!p.dead&&p!==shooter);
  if(!shooter||!target)return false;
  const dx=target.x-shooter.x,dy=target.y-shooter.y;
  const len=Math.hypot(dx,dy)||1;
  shooter.guidedAmmo=Math.max(1,Number(shooter.guidedAmmo)||0);
  shooter.guided=true;
  shooter.guidedTarget=target.index;
  shooter.reload=0;
  const dir={x:dx/len,y:dy/len};
  const dirFromRot=rot=>{
    const r=rot*Math.PI/180;
    return{x:-Math.sin(r),y:-Math.cos(r)};
  };
  const projectile=global.GalaxyPhysicsCore.tryFireProjectile(
    shooter,dir,true,false,false,false,sim.players,dirFromRot,()=>injectedId++,0
  );
  if(!projectile)return false;
  sim.bullets.push(projectile);
  coverage.missile=true;
  return true;
}

function countUfos(){
  return (sim.ufo?1:0)+(Array.isArray(sim.ufoExtras)?sim.ufoExtras.length:0);
}

function observeCoverage(){
  if(sim.bullets.some(b=>b&&b.guided))coverage.missile=true;
  if(sim.flares.length)coverage.flare=true;
  if(sim.activeShockwaves.length)coverage.shockwave=true;
  if(sim.meteors.length||sim.showerLeft>0)coverage.meteor=true;
  if(sim.giant)coverage.giant=true;
  if(countUfos())coverage.ufo=true;
  if(sim.asteroids.some(a=>a&&a.fragment===true))coverage.fragment=true;
  if(sim.pickups.length)coverage.pickup=true;
}

function updateMaxima(){
  maxima.bullets=Math.max(maxima.bullets,sim.bullets.length);
  maxima.flares=Math.max(maxima.flares,sim.flares.length);
  maxima.pickups=Math.max(maxima.pickups,sim.pickups.length);
  maxima.shockwaves=Math.max(maxima.shockwaves,sim.activeShockwaves.length);
  maxima.meteors=Math.max(maxima.meteors,sim.meteors.length);
  maxima.asteroids=Math.max(maxima.asteroids,sim.asteroids.length);
  maxima.ufos=Math.max(maxima.ufos,countUfos());
  maxima.fx=Math.max(maxima.fx,sim.fxEvents.length);
}

function assertCounts(){
  if(sim.players.length!==4)die('numero de jugadores cambió: '+sim.players.length);
  if(sim.bullets.length>256)die('demasiados proyectiles: '+sim.bullets.length);
  if(sim.flares.length>128)die('demasiadas bengalas: '+sim.flares.length);
  if(sim.pickups.length>20)die('demasiados pickups: '+sim.pickups.length);
  if(sim.activeShockwaves.length>16)die('demasiadas ondas: '+sim.activeShockwaves.length);
  if(sim.meteors.length>160)die('demasiados meteoritos de lluvia: '+sim.meteors.length);
  if(sim.asteroids.length>32)die('demasiados asteroides/fragmentos: '+sim.asteroids.length);
  if(countUfos()>3)die('demasiados OVNIs: '+countUfos());
  if(sim.fxEvents.length>32)die('pool FX superó 32: '+sim.fxEvents.length);
}

function assertPhysics(nowSeconds){
  const groups=[
    ['players',sim.players,2500],
    ['bullets',sim.bullets,2600],
    ['flares',sim.flares,2200],
    ['meteors',sim.meteors,1800],
    ['asteroids',sim.asteroids,1800],
    ['ufos',[sim.ufo,...sim.ufoExtras].filter(Boolean),1800]
  ];
  if(sim.giant)groups.push(['giant',[sim.giant],1800]);

  for(const [name,list,maxSpeed] of groups){
    finiteDeep(list,name);
    for(let i=0;i<list.length;i++)speedCheck(name+'['+i+']',list[i],maxSpeed);
  }
  finiteDeep(sim.pickups,'pickups');
  finiteDeep(sim.activeShockwaves,'shockwaves');

  const liveFragments=new Set();
  for(const a of sim.asteroids){
    if(!a)continue;
    if(a.fragment===true){
      liveFragments.add(a.id);
      if(!fragmentBorn.has(a.id))fragmentBorn.set(a.id,nowSeconds);
      const age=nowSeconds-fragmentBorn.get(a.id);
      if(age>90)die('fragmento eterno id='+a.id+' edad='+age.toFixed(1)+'s');
    }

    const far=a.x<-220||a.x>W+220||a.y<-220||a.y>H+220;
    if(far){
      if(!offscreenSince.has(a.id))offscreenSince.set(a.id,nowSeconds);
      const age=nowSeconds-offscreenSince.get(a.id);
      if(age>8)die('asteroide demasiado tiempo fuera de escena id='+a.id+' edad='+age.toFixed(1)+'s');
    }else{
      offscreenSince.delete(a.id);
    }
  }

  for(const id of [...fragmentBorn.keys()])if(!liveFragments.has(id))fragmentBorn.delete(id);
  const liveAsteroids=new Set(sim.asteroids.map(a=>a&&a.id).filter(id=>id!=null));
  for(const id of [...offscreenSince.keys()])if(!liveAsteroids.has(id))offscreenSince.delete(id);

  assertCounts();
}

equipCpu();
forceGuidedProjectile();

const startedAt=Date.now();

for(let tick=0;tick<TOTAL_TICKS;tick++){
  const now=tick*DT;

  // Alimentar combate para que el stress no se convierta en una partida vacía.
  if((tick%(3*TICK_HZ))===0)equipCpu();

  if((tick%(11*TICK_HZ))===0){
    const p=sim.players[(tick/(11*TICK_HZ))%sim.players.length|0];
    if(p&&!p.dead){
      p.flare=Math.max(1,Number(p.flare)||0);
      if(sim.deployFlares(p))coverage.flare=true;
    }
  }

  if((tick%(17*TICK_HZ))===0){
    const p=sim.players[(tick/(17*TICK_HZ))%sim.players.length|0];
    if(p&&!p.dead){
      p.shockwave=true;
      if(sim.deployShockwave(p))coverage.shockwave=true;
    }
  }

  // Repetir peligros durante toda la ventana simulada.
  if((tick%(25*TICK_HZ))===0){
    if(!sim.giant)sim.nextGiant=0;
    if(sim.showerLeft<=0)sim.firstShower=0;
    if(countUfos()===0)sim.nextUfo=0;
  }

  // Forzar al menos una fragmentación real por la API del juego.
  if(tick===2*TICK_HZ&&!coverage.fragment){
    const asteroid=sim.asteroids.find(a=>a&&a.fragment!==true&&!a.exiting);
    if(asteroid){
      sim.splitAsteroidByMissile(asteroid,0,asteroid.x+8,asteroid.y+4);
      coverage.fragment=sim.asteroids.some(a=>a&&a.fragment===true);
    }
  }

  // Si la IA aún no ha lanzado misil, inyectar uno por el mismo core compartido.
  if(tick===3*TICK_HZ&&!coverage.missile)forceGuidedProjectile();

  sim.update(DT);

  // Nunca permitir que la condición de victoria corte la duración del stress.
  if(sim.finished){sim.finished=false;sim.winner=null;}

  observeCoverage();
  updateMaxima();
  assertPhysics(now);

  // También estresar serialización de estado una vez por segundo.
  if((tick%TICK_HZ)===0)finiteDeep(sim.publicState(),'publicState');
}

const missing=Object.entries(coverage).filter(([,ok])=>!ok).map(([name])=>name);
if(missing.length)die('mecánicas no ejercitadas: '+missing.join(', '));

const elapsedMs=Date.now()-startedAt;
console.log('Galaxy Combat stress OK');
console.log(JSON.stringify({
  simulatedSeconds:SIM_SECONDS,
  ticks:TOTAL_TICKS,
  wallMs:elapsedMs,
  coverage,
  maxima,
  events:events.length
},null,2));
