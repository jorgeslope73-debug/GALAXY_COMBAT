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
      this.pendingStateRaw=null;this.stateRaf=0;
      this.pendingBroadcastState=null;this.broadcastTimer=0;
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
      for(const p of this.players){
        if(p&&p.cpu)continue;
        const i=Number(p&&p.i);
        if(!Number.isInteger(i)||i===this.myIndex)continue;
        const rec=this.peers.get(i);
        if(rec&&rec.pc&&rec.pc.connectionState!=='closed'&&rec.pc.connectionState!=='failed')continue;
        if(rec)this.closePeer(i);
        await this.createPeer(i,true);
      }
    }
    closePeer(peerIndex){
      const rec=this.peers.get(peerIndex);if(!rec)return;
      this.peers.delete(peerIndex);
      try{rec.dc&&rec.dc.close();}catch(_){}
      try{rec.pc&&rec.pc.close();}catch(_){}
    }
    makePc(peerIndex){
      const pc=new RTCPeerConnection({iceServers:this.iceServers});
      const rec={pc,dc:null,open:false,pendingIce:[]};this.peers.set(peerIndex,rec);
      pc.onicecandidate=e=>{if(e.candidate)this.sendSignal({t:'p2p-ice',to:peerIndex,data:e.candidate});};
      pc.onconnectionstatechange=()=>{
        const state=pc.connectionState,ok=state==='connected';
        rec.open=ok&&!!(rec.dc&&rec.dc.readyState==='open');
        this.onPeerState(peerIndex,state);
        if(this.isHost&&state==='failed'){this.closePeer(peerIndex);this.ensureHostPeers();}
      };
      pc.ondatachannel=e=>this.bindChannel(peerIndex,e.channel);
      return rec;
    }
    flushPendingState(){
      const raw=this.pendingStateRaw;
      if(!raw)return false;
      this.pendingStateRaw=null;
      let m;try{m=JSON.parse(raw);}catch(_){return false;}
      if(!this.isHost&&m&&m.t==='state'){this.onState(m.state);return true;}
      return false;
    }
    queueState(raw){
      this.pendingStateRaw=raw;
      if(this.stateRaf)return;
      this.stateRaf=requestAnimationFrame(()=>{
        this.stateRaf=0;
        this.flushPendingState();
      });
    }
    bindChannel(peerIndex,dc){
      const rec=this.peers.get(peerIndex)||this.makePc(peerIndex);rec.dc=dc;
      dc.binaryType='arraybuffer';
      dc.onopen=()=>{rec.open=true;this.onPeerState(peerIndex,'open');};
      dc.onclose=()=>{rec.open=false;this.onPeerState(peerIndex,'closed');};
      dc.onerror=()=>{};
      dc.onmessage=e=>{
        const raw=typeof e.data==='string'?e.data:String(e.data);
        // El estado es continuo: conservar solo el ultimo paquete recibido
        // hasta el siguiente frame evita parseos en mitad del pintado.
        if(!this.isHost&&raw.startsWith('{"t":"state"')){this.queueState(raw);return;}
        // Los eventos son infrecuentes. Antes de procesarlos aplicamos el
        // ultimo estado pendiente para no desordenar visualmente la secuencia.
        if(this.pendingStateRaw)this.flushPendingState();
        let m;try{m=JSON.parse(raw);}catch(_){return;}
        if(this.isHost&&m.t==='ctrl')this.onControl(peerIndex,m);
        else if(!this.isHost&&m.t==='state')this.onState(m.state);
        else if(!this.isHost&&m.t==='event')this.onEvent(m.event);
        else if(this.isHost&&m.t==='action')this.onEvent({t:'p2p-action',from:peerIndex,action:m.action});
      };
    }
    async createPeer(peerIndex,offerer){
      let rec=this.peers.get(peerIndex);if(!rec)rec=this.makePc(peerIndex);
      if(offerer&&!rec.dc)this.bindChannel(peerIndex,rec.pc.createDataChannel('galaxy',{ordered:false,maxRetransmits:0}));
      if(offerer){
        const offer=await rec.pc.createOffer();
        await rec.pc.setLocalDescription(offer);
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
      if(!this.isHost||!Number.isInteger(i)||i===this.myIndex)return false;
      this.closePeer(i);
      try{await this.createPeer(i,true);return true;}catch(err){console.warn('[Galaxy P2P] reconnect',err);return false;}
    }
    async handleSignal(m){
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
    sendControl(turn,thrust,fire){
      if(this.isHost){this.onControl(this.myIndex,{turn,thrust,fire});return true;}
      const rec=this.peers.get(0)||[...this.peers.values()].find(x=>x.open);
      if(!rec||!rec.dc||rec.dc.readyState!=='open')return false;
      try{rec.dc.send(JSON.stringify({t:'ctrl',turn,thrust:!!thrust,fire:!!fire}));return true;}catch(_){return false;}
    }
    flushBroadcastState(){
      if(!this.isHost||!this.pendingBroadcastState)return false;
      const state=this.pendingBroadcastState;
      this.pendingBroadcastState=null;
      let raw;try{raw=JSON.stringify({t:'state',state});}catch(_){return false;}
      for(const rec of this.peers.values()){
        if(rec.dc&&rec.dc.readyState==='open'&&rec.dc.bufferedAmount<128*1024){
          try{rec.dc.send(raw);}catch(_){}
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
      for(const rec of this.peers.values())if(rec.dc&&rec.dc.readyState==='open'){try{rec.dc.send(raw);}catch(_){}}
    }
    sendAction(action){
      if(this.isHost){this.onEvent({t:'p2p-action',from:this.myIndex,action});return true;}
      const rec=this.peers.get(0)||[...this.peers.values()].find(x=>x.open);
      if(!rec||!rec.dc||rec.dc.readyState!=='open')return false;
      try{rec.dc.send(JSON.stringify({t:'action',action}));return true;}catch(_){return false;}
    }
    close(){
      if(this.stateRaf){cancelAnimationFrame(this.stateRaf);this.stateRaf=0;}
      if(this.broadcastTimer){clearTimeout(this.broadcastTimer);this.broadcastTimer=0;}
      this.pendingStateRaw=null;this.pendingBroadcastState=null;
      for(const rec of this.peers.values()){
        try{rec.dc&&rec.dc.close();}catch(_){}
        try{rec.pc.close();}catch(_){}
      }
      this.peers.clear();
    }
  }
  window.GalaxyP2P=GalaxyP2P;
})();
