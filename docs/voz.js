'use strict';
(() => {
  const tr=(key,vars)=>window.GalaxyI18n?window.GalaxyI18n.t(key,vars):key;
  const DEFAULT_ICE_SERVERS = [
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'}
  ];
  const SIGNAL_TYPES = new Set([
    'voice-ready','voice-peers','voice-offline','voice-left',
    'voice-offer','voice-answer','voice-ice','voice-talking'
  ]);

  function isEditableTarget(target){
    if(!target)return false;
    const tag=(target.tagName||'').toUpperCase();
    return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||target.isContentEditable;
  }

  class GalaxyVoice {
    constructor({send,isMobile=false}={}){
      this.send=typeof send==='function'?send:()=>false;
      this.isMobile=!!isMobile;
      this.enabled=false;
      this.enabling=false;
      this.localStream=null;
      this.localTrack=null;
      this.localIndex=null;
      this.roomCode='';
      this.cpuMode=false;
      this.peers=new Map();
      this.readyPeers=new Set();
      this.peerPlayers=new Set();
      this.remoteAudio=new Map();
      this.offerBusy=new Set();
      this.pendingIce=new Map();
      this.keyVDown=false;
      this.talking=false;
      this.remoteTalking=new Set();

      this.enableButton=document.getElementById('enableVoice');
      this.statusEl=document.getElementById('voiceStatus');
      this.activationTipEl=document.getElementById('voiceActivationTip');
      this.activationTipTimer=null;
      this.pttButton=document.getElementById('voicePtt');
      this.hintEl=document.getElementById('voiceHint');
      this.talkerEl=document.getElementById('voiceTalker');

      this.bindUI();
      this.refreshUI();
      window.addEventListener('galaxy-languagechange',()=>this.refreshUI());
    }

    bindUI(){
      if(this.enableButton){
        this.enableButton.addEventListener('click',async e=>{
          e.preventDefault();e.stopPropagation();
          if(this.enabled)this.disable();
          else await this.enable();
        });
      }

      if(this.pttButton){
        this.pttButton.addEventListener('pointerdown',async e=>{
          e.preventDefault();e.stopPropagation();
          try{this.pttButton.setPointerCapture?.(e.pointerId);}catch(_){}
          if(!this.enabled){
            const ok=await this.enable();
            if(!ok)return;
          }
          this.setTalking(true);
        },{passive:false});
        const end=e=>{
          e.preventDefault();e.stopPropagation();
          this.setTalking(false);
        };
        this.pttButton.addEventListener('pointerup',end,{passive:false});
        this.pttButton.addEventListener('pointercancel',end,{passive:false});
        this.pttButton.addEventListener('lostpointercapture',()=>this.setTalking(false));
      }

      window.addEventListener('keydown',async e=>{
        if(e.code!=='KeyV'||isEditableTarget(e.target))return;
        if(this.cpuMode)return;
        if(e.repeat){e.preventDefault();return;}
        this.keyVDown=true;
        e.preventDefault();
        if(!this.enabled){
          const ok=await this.enable();
          if(!ok)return;
        }
        if(this.keyVDown)this.setTalking(true);
      });
      window.addEventListener('keyup',e=>{
        if(e.code!=='KeyV')return;
        this.keyVDown=false;
        this.setTalking(false);
      });
      window.addEventListener('blur',()=>{
        this.keyVDown=false;
        this.setTalking(false);
      });
      window.addEventListener('pagehide',()=>this.shutdown(false));
    }

    async enable(){
      if(this.enabled)return true;
      if(this.enabling)return false;
      if(!navigator.mediaDevices||typeof navigator.mediaDevices.getUserMedia!=='function'){
        this.setStatus(tr('microphoneUnavailable'));
        return false;
      }
      this.enabling=true;
      this.setStatus(tr('requestingMicrophone'));
      try{
        const stream=await navigator.mediaDevices.getUserMedia({
          audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
          video:false
        });
        const track=stream.getAudioTracks()[0];
        if(!track)throw new Error('No hay pista de audio');
        track.enabled=false;
        this.localStream=stream;
        this.localTrack=track;
        this.enabled=true;
        track.addEventListener('ended',()=>this.disable(false),{once:true});
        this.setStatus(tr('voiceEnabled'));
        this.refreshUI();
        this.showActivationTip();
        if(this.localIndex!==null&&!this.cpuMode){
          this.send({t:'voice-ready'});
          for(const peer of this.readyPeers)this.maybeOffer(peer);
        }
        return true;
      }catch(err){
        this.setStatus(tr('microphoneDenied'));
        console.warn('[Galaxy Combat Voice] No se pudo abrir el microfono.',err);
        return false;
      }finally{
        this.enabling=false;
        this.refreshUI();
      }
    }

    disable(notify=true){
      this.hideActivationTip();
      this.setTalking(false);
      if(notify&&this.localIndex!==null)this.send({t:'voice-offline'});
      this.enabled=false;
      if(this.localTrack){try{this.localTrack.stop();}catch(_){}}
      if(this.localStream){for(const t of this.localStream.getTracks()){try{t.stop();}catch(_){}}}
      this.localTrack=null;
      this.localStream=null;
      this.closeAllPeers();
      this.setStatus(tr('voiceDisabled'));
      this.refreshUI();
    }

    shutdown(notify=true){
      this.hideActivationTip();
      if(notify&&this.enabled&&this.localIndex!==null)this.send({t:'voice-offline'});
      this.setTalking(false);
      this.closeAllPeers();
      if(this.localStream){for(const t of this.localStream.getTracks()){try{t.stop();}catch(_){}}}
      this.localTrack=null;this.localStream=null;this.enabled=false;
    }

    setSession(code,index,cpuMode=false){
      this.roomCode=String(code||'');
      this.localIndex=Number.isInteger(index)?index:Number(index);
      this.cpuMode=!!cpuMode;
      this.readyPeers.clear();
      this.peerPlayers.clear();
      this.closeAllPeers();
      if(this.enabled&&!this.cpuMode)this.send({t:'voice-ready'});
      this.refreshUI();
    }

    clearSession(){
      if(this.enabled&&this.localIndex!==null)this.send({t:'voice-offline'});
      this.localIndex=null;this.roomCode='';this.cpuMode=false;
      this.readyPeers.clear();this.peerPlayers.clear();this.remoteTalking.clear();
      this.closeAllPeers();
      this.refreshUI();
    }

    syncPlayers(players){
      const valid=new Set();
      for(const p of Array.isArray(players)?players:[]){
        if(!p||p.cpu)continue;
        const i=Number(p.i);
        if(Number.isInteger(i)&&i!==this.localIndex)valid.add(i);
      }
      this.peerPlayers=valid;
      for(const id of [...this.peers.keys()])if(!valid.has(id))this.closePeer(id);
      for(const id of [...this.readyPeers])if(!valid.has(id))this.readyPeers.delete(id);
      for(const id of [...this.remoteTalking])if(!valid.has(id))this.remoteTalking.delete(id);
      this.refreshTalkers();
    }

    isSignal(msg){return !!(msg&&SIGNAL_TYPES.has(msg.t));}

    async handleSignal(msg){
      if(!this.isSignal(msg))return false;
      try{
        if(msg.t==='voice-peers'){
          for(const p of Array.isArray(msg.peers)?msg.peers:[]){
            const id=Number(p);
            if(Number.isInteger(id)&&id!==this.localIndex){this.readyPeers.add(id);this.maybeOffer(id);}
          }
        }else if(msg.t==='voice-ready'){
          const id=Number(msg.from);
          if(Number.isInteger(id)&&id!==this.localIndex){this.readyPeers.add(id);this.maybeOffer(id);}
        }else if(msg.t==='voice-offline'||msg.t==='voice-left'){
          const id=Number(msg.from);
          this.readyPeers.delete(id);this.remoteTalking.delete(id);this.closePeer(id);this.refreshTalkers();
        }else if(msg.t==='voice-offer'){
          await this.acceptOffer(Number(msg.from),msg.data);
        }else if(msg.t==='voice-answer'){
          await this.acceptAnswer(Number(msg.from),msg.data);
        }else if(msg.t==='voice-ice'){
          await this.acceptIce(Number(msg.from),msg.data);
        }else if(msg.t==='voice-talking'){
          const id=Number(msg.from);
          if(msg.on)this.remoteTalking.add(id);else this.remoteTalking.delete(id);
          this.refreshTalkers();
        }
      }catch(err){
        console.warn('[Galaxy Combat Voice] Senal WebRTC ignorada.',msg.t,err);
      }
      return true;
    }

    makePeer(id){
      if(this.peers.has(id))return this.peers.get(id);
      if(!this.enabled||!this.localStream)return null;
      const pc=new RTCPeerConnection({
        iceServers:[
          {urls:'stun:stun.l.google.com:19302'},
          {urls:'stun:stun1.l.google.com:19302'}
        ]
      });
      this.localStream.getTracks().forEach(track=>pc.addTrack(track,this.localStream));
      pc.onicecandidate=e=>{
        if(e.candidate)this.send({t:'voice-ice',to:id,data:e.candidate.toJSON?e.candidate.toJSON():e.candidate});
      };
      pc.ontrack=e=>this.attachRemoteAudio(id,e.streams&&e.streams[0]?e.streams[0]:new MediaStream([e.track]));
      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='failed'||pc.connectionState==='closed')this.closePeer(id);
      };
      this.peers.set(id,pc);
      return pc;
    }

    maybeOffer(id){
      if(!this.enabled||this.localIndex===null||!Number.isInteger(id)||id===this.localIndex)return;
      if(this.localIndex<id)this.makeOffer(id);
    }

    async makeOffer(id){
      if(this.offerBusy.has(id))return;
      const existing=this.peers.get(id);
      if(existing&&['connected','connecting'].includes(existing.connectionState))return;
      const pc=this.makePeer(id);if(!pc)return;
      if(pc.signalingState!=='stable')return;
      this.offerBusy.add(id);
      try{
        const offer=await pc.createOffer({offerToReceiveAudio:true});
        await pc.setLocalDescription(offer);
        this.send({t:'voice-offer',to:id,data:pc.localDescription});
      }finally{this.offerBusy.delete(id);}
    }

    async acceptOffer(id,data){
      if(!this.enabled||!data||!Number.isInteger(id))return;
      this.readyPeers.add(id);
      let pc=this.peers.get(id);
      if(pc&&pc.signalingState!=='stable')this.closePeer(id);
      pc=this.makePeer(id);if(!pc)return;
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      await this.flushPendingIce(id,pc);
      const answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({t:'voice-answer',to:id,data:pc.localDescription});
    }

    async acceptAnswer(id,data){
      const pc=this.peers.get(id);
      if(!pc||!data)return;
      if(pc.signalingState!=='have-local-offer')return;
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      await this.flushPendingIce(id,pc);
    }

    async acceptIce(id,data){
      if(!data||!Number.isInteger(id))return;
      const pc=this.peers.get(id);
      if(!pc||!pc.remoteDescription){
        if(!this.pendingIce.has(id))this.pendingIce.set(id,[]);
        this.pendingIce.get(id).push(data);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(data));
    }

    async flushPendingIce(id,pc){
      const list=this.pendingIce.get(id)||[];
      this.pendingIce.delete(id);
      for(const c of list){try{await pc.addIceCandidate(new RTCIceCandidate(c));}catch(_){} }
    }

    attachRemoteAudio(id,stream){
      let audio=this.remoteAudio.get(id);
      if(!audio){
        audio=document.createElement('audio');
        audio.autoplay=true;audio.playsInline=true;
        audio.dataset.voicePlayer=String(id);
        audio.style.display='none';
        document.body.appendChild(audio);
        this.remoteAudio.set(id,audio);
      }
      if(audio.srcObject!==stream)audio.srcObject=stream;
      const p=audio.play();
      if(p&&typeof p.catch==='function')p.catch(()=>{
        this.setStatus(tr('tapVoiceToHear'));
      });
    }

    closePeer(id){
      const pc=this.peers.get(id);if(pc){try{pc.close();}catch(_){}this.peers.delete(id);}
      const audio=this.remoteAudio.get(id);if(audio){try{audio.pause();audio.srcObject=null;audio.remove();}catch(_){}this.remoteAudio.delete(id);}
      this.pendingIce.delete(id);this.offerBusy.delete(id);
    }

    closeAllPeers(){for(const id of [...this.peers.keys()])this.closePeer(id);}

    setTalking(on){
      on=!!on&&this.enabled&&!!this.localTrack&&this.localIndex!==null;
      if(this.talking===on)return;
      this.talking=on;
      if(this.localTrack)this.localTrack.enabled=on;
      if(this.localIndex!==null)this.send({t:'voice-talking',on});
      this.refreshUI();
    }

    setStatus(text){if(this.statusEl)this.statusEl.textContent=text;}
    showActivationTip(){
      if(this.isMobile||!this.activationTipEl)return;
      clearTimeout(this.activationTipTimer);
      this.activationTipEl.classList.remove('hidden');
      this.activationTipTimer=setTimeout(()=>this.hideActivationTip(),5000);
    }
    hideActivationTip(){
      clearTimeout(this.activationTipTimer);
      this.activationTipTimer=null;
      if(this.activationTipEl)this.activationTipEl.classList.add('hidden');
    }

    refreshTalkers(){
      if(!this.talkerEl)return;
      // Si la voz local no esta habilitada (o estamos contra CPU), no mostramos
      // ningun indicador de voz dentro de la partida.
      if(!this.enabled||this.cpuMode){
        this.talkerEl.textContent='';
        this.talkerEl.classList.add('hidden');
        return;
      }
      const ids=[...this.remoteTalking].sort((a,b)=>a-b);
      if(!ids.length){this.talkerEl.textContent='';this.talkerEl.classList.add('hidden');return;}
      this.talkerEl.textContent=ids.map(i=>tr('talkingPlayer',{index:i+1})).join(' · ');
      this.talkerEl.classList.remove('hidden');
    }

    refreshUI(){
      const inRoom=this.localIndex!==null;
      if(this.enableButton){
        this.enableButton.textContent=this.enabled?tr('voiceActive'):tr('activateVoice');
        this.enableButton.classList.toggle('active',this.enabled);
      }
      if(this.statusEl&&!this.enabling){
        this.statusEl.textContent=this.enabled?tr('voiceEnabled'):tr('voiceDisabled');
      }
      if(this.pttButton){
        const show=this.isMobile&&inRoom&&this.enabled&&!this.cpuMode;
        this.pttButton.classList.toggle('hidden',!show);
        this.pttButton.textContent=this.enabled?tr('talk'):tr('activateVoice');
        this.pttButton.setAttribute('aria-label',this.enabled?tr('holdToTalk'):tr('activateVoice'));
        this.pttButton.title=this.enabled?tr('holdToTalk'):tr('activateVoice');
        this.pttButton.classList.toggle('talking',this.talking);
      }
      if(this.hintEl){
        const show=!this.isMobile&&inRoom&&this.enabled&&!this.cpuMode;
        this.hintEl.classList.toggle('hidden',!show);
        this.hintEl.textContent=this.talking?tr('voiceHintTalking'):tr('voiceHintTalk');
        this.hintEl.classList.toggle('talking',this.talking);
      }
      this.refreshTalkers();
    }
  }

  window.GalaxyVoice=GalaxyVoice;
})();
