'use strict';
(() => {
  class GalaxyP2P {
    constructor({sendSignal,onControl,onState,onEvent,onPeerState}={}){
      this.sendSignal=sendSignal||(()=>false);
      this.onControl=onControl||(()=>{});
      this.onState=onState||(()=>{});
      this.onEvent=onEvent||(()=>{});
      this.onPeerState=onPeerState||(()=>{});
      this.myIndex=null;this.isHost=false;this.players=[];this.peers=new Map();
      this.pendingStateRaw=null;this.pendingStateRound=-1;this.pendingStateSeq=-1;this.stateRaf=0;
      this.lastStateRound=-1;this.lastStateSeq=-1;
      this.pendingBroadcastState=null;this.broadcastTimer=0;
      // V20.83: una reconexion por peer a la vez. Evita que dos rutas de
      // recuperacion cierren/recreen el mismo RTCPeerConnection simultaneamente.
      this.reconnectingPeers=new Map();this.closed=false;
      this.iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
    }
    setIceServers(servers){if(Array.isArray(servers)&&servers.length)this.iceServers=servers;}
    configure({myIndex,isHost,players}={}){
      this.myIndex=Number(myIndex);this.isHost=!!isHost;this.players=Array.isArray(players)?players.slice():[];
      this.prunePeers();
      if(this.isHost)this.ensureHostPeers();
    }
    updatePlayers(players){
      this.players=Array.isArray(players)?players.slice():[];
      this.prunePeers();
      if(this.isHost)this.ensureHostPeers();
    }
    prunePeers(){
      const allowed=new Set();
      for(const p of this.players){
        if(!p||p.cpu)continue;
        const i=Number(p.i);
        if(Number.isInteger(i)&&i!==this.myIndex)allowed.add(i);
      }
      for(const i of [...this.peers.keys()])if(!allowed.has(i))this.closePeer(i);
    }
    async ensureHostPeers(){
      if(this.closed)return;
      for(const p of this.players){
        if(p&&p.cpu)continue;
        const i=Number(p&&p.i);
        if(!Number.isInteger(i)||i===this.myIndex)continue;
        const rec=this.peers.get(i);
        if(rec&&rec.pc&&rec.pc.connectionState!=='closed'&&rec.pc.connectionState!=='failed')continue;
        // V20.83: toda creacion/recreacion del host pasa por la misma puerta
        // deduplicada. Varias señales simultaneas no pueden abrir dos peers.
        await this.reconnectPeer(i);
      }
    }
    closePeer(peerIndex){
      const rec=this.peers.get(peerIndex);if(!rec)return;
      this.peers.delete(peerIndex);
      try{
        const channels=new Set([rec.fastDc,rec.reliableDc,rec.dc]);
        for(const dc of channels){
          if(!dc)continue;
          dc.onopen=null;dc.onclose=null;dc.onerror=null;dc.onmessage=null;
          dc.close();
        }
      }catch(_){}
      try{
        if(rec.pc){
          rec.pc.onicecandidate=null;rec.pc.onconnectionstatechange=null;rec.pc.ondatachannel=null;
          rec.pc.close();
        }
      }catch(_){}
    }
    makePc(peerIndex){
      if(this.closed)throw new Error('P2P closed');
      const pc=new RTCPeerConnection({iceServers:this.iceServers});
      // V22.15: fast = estado/controles descartables; reliable = eventos/acciones.
      // rec.dc queda como alias del canal fast para compatibilidad con métricas.
      const rec={pc,dc:null,fastDc:null,reliableDc:null,open:false,pendingIce:[]};this.peers.set(peerIndex,rec);
      pc.onicecandidate=e=>{
        if(this.closed||this.peers.get(peerIndex)!==rec)return;
        if(e.candidate)this.sendSignal({t:'p2p-ice',to:peerIndex,data:e.candidate});
      };
      pc.onconnectionstatechange=()=>{
        // Un callback de una conexion antigua nunca puede cerrar la nueva.
        if(this.closed||this.peers.get(peerIndex)!==rec)return;
        const state=pc.connectionState;
        this.updatePeerOpen(peerIndex,rec,state);
        if(this.isHost&&state==='failed'){
          this.closePeer(peerIndex);
          this.ensureHostPeers();
        }
      };
      pc.ondatachannel=e=>{
        if(!this.closed&&this.peers.get(peerIndex)===rec)this.bindChannel(peerIndex,e.channel);
      };
      return rec;
    }
    updatePeerOpen(peerIndex,rec,stateHint=''){
      if(!rec||this.peers.get(peerIndex)!==rec)return false;
      const connected=(stateHint||rec.pc.connectionState)==='connected';
      const fastOpen=!!(rec.fastDc&&rec.fastDc.readyState==='open');
      const reliableOpen=!!(rec.reliableDc&&rec.reliableDc.readyState==='open');
      const next=connected&&fastOpen&&reliableOpen;
      if(rec.open!==next){
        rec.open=next;
        this.onPeerState(peerIndex,next?'open':(stateHint||'closed'));
      }
      return next;
    }
    stateOrderFromRaw(raw){
      if(typeof raw!=='string')return {round:-1,seq:-1};
      const readInt=key=>{
        const marker='\"'+key+'\":';
        const at=raw.indexOf(marker);
        if(at<0)return -1;
        let i=at+marker.length,n=0,found=false;
        while(i<raw.length){
          const c=raw.charCodeAt(i);
          if(c<48||c>57)break;
          found=true;n=n*10+(c-48);i++;
        }
        return found?n:-1;
      };
      return {round:readInt('round'),seq:readInt('seq')};
    }
    isNewerState(round,seq,baseRound,baseSeq){
      if(round<0||seq<0||baseRound<0||baseSeq<0)return true;
      return round>baseRound||(round===baseRound&&seq>baseSeq);
    }
    flushPendingState(){
      const raw=this.pendingStateRaw;
      if(!raw)return false;
      const queuedRound=this.pendingStateRound,queuedSeq=this.pendingStateSeq;
      this.pendingStateRaw=null;this.pendingStateRound=-1;this.pendingStateSeq=-1;
      let m;try{m=JSON.parse(raw);}catch(_){return false;}
      if(!this.isHost&&m&&m.t==='state'){
        const state=m.state||{};
        const round=Number.isInteger(Number(state.round))?Number(state.round):queuedRound;
        const seq=Number.isInteger(Number(state.seq))?Number(state.seq):queuedSeq;
        if(!this.isNewerState(round,seq,this.lastStateRound,this.lastStateSeq))return false;
        if(round>=0&&seq>=0){this.lastStateRound=round;this.lastStateSeq=seq;}
        this.onState(state);return true;
      }
      return false;
    }
    queueState(raw){
      const order=this.stateOrderFromRaw(raw);
      if(order.round>=0&&order.seq>=0){
        if(!this.isNewerState(order.round,order.seq,this.lastStateRound,this.lastStateSeq))return;
        if(this.pendingStateRaw&&!this.isNewerState(order.round,order.seq,this.pendingStateRound,this.pendingStateSeq))return;
        this.pendingStateRound=order.round;this.pendingStateSeq=order.seq;
      }else{
        this.pendingStateRound=-1;this.pendingStateSeq=-1;
      }
      this.pendingStateRaw=raw;
      if(this.stateRaf)return;
      this.stateRaf=requestAnimationFrame(()=>{
        this.stateRaf=0;
        this.flushPendingState();
      });
    }
    bindChannel(peerIndex,dc){
      const rec=this.peers.get(peerIndex)||this.makePc(peerIndex);
      const label=String(dc&&dc.label||'');
      // Compatibilidad transitoria: el antiguo "galaxy" se trata como ambos.
      const legacy=label==='galaxy';
      const reliable=label==='galaxy-reliable';
      const fast=legacy||label==='galaxy-fast'||!reliable;
      if(legacy){
        rec.fastDc=dc;rec.reliableDc=dc;rec.dc=dc;
      }else if(reliable){
        rec.reliableDc=dc;
      }else if(fast){
        rec.fastDc=dc;rec.dc=dc;
      }

      dc.binaryType='arraybuffer';
      dc.onopen=()=>{this.updatePeerOpen(peerIndex,rec,rec.pc.connectionState);};
      dc.onclose=()=>{this.updatePeerOpen(peerIndex,rec,rec.pc.connectionState);};
      dc.onerror=()=>{};
      dc.onmessage=e=>{
        const raw=typeof e.data==='string'?e.data:String(e.data);
        const allowFast=legacy||!reliable;
        const allowReliable=legacy||reliable;

        // Estado continuo: solo canal fast y conservar únicamente el último.
        if(allowFast&&!this.isHost&&raw.startsWith('{"t":"state"')){this.queueState(raw);return;}

        let m;try{m=JSON.parse(raw);}catch(_){return;}
        if(allowFast&&this.isHost&&m.t==='ctrl'){this.onControl(peerIndex,m);return;}
        if(allowFast&&!this.isHost&&m.t==='state'){this.onState(m.state);return;}

        // Eventos/acciones son fiables. Aplicar antes el último estado fast pendiente.
        if(allowReliable&&(m.t==='event'||m.t==='action')&&this.pendingStateRaw)this.flushPendingState();
        if(allowReliable&&!this.isHost&&m.t==='event')this.onEvent(m.event);
        else if(allowReliable&&this.isHost&&m.t==='action')this.onEvent({t:'p2p-action',from:peerIndex,action:m.action});
      };
    }
    async createPeer(peerIndex,offerer){
      if(this.closed)throw new Error('P2P closed');
      let rec=this.peers.get(peerIndex);if(!rec)rec=this.makePc(peerIndex);
      if(offerer&&!rec.fastDc){
        this.bindChannel(peerIndex,rec.pc.createDataChannel('galaxy-fast',{ordered:false,maxRetransmits:0}));
      }
      if(offerer&&!rec.reliableDc){
        this.bindChannel(peerIndex,rec.pc.createDataChannel('galaxy-reliable',{ordered:true}));
      }
      if(offerer){
        const offer=await rec.pc.createOffer();
        if(this.closed||this.peers.get(peerIndex)!==rec)return rec;
        await rec.pc.setLocalDescription(offer);
        if(this.closed||this.peers.get(peerIndex)!==rec)return rec;
        this.sendSignal({t:'p2p-offer',to:peerIndex,data:rec.pc.localDescription});
      }
      return rec;
    }
    async flushPendingIce(rec){
      if(!rec||!rec.pc||!rec.pc.remoteDescription||!rec.pc.remoteDescription.type)return;
      const pending=Array.isArray(rec.pendingIce)?rec.pendingIce.splice(0):[];
      for(const candidate of pending){
        try{await rec.pc.addIceCandidate(candidate);}
        catch(err){console.warn('[Galaxy P2P] ICE pendiente',err);}
      }
    }
    async reconnectPeer(peerIndex){
      const i=Number(peerIndex);
      if(this.closed||!this.isHost||!Number.isInteger(i)||i===this.myIndex)return false;
      const existing=this.reconnectingPeers.get(i);
      if(existing)return existing;
      const task=(async()=>{
        this.closePeer(i);
        if(this.closed)return false;
        try{
          await this.createPeer(i,true);
          if(this.closed){this.closePeer(i);return false;}
          return true;
        }catch(err){
          if(!this.closed)console.warn('[Galaxy P2P] reconnect',err);
          return false;
        }
      })();
      this.reconnectingPeers.set(i,task);
      try{return await task;}
      finally{if(this.reconnectingPeers.get(i)===task)this.reconnectingPeers.delete(i);}
    }
    async handleSignal(m){
      if(this.closed)return false;
      const from=Number(m&&m.from);if(!Number.isInteger(from)||from===this.myIndex)return false;
      if(m.t==='p2p-reconnect')return this.reconnectPeer(from);
      let rec=this.peers.get(from);if(!rec)rec=await this.createPeer(from,false);
      try{
        if(m.t==='p2p-offer'){
          await rec.pc.setRemoteDescription(m.data);
          await this.flushPendingIce(rec);
          const ans=await rec.pc.createAnswer();
          await rec.pc.setLocalDescription(ans);
          this.sendSignal({t:'p2p-answer',to:from,data:rec.pc.localDescription});
          return true;
        }
        if(m.t==='p2p-answer'){
          await rec.pc.setRemoteDescription(m.data);
          await this.flushPendingIce(rec);
          return true;
        }
        if(m.t==='p2p-ice'){
          if(!m.data)return true;
          if(rec.pc.remoteDescription&&rec.pc.remoteDescription.type)await rec.pc.addIceCandidate(m.data);
          else rec.pendingIce.push(m.data);
          return true;
        }
      }catch(err){console.warn('[Galaxy P2P] signaling',err);}
      return false;
    }
    firstOpenPeer(){
      for(const rec of this.peers.values())if(rec&&rec.open)return rec;
      return null;
    }
    sendControl(turn,thrust,fire,actions={}){
      if(this.isHost){this.onControl(this.myIndex,{turn,thrust,fire,...actions});return true;}
      const rec=this.peers.get(0)||this.firstOpenPeer();
      const dc=rec&&rec.fastDc;
      if(!rec||!rec.open||!dc||dc.readyState!=='open')return false;
      // Los controles son efimeros: con cola alta descartamos el antiguo y el
      // siguiente heartbeat enviara el estado mas reciente, evitando input lag.
      if(Number(dc.bufferedAmount||0)>32*1024)return false;
      try{dc.send(JSON.stringify({t:'ctrl',turn,thrust:!!thrust,fire:!!fire,...actions}));return true;}catch(_){return false;}
    }
    flushBroadcastState(){
      if(!this.isHost||!this.pendingBroadcastState)return false;
      const state=this.pendingBroadcastState;
      this.pendingBroadcastState=null;
      let raw;try{raw=JSON.stringify({t:'state',state});}catch(_){return false;}
      for(const rec of this.peers.values()){
        const dc=rec&&rec.fastDc;
        if(rec.open&&dc&&dc.readyState==='open'&&dc.bufferedAmount<128*1024){
          try{dc.send(raw);}catch(_){}
        }
      }
      return true;
    }
    broadcastState(state){
      if(!this.isHost)return;
      // El host puede generar mas de un snapshot al recuperar tiempo perdido.
      // Guardamos solo el ultimo y serializamos fuera del RAF actual, evitando
      // concentrar JSON.stringify + WebRTC justo antes del pintado.
      this.pendingBroadcastState=state;
      if(this.broadcastTimer)return;
      this.broadcastTimer=setTimeout(()=>{
        this.broadcastTimer=0;
        this.flushBroadcastState();
      },0);
    }
    broadcastEvent(event){
      if(!this.isHost)return;
      // Mantener orden: un evento nunca adelanta al ultimo estado pendiente.
      if(this.broadcastTimer){clearTimeout(this.broadcastTimer);this.broadcastTimer=0;}
      this.flushBroadcastState();
      const raw=JSON.stringify({t:'event',event});
      for(const rec of this.peers.values()){
        const dc=rec&&rec.reliableDc;
        if(rec.open&&dc&&dc.readyState==='open'){try{dc.send(raw);}catch(_){}}
      }
    }
    sendAction(action){
      if(this.isHost){this.onEvent({t:'p2p-action',from:this.myIndex,action});return true;}
      const rec=this.peers.get(0)||this.firstOpenPeer();
      const dc=rec&&rec.reliableDc;
      if(!rec||!rec.open||!dc||dc.readyState!=='open')return false;
      try{dc.send(JSON.stringify({t:'action',action}));return true;}catch(_){return false;}
    }
    close(){
      this.closed=true;
      if(this.stateRaf){cancelAnimationFrame(this.stateRaf);this.stateRaf=0;}
      if(this.broadcastTimer){clearTimeout(this.broadcastTimer);this.broadcastTimer=0;}
      this.pendingStateRaw=null;this.pendingStateRound=-1;this.pendingStateSeq=-1;
      this.lastStateRound=-1;this.lastStateSeq=-1;this.pendingBroadcastState=null;
      this.reconnectingPeers.clear();
      for(const rec of this.peers.values()){
        try{
          const channels=new Set([rec.fastDc,rec.reliableDc,rec.dc]);
          for(const dc of channels)if(dc)dc.close();
        }catch(_){}
        try{rec.pc.close();}catch(_){}
      }
      this.peers.clear();
    }
  }
  window.GalaxyP2P=GalaxyP2P;
})();
