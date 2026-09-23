'use strict';

const http=require('http');
const {randomBytes,scrypt:scryptCallback,timingSafeEqual,createHash}=require('crypto');
const {promisify}=require('util');
const {Pool}=require('pg');
const {WebSocketServer}=require('ws');

const scrypt=promisify(scryptCallback);
const PORT=Number(process.env.PORT||8080);
const MAX_PLAYERS=4;
const SESSION_DAYS=30;
const PASSWORD_MIN_LENGTH=8;
const DATABASE_URL=String(process.env.DATABASE_URL||'').trim();

let dbReady=false;
let dbInitPromise=null;
const db=DATABASE_URL?new Pool({
  connectionString:DATABASE_URL,
  ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false}
}):null;

const rooms=new Map();
const info=new WeakMap();

function normalizeUsername(value){return String(value||'').replace(/[\x00-\x1f\x7f]/g,'').replace(/\s+/g,' ').trim().slice(0,16);}
function usernameKey(value){return normalizeUsername(value).toLowerCase();}
function normalizeEmail(value){return String(value||'').trim().toLowerCase().slice(0,254);}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
function validRegisteredUsername(value){return /^[A-Za-z0-9 _-]{2,16}$/.test(normalizeUsername(value));}
function safeName(v){return normalizeUsername(v)||'JUGADOR';}
function tokenHash(token){return createHash('sha256').update(String(token||'')).digest('hex');}

async function hashPassword(password,saltHex=''){
  const salt=saltHex?Buffer.from(saltHex,'hex'):randomBytes(16);
  const derived=await scrypt(String(password),salt,64);
  return {salt:salt.toString('hex'),hash:Buffer.from(derived).toString('hex')};
}
async function verifyPassword(password,saltHex,hashHex){
  try{
    const test=await hashPassword(password,saltHex);
    const a=Buffer.from(test.hash,'hex');
    const b=Buffer.from(String(hashHex||''),'hex');
    return a.length===b.length&&timingSafeEqual(a,b);
  }catch(_){return false;}
}
async function ensureDatabase(){
  if(!db)return false;
  if(dbReady)return true;
  if(dbInitPromise)return dbInitPromise;
  dbInitPromise=(async()=>{
    await db.query(`
      CREATE TABLE IF NOT EXISTS galaxy_users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(16) NOT NULL,
        username_key VARCHAR(16) NOT NULL UNIQUE,
        email VARCHAR(254) NOT NULL,
        email_key VARCHAR(254) NOT NULL UNIQUE,
        password_salt VARCHAR(64) NOT NULL,
        password_hash VARCHAR(256) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS galaxy_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES galaxy_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS galaxy_sessions_user_idx ON galaxy_sessions(user_id);
      CREATE INDEX IF NOT EXISTS galaxy_sessions_exp_idx ON galaxy_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS galaxy_ranked_matches (
        match_id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(8) NOT NULL,
        winner_user_id BIGINT NOT NULL REFERENCES galaxy_users(id) ON DELETE RESTRICT,
        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS galaxy_ranked_match_players (
        match_id VARCHAR(64) NOT NULL REFERENCES galaxy_ranked_matches(match_id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES galaxy_users(id) ON DELETE RESTRICT,
        player_index SMALLINT NOT NULL,
        PRIMARY KEY(match_id,user_id)
      );
      CREATE INDEX IF NOT EXISTS galaxy_rank_players_user_idx ON galaxy_ranked_match_players(user_id);
      CREATE INDEX IF NOT EXISTS galaxy_rank_winner_idx ON galaxy_ranked_matches(winner_user_id);
      CREATE TABLE IF NOT EXISTS galaxy_cpu_brain (
        id SMALLINT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT 1,
        brain JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO galaxy_cpu_brain(id,version,brain)
      VALUES(1,1,'{"version":1,"strategies":[],"candidates":[]}'::jsonb)
      ON CONFLICT(id) DO NOTHING;
    `);
    dbReady=true;
    console.log('[Galaxy Combat P2P] Base de datos de cuentas preparada.');
    return true;
  })().catch(err=>{
    dbInitPromise=null;dbReady=false;
    console.error('[Galaxy Combat P2P] No se pudo preparar DATABASE_URL:',err&&err.message||err);
    return false;
  });
  return dbInitPromise;
}
async function createSession(userId){
  if(!await ensureDatabase())return null;
  const token=randomBytes(32).toString('hex');
  await db.query('DELETE FROM galaxy_sessions WHERE expires_at<=NOW()');
  await db.query(`INSERT INTO galaxy_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+($3||' days')::interval)`,[tokenHash(token),userId,String(SESSION_DAYS)]);
  return token;
}
async function userFromSessionToken(token){
  if(!token||!/^[a-f0-9]{64}$/i.test(String(token)))return null;
  if(!await ensureDatabase())return null;
  const {rows}=await db.query(`SELECT u.id,u.username,u.email FROM galaxy_sessions s JOIN galaxy_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`,[tokenHash(token)]);
  return rows[0]||null;
}
async function registeredNameExists(name){
  if(!db||!await ensureDatabase())return false;
  const {rowCount}=await db.query('SELECT 1 FROM galaxy_users WHERE username_key=$1 LIMIT 1',[usernameKey(name)]);
  return rowCount>0;
}
async function resolvePlayerIdentity(msg){
  const token=String(msg&&msg.authToken||'').trim();
  let user=null;
  try{user=token?await userFromSessionToken(token):null;}catch(err){
    console.error('[Galaxy Combat P2P] Error validando sesion:',err&&err.message||err);
    if(token)return {error:'SERVICIO DE CUENTAS NO DISPONIBLE.'};
  }
  if(user)return {name:user.username,userId:Number(user.id),registered:true};
  if(token)return {error:'SESION CADUCADA. INICIA SESION DE NUEVO.'};
  const name=safeName(msg&&msg.name);
  try{if(await registeredNameExists(name))return {error:'NOMBRE REGISTRADO. INICIA SESION.'};}
  catch(err){console.error('[Galaxy Combat P2P] Error comprobando nombre:',err&&err.message||err);}
  return {name,userId:null,registered:false};
}

function roomCode(){
  for(;;){const c=randomBytes(3).toString('hex').slice(0,4).toUpperCase();if(!rooms.has(c))return c;}
}
function send(ws,o){if(ws&&ws.readyState===1)try{ws.send(JSON.stringify(o));}catch(_){}}
function roster(r){return r.players.map(p=>({i:p.i,n:p.n,cpu:false,registered:!!p.registered}));}
function broadcast(r,o){for(const p of r.players)send(p.ws,o);}
function publicRooms(){return [...rooms.values()].filter(r=>r.public&&!r.started).map(r=>({code:r.code,host:r.players[0]?.n||'JUGADOR',lang:r.lang,players:r.players.length,maxPlayers:MAX_PLAYERS}));}
function publicUpdate(wss){const raw=JSON.stringify({t:'public-rooms',rooms:publicRooms()});for(const ws of wss.clients)if(ws.readyState===1)ws.send(raw);}
function remove(ws,wss){
  const x=info.get(ws);if(!x)return;info.delete(ws);
  const r=rooms.get(x.code);if(!r)return;
  const p=r.players.find(p=>p.i===x.i);if(!p)return;
  const host=p.i===0;r.players=r.players.filter(q=>q!==p);
  if(host){broadcast(r,{t:'closed',reason:'El anfitrion cerro la sala.'});rooms.delete(r.code);}
  else broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:r.players.length>1});
  publicUpdate(wss);
}

async function recordRankedMatch(room,winner){
  if(!db||!room||room.rankRecorded||!room.rankEligible||!room.rankMatchId||!winner||!winner.userId)return false;
  room.rankRecorded=true;
  try{
    if(!await ensureDatabase()){room.rankRecorded=false;return false;}
    const players=room.players.filter(p=>p.userId);
    if(players.length<2||players.length!==room.players.length){room.rankRecorded=false;return false;}
    const client=await db.connect();
    try{
      await client.query('BEGIN');
      await client.query(`INSERT INTO galaxy_ranked_matches(match_id,room_code,winner_user_id) VALUES($1,$2,$3) ON CONFLICT(match_id) DO NOTHING`,[room.rankMatchId,room.code,winner.userId]);
      for(const p of players){
        await client.query(`INSERT INTO galaxy_ranked_match_players(match_id,user_id,player_index) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[room.rankMatchId,p.userId,p.i]);
      }
      await client.query('COMMIT');
      console.log(`[Galaxy Combat P2P] Partida rankeada ${room.rankMatchId} registrada.`);
      return true;
    }catch(err){try{await client.query('ROLLBACK');}catch(_){}throw err;}
    finally{client.release();}
  }catch(err){room.rankRecorded=false;console.error('[Galaxy Combat P2P] Error guardando partida:',err&&err.message||err);return false;}
}

function sendJson(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
function readJsonBody(req,maxBytes=16384){
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(new Error('body-too-large'));req.destroy();return;}chunks.push(chunk);});
    req.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{});}catch(_){reject(new Error('bad-json'));}});
    req.on('error',reject);
  });
}
function bearerToken(req){const raw=String(req.headers.authorization||'');const m=/^Bearer\s+([a-f0-9]{64})$/i.exec(raw.trim());return m?m[1]:'';}

const CPU_BRAIN_MAX_STRATEGIES=32;
const CPU_BRAIN_MAX_CANDIDATES=16;
const CPU_BRAIN_MAX_BYTES=32768;
const CPU_ACTIONS=new Set(['attack','evade','resource','scatter']);
function safeCpuContext(v){
  const s=String(v||'');
  return s==='open3'||/^a[012]-s[01]-d[012]-e[01]$/.test(s)?s:'';
}
function normalizeCpuBrain(raw){
  const brain=raw&&typeof raw==='object'?raw:{};
  const out={version:Math.max(1,Number(brain.version)||1),strategies:[],candidates:[]};
  for(const src of Array.isArray(brain.strategies)?brain.strategies:[]){
    const context=safeCpuContext(src&&src.context),action=String(src&&src.action||'');
    if(!context||!CPU_ACTIONS.has(action))continue;
    const samples=Math.max(1,Math.min(100000,Math.round(Number(src.samples)||1)));
    const total=Math.max(-200000,Math.min(200000,Number(src.total)||0));
    out.strategies.push({context,action,samples,total});
    if(out.strategies.length>=CPU_BRAIN_MAX_STRATEGIES)break;
  }
  for(const src of Array.isArray(brain.candidates)?brain.candidates:[]){
    const context=safeCpuContext(src&&src.context),action=String(src&&src.action||'');
    if(!context||!CPU_ACTIONS.has(action))continue;
    const samples=Math.max(1,Math.min(1000,Math.round(Number(src.samples)||1)));
    const total=Math.max(-2000,Math.min(2000,Number(src.total)||0));
    out.candidates.push({context,action,samples,total});
    if(out.candidates.length>=CPU_BRAIN_MAX_CANDIDATES)break;
  }
  return out;
}
function cpuEntryScore(e){return e&&e.samples?e.total/e.samples:0;}
function mergeCpuBrain(rawBrain,deltas){
  const brain=normalizeCpuBrain(rawBrain);
  const valid=(Array.isArray(deltas)?deltas:[]).slice(0,24);
  for(const d of valid){
    const context=safeCpuContext(d&&d.context),action=String(d&&d.action||'');
    if(!context||!CPU_ACTIONS.has(action))continue;
    const reward=Math.max(-2,Math.min(2,Number(d.reward)||0));
    const uses=Math.max(1,Math.min(4,Math.round(Number(d.uses)||1)));
    let e=brain.strategies.find(x=>x.context===context&&x.action===action);
    if(e){
      e.samples=Math.min(100000,e.samples+uses);e.total=Math.max(-200000,Math.min(200000,e.total+reward*uses));
      continue;
    }
    if(brain.strategies.length<CPU_BRAIN_MAX_STRATEGIES){
      brain.strategies.push({context,action,samples:uses,total:reward*uses});
      continue;
    }
    let c=brain.candidates.find(x=>x.context===context&&x.action===action);
    if(!c){
      if(brain.candidates.length>=CPU_BRAIN_MAX_CANDIDATES){
        brain.candidates.sort((a,b)=>a.samples-b.samples||cpuEntryScore(a)-cpuEntryScore(b));
        brain.candidates.shift();
      }
      c={context,action,samples:0,total:0};brain.candidates.push(c);
    }
    c.samples=Math.min(1000,c.samples+uses);c.total+=reward*uses;
    if(c.samples>=5){
      let worstIndex=0,worstScore=Infinity;
      for(let i=0;i<brain.strategies.length;i++){
        const x=brain.strategies[i];
        const score=cpuEntryScore(x)-(Math.min(5,x.samples)<5?.18:0);
        if(score<worstScore){worstScore=score;worstIndex=i;}
      }
      const candidateScore=cpuEntryScore(c);
      if(candidateScore>worstScore+.15){
        brain.strategies[worstIndex]={context:c.context,action:c.action,samples:c.samples,total:c.total};
        brain.candidates=brain.candidates.filter(x=>x!==c);
      }
    }
  }
  brain.version=Math.max(1,Number(brain.version)||1)+1;
  while(Buffer.byteLength(JSON.stringify(brain),'utf8')>CPU_BRAIN_MAX_BYTES&&brain.candidates.length)brain.candidates.shift();
  while(Buffer.byteLength(JSON.stringify(brain),'utf8')>CPU_BRAIN_MAX_BYTES&&brain.strategies.length>8)brain.strategies.shift();
  return brain;
}

async function authApi(req,res,url){
  if(!db){sendJson(res,503,{ok:false,code:'DB_NOT_CONFIGURED',message:'Cuentas aun no configuradas en el servidor.'});return true;}
  if(!await ensureDatabase()){sendJson(res,503,{ok:false,code:'DB_UNAVAILABLE',message:'Servicio de cuentas no disponible.'});return true;}

  if(url==='/api/auth/register'&&req.method==='POST'){
    let body;try{body=await readJsonBody(req);}catch(_){sendJson(res,400,{ok:false,code:'BAD_REQUEST'});return true;}
    const username=normalizeUsername(body.username),email=normalizeEmail(body.email),password=String(body.password||'');
    if(!validRegisteredUsername(username)){sendJson(res,400,{ok:false,code:'BAD_USERNAME',message:'Nombre de 2 a 16 caracteres: letras, numeros, espacio, _ o -.'});return true;}
    if(!validEmail(email)){sendJson(res,400,{ok:false,code:'BAD_EMAIL',message:'Correo no valido.'});return true;}
    if(password.length<PASSWORD_MIN_LENGTH||password.length>128){sendJson(res,400,{ok:false,code:'BAD_PASSWORD',message:`La clave debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`});return true;}
    const pw=await hashPassword(password);
    try{
      const {rows}=await db.query(`INSERT INTO galaxy_users(username,username_key,email,email_key,password_salt,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,username,email`,[username,usernameKey(username),email,email,pw.salt,pw.hash]);
      const user=rows[0];const token=await createSession(user.id);
      sendJson(res,201,{ok:true,token,user:{id:Number(user.id),username:user.username,email:user.email}});
    }catch(err){
      if(err&&err.code==='23505'){
        const detail=String(err.constraint||err.detail||'');const code=detail.includes('email')?'EMAIL_TAKEN':'USERNAME_TAKEN';
        sendJson(res,409,{ok:false,code,message:code==='EMAIL_TAKEN'?'Ese correo ya esta registrado.':'Ese nombre ya esta registrado.'});
      }else{console.error(err);sendJson(res,500,{ok:false,code:'SERVER_ERROR'});}
    }
    return true;
  }
  if(url==='/api/auth/login'&&req.method==='POST'){
    let body;try{body=await readJsonBody(req);}catch(_){sendJson(res,400,{ok:false,code:'BAD_REQUEST'});return true;}
    const key=usernameKey(body.username),password=String(body.password||'');
    const {rows}=await db.query('SELECT id,username,email,password_salt,password_hash FROM galaxy_users WHERE username_key=$1 LIMIT 1',[key]);
    const user=rows[0];
    if(!user||!await verifyPassword(password,user.password_salt,user.password_hash)){sendJson(res,401,{ok:false,code:'INVALID_LOGIN',message:'Nombre o clave incorrectos.'});return true;}
    const token=await createSession(user.id);
    sendJson(res,200,{ok:true,token,user:{id:Number(user.id),username:user.username,email:user.email}});return true;
  }
  if(url==='/api/auth/logout'&&req.method==='POST'){
    const token=bearerToken(req);if(token)await db.query('DELETE FROM galaxy_sessions WHERE token_hash=$1',[tokenHash(token)]);
    sendJson(res,200,{ok:true});return true;
  }
  if(url==='/api/auth/me'&&req.method==='GET'){
    const user=await userFromSessionToken(bearerToken(req));
    if(!user){sendJson(res,401,{ok:false,code:'UNAUTHORIZED'});return true;}
    sendJson(res,200,{ok:true,user:{id:Number(user.id),username:user.username,email:user.email}});return true;
  }
  if(url==='/api/cpu-brain'&&req.method==='GET'){
    const {rows}=await db.query('SELECT version,brain,updated_at FROM galaxy_cpu_brain WHERE id=1 LIMIT 1');
    const row=rows[0]||{version:1,brain:{version:1,strategies:[],candidates:[]},updated_at:null};
    const brain=normalizeCpuBrain(row.brain);
    sendJson(res,200,{ok:true,version:Number(row.version)||1,brain:{version:brain.version,strategies:brain.strategies}});
    return true;
  }
  if(url==='/api/cpu-brain/learn'&&req.method==='POST'){
    let body;try{body=await readJsonBody(req,16384);}catch(_){sendJson(res,400,{ok:false,code:'BAD_REQUEST'});return true;}
    const deltas=Array.isArray(body&&body.deltas)?body.deltas:[];
    const client=await db.connect();
    try{
      await client.query('BEGIN');
      const {rows}=await client.query('SELECT version,brain FROM galaxy_cpu_brain WHERE id=1 FOR UPDATE');
      const current=rows[0]||{version:1,brain:{version:1,strategies:[],candidates:[]}};
      const brain=mergeCpuBrain(current.brain,deltas);
      const bytes=Buffer.byteLength(JSON.stringify(brain),'utf8');
      await client.query('UPDATE galaxy_cpu_brain SET version=$1,brain=$2::jsonb,updated_at=NOW() WHERE id=1',[brain.version,JSON.stringify(brain)]);
      await client.query('COMMIT');
      sendJson(res,200,{ok:true,version:brain.version,strategies:brain.strategies.length,bytes});
    }catch(err){
      try{await client.query('ROLLBACK');}catch(_){}
      console.error('[Galaxy Combat P2P] Error actualizando CPU brain:',err&&err.message||err);
      sendJson(res,500,{ok:false,code:'CPU_BRAIN_ERROR'});
    }finally{client.release();}
    return true;
  }
  if(url==='/api/ranking'&&req.method==='GET'){
    const {rows}=await db.query(`
      WITH stats AS (
        SELECT u.id,u.username,COUNT(DISTINCT mp.match_id)::int AS played,COUNT(DISTINCT CASE WHEN m.winner_user_id=u.id THEN m.match_id END)::int AS wins
        FROM galaxy_users u LEFT JOIN galaxy_ranked_match_players mp ON mp.user_id=u.id LEFT JOIN galaxy_ranked_matches m ON m.match_id=mp.match_id
        GROUP BY u.id,u.username
      ), strength AS (
        SELECT m.winner_user_id AS id,COALESCE(SUM(opponent_stats.wins),0)::bigint AS opponent_strength
        FROM galaxy_ranked_matches m JOIN galaxy_ranked_match_players opp ON opp.match_id=m.match_id AND opp.user_id<>m.winner_user_id
        JOIN stats opponent_stats ON opponent_stats.id=opp.user_id GROUP BY m.winner_user_id
      ), ranked AS (
        SELECT s.id,s.username,s.played,s.wins,(s.played-s.wins) AS losses,COALESCE(st.opponent_strength,0) AS opponent_strength,
        ROW_NUMBER() OVER (ORDER BY s.wins DESC,COALESCE(st.opponent_strength,0) DESC,(s.played-s.wins) ASC,s.id ASC)::int AS position
        FROM stats s LEFT JOIN strength st ON st.id=s.id
      ) SELECT position,username,played,wins,losses FROM ranked ORDER BY position ASC LIMIT 100`);
    sendJson(res,200,{ok:true,ranking:rows});return true;
  }
  if(url==='/api/ranking/me'&&req.method==='GET'){
    const user=await userFromSessionToken(bearerToken(req));
    if(!user){sendJson(res,401,{ok:false,code:'UNAUTHORIZED'});return true;}
    const {rows}=await db.query(`
      WITH stats AS (
        SELECT u.id,COUNT(DISTINCT mp.match_id)::int AS played,COUNT(DISTINCT CASE WHEN m.winner_user_id=u.id THEN m.match_id END)::int AS wins
        FROM galaxy_users u LEFT JOIN galaxy_ranked_match_players mp ON mp.user_id=u.id LEFT JOIN galaxy_ranked_matches m ON m.match_id=mp.match_id GROUP BY u.id
      ), strength AS (
        SELECT m.winner_user_id AS id,COALESCE(SUM(opponent_stats.wins),0)::bigint AS opponent_strength
        FROM galaxy_ranked_matches m JOIN galaxy_ranked_match_players opp ON opp.match_id=m.match_id AND opp.user_id<>m.winner_user_id
        JOIN stats opponent_stats ON opponent_stats.id=opp.user_id GROUP BY m.winner_user_id
      ), ranked AS (
        SELECT s.id,s.played,s.wins,(s.played-s.wins) AS losses,COALESCE(st.opponent_strength,0) AS opponent_strength,
        ROW_NUMBER() OVER (ORDER BY s.wins DESC,COALESCE(st.opponent_strength,0) DESC,(s.played-s.wins) ASC,s.id ASC)::int AS position
        FROM stats s LEFT JOIN strength st ON st.id=s.id
      ) SELECT played,wins,losses,position FROM ranked WHERE id=$1`,[user.id]);
    sendJson(res,200,{ok:true,ranking:rows[0]||{played:0,wins:0,losses:0,position:1}});return true;
  }
  if(url==='/api/rank-result'&&req.method==='POST'){
    const user=await userFromSessionToken(bearerToken(req));
    if(!user){sendJson(res,401,{ok:false,code:'UNAUTHORIZED'});return true;}
    let body;try{body=await readJsonBody(req);}catch(_){sendJson(res,400,{ok:false,code:'BAD_REQUEST'});return true;}
    const code=String(body.roomCode||'').trim().toUpperCase();
    const winnerIndex=Number(body.winnerIndex);
    const room=rooms.get(code);
    if(!room||!room.started){sendJson(res,404,{ok:false,code:'ROOM_NOT_FOUND'});return true;}
    const host=room.players.find(p=>p.i===0);
    if(!host||Number(host.userId)!==Number(user.id)){sendJson(res,403,{ok:false,code:'HOST_REQUIRED'});return true;}
    const winner=room.players.find(p=>p.i===winnerIndex);
    if(!winner){sendJson(res,400,{ok:false,code:'BAD_WINNER'});return true;}
    room.rankEligible=room.players.length>=2&&room.players.every(p=>p.registered&&p.userId);
    if(!room.rankEligible){sendJson(res,200,{ok:true,ranked:false,reason:'NOT_ALL_REGISTERED'});return true;}
    const recorded=await recordRankedMatch(room,winner);
    sendJson(res,200,{ok:true,ranked:!!recorded});return true;
  }
  return false;
}

function rtcIceServers(){
  const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
  const rawUrls=String(process.env.TURN_URLS||process.env.TURN_URL||'').trim();
  const username=String(process.env.TURN_USERNAME||'').trim();
  const credential=String(process.env.TURN_CREDENTIAL||'').trim();
  if(rawUrls&&username&&credential){const urls=rawUrls.split(',').map(x=>x.trim()).filter(Boolean);if(urls.length)iceServers.push({urls:urls.length===1?urls[0]:urls,username,credential});}
  return iceServers;
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=(req.url||'/').split('?')[0];
  try{if(url.startsWith('/api/')&&await authApi(req,res,url))return;}
  catch(err){console.error('[Galaxy Combat P2P] API error:',err);sendJson(res,500,{ok:false,code:'SERVER_ERROR'});return;}
  if(url==='/health'){sendJson(res,200,{ok:true,service:'Galaxy Combat P2P signaling',accounts:!!db,rooms:rooms.size});return;}
  if(url==='/rtc-config'){sendJson(res,200,{iceServers:rtcIceServers()});return;}
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});
  res.end('Galaxy Combat P2P signaling server online. Physics run on the host browser.\n');
});

const wss=new WebSocketServer({server,path:'/ws',perMessageDeflate:false});

wss.on('connection',ws=>{
  send(ws,{t:'hello',p2p:true,accounts:!!db});
  send(ws,{t:'public-rooms',rooms:publicRooms()});

  ws.on('message',async raw=>{
    let m;try{m=JSON.parse(String(raw));}catch(_){return;}

    if(m.t==='create'){
      const identity=await resolvePlayerIdentity(m);
      if(identity.error){send(ws,{t:'error',message:identity.error});return;}
      const r={code:roomCode(),public:!!m.public,lang:String(m.lang||'es'),started:false,players:[],rankEligible:false,rankRecorded:false,rankMatchId:null};
      const p={i:0,n:identity.name,ws,userId:identity.userId,registered:identity.registered};
      r.players.push(p);rooms.set(r.code,r);info.set(ws,{code:r.code,i:0});
      send(ws,{t:'created',code:r.code,index:0,public:r.public,playerToken:'',registered:p.registered,p2p:true});
      broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:false});publicUpdate(wss);return;
    }

    if(m.t==='join'){
      const r=rooms.get(String(m.code||'').trim().toUpperCase());
      if(!r||r.started||r.players.length>=MAX_PLAYERS){send(ws,{t:'error',message:'Sala no disponible.'});return;}
      const identity=await resolvePlayerIdentity(m);
      if(identity.error){send(ws,{t:'error',message:identity.error});return;}
      const used=new Set(r.players.map(p=>p.i));let i=0;while(used.has(i))i++;
      const p={i,n:identity.name,ws,userId:identity.userId,registered:identity.registered};
      r.players.push(p);info.set(ws,{code:r.code,i});
      send(ws,{t:'joined',code:r.code,index:i,public:r.public,playerToken:'',registered:p.registered,p2p:true});
      broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:r.players.length>1});publicUpdate(wss);return;
    }

    const x=info.get(ws),r=x&&rooms.get(x.code);if(!r)return;

    if(m.t==='start'&&x.i===0&&r.players.length>1&&!r.started){
      r.started=true;r.rankRecorded=false;r.rankMatchId=randomBytes(24).toString('hex');
      r.rankEligible=r.players.length>=2&&r.players.every(p=>p.registered&&p.userId);
      broadcast(r,{t:'start',code:r.code,players:roster(r),p2p:true,rankEligible:r.rankEligible});publicUpdate(wss);return;
    }

    if(['p2p-offer','p2p-answer','p2p-ice'].includes(m.t)){
      const to=Number(m.to),target=r.players.find(p=>p.i===to);if(target)send(target.ws,{t:m.t,from:x.i,data:m.data});return;
    }
    if(m.t==='chat'&&!r.started){
      const text=String(m.text||'').trim().slice(0,120);if(text)broadcast(r,{t:'chat',i:x.i,n:r.players.find(p=>p.i===x.i)?.n||'JUGADOR',text});return;
    }
    if(m.t==='voice-ready'){
      send(ws,{t:'voice-peers',peers:r.players.filter(p=>p.i!==x.i).map(p=>p.i)});for(const p of r.players)if(p.i!==x.i)send(p.ws,{t:'voice-ready',from:x.i});return;
    }
    if(['voice-offer','voice-answer','voice-ice'].includes(m.t)){
      const to=Number(m.to),target=r.players.find(p=>p.i===to);if(target)send(target.ws,{t:m.t,from:x.i,data:m.data});return;
    }
    if(m.t==='voice-talking'||m.t==='voice-offline'){
      for(const p of r.players)if(p.i!==x.i)send(p.ws,{t:m.t,from:x.i,on:!!m.on});return;
    }
    if(m.t==='public-rooms'){send(ws,{t:'public-rooms',rooms:publicRooms()});return;}
    if(m.t==='leave'){remove(ws,wss);return;}
  });

  ws.on('close',()=>remove(ws,wss));
});

server.listen(PORT,'0.0.0.0',async()=>{
  console.log('Galaxy Combat P2P signaling on '+PORT);
  if(db)await ensureDatabase();
  else console.log('[Galaxy Combat P2P] DATABASE_URL no configurada: cuentas desactivadas hasta anadirla en Render.');
});
