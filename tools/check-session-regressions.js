'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const util=require('node:util');
const {EventEmitter}=require('node:events');
const read=p=>fs.readFileSync(p,'utf8');
const game=read('docs/game.js');
const noop=()=>{};

function engineContext(clock={now:1000000}){
  class TestDate extends Date{static now(){return clock.now;}}
  const ctx=vm.createContext({window:{},console,Date:TestDate,performance,setTimeout,clearTimeout});
  for(const file of ['campaign-config','physics-core','host-physics','local-cpu']){
    vm.runInContext(read('docs/'+file+'.js'),ctx,{filename:file+'.js'});
  }
  return ctx;
}

function checkExpiredControls(){
  for(const [name,online] of [['GalaxyHostPhysics',true],['GalaxyLocalCpu',false]]){
    const clock={now:1000000},ctx=engineContext(clock);
    const engine=new ctx.window[name]({});
    if(online)engine.start([{i:0,n:'Human'},{i:1,n:'CPU',cpu:true}]);
    else engine.start('Human');
    const human=engine.players.find(p=>!p.cpu);
    human.spawnFx=0;human.protection=10;
    const control=()=>online?engine.setControl(0,1,true,false):engine.setControl(1,true,false);
    for(let cycle=0;cycle<3;cycle++){
      control();
      engine.update(1/60);
      const heading=human.rot;
      const stored=engine.controls.get(0);
      stored.rocketPulse=stored.flarePulse=stored.shockPulse=true;
      clock.now+=301;
      assert.doesNotThrow(()=>engine.update(1/60),name+': un input caducado no interrumpe el tick');
      assert.equal(human.rot,heading,'el giro caducado queda en reposo');
      assert.equal(human.thrust,false);
      for(const key of ['rocketPulse','flarePulse','shockPulse'])assert.equal(stored[key],false);
      control();engine.update(1/60);
      assert.notEqual(human.rot,heading,'el control vuelve a funcionar tras recuperarse');
    }
  }
}

function serverFixture(){
  let wss;
  class SocketServer extends EventEmitter{
    constructor(){super();this.clients=new Set();wss=this;}
  }
  class Socket extends EventEmitter{
    constructor(){super();this.readyState=1;this.bufferedAmount=0;this.messages=[];}
    send(raw){this.messages.push(JSON.parse(raw));}
    close(){this.readyState=3;this.emit('close');}
    last(type){return this.messages.filter(m=>m.t===type).at(-1);}
  }
  const timers=new Map();let timerId=0;
  const ctx=vm.createContext({
    console:{log:noop,warn:noop,error:noop},Buffer,URL,process:{env:{DATABASE_URL:'postgres://test@localhost/test'}},
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setInterval:noop,
    require:name=>{
      if(name==='http')return {createServer:()=>({listen:noop})};
      if(name==='crypto')return crypto;
      if(name==='util')return util;
      if(name==='pg')return {Pool:class{async query(){return {rows:[],rowCount:0};}}};
      if(name==='ws')return {WebSocketServer:SocketServer};
      throw Error('Dependencia inesperada: '+name);
    }
  });
  vm.runInContext(read('server/p2p-server.js'),ctx,{filename:'p2p-server.js'});
  let connectionId=0;
  const connect=()=>{
    const socket=new Socket();wss.clients.add(socket);
    wss.emit('connection',socket,{headers:{},socket:{remoteAddress:'10.0.0.'+(++connectionId)}});
    return socket;
  };
  const receive=async(socket,message)=>{
    await socket.listeners('message')[0](Buffer.from(JSON.stringify(message)));
  };
  const room=code=>vm.runInContext('rooms.get('+JSON.stringify(code)+')',ctx);
  const request=async(url,body)=>{
    const req=new EventEmitter();req.method='POST';req.headers={};
    const result={};
    const res={writeHead:status=>{result.status=status;},end:raw=>{result.body=JSON.parse(raw);}};
    const done=ctx.authApi(req,res,url);
    await new Promise(setImmediate);
    req.emit('data',Buffer.from(JSON.stringify(body)));req.emit('end');
    await done;return result;
  };
  return {connect,receive,room,timers,request};
}

async function onlineRoom(){
  const server=serverFixture(),host=server.connect(),guest=server.connect();
  await server.receive(host,{t:'create',name:'Host',clientId:'1'.repeat(32)});
  const created=host.last('created');
  await server.receive(guest,{t:'join',name:'Guest',code:created.code,clientId:'2'.repeat(32),slot:1});
  await server.receive(host,{t:'start'});
  return {...server,host,guest,code:created.code,token:created.playerToken};
}

async function score(server,winner=0){
  const room=server.room(server.code);
  await server.receive(server.host,{t:'series-round-result',winnerIndex:winner,rankRound:room.rankRound,hostEpoch:room.hostEpoch,requestId:'score-'+room.rankRound});
}

async function checkRepeatedSeries(){
  const server=await onlineRoom();
  const ctx=vm.createContext({window:{},console,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,setTimeout,clearTimeout});
  vm.runInContext(read('docs/p2p-network.js'),ctx);
  const accepted=[];
  const net=new ctx.window.GalaxyP2P({onState:m=>accepted.push([m.hostEpoch,m.round,m.seq])});
  const configure=()=>net.configure({myIndex:1,hostIndex:0,hostEpoch:server.room(server.code).hostEpoch,isHost:false,players:[]});
  const state=(epoch,round,seq)=>{net.queueState(JSON.stringify({t:'state',state:{hostEpoch:epoch,round,seq}}));net.flushPendingState();};
  for(let series=0;series<3;series++){
    configure();const epoch=net.hostEpoch;
    state(epoch,1,1);assert.deepEqual(accepted.at(-1),[epoch,1,1]);
    state(epoch,5,100);
    for(let round=1;round<=5;round++){
      await score(server);
      if(round<5)await server.receive(server.host,{t:'rank-restart',fromRound:round,targetRound:round+1,hostEpoch:epoch});
    }
    assert.equal(server.room(server.code).seriesComplete,true);
    await server.receive(server.host,{t:'series-continue'});
    await server.receive(server.host,{t:'start'});
    assert.ok(server.room(server.code).hostEpoch>epoch);
    configure();
    const count=accepted.length;
    state(epoch,5,101);assert.equal(accepted.length,count,'descartar estados de la serie anterior');
  }
  configure();state(net.hostEpoch,1,1);
  assert.equal(accepted.at(-1)[1],1,'la siguiente serie entra por P2P desde la primera ronda');
}

function clientFixture(){
  const engines=engineContext(),queued=[],events=[];
  const ui=()=>({classList:{add:noop,remove:noop},textContent:''});
  const ctx=vm.createContext({
    console,isHost:true,hostPhysics:null,hostEpoch:2,roomCode:'TEST',myIndex:0,playerToken:'token',
    inGame:false,lobbyPlayers:[{i:0,n:'Host'},{i:1,n:'Guest'}],cpuFillEnabled:false,
    onlineSeriesComplete:false,onlineSeriesConfirmedRound:0,onlineSeriesRound:0,onlineSeriesScoredRound:0,onlineSessionWins:new Map(),onlineStartGeneration:0,lastRestartedRound:0,
    lastAcceptedStateEpoch:-1,lastAcceptedStateRound:-1,lastAcceptedStateSeq:-1,
    lastP2PStateAt:0,lastFallbackRequestAt:0,lastFallbackStateSentAt:0,fallbackActive:false,p2pStableCount:0,
    fallbackPeers:new Set(),fallbackReconnectAt:new Map(),pendingCriticalServerOps:[],
    p2p:{broadcastEvent:m=>events.push(m)},sendHostFallbackEvent:noop,
    queueCriticalServerOp:m=>{queued.push(m);return true;},persistCriticalServerOps:noop,
    prepareGameAssets:()=>Promise.resolve(),prepareMatchBackground:()=>Promise.resolve(),
    beginGame:()=>{ctx.inGame=true;},handle:m=>events.push(m),queueVictory:i=>events.push({t:'victory',winner:i}),
    resetOnlineStartCountdown:()=>{ctx.onlineStartGeneration++;},
    startHostPhysics:(players,round)=>{
      ctx.hostPhysics=new engines.window.GalaxyHostPhysics({rankRound:round,hostEpoch:ctx.hostEpoch});
      return ctx.hostPhysics.start(players);
    },
    clearGameCanvas:noop,ensureP2P:()=>({configure:noop}),syncVoicePlayers:noop,
    currentVictoryRoster:()=>ctx.lobbyPlayers,onlineSessionPlayerKey:p=>String(p.i),updateOnlineSeriesRoundUi:noop,renderOnlineSessionRanking:noop,
    victory:{classList:{contains:()=>true}},restoreCriticalServerOps:noop,flushCriticalServerOps:noop,
    updateCpuFillButton:noop,saveResumeSession:noop,stopResumeWindow:noop,stopMusic:noop,
    roomCodeEl:ui(),roomMini:ui(),menu:ui(),lobby:ui(),voice:null,
    onlineGoAt:1,onlineStartRankRound:1,activateGameUi:noop,playSound:noop
  });
  const from=game.indexOf('  function restartOnlineRoundAuthoritatively(');
  vm.runInContext(game.slice(from,game.indexOf('  function sendInputAction(',from)),ctx);
  const series=game.indexOf('  function applyOnlineSeriesState(');
  vm.runInContext(game.slice(series,game.indexOf('  function submitOnlineSeriesRound(',series)),ctx);
  const resumed=game.slice(game.indexOf("    else if(m.t==='resumed'){"),game.indexOf("    else if(m.t==='resume-failed'){")).replace('else if','if');
  vm.runInContext('function resume(m){'+resumed+'}',ctx);
  const launch=game.indexOf('  function launchOnlineAfterReady(');
  vm.runInContext(game.slice(launch,game.indexOf('  function prepareMatchBackground(',launch)),ctx);
  return {ctx,queued,events};
}

async function checkConcurrentRestarts(){
  const server=await onlineRoom();await score(server);
  const {ctx,queued}=clientFixture();ctx.hostEpoch=server.room(server.code).hostEpoch;
  ctx.applyOnlineSeriesState({seriesRound:2,seriesLastScoredRound:1,seriesWins:[1,0,0,0]});
  assert.equal(ctx.onlineSeriesConfirmedRound,1,'la ronda en curso no cuenta como resultado confirmado');
  ctx.startHostPhysics(ctx.lobbyPlayers,1);ctx.hostPhysics.finished=true;
  assert.equal(ctx.restartOnlineRoundAuthoritatively(1,ctx.hostEpoch),true);
  assert.equal(ctx.restartOnlineRoundAuthoritatively(1,ctx.hostEpoch),false);
  assert.equal(queued.length,1,'dos peticiones simultaneas generan una sola transicion');
  for(const request of queued)await server.receive(server.host,{...request,hostEpoch:ctx.hostEpoch});
  await server.receive(server.host,{...queued[0],hostEpoch:ctx.hostEpoch});
  assert.equal(server.room(server.code).rankRound,2);
  assert.equal(ctx.hostPhysics.rankRound,2);
  await server.receive(server.host,{t:'rank-restart',fromRound:2,targetRound:3,hostEpoch:ctx.hostEpoch});
  assert.equal(server.room(server.code).rankRound,2,'no avanzar una ronda sin resultado');
  ctx.hostPhysics.finished=true;ctx.onlineSeriesConfirmedRound=2;
  assert.equal(ctx.restartOnlineRoundAuthoritatively(1,ctx.hostEpoch),false,'rechazar una peticion tardia de otra ronda');
  assert.equal(ctx.restartOnlineRoundAuthoritatively(2,ctx.hostEpoch-1),false,'rechazar otra autoridad');
  assert.equal(queued.length,1);
  ctx.hostPhysics.restart=()=>false;
  assert.equal(ctx.restartOnlineRoundAuthoritatively(2,ctx.hostEpoch),false);
  assert.equal(queued.length,1,'un reinicio rechazado no se publica');
}

async function resumeClient(message){
  const client=clientFixture(),ctx=client.ctx;
  let recovery;
  const original=ctx.recoverOnlineRound;
  ctx.recoverOnlineRound=m=>{recovery=original(m);return recovery;};
  ctx.resume(message);
  if(recovery)await recovery;
  return client;
}

async function checkHostRecovery(){
  const server=await onlineRoom();let room=server.room(server.code),epoch=room.hostEpoch;
  server.host.close();
  let replacement=server.connect();
  await server.receive(replacement,{t:'resume',code:server.code,token:server.token,hostSimulationAlive:true});
  assert.equal(replacement.last('resumed').recoverHost,false);
  assert.equal(room.hostEpoch,epoch,'una reconexion no reinicia la fisica viva');
  server.host=replacement;server.host.close();replacement=server.connect();
  await server.receive(replacement,{t:'resume',code:server.code,token:server.token,hostSimulationAlive:false});
  let resumed=replacement.last('resumed');
  assert.equal(resumed.recoverHost,true);assert.equal(resumed.restartRound,true);
  assert.equal(room.hostEpoch,epoch+1);
  assert.equal(server.guest.last('host-migrated').hostEpoch,room.hostEpoch);
  assert.equal(server.guest.last('host-migrated').restartRound,true);
  const running=await resumeClient(resumed);
  assert.ok(running.events.some(m=>m.t==='restarted'&&m.rankRound===1));
  running.ctx.inGame=true;running.ctx.launchOnlineAfterReady();
  assert.ok(running.ctx.hostPhysics&&running.ctx.hostPhysics.started,'la cuenta atras crea el motor perdido');
  assert.equal(running.ctx.hostPhysics.hostEpoch,room.hostEpoch);
  assert.equal(running.ctx.onlineSeriesConfirmedRound,0);
  server.host=replacement;
  const staleRank=await server.request('/api/rank-result',{roomCode:server.code,hostToken:server.token,rankRound:1,winnerIndex:0,hostEpoch:epoch});
  assert.equal(staleRank.status,409,'un resultado HTTP en vuelo tambien pertenece a la autoridad anterior');
  assert.equal(staleRank.body.code,'STALE_HOST');
  await server.receive(server.host,{t:'series-round-result',rankRound:1,winnerIndex:0,hostEpoch:epoch});
  assert.equal(room.seriesLastScoredRound,0,'no contabilizar resultados de antes de la recarga');
  await score(server,1);
  const wins=JSON.stringify(room.seriesWins);
  epoch=room.hostEpoch;server.host.close();replacement=server.connect();
  await server.receive(replacement,{t:'resume',code:server.code,token:server.token,hostSimulationAlive:false});
  resumed=replacement.last('resumed');
  assert.equal(resumed.roundFinished,true);assert.equal(resumed.roundWinner,1);
  assert.equal(resumed.restartRound,false);assert.equal(room.hostEpoch,epoch+1);
  assert.equal(JSON.stringify(room.seriesWins),wins);
  const finished=await resumeClient(resumed);
  assert.equal(finished.ctx.hostPhysics.finished,true);
  assert.equal(finished.ctx.hostPhysics.winner,1);
  assert.equal(finished.ctx.onlineSeriesConfirmedRound,1);
  assert.ok(finished.events.some(m=>m.t==='victory'&&m.winner===1));
  assert.equal(finished.events.filter(m=>m.t==='restarted').length,0,'no repetir la ronda terminada');
  assert.equal(finished.queued.length,0,'restaurar una victoria no vuelve a puntuarla');
  server.host=replacement;
  await server.receive(server.host,{t:'leave'});
  const migration=server.guest.last('host-migrated');
  assert.equal(migration.roundFinished,true);
  assert.equal(migration.restartRound,false,'migrar entre rondas conserva el resultado confirmado');
  assert.equal(migration.roundWinner,1);
  server.host=server.guest;
  await server.receive(server.host,{t:'rank-restart',fromRound:1,targetRound:2,hostEpoch:room.hostEpoch});
  assert.equal(room.rankRound,2,'continuar despues de recuperar una victoria');
}

async function main(){
  let failures=0;
  for(const [name,check] of [['controles humanos',checkExpiredControls],['series repetidas',checkRepeatedSeries],['reinicios simultaneos',checkConcurrentRestarts],['recuperacion del anfitrion',checkHostRecovery]]){
    try{await check();console.log('OK: '+name);}
    catch(error){failures++;console.error('FALLO: '+name);console.error(error);}
  }
  if(failures)throw Error(failures+' grupo(s) de regresion fallan');
  console.log('Sesiones OK: caducidad humana en ambos motores, series repetidas, transiciones unicas y recuperacion del anfitrion.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
