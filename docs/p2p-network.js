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
      this.iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];
    }
    setIceServers(servers){if(Array.isArray(servers)&&servers.length)this.iceServers=servers;}
    configure({myIndex,isHost,players}={}){
      this.myIndex=Number(myIndex);this.isHost=!!isHost;this.players=Array.isArray(players)?players.slice():[];
      if(this.isHost)this.ensureHostPeers();
    }
    updatePlayers(players){this.players=Array.isArray(players)?players.slice():[];if(this.isHost)this.ensureHostPeers();}
    async ensureHostPeers(){
      for(const p of this.players){
        const i=Number(p&&p.i);
        if(Number.isInteger(i)&&i!==this.myIndex&&!this.peers.has(i))await this.createPeer(i,true);
      }
    }
    makePc(peerIndex){
      const pc=new RTCPeerConnection({iceServers:this.iceServers});
      const rec={pc,dc:null,open:false,pendingIce:[]};this.peers.set(peerIndex,rec);
      pc.onicecandidate=e=>{if(e.candidate)this.sendSignal({t:'p2p-ice',to:peerIndex,data:e.candidate});};
      pc.onconnectionstatechange=()=>{const ok=pc.connectionState==='connected';rec.open=ok&&!!(rec.dc&&rec.dc.readyState==='open');this.onPeerState(peerIndex,pc.connectionState);};
      pc.ondatachannel=e=>this.bindChannel(peerIndex,e.channel);
      return rec;
    }
    bindChannel(peerIndex,dc){
      const rec=this.peers.get(peerIndex)||this.makePc(peerIndex);rec.dc=dc;
      dc.binaryType='arraybuffer';
      dc.onopen=()=>{rec.open=true;this.onPeerState(peerIndex,'open');};
      dc.onclose=()=>{rec.open=false;this.onPeerState(peerIndex,'closed');};
      dc.onerror=()=>{};
      dc.onmessage=e=>{
        let m;try{m=JSON.parse(e.data);}catch(_){return;}
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
    async handleSignal(m){
      const from=Number(m&&m.from);if(!Number.isInteger(from)||from===this.myIndex)return false;
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
    broadcastState(state){
      if(!this.isHost)return;
      const raw=JSON.stringify({t:'state',state});
      for(const rec of this.peers.values()){
        if(rec.dc&&rec.dc.readyState==='open'&&rec.dc.bufferedAmount<128*1024){
          try{rec.dc.send(raw);}catch(_){}
        }
      }
    }
    broadcastEvent(event){
      if(!this.isHost)return;
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
      for(const rec of this.peers.values()){
        try{rec.dc&&rec.dc.close();}catch(_){}
        try{rec.pc.close();}catch(_){}
      }
      this.peers.clear();
    }
  }
  window.GalaxyP2P=GalaxyP2P;
})();
