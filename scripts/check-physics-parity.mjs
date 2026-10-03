import fs from 'node:fs';

const LOCAL_PATH='docs/local-cpu.js';
const HOST_PATH='docs/host-physics.js';

const SHARED_METHODS=[
  'bulletSpeed',
  'updateAsteroids',
  'updateFlares',
  'guidedTargetFor',
  'updateBullets',
  'shipCollisions',
  'dropDefeatedLoadout'
];

const SHARED_CONSTANTS=[
  'SHIP_RADIUS',
  'ASTEROID_RADIUS',
  'GIANT_RADIUS',
  'PICKUP_RADIUS',
  'BULLET_RADIUS',
  'MISSILE_HIT_RADIUS',
  'SMALL_METEOR_RADIUS',
  'FLARE_RADIUS',
  'SHOCKWAVE_RADIUS',
  'UFO_RADIUS'
];

function extractMethod(source,name){
  const start=source.indexOf('    '+name+'(');
  if(start<0)throw new Error('No se encontro el metodo '+name);
  const brace=source.indexOf('{',start);
  if(brace<0)throw new Error('Metodo sin cuerpo: '+name);

  let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=brace;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(lineComment){
      if(c==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(c==='*'&&next==='/'){blockComment=false;i++;}
      continue;
    }
    if(quote){
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c===quote)quote=null;
      continue;
    }
    if(c==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==='\x60'){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'){
      depth--;
      if(depth===0)return source.slice(start,i+1);
    }
  }
  throw new Error('No se pudo cerrar el metodo '+name);
}

function normalizeCode(source){
  let out='',quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=0;i<source.length;i++){
    const c=source[i],next=source[i+1];
    if(lineComment){
      if(c==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(c==='*'&&next==='/'){blockComment=false;i++;}
      continue;
    }
    if(quote){
      out+=c;
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c===quote)quote=null;
      continue;
    }
    if(c==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(c==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(c==="'"||c==='"'||c==='\x60'){quote=c;out+=c;continue;}
    if(/\s/.test(c))continue;
    out+=c;
  }
  return out;
}

function extractConstant(source,name){
  const re=new RegExp('\\b'+name+'\\s*=\\s*([^,;\\n]+)');
  const match=source.match(re);
  if(!match)throw new Error('No se encontro la constante '+name);
  return match[1].trim();
}

const local=fs.readFileSync(LOCAL_PATH,'utf8');
const host=fs.readFileSync(HOST_PATH,'utf8');
const failures=[];

for(const name of SHARED_METHODS){
  const a=normalizeCode(extractMethod(local,name));
  const b=normalizeCode(extractMethod(host,name));
  if(a!==b)failures.push('Metodo compartido distinto: '+name);
}

for(const name of SHARED_CONSTANTS){
  const a=extractConstant(local,name);
  const b=extractConstant(host,name);
  if(a!==b)failures.push('Constante compartida distinta: '+name+' (local='+a+', online='+b+')');
}

if(failures.length){
  console.error('[Galaxy Combat] PARIDAD FISICA: ERROR');
  for(const failure of failures)console.error(' - '+failure);
  process.exit(1);
}

console.log('[Galaxy Combat] PARIDAD FISICA: OK');
console.log('Metodos verificados: '+SHARED_METHODS.join(', '));
console.log('Constantes verificadas: '+SHARED_CONSTANTS.join(', '));
