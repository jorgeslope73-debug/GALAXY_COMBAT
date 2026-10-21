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
const relay=vm.createContext({info:new WeakMap(),rooms:new Map(),PROTOCOL});
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
console.log('Red OK: orden, reconexion, cambio de host, fallback y congestion.');
