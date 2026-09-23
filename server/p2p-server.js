'use strict';

const http=require('http');
const crypto=require('crypto');
const {WebSocketServer}=require('ws');

const PORT=Number(process.env.PORT||8080);
const MAX_PLAYERS=4;
const rooms=new Map();
const info=new WeakMap();

function roomCode(){
  for(;;){
    const c=crypto.randomBytes(3).toString('hex').slice(0,4).toUpperCase();
    if(!rooms.has(c))return c;
  }
}
function safeName(v){
  return String(v||'JUGADOR').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16)||'JUGADOR';
}
function send(ws,o){if(ws&&ws.readyState===1)try{ws.send(JSON.stringify(o));}catch(_){}}
function roster(r){return r.players.map(p=>({i:p.i,n:p.n,cpu:false,registered:false}));}
function broadcast(r,o){for(const p of r.players)send(p.ws,o);}
function publicRooms(){
  return [...rooms.values()]
    .filter(r=>r.public&&!r.started)
    .map(r=>({code:r.code,host:r.players[0]?.n||'JUGADOR',lang:r.lang,players:r.players.length,maxPlayers:MAX_PLAYERS}));
}
function publicUpdate(wss){
  const raw=JSON.stringify({t:'public-rooms',rooms:publicRooms()});
  for(const ws of wss.clients)if(ws.readyState===1)ws.send(raw);
}
function remove(ws,wss){
  const x=info.get(ws);if(!x)return;
  info.delete(ws);
  const r=rooms.get(x.code);if(!r)return;
  const p=r.players.find(p=>p.i===x.i);if(!p)return;
  const host=p.i===0;
  r.players=r.players.filter(q=>q!==p);
  if(host){
    broadcast(r,{t:'closed',reason:'El anfitrión cerró la sala.'});
    rooms.delete(r.code);
  }else{
    broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:r.players.length>1});
  }
  publicUpdate(wss);
}

const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.url==='/health'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,service:'Galaxy Combat P2P signaling',rooms:rooms.size}));
    return;
  }
  if(req.url==='/rtc-config'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'}
    ]}));
    return;
  }
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.end('Galaxy Combat P2P signaling server online. No physics are calculated here.\n');
});

const wss=new WebSocketServer({server,path:'/ws',perMessageDeflate:false});

wss.on('connection',ws=>{
  send(ws,{t:'hello',p2p:true});
  send(ws,{t:'public-rooms',rooms:publicRooms()});

  ws.on('message',raw=>{
    let m;try{m=JSON.parse(String(raw));}catch(_){return;}

    if(m.t==='create'){
      const r={code:roomCode(),public:!!m.public,lang:String(m.lang||'es'),started:false,players:[]};
      const p={i:0,n:safeName(m.name),ws};
      r.players.push(p);rooms.set(r.code,r);info.set(ws,{code:r.code,i:0});
      send(ws,{t:'created',code:r.code,index:0,public:r.public,playerToken:'',registered:false,p2p:true});
      broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:false});
      publicUpdate(wss);
      return;
    }

    if(m.t==='join'){
      const r=rooms.get(String(m.code||'').toUpperCase());
      if(!r||r.started||r.players.length>=MAX_PLAYERS){send(ws,{t:'error',message:'Sala no disponible.'});return;}
      const used=new Set(r.players.map(p=>p.i));let i=0;while(used.has(i))i++;
      const p={i,n:safeName(m.name),ws};
      r.players.push(p);info.set(ws,{code:r.code,i});
      send(ws,{t:'joined',code:r.code,index:i,public:r.public,playerToken:'',registered:false,p2p:true});
      broadcast(r,{t:'lobby',code:r.code,players:roster(r),canStart:r.players.length>1});
      publicUpdate(wss);
      return;
    }

    const x=info.get(ws),r=x&&rooms.get(x.code);
    if(!r)return;

    if(m.t==='start'&&x.i===0&&r.players.length>1&&!r.started){
      r.started=true;
      broadcast(r,{t:'start',code:r.code,players:roster(r),p2p:true});
      publicUpdate(wss);
      return;
    }

    if(['p2p-offer','p2p-answer','p2p-ice'].includes(m.t)){
      const to=Number(m.to),target=r.players.find(p=>p.i===to);
      if(target)send(target.ws,{t:m.t,from:x.i,data:m.data});
      return;
    }

    if(m.t==='chat'&&!r.started){
      const text=String(m.text||'').trim().slice(0,120);
      if(text)broadcast(r,{t:'chat',i:x.i,n:r.players.find(p=>p.i===x.i)?.n||'JUGADOR',text});
      return;
    }

    if(m.t==='voice-ready'){
      send(ws,{t:'voice-peers',peers:r.players.filter(p=>p.i!==x.i).map(p=>p.i)});
      for(const p of r.players)if(p.i!==x.i)send(p.ws,{t:'voice-ready',from:x.i});
      return;
    }

    if(['voice-offer','voice-answer','voice-ice'].includes(m.t)){
      const to=Number(m.to),target=r.players.find(p=>p.i===to);
      if(target)send(target.ws,{t:m.t,from:x.i,data:m.data});
      return;
    }

    if(m.t==='voice-talking'||m.t==='voice-offline'){
      for(const p of r.players)if(p.i!==x.i)send(p.ws,{t:m.t,from:x.i,on:!!m.on});
      return;
    }

    if(m.t==='public-rooms'){send(ws,{t:'public-rooms',rooms:publicRooms()});return;}
    if(m.t==='leave'){remove(ws,wss);return;}
  });

  ws.on('close',()=>remove(ws,wss));
});

server.listen(PORT,'0.0.0.0',()=>console.log('Galaxy Combat P2P signaling on '+PORT));
