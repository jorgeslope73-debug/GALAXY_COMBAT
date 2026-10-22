'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const PROTOCOL=require('../server/net-protocol.js');
const read=p=>fs.readFileSync(p,'utf8');
let raf;
const states=[],events=[];
const context=vm.createContext({
  window:{},console,
  requestAnimationFrame:fn=>{raf=fn;return 1;},
  cancelAnimationFrame:()=>{},setTimeout,clearTimeout
});
vm.runInContext(read('docs/net-protocol.js'),context);
vm.runInContext(read('docs/p2p-network.js'),context);
const net=new context.window.GalaxyP2P({
  onState:s=>states.push(s.seq),onEvent:e=>events.push(e)
});
net.hostIndex=0;
net.seriesId='a'.repeat(32);net.rankRound=1;
function channel(i){
  const dc={label:'galaxy-fast',readyState:'open',close(){}};
  const rec={pc:{connectionState:'connected'},open:true};
  net.peers.set(i,rec);net.bindChannel(i,dc);
  return dc;
}
const host=channel(0);
const packet=seq=>JSON.stringify({t:'state',state:PROTOCOL.stamp(net,{round:1,seq})});
host.onmessage({data:packet(3)});
host.onmessage({data:packet(2)});
raf();
assert.deepEqual(states,[3],'un paquete desordenado no hace retroceder la partida');
host.onmessage({data:JSON.stringify({state:PROTOCOL.stamp(net,{round:1,seq:1}),t:'state'})});
raf();
assert.deepEqual(states,[3],'el orden de las claves JSON no elude el filtro');
const oldCallback=host.onmessage;
const replacement=channel(0);
oldCallback({data:packet(10)});
assert.equal(net.pendingStateRaw,null,'ignorar callbacks de la conexion sustituida');
net.hostIndex=1;
replacement.onmessage({data:packet(11)});
assert.equal(net.pendingStateRaw,null,'ignorar estados del antiguo anfitrion');
const newHost=channel(1);
newHost.onmessage({data:packet(12)});
raf();
assert.deepEqual(states,[3,12]);
net.closed=true;
newHost.onmessage({data:packet(13)});
assert.equal(net.pendingStateRaw,null,'no entregar estados tras cerrar');

// Ejecutar los handlers reales del cliente con ambos transportes simulados.
const game=read('docs/game.js');
const handlers=game.slice(game.indexOf("      if(m&&m.t==='fallback-state'){"),
  game.indexOf("      if(m&&m.t==='fallback-ctrl'){"));
const applied=[];
const client=vm.createContext({
  fallbackActive:false,isHost:false,clientNeedsFallback:()=>false,
  handle:m=>applied.push(m),receiveOnlineEvent:m=>applied.push(m),isCurrentOnlinePacket:()=>true
});
vm.runInContext('function receive(m){'+handlers+'}',client);
client.receive({t:'fallback-event',event:{t:'victory'}});
assert.equal(client.fallbackActive,false,'un evento duplicado no cambia el transporte');
assert.equal(applied.length,1);
client.receive({t:'fallback-state',state:{seq:4}});
assert.equal(applied.length,1,'ignorar estados de respaldo en vuelo con P2P recuperado');
client.clientNeedsFallback=()=>true;
client.receive({t:'fallback-state',state:{seq:5}});
assert.equal(client.fallbackActive,true);
assert.equal(applied.length,2,'el respaldo sigue entrando cuando falla P2P');
client.clientNeedsFallback=()=>false;
client.receive({t:'fallback-state',state:{seq:6}});
assert.equal(applied.length,3,'mantener respaldo hasta completar recuperacion estable');

const server=read('server/p2p-server.js');
const sendSource=server.slice(server.indexOf('function send(ws,o)'),server.indexOf('\n}',server.indexOf('function sendLatestState'))+2);
const relay=vm.createContext({info:new WeakMap(),rooms:new Map(),PROTOCOL,Buffer,WS_MAX_BUFFER_BYTES:512*1024});
vm.runInContext(sendSource,relay);
const sent=[];
const slow={readyState:1,bufferedAmount:65536,send:s=>sent.push(JSON.parse(s))};
const healthy={readyState:1,bufferedAmount:0,send:s=>sent.push(JSON.parse(s))};
for(let seq=1;seq<=100;seq++){
  relay.sendLatestState(slow,{seq});
  relay.sendLatestState(healthy,{seq});
}
assert.equal(sent.length,100,'un cliente lento no acumula estados ni bloquea al sano');
relay.send(slow,{t:'event'});
assert.equal(sent.at(-1).t,'event','los eventos fiables no se descartan');
slow.bufferedAmount=0;
relay.sendLatestState(slow,{seq:101});
assert.equal(sent.at(-1).seq,101,'al recuperarse se envia el estado actual');
// La cola fiable se permite hasta el limite; el exceso retira solo el socket lento.
let terminated=0;
const blocked={readyState:1,bufferedAmount:512*1024,send:()=>assert.fail('cola bloqueada'),terminate(){terminated++;this.readyState=3;}};
relay.send(blocked,{t:'event'});
assert.equal(terminated,1);
relay.send(healthy,{t:'event'});
assert.equal(sent.at(-1).t,'event');

const {serverFixture}=require('./check-session-regressions.js');
const service=serverFixture(),silent=service.connect(),responsive=service.connect();
service.checkSocketHealth();
assert.equal(silent.pings,1);assert.equal(responsive.pings,1);
responsive.emit('pong');service.checkSocketHealth();
assert.equal(silent.readyState,3,'cerrar transporte sin pong');
assert.equal(responsive.readyState,1,'conservar transporte que responde');
responsive.emit('message',Buffer.from(JSON.stringify({t:'ping',at:123.5})));
assert.equal(responsive.last('pong').at,123.5,'eco de reloj monotono para RTT');
responsive.emit('message',Buffer.from(JSON.stringify({t:'ping',at:{invalid:true}})));
assert.equal(Object.hasOwn(responsive.last('pong'),'at'),false,'no reflejar objetos arbitrarios');

// Canales fiables P2P: aislar al peer congestionado sin bloquear a los demas.
const transport=new context.window.GalaxyP2P();
transport.isHost=true;transport.seriesId='a'.repeat(32);transport.rankRound=1;
let fastClosed=0,reliableClosed=0,peerClosed=0,reliableSends=0;
const stuck={open:true,pc:{close(){peerClosed++;}},fastDc:{close(){fastClosed++;}},reliableDc:{readyState:'open',bufferedAmount:256*1024,close(){reliableClosed++;},send(){assert.fail('canal bloqueado');}}};
const good={open:true,pc:{},reliableDc:{readyState:'open',bufferedAmount:0,send(){reliableSends++;}}};
transport.peers.set(1,stuck);transport.peers.set(2,good);
transport.broadcastEvent(PROTOCOL.stamp(transport,{t:'victory',eventId:1,winner:0}));
assert.equal(transport.peers.has(1),false);assert.equal(transport.peers.has(2),true);
assert.equal(fastClosed,1);assert.equal(reliableClosed,1);assert.equal(peerClosed,1);assert.equal(reliableSends,1);

// Reloj simulado: la recuperacion no depende de esperar a close del TCP roto.
const browser=vm.createContext({WebSocket:{OPEN:1,CONNECTING:0},performance:{now:()=>0},ws:null});
vm.runInContext(game.slice(game.indexOf('  function retireSocket('),game.indexOf('  function scheduleReconnect(')),browser);
let closed=0,recovered=0;
const connection={readyState:1,bufferedAmount:0,lastReceiveAt:0,helloReceived:true,heartbeatEnabled:true,send(){},close(){closed++;},onclose(){recovered++;browser.ws=null;}};
browser.ws=connection;browser.checkClientSocketHealth(connection,20000);
assert.equal(recovered,0);
browser.checkClientSocketHealth(connection,26000);
assert.equal(closed,1);assert.equal(recovered,1);
const newSocket={...connection,lastReceiveAt:26000};browser.ws=newSocket;
browser.checkClientSocketHealth(connection,60000);
assert.equal(browser.ws,newSocket,'el watchdog antiguo no retira el socket nuevo');
assert.equal(browser.sendSocketRaw(newSocket,'{}'),true);
newSocket.bufferedAmount=512*1024;
assert.equal(browser.sendSocketRaw(newSocket,'{}'),false);
assert.equal(recovered,2,'la cola llena entra en recuperacion');
const legacy={...connection,heartbeatEnabled:false};browser.ws=legacy;
browser.checkClientSocketHealth(legacy,60000);
assert.equal(browser.ws,legacy,'compatibilidad con servidor anterior sin heartbeat');

// Una accion que no cabe conserva el ID y se reenvia por el respaldo existente.
const {clientFixture}=require('./check-session-regressions.js');
const actionClient=clientFixture().ctx;
actionClient.isHost=false;actionClient.inGame=true;
const actionTransport=new context.window.GalaxyP2P();
Object.assign(actionTransport,{hostIndex:0,hostEpoch:actionClient.hostEpoch,seriesId:actionClient.onlineSeriesId,rankRound:1,inputSessionId:actionClient.inputSessionId});
actionTransport.peers.set(0,{open:true,pc:{close(){}},reliableDc:{readyState:'open',bufferedAmount:256*1024,close(){},send(){assert.fail('accion en cola saturada');}}});
actionClient.p2p=actionTransport;
actionClient.queueInputAction('rocket');
assert.equal(actionClient.pendingInputActions.length,1);
assert.equal(actionClient.pendingInputActions[0].sentAt,null);
const actionId=actionClient.pendingInputActions[0].actionId,forwarded=[];
actionClient.clientNeedsFallback=()=>true;
actionClient.ws={readyState:1,bufferedAmount:0,send:raw=>forwarded.push(JSON.parse(raw))};
actionClient.flushPendingInputActions();
assert.equal(forwarded.length,1);assert.equal(forwarded[0].actionId,actionId);
assert.equal(forwarded[0].t,'fallback-input-action');
actionClient.acknowledgeInputAction(forwarded[0]);
assert.equal(actionClient.pendingInputActions.length,0);
// Los reintentos crecen, quedan acotados y cancelan el temporizador anterior.
let scheduledDelay=0,cancelled=0;
const retries=vm.createContext({reconnectTimer:1,manualClose:false,inGame:false,reconnectFailures:0,
  Math:Object.assign(Object.create(Math),{random:()=>.5}),connect(){},
  clearTimeout(){cancelled++;},setTimeout(fn,delay){scheduledDelay=delay;return 2;}});
vm.runInContext(game.slice(game.indexOf('  function scheduleReconnect('),game.indexOf('  function serverHello(')),retries);
const delays=[];
for(let n=0;n<7;n++){retries.scheduleReconnect();delays.push(scheduledDelay);}
assert.deepEqual(delays,[2200,4400,8800,15000,15000,15000,15000]);
retries.inGame=true;retries.reconnectFailures=0;
const playingDelays=[];
for(let n=0;n<5;n++){retries.scheduleReconnect(500);playingDelays.push(scheduledDelay);}
assert.deepEqual(playingDelays,[500,1000,2000,4000,4000]);
retries.manualClose=true;scheduledDelay=0;retries.scheduleReconnect();
assert.equal(scheduledDelay,0);assert.equal(cancelled,13);

// Perder el foco inhibe tambien mando/sensores, no solo las teclas.
const pumpStart=game.indexOf('  function pumpControls(');
const pumpEnd=game.indexOf('\n  function ',pumpStart+10);
const background=vm.createContext({inputSuspended:true,document:{hidden:false}});
vm.runInContext(game.slice(pumpStart,pumpEnd),background);
assert.doesNotThrow(()=>background.pumpControls(100));
background.inputSuspended=false;background.document.hidden=true;
assert.doesNotThrow(()=>background.pumpControls(200));

let controls=0,healthChecks=0,reconnections=0;
const foreground=vm.createContext({inputSuspended:true,document:{hidden:false,hasFocus:()=>true},
  manualClose:false,ws:{readyState:1,lastReceiveAt:0},WebSocket:{OPEN:1,CONNECTING:0},
  performance:{now:()=>60000},clearHeldKeys(){controls++;},
  checkClientSocketHealth(){healthChecks++;},connect(){reconnections++;},
  reconnectFailures:6,reconnectTimer:4,clearTimeout(){}});
const foregroundStart=game.indexOf('  function recoverForeground(');
vm.runInContext(game.slice(foregroundStart,game.indexOf("  window.addEventListener('blur'",foregroundStart)),foreground);
foreground.recoverForeground();
assert.equal(foreground.inputSuspended,false);assert.equal(foreground.ws.lastReceiveAt,60000);
assert.equal(healthChecks,1);assert.equal(controls,1);
foreground.ws=null;foreground.recoverForeground();
assert.equal(reconnections,1);assert.equal(foreground.reconnectFailures,0);
foreground.ws={readyState:0};foreground.recoverForeground();
assert.equal(reconnections,1,'no duplicar una conexion en curso');
foreground.document.hidden=true;foreground.recoverForeground();
assert.equal(foreground.inputSuspended,true);assert.equal(reconnections,1);
let neutral=0,micOff=0;
const released=vm.createContext({keys:new Set(['KeyW']),lastControlTurn:1,lastControlSentAt:50,
  joystickVoiceHeld:true,voice:{setTalking(value){assert.equal(value,false);micOff++;}},
  inputActionHeld:{rocket:true,flare:true,shock:true},isMobile:false,inGame:true,
  sendControl(...args){assert.deepEqual(args,[0,false,false]);neutral++;}});
const clearStart=game.indexOf('  function clearHeldKeys(');
vm.runInContext(game.slice(clearStart,game.indexOf('  function recoverForeground(',clearStart)),released);
released.clearHeldKeys();
assert.equal(released.keys.size,0);assert.equal(released.lastControlSentAt,0);
assert.equal(released.joystickVoiceHeld,false);assert.equal(micOff,1);assert.equal(neutral,1);
console.log('Red OK: orden, reconexion progresiva, fallback, congestion, heartbeat y segundo plano.');

