'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const PROTOCOL=require('../server/net-protocol.js');
const {onlineRoom,score,clientFixture}=require('./check-session-regressions.js');
const read=p=>fs.readFileSync(p,'utf8');
const noop=()=>{};

function checkContract(){
  assert.equal(read('docs/net-protocol.js'),read('server/net-protocol.js'),'Pages y backend deben usar el mismo contrato');
  const index=read('docs/index.html'),dependency=index.indexOf('src="net-protocol.js?');
  assert.ok(dependency>=0);
  for(const consumer of ['host-physics.js','p2p-network.js','game.js'])assert.ok(index.indexOf('src="'+consumer+'?')>dependency,'cargar el contrato antes de '+consumer);
  assert.ok(read('docs/build-version.js').includes("'net-protocol.js'"));
  assert.ok(read('docs/sw.js').includes("'./net-protocol.js'"));
  const context={seriesId:'a'.repeat(32),hostEpoch:4,rankRound:3};
  const valid=PROTOCOL.stamp(context,{t:'ctrl'});
  assert.equal(PROTOCOL.matches(valid,context),true);
  for(const mutation of [{protocolVersion:1},{seriesId:'b'.repeat(32)},{seriesId:''},{hostEpoch:3},{rankRound:2},{rankRound:4},{rankRound:Infinity}]){
    assert.equal(PROTOCOL.matches({...valid,...mutation},context),false,JSON.stringify(mutation));
  }
  assert.equal(PROTOCOL.matches({...valid,rankRound:4},context,{futureRound:true}),true);
  assert.equal(PROTOCOL.matches({...valid,rankRound:5},context,{futureRound:true}),false);
  assert.equal(PROTOCOL.counter(Infinity,1),false);
  const replay=new PROTOCOL.ReplayWindow(8);
  assert.equal(replay.accept(3),true);assert.equal(replay.accept(2),true);
  assert.equal(replay.accept(3),false);assert.equal(replay.accept(20),true);
  assert.equal(replay.accept(2),false);assert.ok(replay.seen.size<=8);
  const room={started:false,rankRound:1,seriesLastScoredRound:0};
  assert.equal(PROTOCOL.phase(room),'lobby');room.started=true;
  assert.equal(PROTOCOL.phase(room),'playing');room.seriesLastScoredRound=1;
  assert.equal(PROTOCOL.phase(room),'round-finished');room.seriesComplete=true;
  assert.equal(PROTOCOL.phase(room),'series-finished');
}

function makeNet(client){
  const ctx=vm.createContext({window:{},console,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,setTimeout,clearTimeout});
  vm.runInContext(read('docs/net-protocol.js'),ctx);vm.runInContext(read('docs/p2p-network.js'),ctx);
  const net=new ctx.window.GalaxyP2P({
    onControl:(i,m)=>client.ctx.hostPhysics.setControl(i,m.turn,m.thrust,m.fire,m),
    onEvent:m=>m.t==='p2p-input-action'?client.ctx.applyOnlineInputAction(m.from,m):client.ctx.receiveOnlineEvent(m)
  });
  net.configure({myIndex:client.ctx.myIndex,hostIndex:0,...client.ctx.onlineContext(),inputSessionId:client.ctx.inputSessionId,isHost:client.ctx.isHost,players:[]});
  client.ctx.p2p=net;return net;
}

function link(host,guest){
  const wire={dropAck:0,dropAction:false,sent:[]};
  function channel(net,index,label){
    if(!net.peers.has(index))net.peers.set(index,{pc:{connectionState:'connected',close:noop},open:true});
    const dc={label,readyState:'open',bufferedAmount:0,close:noop};
    net.bindChannel(index,dc);return dc;
  }
  const hostFast=channel(host,1,'galaxy-fast'),hostReliable=channel(host,1,'galaxy-reliable');
  const guestFast=channel(guest,0,'galaxy-fast'),guestReliable=channel(guest,0,'galaxy-reliable');
  hostFast.send=raw=>guestFast.onmessage({data:raw});guestFast.send=raw=>hostFast.onmessage({data:raw});
  hostReliable.send=raw=>{
    const packet=JSON.parse(raw);
    if(packet.t==='input-ack'&&wire.dropAck){wire.dropAck--;return;}
    guestReliable.onmessage({data:raw});
  };
  guestReliable.send=raw=>{
    const packet=JSON.parse(raw);wire.sent.push(packet);
    if(!wire.dropAction)hostReliable.onmessage({data:raw});
  };
  return {...wire,get dropAck(){return wire.dropAck;},set dropAck(v){wire.dropAck=v;},get dropAction(){return wire.dropAction;},set dropAction(v){wire.dropAction=v;},hostFast,hostReliable,guestFast,guestReliable};
}

function checkReliableActions(){
  const host=clientFixture(),guest=clientFixture();
  guest.ctx.isHost=false;guest.ctx.myIndex=1;guest.ctx.inputSessionId='2'.repeat(32);
  host.ctx.onlineSeriesRound=guest.ctx.onlineSeriesRound=1;
  const players=[{i:0,n:'Host',inputSessionId:host.ctx.inputSessionId},{i:1,n:'Guest',inputSessionId:guest.ctx.inputSessionId}];
  host.ctx.lobbyPlayers=guest.ctx.lobbyPlayers=players;
  host.ctx.startHostPhysics(players,1);guest.ctx.inGame=true;
  const engine=host.ctx.hostPhysics;
  for(const player of engine.players){player.spawnFx=0;player.protection=10;}
  engine.asteroids=[];
  const human=engine.players[1];human.flare=10;
  let deployments=0;
  engine.deployFlares=()=>{deployments++;return true;};
  const hostNet=makeNet(host),guestNet=makeNet(guest),wire=link(hostNet,guestNet);
  let now=1000;guest.ctx.performance={now:()=>now};
  wire.dropAck=1;
  assert.equal(guest.ctx.queueInputAction('flare'),true);
  assert.equal(guest.ctx.pendingInputActions.length,1,'sin ACK se conserva la misma accion');
  const original=wire.sent.at(-1);
  engine.resetControlSequence(1);
  now+=300;guest.ctx.flushPendingInputActions();
  assert.equal(wire.sent.at(-1).actionId,original.actionId,'el reenvio conserva su identidad');
  assert.equal(guest.ctx.pendingInputActions.length,0,'el ACK del reenvio retira la accion');
  engine.update(1/60);
  assert.equal(deployments,1,'reconectar antes del tick no pierde ni duplica la accion');
  wire.hostReliable.onmessage({data:JSON.stringify(original)});engine.update(1/60);
  assert.equal(deployments,1,'un duplicado tardio no vuelve a desplegar');
  // El paquete viejo no puede limpiar una accion distinta que sigue pendiente.
  wire.dropAction=true;now+=300;guest.ctx.queueInputAction('flare');
  assert.equal(guest.ctx.pendingInputActions.length,1);
  guest.ctx.acknowledgeInputAction(PROTOCOL.stamp(original,{t:'input-ack',kind:'flare',actionId:original.actionId,inputSessionId:original.inputSessionId}));
  assert.equal(guest.ctx.pendingInputActions.length,1);
  now+=2100;guest.ctx.flushPendingInputActions();
  assert.equal(guest.ctx.pendingInputActions.length,0,'las acciones sin entregar caducan');
  now+=300;guest.ctx.queueInputAction('flare');
  const oldRound=wire.sent.at(-1);
  engine.rankRound=2;host.ctx.onlineSeriesRound=guest.ctx.onlineSeriesRound=2;
  hostNet.rankRound=guestNet.rankRound=2;
  guest.ctx.flushPendingInputActions();
  assert.equal(guest.ctx.pendingInputActions.length,0,'no trasladar la cola a otra ronda');
  wire.hostReliable.onmessage({data:JSON.stringify(oldRound)});engine.update(1/60);
  assert.equal(deployments,1);
  wire.dropAction=false;now+=300;guest.ctx.queueInputAction('flare');engine.update(1/60);
  assert.equal(deployments,2,'una accion nueva de la ronda actual funciona');
  // Una recarga cambia el emisor. Rechazar el input anterior aunque su contador sea mayor.
  const oldInput=wire.sent.at(-1);
  wire.hostFast.onmessage({data:JSON.stringify(PROTOCOL.stamp(host.ctx.onlineContext(),{t:'ctrl',controlSeq:100,turn:1,thrust:true,inputSessionId:oldInput.inputSessionId}))});
  assert.equal(engine.controls.get(1).controlSeq,100);
  guest.ctx.inputSessionId='3'.repeat(32);guestNet.inputSessionId=guest.ctx.inputSessionId;
  players[1].inputSessionId=guest.ctx.inputSessionId;engine.syncRoster(players);
  wire.hostReliable.onmessage({data:JSON.stringify({...oldInput,actionId:9999})});
  assert.equal(engine.controls.get(1).flarePulse,false);
  guest.ctx.inputActionSeq.flare=0;now+=300;guest.ctx.queueInputAction('flare');
  assert.equal(engine.controls.get(1).actionIds.flare,1,'la sesion nueva puede empezar por el primer contador');
  const current=engine.controls.get(1);
  wire.hostFast.onmessage({data:JSON.stringify(PROTOCOL.stamp(host.ctx.onlineContext(),{t:'ctrl',controlSeq:999,turn:1,thrust:true,inputSessionId:oldInput.inputSessionId}))});
  assert.equal(current.controlSeq,0,'el movimiento de la pagina antigua tambien se rechaza');
  guestNet.sendControl(1,true,false,{},5);guestNet.sendControl(-1,false,false,{},4);
  assert.equal(current.controlSeq,5);assert.equal(current.turn,1,'el paquete de movimiento atrasado no revierte el actual');
  assert.doesNotThrow(()=>wire.hostReliable.onmessage({data:'null'}));
  // El P2P puede conocer la nueva ronda antes del RAF del cliente: no reinterpretar la cola.
  const previousContext=guest.ctx.onlineContext();guestNet.rankRound=3;
  assert.equal(guestNet.sendInputAction('flare',12,previousContext),false);
  guestNet.rankRound=2;wire.dropAction=true;now+=300;
  guest.ctx.queueInputAction('flare');const delayed=wire.sent.at(-1);
  engine.fxClock=10;
  wire.hostReliable.onmessage({data:JSON.stringify(delayed)});
  assert.equal(guest.ctx.pendingInputActions.length,0,'se confirma el descarte de una entrega caducada');
  assert.equal(engine.controls.get(1).flarePulse,true,'la entrega tardia no altera el pulso nuevo que ya estaba pendiente');
  const registered=engine.controls.get(1).actionIds.flare;
  assert.notEqual(registered,delayed.actionId,'la entrega caducada no se registra para ejecutar');
}

function checkEventDeduplication(){
  const client=clientFixture();client.ctx.isHost=false;client.ctx.onlineSeriesRound=1;
  const net=makeNet(client);
  const rec={pc:{connectionState:'connected'},open:true};net.peers.set(0,rec);
  const reliable={label:'galaxy-reliable',readyState:'open',close:noop};net.bindChannel(0,reliable);
  const event=PROTOCOL.stamp(client.ctx.onlineContext(),{t:'sound',kind:'laser',eventId:1});
  reliable.onmessage({data:JSON.stringify({t:'event',event})});
  client.ctx.receiveOnlineEvent(event); // La misma entrega por respaldo WebSocket.
  assert.equal(client.events.filter(m=>m.t==='sound').length,1);
  const controlPlane=PROTOCOL.stamp(client.ctx.onlineContext(),{t:'start',eventId:2});
  reliable.onmessage({data:JSON.stringify({t:'event',event:controlPlane})});
  assert.equal(client.events.some(m=>m.t==='start'),false,'solo el servidor decide la fase de sala');
  client.ctx.onlineSeriesRound=2;net.rankRound=2;
  assert.equal(client.ctx.receiveOnlineEvent(event),false,'no mostrar una victoria o efecto de otra ronda');
  const next=PROTOCOL.stamp(client.ctx.onlineContext(),{t:'sound',kind:'laser',eventId:1});
  assert.equal(client.ctx.receiveOnlineEvent(next),true,'los identificadores pertenecen a su contexto');
  client.ctx.onlineSeriesId='b'.repeat(32);
  assert.equal(client.ctx.receiveOnlineEvent(next),false,'la serie tambien forma parte de la identidad');
}

async function checkFallbackIsolation(){
  const server=await onlineRoom(),room=server.room(server.code);
  const count=()=>server.host.messages.filter(m=>m.t==='fallback-input-action').length;
  const action={t:'fallback-input-action',kind:'flare',actionId:1,simTime:0};
  await server.receive(server.guest,action);assert.equal(count(),1);
  for(const mutation of [{seriesId:'f'.repeat(32)},{hostEpoch:room.hostEpoch-1},{rankRound:0},{inputSessionId:'f'.repeat(32)},{actionId:Infinity}]){
    await server.receive(server.guest,{...action,...mutation});
    assert.equal(count(),1,'no reenviar acciones ajenas al contexto: '+JSON.stringify(mutation));
  }
  const delivered=server.host.last('fallback-input-action');
  await server.receive(server.host,{...delivered,t:'fallback-input-ack',to:1});
  assert.equal(server.guest.last('input-ack').actionId,1);
  const previousSeries=room.seriesId,previousEpoch=room.hostEpoch;
  await score(server,0);
  assert.equal(server.host.last('series-state').seriesPhase,'round-finished');
  await server.receive(server.host,{t:'rank-restart',fromRound:1,targetRound:2});
  assert.equal(server.guest.last('rank-round').seriesPhase,'playing');
  assert.equal(server.guest.last('rank-round').rankRound,2);
  await server.receive(server.host,{t:'sync-round',rankRound:1});
  assert.equal(server.host.last('round-sync').seriesPhase,'playing');
  assert.equal(server.host.last('round-sync').rankRound,2,'el servidor devuelve su fase aunque el cliente este atrasado');
  await server.receive(server.guest,{...action,rankRound:1});assert.equal(count(),1);
  // Una serie distinta se rechaza incluso si se reutilizan epoca y ronda.
  room.seriesId='e'.repeat(32);
  await server.receive(server.guest,{...action,seriesId:previousSeries,hostEpoch:previousEpoch});assert.equal(count(),1);
  const reply=await server.request('/api/rank-result',{roomCode:server.code,hostToken:server.token,rankRound:2,winnerIndex:0,seriesId:previousSeries});
  assert.equal(reply.body.code,'STALE_CONTEXT');
  const oldClient=server.connect();
  await server.receive(oldClient,{t:'join',code:server.code,name:'Old',clientId:'f'.repeat(32),protocolVersion:1});
  assert.equal(oldClient.last('error').message,'ACTUALIZA EL JUEGO PARA ENTRAR EN ESTA SALA.');
}

async function checkClientRecoveryHelpers(){
  const client=clientFixture(),ctx=client.ctx,game=read('docs/game.js'),sent=[];
  let now=1000;ctx.performance={now:()=>now};
  ctx.criticalServerOpSeq=0;ctx.criticalNextRetryAt=0;
  ctx.sessionStorage={setItem:noop,removeItem:noop,getItem:()=>null};
  ctx.ws={readyState:1,send:raw=>sent.push(JSON.parse(raw))};ctx.onlineSeriesRound=1;
  const start=game.indexOf('  function nextCriticalRequestId(');
  vm.runInContext(game.slice(start,game.indexOf('  function restartOnlineRoundAuthoritatively(',start)),ctx);
  ctx.queueCriticalServerOp({t:'series-round-result',rankRound:1,winnerIndex:0});
  const request=sent[0];assert.ok(request.requestId);
  now+=500;ctx.flushCriticalServerOps();assert.equal(sent.length,1);
  now+=300;ctx.flushCriticalServerOps();assert.equal(sent.length,2);
  assert.equal(sent[1].requestId,request.requestId,'reintentar la misma operacion, no crear otra');
  assert.deepEqual(sent[1],request);
  ctx.acknowledgeCriticalServerOp(request.requestId);now+=1000;ctx.flushCriticalServerOps();
  assert.equal(sent.length,2,'un ACK detiene los reintentos');
  ctx.queueCriticalServerOp({t:'series-round-result',rankRound:1,winnerIndex:0});
  ctx.onlineSeriesId='b'.repeat(32);now+=1000;ctx.flushCriticalServerOps();
  assert.equal(ctx.pendingCriticalServerOps.length,0,'no reenviar operaciones persistidas a otra serie');
  // Un servidor incompatible no habilita botones ni intenta recuperar una sala.
  const hello=game.indexOf('  function serverHello('),ready=[];
  ctx.setServerReady=value=>ready.push(value);ctx.statusEl={textContent:''};ctx.serverWaitText={textContent:''};ctx.trServer=text=>text;ctx.tr=key=>key;
  ctx.loadResumeSession=()=>null;ctx.sharedRoomCode='';ctx.send=m=>sent.push(m);
  vm.runInContext(game.slice(hello,game.indexOf('  function connect(',hello)),ctx);
  const count=sent.length;
  ctx.serverHello({protocolVersion:1});assert.equal(ready.at(-1),false);assert.equal(sent.length,count);
  ctx.serverHello({protocolVersion:2});assert.equal(ready.at(-1),true);assert.equal(sent.at(-1).t,'resume');
  // Recuperar la vista espera sus recursos y cancela el resultado si cambia la autoridad.
  const view=game.indexOf('  async function prepareOnlineView(');
  vm.runInContext(game.slice(view,game.indexOf('  function onlineContext(',view)),ctx);
  let finish;
  ctx.prepareGameAssets=()=>new Promise(resolve=>{finish=resolve;});ctx.inGame=false;ctx.onlineStartPending=false;
  const preparing=ctx.prepareOnlineView(2);
  assert.equal(ctx.onlineStartPending,true);assert.equal(ctx.inGame,false);
  finish();await preparing;assert.equal(ctx.inGame,true);assert.equal(ctx.onlineStartPending,false);
  ctx.inGame=false;
  const stale=ctx.prepareOnlineView(2);ctx.hostEpoch++;
  finish();await stale;assert.equal(ctx.inGame,false);
}

async function main(){
  checkContract();checkReliableActions();checkEventDeduplication();await checkFallbackIsolation();await checkClientRecoveryHelpers();
  console.log('Protocolo OK: contexto compartido, ACK/reenvio sin duplicados, caducidad, sesiones de input, aislamiento de rondas/series y fases autoritativas.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
