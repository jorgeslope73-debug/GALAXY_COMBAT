'use strict';

const fs=require('fs');

const HOST_PATH='docs/host-physics.js';
const LOCAL_PATH='docs/local-cpu.js';

// Solo funciones que hoy son mecanica compartida real. Las diferencias
// intencionadas (IA/aprendizaje, roster online, ranking y publicState) quedan
// fuera para no producir falsos positivos.
const SHARED_METHODS=[
  // V21.54: solo bloques que deben permanecer EXACTAMENTE iguales entre
  // partida local y host online. IA, aprendizaje, campaña, ranking, respawn,
  // onda y hazards con progresión quedan fuera porque tienen diferencias
  // intencionadas entre ambos motores.
  'reloadTime',
  'bulletSpeed',
  'resolveAsteroidPairCollision',
  'resolveGiantAsteroidCollision',
  'splitAsteroidByMissile',
  'asteroidPopulationUnits',
  'normalAsteroidCount',
  'updateAsteroids',
  'updateFlares',
  'guidedTargetFor',
  'updateBullets',
  'shipCollisions',
  'dropDefeatedLoadout'
];

const SHARED_CONSTANTS=[
  'TICK_HZ','DT','STEP_MS','SCORE_TO_WIN',
  'SHIP_RADIUS','ASTEROID_RADIUS','GIANT_RADIUS','PICKUP_RADIUS',
  'BULLET_RADIUS','MISSILE_HIT_RADIUS','SMALL_METEOR_RADIUS',
  'SPAWN_PROTECTION_SECONDS','SPAWN_MATERIALIZE_SECONDS','BRUTAL_SHOT_DISTANCE',
  'FLARE_HOLD_SECONDS','FLARE_LIFE_SECONDS','FLARE_LAUNCH_COOLDOWN',
  'FLARE_RADIUS','FLARE_DECOY_TRIGGER','FLARE_CPU_USE_COOLDOWN',
  'FLARE_CPU_KEEP_COOLDOWN','FLARE_CPU_MISSILE_REACTION_MIN',
  'FLARE_CPU_MISSILE_REACTION_MAX','CPU_ARMED_WARNING_SECONDS',
  'SHOCKWAVE_RADIUS','SHOCKWAVE_SAFE_DISTANCE','SHOCKWAVE_STANDOFF_DISTANCE',
  'UFO_RADIUS','ASTEROID_MAX_ACTIVE'
];

function findMethodStart(source,name){
  const pattern=new RegExp('^\\s{4}'+name+'\\s*\\([^)]*\\)\\s*\\{','m');
  const match=pattern.exec(source);
  return match?match.index:-1;
}

function extractMethod(source,name){
  const start=findMethodStart(source,name);
  if(start<0)return null;
  let brace=source.indexOf('{',start);
  if(brace<0)return null;

  let depth=0;
  let quote='';
  let escaped=false;
  let lineComment=false;
  let blockComment=false;

  for(let i=brace;i<source.length;i++){
    const ch=source[i],next=source[i+1];

    if(lineComment){
      if(ch==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(ch==='*'&&next==='/'){blockComment=false;i++;}
      continue;
    }
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }

    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch==='\x60'){quote=ch;continue;}

    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return source.slice(start,i+1);
    }
  }
  return null;
}

function normalizeCode(source){
  let out='';
  let quote='';
  let escaped=false;
  let lineComment=false;
  let blockComment=false;

  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1];

    if(lineComment){
      if(ch==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(ch==='*'&&next==='/'){blockComment=false;i++;}
      continue;
    }
    if(quote){
      out+=ch;
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }

    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch==='\x60'){quote=ch;out+=ch;continue;}
    if(/\s/.test(ch))continue;
    out+=ch;
  }
  return out;
}

function constantValue(source,name){
  const pattern=new RegExp('\\b'+name+'\\s*=\\s*([^,;\\n]+)');
  const match=pattern.exec(source);
  return match?match[1].trim():null;
}

const host=fs.readFileSync(HOST_PATH,'utf8');
const local=fs.readFileSync(LOCAL_PATH,'utf8');
const failures=[];

for(const name of SHARED_METHODS){
  const hostMethod=extractMethod(host,name);
  const localMethod=extractMethod(local,name);
  if(!hostMethod||!localMethod){
    failures.push(name+': falta en '+(!hostMethod?HOST_PATH:LOCAL_PATH));
    continue;
  }
  if(normalizeCode(hostMethod)!==normalizeCode(localMethod)){
    failures.push(name+': la mecanica compartida ya no es identica');
  }
}

for(const name of SHARED_CONSTANTS){
  const hostValue=constantValue(host,name);
  const localValue=constantValue(local,name);
  if(hostValue===null||localValue===null){
    failures.push(name+': constante compartida no encontrada');
    continue;
  }
  if(hostValue!==localValue){
    failures.push(name+': host='+hostValue+' local='+localValue);
  }
}

if(failures.length){
  console.error('\nGALAXY COMBAT - FALLO DE PARIDAD DE FISICA\n');
  for(const failure of failures)console.error(' - '+failure);
  console.error('\nSi la diferencia es intencionada, revisa la lista protegida del comprobador.');
  process.exit(1);
}

console.log(
  'Galaxy Combat: paridad OK - '+
  SHARED_METHODS.length+' mecanicas y '+
  SHARED_CONSTANTS.length+' constantes compartidas.'
);
