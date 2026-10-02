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
      this.captureStream=null;
      this.audioContext=null;
      this.micSource=null;
      this.micGain=null;
      this.micDestination=null;
      this.remoteNodes=new Map();
      this.iceServers=DEFAULT_ICE_SERVERS.slice();
      this.rtcConfigPromise=null;
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
      this.pttTouchActive=false;
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
      window.addEventListener('galaxy-joystickchange',()=>this.refreshUI());
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
        const startTouch=async e=>{
          e.preventDefault();e.stopPropagation();
          this.pttTouchActive=true;
          if(!this.enabled){
            const ok=await this.enable();
            if(!ok||!this.pttTouchActive)return;
          }
          if(this.pttTouchActive)this.setTalking(true);
        };
        const endTouch=e=>{
          if(e){e.preventDefault();e.stopPropagation();}
          this.pttTouchActive=false;
          this.setTalking(false);
        };

        // iPhone/iPad: los Touch Events son la ruta principal del PTT.
        // Evitamos depender de pointer-capture, que Safari/PWA puede perder
        // inmediatamente al coexistir con las zonas táctiles del juego.
        this.pttButton.addEventListener('touchstart',startTouch,{passive:false});
        this.pttButton.addEventListener('touchend',endTouch,{passive:false});
        this.pttButton.addEventListener('touchcancel',endTouch,{passive:false});

        // Ratón/pen y navegadores sin Touch Events.
        this.pttButton.addEventListener('pointerdown',async e=>{
          if(e.pointerType==='touch')return;
          e.preventDefault();e.stopPropagation();
          try{this.pttButton.setPointerCapture?.(e.pointerId);}catch(_){}
          if(!this.enabled){
            const ok=await this.enable();
            if(!ok)return;
          }
          this.setTalking(true);
        },{passive:false});
        const endPointer=e=>{
          if(e.pointerType==='touch')return;
          e.preventDefault();e.stopPropagation();
          this.setTalking(false);
        };
        this.pttButton.addEventListener('pointerup',endPointer,{passive:false});
        this.pttButton.addEventListener('pointercancel',endPointer,{passive:false});
        this.pttButton.addEventListener('lostpointercapture',e=>{
          if(!e||e.pointerType!=='touch')this.setTalking(false);
        });
      }

      // Si el navegador receptor bloquea autoplay, cualquier gesto posterior
      // del jugador vuelve a intentar arrancar los audios remotos.
      const retryRemoteAudio=()=>this.resumeRemoteAudio();
      window.addEventListener('pointerdown',retryRemoteAudio,{passive:true});
      window.addEventListener('touchstart',retryRemoteAudio,{passive:true});
      window.addEventListener('keydown',retryRemoteAudio);

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

    async loadRtcConfig(){
      if(this.rtcConfigPromise)return this.rtcConfigPromise;
      this.rtcConfigPromise=(async()=>{
        try{
          const base=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').replace(/\/$/,'');
          if(!base)return this.iceServers;
          const res=await fetch(base+'/rtc-config',{cache:'no-store'});
          if(!res.ok)throw new Error('HTTP '+res.status);
          const data=await res.json();
          if(Array.isArray(data&&data.iceServers)&&data.iceServers.length){
            this.iceServers=data.iceServers;
          }
        }catch(err){
          console.warn('[Galaxy Combat Voice] RTC config no disponible; se usan STUN por defecto.',err&&err.message||err);
        }
        return this.iceServers;
      })();
      return this.rtcConfigPromise;
    }

    async prepareMobileAudio(capture){
      if(!this.isMobile)return false;
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return false;
      try{
        if(!this.audioContext)this.audioContext=new AudioCtx();
        if(this.audioContext.state==='suspended')await this.audioContext.resume();
        this.micSource=this.audioContext.createMediaStreamSource(capture);
        this.micGain=this.audioContext.createGain();
        this.micGain.gain.value=0;
        this.micDestination=this.audioContext.createMediaStreamDestination();
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.micDestination);
        const outTrack=this.micDestination.stream.getAudioTracks()[0];
        if(!outTrack)throw new Error('No hay pista WebAudio de salida');
        this.localStream=this.micDestination.stream;
        this.localTrack=outTrack;
        this.localTrack.enabled=true;
        return true;
      }catch(err){
        console.warn('[Galaxy Combat Voice] WebAudio movil no disponible; usando pista directa.',err&&err.message||err);
        this.micSource=null;this.micGain=null;this.micDestination=null;
        try{if(this.audioContext&&this.audioContext.state!=='closed')await this.audioContext.close();}catch(_){}
        this.audioContext=null;
        return false;
      }
    }

    closeAudioGraph(){
      for(const node of this.remoteNodes.values()){try{node.disconnect();}catch(_){}}
      this.remoteNodes.clear();
      try{this.micSource&&this.micSource.disconnect();}catch(_){}
      try{this.micGain&&this.micGain.disconnect();}catch(_){}
      this.micSource=null;this.micGain=null;this.micDestination=null;
      if(this.audioContext){try{this.audioContext.close();}catch(_){}}
      this.audioContext=null;
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
        const rtcPromise=this.loadRtcConfig();
        const stream=await navigator.mediaDevices.getUserMedia({
          audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
          video:false
        });
        const captureTrack=stream.getAudioTracks()[0];
        if(!captureTrack)throw new Error('No hay pista de audio');
        this.captureStream=stream;

        const webAudioReady=await this.prepareMobileAudio(stream);
        if(!webAudioReady){
          captureTrack.enabled=false;
          this.localStream=stream;
          this.localTrack=captureTrack;
        }

        await rtcPromise;
        this.enabled=true;
        captureTrack.addEventListener('ended',()=>this.disable(false),{once:true});
        this.setStatus(tr('voiceEnabled'));
        this.refreshUI();
        this.showActivationTip();
        if(this.localIndex!==null&&!this.cpuMode){
          this.send({t:'voice-ready'});
          for(const peer of this.readyPeers)this.maybeOffer(peer);
        }
        return true;
      }catch(err){
        // V19.76: si getUserMedia llego a abrir el microfono pero fallo un paso
        // posterior (WebAudio/RTC), cerrar todo aqui. Antes esos recursos podian
        // quedar vivos hasta recargar la pagina.
        if(this.localStream){for(const t of this.localStream.getTracks()){try{t.stop();}catch(_){}}}
        if(this.captureStream&&this.captureStream!==this.localStream){for(const t of this.captureStream.getTracks()){try{t.stop();}catch(_){}}}
        this.localTrack=null;this.localStream=null;this.captureStream=null;
        this.closeAudioGraph();
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
      this.pttTouchActive=false;
      this.setTalking(false);
      if(notify&&this.localIndex!==null)this.send({t:'voice-offline'});
      this.enabled=false;
      this.closeAllPeers();
      if(this.localTrack){try{this.localTrack.stop();}catch(_){}}
      if(this.localStream){for(const t of this.localStream.getTracks()){try{t.stop();}catch(_){}}}
      if(this.captureStream){for(const t of this.captureStream.getTracks()){try{t.stop();}catch(_){}}}
      this.localTrack=null;
      this.localStream=null;
      this.captureStream=null;
      this.closeAudioGraph();
      this.setStatus(tr('voiceDisabled'));
      this.refreshUI();
    }

    shutdown(notify=true){
      this.hideActivationTip();
      this.pttTouchActive=false;
      if(notify&&this.enabled&&this.localIndex!==null)this.send({t:'voice-offline'});
      this.setTalking(false);
      this.closeAllPeers();
      if(this.localStream){for(const t of this.localStream.getTracks()){try{t.stop();}catch(_){}}}
      if(this.captureStream){for(const t of this.captureStream.getTracks()){try{t.stop();}catch(_){}}}
      this.localTrack=null;this.localStream=null;this.captureStream=null;this.enabled=false;
      this.closeAudioGraph();
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
      const pc=new RTCPeerConnection({iceServers:this.iceServers});
      this.localStream.getTracks().forEach(track=>pc.addTrack(track,this.localStream));
      pc.onicecandidate=e=>{
        if(e.candidate)this.send({t:'voice-ice',to:id,data:e.candidate.toJSON?e.candidate.toJSON():e.candidate});
      };
      pc.ontrack=e=>this.attachRemoteAudio(id,e.streams&&e.streams[0]?e.streams[0]:new MediaStream([e.track]));
      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='failed'){
          this.closePeer(id);
          setTimeout(()=>{
            if(!this.enabled||this.localIndex===null||!this.peerPlayers.has(id))return;
            this.send({t:'voice-ready'});
            this.maybeOffer(id);
          },300);
        }else if(pc.connectionState==='closed'){
          this.closePeer(id);
        }
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
      if(this.isMobile&&this.audioContext){
        try{
          const old=this.remoteNodes.get(id);
          if(old){try{old.disconnect();}catch(_){}}
          const source=this.audioContext.createMediaStreamSource(stream);
          source.connect(this.audioContext.destination);
          this.remoteNodes.set(id,source);
          if(this.audioContext.state==='suspended')this.audioContext.resume().catch(()=>{});
          return;
        }catch(err){
          console.warn('[Galaxy Combat Voice] Fallo salida WebAudio; usando audio HTML.',err&&err.message||err);
        }
      }

      let audio=this.remoteAudio.get(id);
      if(!audio){
        audio=document.createElement('audio');
        audio.autoplay=true;
        audio.playsInline=true;
        audio.setAttribute('playsinline','');
        audio.setAttribute('webkit-playsinline','');
        audio.muted=false;audio.volume=1;
        audio.dataset.voicePlayer=String(id);
        // Evitar display:none en Safari/iOS: algunos WebKit dejan el elemento
        // fuera de la ruta de reproducción si no participa en el render tree.
        audio.style.position='fixed';
        audio.style.width='1px';
        audio.style.height='1px';
        audio.style.opacity='0.001';
        audio.style.pointerEvents='none';
        audio.style.left='-10px';
        audio.style.bottom='0';
        document.body.appendChild(audio);
        this.remoteAudio.set(id,audio);
      }
      if(audio.srcObject!==stream)audio.srcObject=stream;
      audio.muted=false;audio.volume=1;
      const p=audio.play();
      if(p&&typeof p.catch==='function')p.catch(()=>{
        this.setStatus(tr('tapVoiceToHear'));
      });
    }

    resumeRemoteAudio(){
      if(this.audioContext&&this.audioContext.state==='suspended'){
        this.audioContext.resume().catch(()=>{});
      }
      for(const audio of this.remoteAudio.values()){
        if(!audio||!audio.srcObject)continue;
        audio.muted=false;audio.volume=1;
        // V19.76: los gestos globales sirven solo para recuperar autoplay
        // bloqueado. Si el audio ya esta sonando, no repetir play() en cada
        // tecla/toque/pointerdown.
        if(!audio.paused)continue;
        const p=audio.play();
        if(p&&typeof p.catch==='function')p.catch(()=>{});
      }
    }

    closePeer(id){
      const pc=this.peers.get(id);if(pc){try{pc.close();}catch(_){}this.peers.delete(id);}
      const audio=this.remoteAudio.get(id);if(audio){try{audio.pause();audio.srcObject=null;audio.remove();}catch(_){}this.remoteAudio.delete(id);}
      const node=this.remoteNodes.get(id);if(node){try{node.disconnect();}catch(_){}this.remoteNodes.delete(id);}
      this.pendingIce.delete(id);this.offerBusy.delete(id);
    }

    closeAllPeers(){for(const id of [...this.peers.keys()])this.closePeer(id);}

    setTalking(on){
      on=!!on&&this.enabled&&!!this.localTrack&&this.localIndex!==null;
      if(this.talking===on)return;
      this.talking=on;
      if(this.micGain&&this.audioContext){
        try{
          if(this.audioContext.state==='suspended'&&on)this.audioContext.resume().catch(()=>{});
          this.micGain.gain.setValueAtTime(on?1:0,this.audioContext.currentTime);
          this.localTrack.enabled=true;
        }catch(_){}
      }else if(this.localTrack){
        this.localTrack.enabled=on;
      }
      if(this.localIndex!==null){
        if(on){
          // Repara automáticamente una negociación WebRTC perdida: al pulsar
          // hablar volvemos a anunciarnos y reintentamos los peers conocidos.
          this.send({t:'voice-ready'});
          for(const id of this.peerPlayers)this.maybeOffer(id);
          for(const id of this.readyPeers)this.maybeOffer(id);
        }
        this.send({t:'voice-talking',on});
      }
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
      const joystickActive=typeof window.GalaxyJoystickEnabled==='function'&&window.GalaxyJoystickEnabled();
      if(this.enableButton){
        if(joystickActive){
          this.enableButton.textContent=this.enabled?'MICRO ACTIVO · R1':'ACTIVAR MICRO · R1';
          this.enableButton.title=this.enabled?'Mantén R1 para hablar':'Activa el micro; después mantén R1 para hablar';
          this.enableButton.setAttribute('aria-label',this.enableButton.title);
        }else{
          this.enableButton.textContent=this.enabled?tr('voiceActive'):tr('activateVoice');
          this.enableButton.title='';
          this.enableButton.removeAttribute('aria-label');
        }
        this.enableButton.classList.toggle('active',this.enabled);
      }
      if(this.activationTipEl){
        this.activationTipEl.textContent=joystickActive?'MANTÉN R1 PARA HABLAR':tr('voiceKeyTip');
      }
      if(this.statusEl&&!this.enabling){
        this.statusEl.textContent=this.enabled?tr('voiceEnabled'):tr('voiceDisabled');
      }
      if(this.pttButton){
        const show=this.isMobile&&inRoom&&!this.cpuMode;
        this.pttButton.classList.toggle('hidden',!show);
        this.pttButton.textContent=this.enabled?tr('talk'):tr('activateVoice');
        this.pttButton.setAttribute('aria-label',this.enabled?tr('holdToTalk'):tr('activateVoice'));
        this.pttButton.title=this.enabled?tr('holdToTalk'):tr('activateVoice');
        this.pttButton.classList.toggle('talking',this.talking);
        this.pttButton.classList.toggle('mic-enabled',this.enabled);
      }
      if(this.hintEl){
        const show=!this.isMobile&&inRoom&&this.enabled&&!this.cpuMode;
        this.hintEl.classList.toggle('hidden',!show);
        this.hintEl.textContent=this.talking
          ?tr('voiceHintTalking')
          :(joystickActive?'R1: HABLAR':tr('voiceHintTalk'));
        this.hintEl.classList.toggle('talking',this.talking);
      }
      this.refreshTalkers();
    }
  }

  window.GalaxyVoice=GalaxyVoice;
})();
