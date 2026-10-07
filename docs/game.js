'use strict';
(() => {
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isMobile=document.documentElement.classList.contains('handheld-device')||matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const perfDebug=new URLSearchParams(location.search).get('debug')==='1';
  const i18n=window.GalaxyI18n||null;
  const tr=(key,vars)=>i18n?i18n.t(key,vars):key;
  const trServer=text=>i18n?i18n.translateServerText(text):String(text==null?'':text);
  const canvas=document.getElementById('game');
  const useStaticPcBackground=!isMobile;
  // V21.80: campaña CPU definida por datos. Los cinco niveles actuales
  // conservan exactamente sus fondos y nombres, pero la longitud de campaña
  // deja de depender de constantes repartidas por el juego.
  const CAMPAIGN=window.GalaxyCampaign||null;
  const FALLBACK_MATCH_BACKGROUNDS=[
    {file:'assets/sprites/fondo.jpg',mobileKey:'bg',stars:true},
    {file:'assets/sprites/fondo02.jpg',mobileKey:'bg02',stars:false},
    {file:'assets/sprites/fondo03.jpg',mobileKey:'bg03',stars:false},
    {file:'assets/sprites/fondo04.jpg',mobileKey:'bg04',stars:false},
    {file:'assets/sprites/fondo05.jpg',mobileKey:'bg05',stars:false}
  ];
  const MATCH_BACKGROUNDS=CAMPAIGN&&Array.isArray(CAMPAIGN.levels)&&CAMPAIGN.levels.length
    ?CAMPAIGN.levels.map(level=>({...level.background}))
    :FALLBACK_MATCH_BACKGROUNDS;
  const LOCAL_CAMPAIGN_LEVELS=CAMPAIGN&&Number(CAMPAIGN.count)>0?Number(CAMPAIGN.count):MATCH_BACKGROUNDS.length;
  const FALLBACK_WORLD_KEYS=['campaignWorld1','campaignWorld2','campaignWorld3','campaignWorld4','campaignWorld5'];
  function localCampaignConfig(level){
    if(CAMPAIGN&&typeof CAMPAIGN.getLevel==='function')return CAMPAIGN.getLevel(level);
    const safe=Math.max(1,Math.min(LOCAL_CAMPAIGN_LEVELS,Math.round(Number(level)||1)));
    return {id:safe,nameKey:FALLBACK_WORLD_KEYS[safe-1]||FALLBACK_WORLD_KEYS[FALLBACK_WORLD_KEYS.length-1],background:MATCH_BACKGROUNDS[safe-1]||MATCH_BACKGROUNDS[0]};
  }
  function localCampaignWorldName(level){
    const cfg=localCampaignConfig(level);
    return tr(cfg&&cfg.nameKey?cfg.nameKey:'campaignWorld1');
  }
  let matchBackgroundCursor=-1,currentMatchBackground=0,currentMatchBackgroundRound=0;
  if(useStaticPcBackground){
    // Fondo PC estatico: se compone una sola vez como capa CSS 16:9 y ya no se
    // copia dentro del canvas en cada frame.
    canvas.style.backgroundColor='#020714';
    canvas.style.backgroundImage="url('assets/sprites/fondo.jpg')";
    canvas.style.backgroundRepeat='no-repeat';
    canvas.style.backgroundPosition='center center';
    canvas.style.backgroundSize='100% 100%';
  }
  // En PC necesitamos alpha para que la capa estatica se vea a traves del
  // canvas dinamico. Movil conserva el contexto opaco que ya funciona fluido.
  const ctx=canvas.getContext('2d',{alpha:useStaticPcBackground})||canvas.getContext('2d');
  const menu=document.getElementById('menu'),lobby=document.getElementById('lobby'),victory=document.getElementById('victory');
  const buildVersionEl=document.getElementById('buildVersion');
  const playerChangeNotice=document.getElementById('playerChangeNotice');
  let playerChangeNoticeTimer=null;
  const statusEl=document.getElementById('status'),roomCodeEl=document.getElementById('roomCode'),playersEl=document.getElementById('players'),startBtn=document.getElementById('start'),fillCpuBtn=document.getElementById('fillCpu'),waitingPlayersEl=document.getElementById('waitingPlayers'),topbar=document.getElementById('topbar'),roomMini=document.getElementById('roomMini');
  const lobbyChatLog=document.getElementById('lobbyChatLog'),lobbyChatEmpty=document.getElementById('lobbyChatEmpty'),lobbyChatInput=document.getElementById('lobbyChatInput'),lobbyChatSend=document.getElementById('lobbyChatSend');
  const shareGameBtn=document.getElementById('shareGame'),shareRoomBtn=document.getElementById('shareRoom'),shareToast=document.getElementById('shareToast');
  const sharedRoomCode=String(new URLSearchParams(location.search).get('room')||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
  let sharedRoomJoinStarted=false;
  let shareToastTimer=null;
  const serverWait=document.getElementById('serverWait'),serverWaitText=document.getElementById('serverWaitText');
  const roomTypeDialog=document.getElementById('roomTypeDialog'),publicRoomsDialog=document.getElementById('publicRoomsDialog'),publicRoomsList=document.getElementById('publicRoomsList'),joinCodeDialog=document.getElementById('joinCodeDialog');
  const cpuSetupDialog=document.getElementById('cpuSetupDialog'),mobileDifficulty=document.getElementById('mobileDifficulty'),mobileCpuCount=document.getElementById('mobileCpuCount'),cpuSetupPlay=document.getElementById('cpuSetupPlay'),cpuSetupClose=document.getElementById('cpuSetupClose');
  const W=1920,H=1080;
  const playerColors=['#5ae1ff','#ff50a5','#5aff78','#ffdc46'];
  const playerRgb=[[90,225,255],[255,80,165],[90,255,120],[255,220,70]];
  const images={},sounds={};
  let state=null,previousState=null,myIndex=null,isHost=false,roomCode='',playerToken='',inGame=false,lastStateTime=0,previousStateTime=0;
  let lastAcceptedStateRound=-1,lastAcceptedStateSeq=-1;
  const RESUME_STORAGE_KEY='galaxyCombatResumeV1';
  const ROOM_CLIENT_ID_KEY='galaxyRoomClientIdV1';
  const TEST_ROOM_PERMIT_STORAGE='galaxyTestRoomPermitV1';
  const RESUME_WINDOW_MS=30000;
  function roomClientId(){
    try{
      let id=String(localStorage.getItem(ROOM_CLIENT_ID_KEY)||'').trim().toLowerCase();
      if(/^[a-f0-9]{32}$/.test(id))return id;
      const bytes=new Uint8Array(16);
      if(window.crypto&&typeof window.crypto.getRandomValues==='function')window.crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
      id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(ROOM_CLIENT_ID_KEY,id);
      return id;
    }catch(_){return '';}
  }
  function testRoomPermitToken(){
    try{
      const data=JSON.parse(localStorage.getItem(TEST_ROOM_PERMIT_STORAGE)||'null');
      const token=String(data&&data.token||'').trim();
      const expiresAt=Number(data&&data.expiresAt)||0;
      if(/^[a-f0-9]{64}$/i.test(token)&&expiresAt>Date.now())return token;
      if(data)localStorage.removeItem(TEST_ROOM_PERMIT_STORAGE);
    }catch(_){}
    return '';
  }
  let resumeStartedAt=0,resumeExpiryTimer=null;
  function loadResumeSession(){
    try{
      const v=JSON.parse(sessionStorage.getItem(RESUME_STORAGE_KEY)||'null');
      if(v&&typeof v.code==='string'&&typeof v.token==='string'&&v.code&&v.token)return {code:v.code,token:v.token};
    }catch(_){}
    return null;
  }
  function saveResumeSession(){
    if(!roomCode||!playerToken)return;
    try{sessionStorage.setItem(RESUME_STORAGE_KEY,JSON.stringify({code:roomCode,token:playerToken}));}catch(_){}
  }
  function clearResumeSession(){
    try{sessionStorage.removeItem(RESUME_STORAGE_KEY);}catch(_){}
  }
  function stopResumeWindow(){
    resumeStartedAt=0;
    clearTimeout(resumeExpiryTimer);resumeExpiryTimer=null;
    if(roomMini&&roomMini.textContent===tr('reconnecting'))roomMini.textContent='';
  }
  // V20.16 PERF: snapshots visuales a 20 Hz. La fisica sigue a 60 Hz y
  // los controles a 30 Hz; interpolacion/extrapolacion mantienen la fluidez.
  const NET_FRAME_MS=1000/20;
  const previousLookup={players:new Map(),asteroids:new Map(),pickups:new Map(),flares:new Map(),meteors:new Map(),ufo:new Map()};
  // V21.61: la rotacion de OVNIs se calcula directamente por id/tiempo.
  // V20.98 GAME FEEL: todo este estado es exclusivamente local de render.
  // No modifica snapshots, fisica, colisiones, IA ni red.
  const pickupVisualBorn=new Map();
  const gameFeelFxSeen=new Set();
  const shipHitFlashUntil=[0,0,0,0];
  let cameraShakeStart=0,cameraShakeUntil=0,cameraShakePower=0,cameraShakeSeed=0;
  function resetGameFeelVisuals(){
    pickupVisualBorn.clear();gameFeelFxSeen.clear();
    shipHitFlashUntil.fill(0);
    cameraShakeStart=0;cameraShakeUntil=0;cameraShakePower=0;cameraShakeSeed=0;
    for(const p of asteroidDust)p.life=0;
    asteroidDustCursor=0;
    ufoEmitAt.clear();
    for(const particle of ufoParticles)particle.life=0;
    ufoFxCursor=0;ufoFxLastAt=0;
    playNoticeStart=0;playNoticeUntil=0;playNoticeText='';playNoticeKind='';
    pickupNoticeStart=0;pickupNoticeUntil=0;pickupNoticeText='';
    specialHelpStart=0;specialHelpUntil=0;specialHelpText='';
    seenShockwaveHelp=false;seenFlareHelp=false;
    nearWinNoticeStart=0;nearWinNoticeUntil=0;nearWinNoticeName='';nearWinNoticeIndex=-1;nearWinActive.clear();
    incomingMissileNoticeId=null;incomingMissileNoticeUntil=0;
    lastLocalKillAt=0;lastSavedNoticeAt=0;
  }
  function updatePickupVisualBirths(nextState,now){
    const active=new Set();
    for(const pk of (nextState&&nextState.pickups)||[]){
      const key=String(pk&&pk.id);
      active.add(key);
      const existed=state&&Array.isArray(state.pickups)&&state.pickups.some(old=>String(old&&old.id)===key);
      if(!existed&&!pickupVisualBorn.has(key))pickupVisualBorn.set(key,now);
    }
    for(const key of pickupVisualBorn.keys())if(!active.has(key))pickupVisualBorn.delete(key);
  }
  function detectLocalMissileEvasion(nextState,now){
    if(!state||!nextState||!Array.isArray(state.bullets)||!Array.isArray(nextState.bullets))return;
    const nextMe=Array.isArray(nextState.players)?nextState.players.find(p=>Number(p&&p.i)===Number(myIndex)):null;
    if(!nextMe||nextMe.dead)return;
    for(const old of state.bullets){
      if(!old||old.g!==true||Number(old.gt)!==Number(myIndex)||Number(old.o)===Number(myIndex))continue;
      const current=nextState.bullets.find(b=>b&&String(b.id)===String(old.id));
      // V21.09: EVASION solo si el MISMO misil sigue vivo pero deja de
      // apuntar al jugador. Esto coincide con el desvio por bengala y evita
      // asumir causas cuando el misil simplemente desaparece.
      if(current&&current.g===true&&Number(current.gt)!==Number(myIndex)){
        playNoticeStart=now;
        playNoticeUntil=now+1200;
        playNoticeText=tr('evasionMove');
        playNoticeKind='evasion';
        return;
      }
    }
  }
  function consumeGameFeelFx(snapshot,now){
    if(!snapshot||!Array.isArray(snapshot.fx))return;
    const round=Number(snapshot.round)||localCampaignLevel||0;
    for(const e of snapshot.fx){
      if(!e||!Number.isSafeInteger(e.id)||e.id<1)continue;
      const key=String(snapshot.code||roomCode||'')+':'+round+':'+e.id;
      if(gameFeelFxSeen.has(key))continue;
      gameFeelFxSeen.add(key);
      if(gameFeelFxSeen.size>256)gameFeelFxSeen.delete(gameFeelFxSeen.values().next().value);
      const age=Math.max(0,Number(e.age)||0);
      if(age>500)continue;
      const owner=Number(e.i);
      const hidden=!!e.hidden&&owner!==Number(myIndex);
      if(e.kind==='hit'&&!hidden&&Number.isInteger(owner)&&owner>=0&&owner<4){
        shipHitFlashUntil[owner]=Math.max(shipHitFlashUntil[owner],now-age+165);
        if(owner===Number(myIndex)&&now-lastSavedNoticeAt>1200){
          lastSavedNoticeAt=now;
          playNoticeStart=now;
          playNoticeUntil=now+1050;
          playNoticeText=tr('savedMove');
          playNoticeKind='saved';
        }
      }else if(e.kind==='explosion'){
        const start=now-age;
        const power=(owner===Number(myIndex)?(isMobile?2.1:3.1):(isMobile?1.0:1.65));
        if(start+190>cameraShakeUntil||power>cameraShakePower){
          cameraShakeStart=start;
          cameraShakeUntil=start+190;
          cameraShakePower=power;
          cameraShakeSeed=(e.id%97)*.37;
        }
      }else if(e.kind==='asteroidDust'){
        spawnAsteroidDust(Number(e.x),Number(e.y));
      }
    }
  }
  const localizedTargetOwners=[-1,-1,-1,-1];
  const localizaSpriteKeys=['localizaA','localizaB','localizaC','localizaD'];
  let lastControlTurn=0,lastControlTurnChangedAt=0,lastControlThrust=false,lastVoicePlayersSig=0,renderScale=1;
  let lastUniqueLeader=null,leaderAnnouncement=null;
  let killHudFlashStart=0,killHudFlashUntil=0,killScoreFxStart=0,killScoreFxUntil=0;
  const invisibleHudUntil=[0,0,0,0];
  let invisibleNoticeIndex=-1,invisibleNoticeUntil=0;
  // Mantiene visualmente el contador anterior hasta que empieza el pop de escala.
  // La puntuacion real del servidor sigue actualizandose al instante.
  let killScoreHeldValue=null,killScorePendingValue=null;
  let crashScoreFxStart=0,crashScoreFxUntil=0;
  // En penalizacion mantenemos el valor anterior hasta que termina el aviso.
  // Entonces aparece la resta junto con el efecto de escala/explosion del HUD.
  let crashScoreHeldValue=null,crashScorePendingValue=null;
  let penaltyMessageUntil=0;
  let brutalFxStart=0,brutalFxUntil=0,brutalDistance=0,brutalDistanceText='',brutalShooter='',brutalAmmoBonus=0,brutalCadenceMax=false,brutalTitleKey='brutal';
  // V21.01: avisos locales de jugadas. Solo leen estados/eventos existentes.
  let playNoticeStart=0,playNoticeUntil=0,playNoticeText='',playNoticeKind='';
  let pickupNoticeStart=0,pickupNoticeUntil=0,pickupNoticeText='';
  let specialHelpStart=0,specialHelpUntil=0,specialHelpText='';
  let seenShockwaveHelp=false,seenFlareHelp=false;
  let nearWinNoticeStart=0,nearWinNoticeUntil=0,nearWinNoticeName='',nearWinNoticeIndex=-1;
  const nearWinActive=new Set();
  // V21.46: el texto MISIL ENTRANTE solo aparece 2 s por cada misil.
  let incomingMissileNoticeId=null,incomingMissileNoticeUntil=0;
  let lastLocalKillAt=0,lastSavedNoticeAt=0;
  const shockwaveFx=[];
  // V21.90: polvo de rotura de asteroide. Pool fijo y exclusivamente visual:
  // cero colisiones, cero IA y cero entidades sincronizadas.
  const ASTEROID_DUST_MAX=isMobile?24:36;
  const asteroidDust=Array.from({length:ASTEROID_DUST_MAX},()=>({life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0}));
  let asteroidDustCursor=0;
  function spawnAsteroidDust(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const count=isMobile?8:12;
    for(let n=0;n<count;n++){
      const p=asteroidDust[asteroidDustCursor++%asteroidDust.length];
      const angle=Math.random()*Math.PI*2;
      const speed=28+Math.random()*72;
      p.life=p.maxLife=.34+Math.random()*.22;
      p.x=x+(Math.random()-.5)*10;p.y=y+(Math.random()-.5)*10;
      p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed;
      p.size=3+Math.random()*7;
    }
  }
  function drawAsteroidDust(dt){
    ctx.save();
    for(const p of asteroidDust){
      if(p.life<=0)continue;
      p.life=Math.max(0,p.life-dt);
      if(p.life<=0)continue;
      const f=p.life/p.maxLife;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=.94;p.vy*=.94;
      ctx.globalAlpha=Math.min(.58,f*.58);
      const shade=135+Math.round((1-f)*35);
      ctx.fillStyle='rgb('+shade+','+shade+','+shade+')';
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.8,p.size*(.55+.45*f)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // V19.28: el titulo BRUTAL se prerenderiza. El shadowBlur grande era caro
  // si se recalculaba en cada frame y podia producir tirones en PC.
  let brutalTitleCache=null,brutalTitleCacheText='',brutalTitleCacheMobile=null;
  // V19.56: cuenta atras online prerenderizada. PREPARADOS sirve de colchon
  // para estabilizar WebRTC/recursos; al aparecer VAMOS arrancan fisica y controles.
  const ONLINE_READY_MS=2000,ONLINE_GO_MS=900;
  let onlineStartAt=0,onlineGoAt=0,onlineStartEndAt=0,onlineStartTimer=null,onlineStartRankRound=1;
  let onlineStartPending=false,onlineStartGeneration=0,lastRestartedRound=0;
  let onlineReadyRedCache=null,onlineReadyOrangeCache=null,onlineGoCache=null;
  let huntFxStart=0,huntFxUntil=0,huntText='',huntCpuAmmo=false,huntCpuBonus=0,huntCpuIndices=[],huntCpuAmmoTotals=new Map();
  let pendingVictoryIndex=null,victoryShowTimer=null;
  let victoryHudScoreShownAt=null;
  // V21.64: victorias acumuladas mientras el jugador permanezca en la misma
  // sesion online. Se reinician solo al volver al menu principal.
  const onlineSessionWins=new Map();
  const ONLINE_SERIES_BASE_ROUNDS=5;
  let onlineSeriesRound=0,onlineSeriesScoredRound=0,onlineSeriesComplete=false,onlineSeriesChampion=-1,onlineSeriesReturnTimer=null;
  let publicRooms=[];
  let localCpu=null,localCpuActive=false,activeLocalDifficulty='';
  // V20.92: CONTRA LA MAQUINA pasa a ser una campana de cinco niveles.
  // El nivel solo avanza si gana el jugador humano (J1).
  let localCampaignLevel=1,localCampaignAwaitingContinue=false,localCampaignComplete=false,localCampaignGameOver=false;
  let cpuLearningControl={autoTrainingEnabled:false,localHardEnabled:false,ready:false};
  let p2p=null,hostPhysics=null,lobbyPlayers=[],cpuFillEnabled=false;
  let netStartAt=0,lastP2PStateAt=0,lastFallbackRequestAt=0,lastFallbackStateSentAt=0;
  let fallbackActive=false,p2pStableCount=0;
  const fallbackPeers=new Set(),fallbackReconnectAt=new Map();
  const FALLBACK_AFTER_MS=500,FALLBACK_RETRY_MS=3000,FALLBACK_STATE_MS=50,P2P_STABLE_STATES=12;
  const keys=new Set(); let ws=null,reconnectTimer=null,musicStarted=false;
  // V16.4.36: sincronizamos estados/controles y reducimos GC en movil para evitar picos de trabajo
  // asincronos en Safari/iOS. Solo conservamos el snapshot de estado mas reciente.
  let pendingStateRaw=null;
  let lastControlSentAt=0;
  let lastSentControlTurn=NaN,lastSentControlThrust=false,lastSentControlFire=false;
  let lastSentJoystickActions='';
  let lastPaintAt=0;
  let lastStateProcessedAt=0;
  const CONTROL_SEND_MS=1000/30;
  const CONTROL_HEARTBEAT_MS=100;
  // V20.16: procesamos como maximo los 20 snapshots/s publicados por la
  // simulacion. Se conserva solo el mas reciente al comienzo del RAF.
  const STATE_PROCESS_MS=isMobile?NET_FRAME_MS:0;
  // Intervalo de snapshots suavizado. Usar directamente el tiempo entre llegadas
  // hace que unos pocos ms de jitter se traduzcan en pequenas variaciones de
  // velocidad visual, especialmente visibles cuando las naves van rapido.
  let smoothedStateInterval=NET_FRAME_MS;
  const localVisual={ready:false,index:-1,x:0,y:0,r:0,vx:0,vy:0,lastAt:0,lastError:0};
  const remoteVisuals=Array.from({length:4},()=>({
    ready:false,x:0,y:0,r:0,vx:0,vy:0,lastAt:0
  }));
  function resetLocalVisual(){
    localVisual.ready=false;localVisual.index=-1;localVisual.lastAt=0;localVisual.lastError=0;
  }
  function resetRemoteVisuals(){
    for(const v of remoteVisuals){
      v.ready=false;v.x=0;v.y=0;v.r=0;v.vx=0;v.vy=0;v.lastAt=0;
    }
  }
  const perfStats=perfDebug?{lastPaint:0,windowStart:performance.now(),frames:0,longFrames:0,maxFrame:0,lastFrame:0,parseMs:0,parseCount:0,localErrMax:0,report:{fps:0,long:0,max:0,frame:0,parse:0,localErr:0,heap:-1,players:0,bullets:0,flares:0,asteroids:0,meteors:0,pickups:0,impacts:0,wsBuf:0,p2pBuf:0,p2pPeers:0,queue:0,physicsTickAvg:0,physicsTickMax:0,physicsDrops:0}}:null;
  // Cadencia de pintado adaptativa. El antiguo umbral fijo de 10,5 ms podia
  // convertir un monitor de 100/110 Hz en ~50/55 FPS. Medimos el RAF real y
  // usamos un divisor entero estable: 60/75/100 Hz pintan cada RAF; 120/144/
  // 165 Hz cada 2; frecuencias aun mayores usan el divisor mas cercano a 75 FPS.
  let displaySampleLast=0,displaySampleTotal=0,displaySampleCount=0;
  let renderDivisor=1,renderCadenceTick=0,measuredRefreshHz=60;
  let renderDivisorCandidate=1,renderDivisorCandidateWins=0;
  function sampleDisplayRefresh(now){
    if(displaySampleLast){
      const dt=now-displaySampleLast;
      if(dt>=4&&dt<=25){
        displaySampleTotal+=dt;displaySampleCount++;
        if(displaySampleCount>=30){
          const hz=1000/(displaySampleTotal/displaySampleCount);
          if(Number.isFinite(hz)&&hz>=40&&hz<=360){
            measuredRefreshHz=hz;
            // V20.14: histeresis para que un monitor VRR/120 Hz no cambie
            // continuamente entre pintar cada RAF y cada 2 RAF.
            let next=renderDivisor;
            if(renderDivisor===1){
              if(hz>=116)next=Math.max(2,Math.floor(hz/60));
            }else{
              if(hz<=110)next=1;
              else next=Math.max(2,Math.floor(hz/60));
            }
            next=Math.max(1,next);
            if(next===renderDivisor){
              renderDivisorCandidate=next;renderDivisorCandidateWins=0;
            }else if(next===renderDivisorCandidate){
              renderDivisorCandidateWins++;
              if(renderDivisorCandidateWins>=6){
                renderDivisor=next;renderCadenceTick=0;renderDivisorCandidateWins=0;
              }
            }else{
              renderDivisorCandidate=next;renderDivisorCandidateWins=1;
            }
          }
          displaySampleTotal=0;displaySampleCount=0;
        }
      }
    }
    displaySampleLast=now;
  }
  const impactFX=typeof window.GalaxyImpactFX==='function'?new window.GalaxyImpactFX():null;
  function collectPerfDebugSnapshot(){
    const s=state||{};
    let p2pBuf=0,p2pPeers=0,p2pQueued=0;
    let physicsTickAvg=0,physicsTickMax=0,physicsDrops=0;
    const physics=localCpuActive?localCpu:(isHost?hostPhysics:null);
    if(physics&&typeof physics.takePerfDebug==='function'){
      const pr=physics.takePerfDebug();
      if(pr){
        physicsTickAvg=Number(pr.tickAvg)||0;
        physicsTickMax=Number(pr.tickMax)||0;
        physicsDrops=Number(pr.catchupDrops)||0;
      }
    }
    if(p2p&&p2p.peers&&typeof p2p.peers.values==='function'){
      for(const rec of p2p.peers.values()){
        const fast=rec&&(rec.fastDc||rec.dc);
        const reliable=rec&&rec.reliableDc;
        if(rec&&rec.open)p2pPeers++;
        if(fast&&fast.readyState==='open')p2pBuf+=Number(fast.bufferedAmount||0);
        if(reliable&&reliable!==fast&&reliable.readyState==='open')p2pBuf+=Number(reliable.bufferedAmount||0);
      }
      if(p2p.pendingStateRaw)p2pQueued++;
      if(p2p.pendingBroadcastState)p2pQueued++;
    }
    const mem=performance&&performance.memory&&Number(performance.memory.usedJSHeapSize);
    return {
      heap:Number.isFinite(mem)?mem/(1024*1024):-1,
      players:Array.isArray(s.players)?s.players.length:0,
      bullets:Array.isArray(s.bullets)?s.bullets.length:0,
      flares:Array.isArray(s.flares)?s.flares.length:0,
      asteroids:Array.isArray(s.asteroids)?s.asteroids.length:0,
      meteors:Array.isArray(s.meteors)?s.meteors.length:0,
      pickups:Array.isArray(s.pickups)?s.pickups.length:0,
      impacts:impactFX&&Array.isArray(impactFX.bursts)?impactFX.bursts.length:0,
      wsBuf:ws&&ws.readyState===WebSocket.OPEN?Number(ws.bufferedAmount||0):0,
      p2pBuf,p2pPeers,
      queue:(pendingStateRaw?1:0)+p2pQueued,
      physicsTickAvg,physicsTickMax,physicsDrops
    };
  }
  let connectAttempt=0,wakeStartedAt=0,manualClose=false;
  const cpuButton=document.getElementById('cpu');
  const audioToggleButton=document.getElementById('enableAudio');
  const joystickToggleButton=document.getElementById('enableJoystick');
  const joystickConfigButton=document.getElementById('configureJoystick');
  const joystickConfigDialog=document.getElementById('joystickConfigDialog');
  const joystickConfigTitle=document.getElementById('joystickConfigTitle');
  const joystickConfigStep=document.getElementById('joystickConfigStep');
  const joystickConfigAction=document.getElementById('joystickConfigAction');
  const joystickConfigHint=document.getElementById('joystickConfigHint');
  const joystickConfigCurrent=document.getElementById('joystickConfigCurrent');
  const joystickConfigClose=document.getElementById('joystickConfigClose');
  const joystickConfigReset=document.getElementById('joystickConfigReset');
  const joystickConfigCancel=document.getElementById('joystickConfigCancel');
  const controlHelpEl=document.getElementById('controlHelp');
  const JOYSTICK_STORAGE_KEY='galaxyCombatJoystickV1';
  const JOYSTICK_MAP_STORAGE_KEY='galaxyCombatJoystickMapV1';
  const JOYSTICK_MAP_COOKIE_KEY='galaxyCombatJoystickMapV1';
  const DEFAULT_JOYSTICK_MAP=Object.freeze({
    turnAxis:0,turnScale:-1,turnLeft:14,turnRight:15,
    thrust:0,fire:7,rocket:6,flare:4,shock:3,ptt:5
  });
  const JOYSTICK_CONFIG_STEPS=[
    {field:'thrust',text:'accelerate'},
    {field:'fire',text:'fire'},
    {field:'rocket',text:'rocket'},
    {field:'flare',text:'flare'},
    {field:'shock',text:'shock'}
  ];
  const JOYSTICK_CONFIG_TEXT={
    es:{configure:'CONFIGURAR',title:'CONFIGURAR MANDO',connect:'CONECTA UN MANDO Y PULSA UN BOTON',move:'MOVER',moveLeft:'MUEVE EL STICK HACIA LA IZQUIERDA O PULSA IZQUIERDA EN LA CRUCETA',moveRight:'AHORA PULSA DERECHA EN LA CRUCETA',accelerate:'ACELERAR',fire:'DISPARO',rocket:'COHETES',flare:'BENGALAS',shock:'HONDA EXPANSIVA',press:'PULSA EL BOTON QUE QUIERAS ASIGNAR',reset:'RESTAURAR',cancel:'CANCELAR',saved:'CONFIGURACION GUARDADA',step:'PASO',voice:'VOZ'},
    en:{configure:'CONFIGURE',title:'CONFIGURE CONTROLLER',connect:'CONNECT A CONTROLLER AND PRESS A BUTTON',move:'MOVE',moveLeft:'MOVE THE STICK LEFT OR PRESS LEFT ON THE D-PAD',moveRight:'NOW PRESS RIGHT ON THE D-PAD',accelerate:'THRUST',fire:'FIRE',rocket:'ROCKETS',flare:'FLARES',shock:'SHOCKWAVE',press:'PRESS THE BUTTON YOU WANT TO ASSIGN',reset:'RESET',cancel:'CANCEL',saved:'CONFIGURATION SAVED',step:'STEP',voice:'VOICE'},
    it:{configure:'CONFIGURA',title:'CONFIGURA CONTROLLER',connect:'COLLEGA UN CONTROLLER E PREMI UN PULSANTE',move:'MUOVI',moveLeft:'MUOVI LO STICK A SINISTRA O PREMI SINISTRA SUL D-PAD',moveRight:'ORA PREMI DESTRA SUL D-PAD',accelerate:'ACCELERA',fire:'SPARO',rocket:'RAZZI',flare:'BENGALA',shock:'ONDA ESPANSIVA',press:'PREMI IL PULSANTE DA ASSEGNARE',reset:'RIPRISTINA',cancel:'ANNULLA',saved:'CONFIGURAZIONE SALVATA',step:'PASSO',voice:'VOCE'},
    fr:{configure:'CONFIGURER',title:'CONFIGURER MANETTE',connect:'CONNECTE UNE MANETTE ET APPUIE SUR UN BOUTON',move:'TOURNER',moveLeft:'POUSSE LE STICK A GAUCHE OU APPUIE A GAUCHE SUR LA CROIX',moveRight:'APPUIE MAINTENANT A DROITE SUR LA CROIX',accelerate:'ACCELERER',fire:'TIR',rocket:'ROQUETTES',flare:'LEURRES',shock:'ONDE DE CHOC',press:'APPUIE SUR LE BOUTON A ASSIGNER',reset:'REINITIALISER',cancel:'ANNULER',saved:'CONFIGURATION ENREGISTREE',step:'ETAPE',voice:'VOIX'},
    de:{configure:'KONFIGURIEREN',title:'CONTROLLER KONFIGURIEREN',connect:'CONTROLLER VERBINDEN UND EINE TASTE DRUECKEN',move:'DREHEN',moveLeft:'STICK NACH LINKS BEWEGEN ODER LINKS AM STEUERKREUZ DRUECKEN',moveRight:'JETZT RECHTS AM STEUERKREUZ DRUECKEN',accelerate:'BESCHLEUNIGEN',fire:'FEUERN',rocket:'RAKETEN',flare:'FLARES',shock:'SCHOCKWELLE',press:'GEWUENSCHTE TASTE DRUECKEN',reset:'ZURUECKSETZEN',cancel:'ABBRECHEN',saved:'KONFIGURATION GESPEICHERT',step:'SCHRITT',voice:'SPRACHE'}
  };
  let joystickMap={...DEFAULT_JOYSTICK_MAP};
  let joystickConfigDraft=null,joystickConfigActive=false,joystickConfigStepIndex=0,joystickConfigTurnStage='left';
  let joystickConfigPrevButtons=[],joystickConfigNeutralAxes=[],joystickConfigPadIndex=-1,joystickConfigRaf=0,joystickConfigCloseTimer=null;
  let joystickEnabled=false;
  let joystickIndex=-1;
  let joystickConnected=false;
  // V21.81: controles del mando en la pantalla de victoria/fin de nivel.
  let victoryJoystickPrevFire=false,victoryJoystickPrevMenu=false,victoryJoystickLastActionAt=0;
  let joystickVoiceHeld=false;
  const serverButtons=['create','join'].map(id=>document.getElementById(id));
  if(cpuButton)cpuButton.disabled=false;
  // Tamano visual de las naves. Solo cambia el dibujo: fisica, colisiones y red quedan iguales.
  const SHIP_DRAW_SIZE=isMobile?86:72;
  const SHIELD_DRAW_RADIUS=isMobile?48:43;
  const HUD_SCALE=isMobile?1.60:1.12;
  const HUD_PANEL_W=128*HUD_SCALE;
  const HUD_PANEL_H=153*HUD_SCALE;
  const HUD_NAME_FONT=isMobile?`800 ${22*HUD_SCALE}px Arial,Helvetica,sans-serif`:`${20*HUD_SCALE}px Flashback,Arial`;
  const HUD_VALUE_FONT=isMobile?`800 ${23*HUD_SCALE}px Arial,Helvetica,sans-serif`:null;
  const SHIP_IMAGE_KEYS=[
    {base:'ship1',a:'ship1a',f:'ship1f',af:'ship1af'},
    {base:'ship2',a:'ship2a',f:'ship2f',af:'ship2af'},
    {base:'ship3',a:'ship3a',f:'ship3f',af:'ship3af'},
    {base:'ship4',a:'ship4a',f:'ship4f',af:'ship4af'}
  ];
  const ROCKET_IMAGE_KEYS=['rocketA','rocketB','rocketC','rocketD'];
  const NAVEMIRA_IMAGE_KEYS=['navemiraA','navemiraB','navemiraC','navemiraD'];
  const ASTEROID_IMAGE_KEYS=['','asteroid1','asteroid2','asteroid3','asteroid4','asteroid5','asteroid6'];
  const METEOR_DRAW_SIZES=[0,22,27,31];

  // V20.1 LocalFX: particulas de propulsion 100% locales.
  // No forman parte del estado, fisicas, colisiones ni mensajes P2P.
  const ENGINE_FX_MAX=isMobile?96:192;
  const ENGINE_FX_INTERVAL=isMobile?55:38;
  // V20.21: cada particula elige una de dos gamas de combustion:
  // amarillo -> naranja/oscuro -> negro, o rojo intenso -> rojo oscuro -> negro.
  // Las paletas son fijas para evitar gradientes/strings nuevos cada frame.
  const ENGINE_FIRE_PALETTES=[
    [
      '#fff3a0','#ffe56a','#ffd33d','#ffb52a',
      '#ff9220','#e9681b','#c94b19','#9f3518',
      '#792818','#571e16','#3b1713','#26110f',
      '#170d0c','#0e0908','#080606','#050505'
    ],
    [
      '#ff2a16','#ff1b0d','#ff0d08','#f00000',
      '#dc0000','#c60000','#b00000','#990000',
      '#820000','#6b0000','#550000','#410000',
      '#300000','#210000','#120000','#050505'
    ]
  ];
  const engineParticles=Array.from({length:ENGINE_FX_MAX},()=>({
    life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0,owner:0,palette:0
  }));
  const engineEmitAt=[0,0,0,0];
  const engineTrailHidden=[false,false,false,false];
  let engineFxCursor=0,engineFxLastAt=0;

  // V20.3 LocalFX: pequeñas rocas grises en choques del meteorito gigante
  // contra asteroides. Se calcula solo en cada cliente: cero datos P2P.
  const ROCK_FX_MAX=isMobile?48:96;
  const GIANT_LOCAL_RADIUS=135,ASTEROID_LOCAL_RADIUS=45;
  const rockParticles=Array.from({length:ROCK_FX_MAX},()=>({
    life:0,maxLife:2,x:0,y:0,vx:0,vy:0,size:0,rot:0,spin:0
  }));
  const giantRockContacts=new Set();
  const giantRockNextContacts=new Set();
  const giantRockLastBurst=new Map();
  let rockFxCursor=0,rockFxLastAt=0;

  // V20.4 LocalFX: fogonazo y estela de particulas del cohete guiado.
  // Usa exclusivamente la posicion/velocidad del proyectil ya recibida.
  const ROCKET_FX_MAX=isMobile?64:128;
  const ROCKET_FX_INTERVAL=isMobile?62:42;
  const rocketParticles=Array.from({length:ROCKET_FX_MAX},()=>({
    life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0
  }));
  const rocketSeen=new Set();
  const rocketActiveScratch=new Set();
  const rocketEmitAt=new Map();
  let rocketFxCursor=0,rocketFxLastAt=0;

  // V21.62 LocalFX: estela circular multicolor del OVNI, 100% visual/local.
  // Solo lee posicion/velocidad recibidas; no toca fisica, IA, colisiones ni red.
  const UFO_FX_MAX=isMobile?104:224;
  const UFO_FX_INTERVAL=isMobile?46:30;
  const UFO_FX_COLORS=['#ff39d6','#38a8ff','#48ff72','#ffe24a'];
  const ufoParticles=Array.from({length:UFO_FX_MAX},()=>({
    life:0,maxLife:0,x:0,y:0,vx:0,vy:0,size:0,color:0
  }));
  const ufoEmitAt=new Map();
  const ufoActiveScratch=new Set();
  let ufoFxCursor=0,ufoFxLastAt=0;

  function clearEngineTrailOwner(owner){
    for(const particle of engineParticles){
      if(particle.life>0&&particle.owner===owner)particle.life=0;
    }
  }
  function suppressEngineTrail(owner,on){
    owner=Math.max(0,Math.min(3,Number(owner)||0));
    if(on){
      if(!engineTrailHidden[owner]){
        engineTrailHidden[owner]=true;
        clearEngineTrailOwner(owner);
      }
    }else engineTrailHidden[owner]=false;
  }
  function emitEngineParticle(player,x,y,rot,now,vx,vy){
    const owner=Math.max(0,Math.min(3,Number(player&&player.i)||0));
    if(engineTrailHidden[owner]||now-engineEmitAt[owner]<ENGINE_FX_INTERVAL)return;
    engineEmitAt[owner]=now;

    const rr=rot*Math.PI/180;
    // Frente = (-sin,-cos); por tanto la parte trasera apunta a (sin,cos).
    const backX=Math.sin(rr),backY=Math.cos(rr);
    const sideX=Math.cos(rr),sideY=-Math.sin(rr);
    const jitter=(Math.random()-.5)*10;
    const exhaust=45+Math.random()*45;
    const particle=engineParticles[engineFxCursor];
    engineFxCursor=(engineFxCursor+1)%ENGINE_FX_MAX;

    particle.owner=owner;
    particle.x=x+backX*(SHIP_DRAW_SIZE*.43)+sideX*jitter;
    particle.y=y+backY*(SHIP_DRAW_SIZE*.43)+sideY*jitter;
    particle.vx=(Number(vx)||0)*.18+backX*exhaust+sideX*(Math.random()-.5)*16;
    particle.vy=(Number(vy)||0)*.18+backY*exhaust+sideY*(Math.random()-.5)*16;
    particle.maxLife=.42+Math.random()*.34;
    particle.life=particle.maxLife;

    // Algo mas pequenas de salida que antes, pero con variedad organica:
    // la mayoria son medias, algunas son motas pequenas y unas pocas mayores.
    const sizeRoll=Math.random();
    const baseSize=(isMobile?2.35:1.95)+Math.random()*(isMobile?3.15:2.85);
    particle.size=baseSize*(sizeRoll<.20?.64:(sizeRoll>.86?1.24:1));

    // La gama se decide una sola vez al nacer: amarillo-negro o rojo-negro.
    particle.palette=Math.random()<.5?0:1;
  }
  function drawEngineParticles(now){
    if(!engineFxLastAt){engineFxLastAt=now;return;}
    const elapsed=now-engineFxLastAt;
    engineFxLastAt=now;

    // Si hemos estado en menu/segundo plano, descartamos el rastro antiguo.
    if(elapsed>250){
      for(const particle of engineParticles)particle.life=0;
      return;
    }
    const dt=Math.min(.05,Math.max(0,elapsed/1000));
    if(dt<=0)return;

    // Primero avanzamos todas las particulas una sola vez.
    for(const particle of engineParticles){
      if(particle.life<=0)continue;
      particle.life-=dt;
      if(particle.life<=0)continue;
      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.vx*=Math.pow(.72,dt);
      particle.vy*=Math.pow(.72,dt);
    }

    ctx.save();

    // Cola fria: rojo muy oscuro hasta negro, dibujada en source-over para
    // que los tonos oscuros sigan siendo visibles. Con 'lighter' desaparecerian.
    ctx.globalCompositeOperation='source-over';
    for(const particle of engineParticles){
      if(particle.life<=0)continue;
      const t=particle.life/particle.maxLife;
      const age=1-t;
      if(age<.62)continue;
      // Se encoge continuamente hasta casi desaparecer.
      const radius=Math.max(.28,particle.size*(.10+.90*t));
      const palette=ENGINE_FIRE_PALETTES[particle.palette]||ENGINE_FIRE_PALETTES[0];
      const colorIndex=Math.min(
        palette.length-1,
        Math.max(0,Math.floor(age*(palette.length-1)))
      );
      const tailFade=Math.max(0,1-(age-.62)/.38);
      ctx.globalAlpha=.38*tailFade;
      ctx.fillStyle=palette[colorIndex];
      ctx.beginPath();
      ctx.arc(particle.x,particle.y,radius,0,Math.PI*2);
      ctx.fill();
    }

    // Zona caliente: rojo muy intenso junto a la tobera, perdiendo brillo y
    // saturacion al alejarse. 'lighter' conserva el resplandor inicial.
    ctx.globalCompositeOperation='lighter';
    for(const particle of engineParticles){
      if(particle.life<=0)continue;
      const t=particle.life/particle.maxLife;
      const age=1-t;
      if(age>=.62)continue;
      // Mismo encogimiento desde el nacimiento hasta el final de vida.
      const radius=Math.max(.28,particle.size*(.10+.90*t));
      const palette=ENGINE_FIRE_PALETTES[particle.palette]||ENGINE_FIRE_PALETTES[0];
      const colorIndex=Math.min(
        palette.length-1,
        Math.max(0,Math.floor(age*(palette.length-1)))
      );
      ctx.globalAlpha=.82*(1-age*.55);
      ctx.fillStyle=palette[colorIndex];
      ctx.beginPath();
      ctx.arc(particle.x,particle.y,radius,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  function emitRockDebris(x,y,nx,ny,now){
    const amount=isMobile?(3+Math.floor(Math.random()*3)):(4+Math.floor(Math.random()*3));
    const tx=-ny,ty=nx;
    for(let i=0;i<amount;i++){
      const particle=rockParticles[rockFxCursor];
      rockFxCursor=(rockFxCursor+1)%ROCK_FX_MAX;
      const spread=(Math.random()-.5)*1.35;
      const speed=28+Math.random()*62;
      const dirX=nx+tx*spread,dirY=ny+ty*spread;
      const len=Math.hypot(dirX,dirY)||1;
      particle.life=particle.maxLife=2;
      particle.x=x+(Math.random()-.5)*8;
      particle.y=y+(Math.random()-.5)*8;
      particle.vx=dirX/len*speed;
      particle.vy=dirY/len*speed;
      particle.size=(isMobile?2.5:2.2)+Math.random()*(isMobile?3.8:4.6);
      particle.rot=Math.random()*Math.PI*2;
      particle.spin=(Math.random()-.5)*5;
    }
  }

  function detectGiantAsteroidDebris(now,giant,asteroids){
    const nextContacts=giantRockNextContacts;
    nextContacts.clear();
    if(!giant||!Array.isArray(asteroids)){
      giantRockContacts.clear();
      return;
    }
    const gx=Number(giant.x),gy=Number(giant.y);
    if(!Number.isFinite(gx)||!Number.isFinite(gy))return;

    const rr=GIANT_LOCAL_RADIUS+ASTEROID_LOCAL_RADIUS;
    const rr2=rr*rr;
    for(const asteroid of asteroids){
      if(!asteroid)continue;
      const ax=Number(asteroid.x),ay=Number(asteroid.y);
      if(!Number.isFinite(ax)||!Number.isFinite(ay))continue;
      const dx=ax-gx,dy=ay-gy,d2=dx*dx+dy*dy;
      if(d2>rr2)continue;

      const key=String(asteroid.id);
      nextContacts.add(key);
      if(giantRockContacts.has(key))continue;

      const last=Number(giantRockLastBurst.get(key))||0;
      if(now-last<700)continue;
      giantRockLastBurst.set(key,now);

      const d=Math.sqrt(d2)||1;
      const nx=dx/d,ny=dy/d;
      // Punto aproximado de contacto sobre el borde del meteorito gigante.
      const hitX=gx+nx*GIANT_LOCAL_RADIUS;
      const hitY=gy+ny*GIANT_LOCAL_RADIUS;
      emitRockDebris(hitX,hitY,nx,ny,now);
    }

    giantRockContacts.clear();
    for(const key of nextContacts)giantRockContacts.add(key);

    // Limpieza muy barata de marcas antiguas.
    if(giantRockLastBurst.size>24){
      for(const [key,t] of giantRockLastBurst)if(now-t>5000)giantRockLastBurst.delete(key);
    }
  }

  function drawRockDebris(now){
    if(!rockFxLastAt){rockFxLastAt=now;return;}
    const elapsed=now-rockFxLastAt;
    rockFxLastAt=now;
    if(elapsed>300){
      for(const particle of rockParticles)particle.life=0;
      return;
    }
    const dt=Math.min(.05,Math.max(0,elapsed/1000));
    if(dt<=0)return;

    ctx.save();
    ctx.fillStyle='#8a8d92';
    ctx.strokeStyle='rgba(35,38,42,.55)';
    ctx.lineWidth=1;
    for(const particle of rockParticles){
      if(particle.life<=0)continue;
      particle.life-=dt;
      if(particle.life<=0)continue;

      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.vx*=Math.pow(.58,dt);
      particle.vy*=Math.pow(.58,dt);
      particle.rot+=particle.spin*dt;

      const t=particle.life/particle.maxLife;
      const size=Math.max(.5,particle.size*(.35+.65*t));
      ctx.globalAlpha=Math.min(.86,t*.86);
      ctx.save();
      ctx.translate(particle.x,particle.y);
      ctx.rotate(particle.rot);
      ctx.beginPath();
      ctx.moveTo(-size*.9,-size*.45);
      ctx.lineTo(size*.35,-size);
      ctx.lineTo(size,size*.15);
      ctx.lineTo(size*.15,size*.8);
      ctx.lineTo(-size*.8,size*.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function spawnRocketParticle(x,y,dx,dy,burst=false){
    const particle=rocketParticles[rocketFxCursor];
    rocketFxCursor=(rocketFxCursor+1)%ROCKET_FX_MAX;

    const tx=-dy,ty=dx;
    const spread=(Math.random()-.5)*(burst?1.15:.75);
    const back=burst?(45+Math.random()*90):(30+Math.random()*55);
    const side=(Math.random()-.5)*(burst?34:20);

    particle.x=x+tx*side*.08+dx*(burst?0:-10);
    particle.y=y+ty*side*.08+dy*(burst?0:-10);
    particle.vx=-dx*back+tx*spread*28;
    particle.vy=-dy*back+ty*spread*28;
    particle.maxLife=burst?(.28+Math.random()*.28):(.42+Math.random()*.34);
    particle.life=particle.maxLife;
    particle.size=burst?(3.2+Math.random()*4.8):(2.0+Math.random()*3.5);
  }

  function updateRocketLocalFx(now,bullets,age){
    const active=rocketActiveScratch;
    active.clear();
    for(const b of (Array.isArray(bullets)?bullets:[])){
      if(!b||b.g!==true)continue;
      const id=String(b.id);
      active.add(id);

      const vx=Number(b.vx)||0,vy=Number(b.vy)||0;
      const speed=Math.hypot(vx,vy)||1;
      const dx=vx/speed,dy=vy/speed;
      const x=Number(b.x)+vx*age,y=Number(b.y)+vy*age;

      if(!rocketSeen.has(id)){
        rocketSeen.add(id);
        const burstCount=isMobile?4:6;
        for(let i=0;i<burstCount;i++)spawnRocketParticle(x,y,dx,dy,true);
        rocketEmitAt.set(id,now);
      }

      const last=Number(rocketEmitAt.get(id))||0;
      if(now-last>=ROCKET_FX_INTERVAL){
        rocketEmitAt.set(id,now);
        spawnRocketParticle(x,y,dx,dy,false);
      }
    }

    // Cuando un cohete deja de existir, eliminamos solo sus marcas de control.
    for(const id of rocketSeen){
      if(active.has(id))continue;
      rocketSeen.delete(id);
      rocketEmitAt.delete(id);
    }
  }

  function drawRocketParticles(now){
    if(!rocketFxLastAt){rocketFxLastAt=now;return;}
    const elapsed=now-rocketFxLastAt;
    rocketFxLastAt=now;
    if(elapsed>300){
      for(const particle of rocketParticles)particle.life=0;
      return;
    }
    const dt=Math.min(.05,Math.max(0,elapsed/1000));
    if(dt<=0)return;

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const particle of rocketParticles){
      if(particle.life<=0)continue;
      particle.life-=dt;
      if(particle.life<=0)continue;

      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.vx*=Math.pow(.66,dt);
      particle.vy*=Math.pow(.66,dt);

      const t=particle.life/particle.maxLife;
      const radius=Math.max(.6,particle.size*(.25+.75*t));
      ctx.globalAlpha=Math.min(.9,t*.9);
      ctx.fillStyle=t>.58?'#ffd36a':'#ff6b3d';
      ctx.beginPath();
      ctx.arc(particle.x,particle.y,radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function spawnUfoParticle(ufo,x,y,vx,vy,now,lane){
    const speed=Math.hypot(vx,vy);
    if(speed<4)return;

    const dx=vx/speed,dy=vy/speed;
    const backX=-dx,backY=-dy;
    const sideX=-dy,sideY=dx;
    const idPhase=(Number(ufo&&ufo.id)||0)*37;
    // Misma cadencia angular visual del platillo: el punto de salida recorre
    // lateralmente su parte trasera y genera la sensacion de giro circular.
    const phase=(now*.072+idPhase+(lane===1?120:(lane===2?240:0)))*Math.PI/180;
    const wave=Math.sin(phase),spin=Math.cos(phase);

    const particle=ufoParticles[ufoFxCursor];
    ufoFxCursor=(ufoFxCursor+1)%UFO_FX_MAX;

    const rear=16+Math.random()*5;
    const rim=9+Math.random()*6;
    particle.x=x+backX*rear+sideX*wave*rim;
    particle.y=y+backY*rear+sideY*wave*rim;

    const exhaust=38+Math.random()*42;
    const curl=spin*(28+Math.random()*24)+(Math.random()-.5)*14;
    particle.vx=backX*exhaust+sideX*curl;
    particle.vy=backY*exhaust+sideY*curl;

    particle.maxLife=.60+Math.random()*.45;
    particle.life=particle.maxLife;
    particle.size=(isMobile?1.75:1.35)+Math.random()*(isMobile?1.95:1.75);
    particle.color=Math.floor(Math.random()*UFO_FX_COLORS.length);
  }

  function updateUfoLocalFx(now,ufos,blend){
    const active=ufoActiveScratch;
    active.clear();

    for(const ufo of (Array.isArray(ufos)?ufos:[])){
      if(!ufo||ufo.id==null)continue;
      const id=String(ufo.id);
      active.add(id);

      const old=previousLookup.ufo.get(ufo.id);
      const x=old?lerp(old.x,ufo.x,blend):Number(ufo.x)||0;
      const y=old?lerp(old.y,ufo.y,blend):Number(ufo.y)||0;
      let vx=Number(ufo.vx)||0,vy=Number(ufo.vy)||0;

      // Respaldo puramente visual por si un snapshot antiguo no trae velocidad.
      if(Math.hypot(vx,vy)<4&&old){
        const factor=1000/Math.max(20,smoothedStateInterval||NET_FRAME_MS);
        vx=(Number(ufo.x)-Number(old.x))*factor;
        vy=(Number(ufo.y)-Number(old.y))*factor;
      }
      if(Math.hypot(vx,vy)<4)continue;

      const last=Number(ufoEmitAt.get(id))||0;
      if(now-last<UFO_FX_INTERVAL)continue;
      ufoEmitAt.set(id,now);

      spawnUfoParticle(ufo,x,y,vx,vy,now,0);
      spawnUfoParticle(ufo,x,y,vx,vy,now,1);
      if(!isMobile)spawnUfoParticle(ufo,x,y,vx,vy,now,2);
    }

    for(const id of ufoEmitAt.keys()){
      if(!active.has(id))ufoEmitAt.delete(id);
    }
  }

  function drawUfoParticles(now){
    if(!ufoFxLastAt){ufoFxLastAt=now;return;}
    const elapsed=now-ufoFxLastAt;
    ufoFxLastAt=now;

    // Evita recuperar una estela vieja tras menu, cambio de pestaña o pausa.
    if(elapsed>300){
      for(const particle of ufoParticles)particle.life=0;
      return;
    }
    const dt=Math.min(.05,Math.max(0,elapsed/1000));
    if(dt<=0)return;

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const particle of ufoParticles){
      if(particle.life<=0)continue;
      particle.life-=dt;
      if(particle.life<=0)continue;

      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      particle.vx*=Math.pow(.70,dt);
      particle.vy*=Math.pow(.70,dt);

      const t=particle.life/particle.maxLife;
      const radius=Math.max(.3,particle.size*(.16+.84*t));
      ctx.globalAlpha=Math.min(.82,t*.86);
      ctx.fillStyle=UFO_FX_COLORS[particle.color]||UFO_FX_COLORS[0];
      ctx.beginPath();
      ctx.arc(particle.x,particle.y,radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Cache de textos del HUD: evita crear cientos de strings por segundo.
  const hudValueCache=[0,1,2,3].map(()=>({ammoValue:null,ammoText:'',speedValue:null,speedText:'',killValue:null,scoreToWin:null,killText:''}));
  function hudAmmoText(p){
    const c=hudValueCache[p.i]||hudValueCache[0],v=Number(p.ammo)||0;
    if(c.ammoValue!==v){c.ammoValue=v;c.ammoText=String(v);}
    return c.ammoText;
  }
  function hudSpeedText(p){
    const c=hudValueCache[p.i]||hudValueCache[0],v=Number(p.spd)||0;
    if(c.speedValue!==v){c.speedValue=v;c.speedText='x'+v;}
    return c.speedText;
  }
  function hudKillText(p,scoreToWin,displayedKills){
    const c=hudValueCache[p.i]||hudValueCache[0],k=Number(displayedKills)||0,w=Number(scoreToWin)||0;
    if(c.killValue!==k||c.scoreToWin!==w){c.killValue=k;c.scoreToWin=w;c.killText=String(k)+'/'+String(w);}
    return c.killText;
  }
  // Estilos RGBA precalculados para FANTASMA. Evita toFixed/template strings
  // en cada frame mientras dura el camuflaje.
  const ghostFillStyles=playerRgb.map(rgb=>new Array(16));
  const ghostBorderStyles=playerRgb.map(rgb=>new Array(16));
  for(let pi=0;pi<playerRgb.length;pi++){
    const rgb=playerRgb[pi];
    for(let step=0;step<16;step++){
      const wave=step/15;
      ghostFillStyles[pi][step]='rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(0.22+0.08*wave).toFixed(3)+')';
      ghostBorderStyles[pi][step]='rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(0.34+0.10*wave).toFixed(3)+')';
    }
  }
  const voice=typeof window.GalaxyVoice==='function'?new window.GalaxyVoice({send:o=>send(o),isMobile}):null;
  let backgroundCache=null,backgroundCacheW=0,backgroundCacheH=0;
  function activeMobileBackground(){
    const cfg=MATCH_BACKGROUNDS[currentMatchBackground]||MATCH_BACKGROUNDS[0];
    const candidate=images[cfg.mobileKey];
    return imageReady(candidate)?candidate:images.bg;
  }
  function matchBackgroundAvailable(index){
    if(index===0)return true;
    const cfg=MATCH_BACKGROUNDS[index];
    return !!(cfg&&imageReady(images[cfg.mobileKey]));
  }
  function applyMatchBackground(index){
    currentMatchBackground=Math.max(0,Math.min(MATCH_BACKGROUNDS.length-1,Number(index)||0));
    const cfg=MATCH_BACKGROUNDS[currentMatchBackground]||MATCH_BACKGROUNDS[0];
    if(useStaticPcBackground){
      // El fondo base queda como fallback si los fondos alternativos aun no existen o fallan.
      canvas.style.backgroundImage=currentMatchBackground===0
        ? "url('assets/sprites/fondo.jpg')"
        : "url('"+cfg.file+"'),url('assets/sprites/fondo.jpg')";
    }else{
      backgroundCache=null;backgroundCacheW=0;backgroundCacheH=0;
      rebuildBackgroundCache();
    }
  }
  function selectNextMatchBackground(){
    for(let step=1;step<=MATCH_BACKGROUNDS.length;step++){
      const candidate=(matchBackgroundCursor+step)%MATCH_BACKGROUNDS.length;
      if(matchBackgroundAvailable(candidate)){
        matchBackgroundCursor=candidate;
        currentMatchBackgroundRound=0;
        applyMatchBackground(candidate);
        return candidate;
      }
    }
    matchBackgroundCursor=0;currentMatchBackgroundRound=0;applyMatchBackground(0);return 0;
  }
  function selectMatchBackgroundForRound(round){
    const safeRound=Math.max(1,Number(round)||1);
    // V20.84: online la ronda manda SIEMPRE sobre el fondo. No sustituimos
    // el indice por fondo.jpg segun la velocidad de carga de cada dispositivo:
    // todos conservan el mismo candidato y activeMobileBackground() usa fondo.jpg
    // solo de forma temporal hasta que el JPG correspondiente termina de cargar.
    const candidate=(safeRound-1)%MATCH_BACKGROUNDS.length;
    currentMatchBackgroundRound=safeRound;
    matchBackgroundCursor=candidate;
    applyMatchBackground(candidate);
    return candidate;
  }
  function rebuildBackgroundCache(){
    if(useStaticPcBackground)return;
    const bg=activeMobileBackground();
    if(!imageReady(bg)||!canvas.width||!canvas.height)return;
    if(backgroundCacheW===canvas.width&&backgroundCacheH===canvas.height&&backgroundCache)return;
    const cached=document.createElement('canvas');
    cached.width=canvas.width;cached.height=canvas.height;
    const c=cached.getContext('2d',{alpha:false});
    if(!c)return;
    c.setTransform(1,0,0,1,0,0);
    c.globalAlpha=1;
    c.globalCompositeOperation='source-over';
    c.imageSmoothingEnabled=true;
    // Cubrir siempre todo el backing canvas antes de cachear el fondo. Esto
    // evita que Safari/iPadOS pueda conservar pixeles de un buffer anterior.
    c.fillStyle='#020714';
    c.fillRect(0,0,cached.width,cached.height);
    try{c.drawImage(bg,0,0,cached.width,cached.height);}catch(_){return;}
    backgroundCache=cached;backgroundCacheW=cached.width;backgroundCacheH=cached.height;
  }
  function updateCanvasResolution(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    // iOS/Safari agradece un buffer algo menor: en una pantalla de telefono
    // 1.2 pixeles internos por pixel CSS mantiene buena nitidez y reduce el
    // trabajo de rasterizado por frame. El mundo/fisica sigue en 1920x1080.
    const maxWidth=isIOS?1152:(isMobile?1280:W);
    const dpr=Math.min(window.devicePixelRatio||1,isIOS?1.20:(isMobile?1.35:1.6));
    const fitScale=Math.min(1,maxWidth/W,(rect.width*dpr)/W,(rect.height*dpr)/H);
    const safeScale=Math.max(1/3,fitScale);
    const targetW=Math.max(640,Math.min(maxWidth,Math.round((W*safeScale)/2)*2));
    const targetH=Math.round(targetW*H/W);
    if(canvas.width!==targetW||canvas.height!==targetH){
      canvas.width=targetW;canvas.height=targetH;
      backgroundCache=null;backgroundCacheW=0;backgroundCacheH=0;
    }
    renderScale=canvas.width/W;
    rebuildBackgroundCache();
    invalidateMobileVoiceLayout();
  }
  let resizeRaf=0;
  function scheduleCanvasResolution(){
    if(resizeRaf)return;
    resizeRaf=requestAnimationFrame(()=>{resizeRaf=0;updateCanvasResolution();});
  }
  const motionStatus=document.getElementById('motionStatus');
  const mobileControls=document.getElementById('mobileControls'),fireZone=document.querySelector('.fire-zone'),thrustZone=document.querySelector('.thrust-zone');
  const mobileExit=document.getElementById('mobileExit');
  const mobileControlMotionBtn=document.getElementById('mobileControlMotion'),mobileControlButtonsBtn=document.getElementById('mobileControlButtons');
  const mobileTurnPad=document.getElementById('mobileTurnPad'),mobileTurnLeft=document.getElementById('mobileTurnLeft'),mobileTurnRight=document.getElementById('mobileTurnRight'),mobileActionZone=document.getElementById('mobileActionZone');
  const voicePttEl=document.getElementById('voicePtt');
  // V19.76: la posicion del micro se mide solo cuando cambia el layout. Antes
  // getBoundingClientRect() se ejecutaba en cada frame y podia forzar layout
  // sincronico en Safari/iOS durante partidas largas.
  const mobileVoiceLayout={dirty:true,valid:false,buttonMode:false,x:W/2,y:H-96,radius:38};
  function invalidateMobileVoiceLayout(){mobileVoiceLayout.dirty=true;}
  function refreshMobileVoiceLayout(buttonMode){
    if(!isMobile||!voicePttEl||voicePttEl.classList.contains('hidden')){
      mobileVoiceLayout.valid=false;
      return mobileVoiceLayout;
    }
    if(!mobileVoiceLayout.dirty&&mobileVoiceLayout.valid&&mobileVoiceLayout.buttonMode===buttonMode)return mobileVoiceLayout;
    const pr=voicePttEl.getBoundingClientRect();
    const cr=canvas.getBoundingClientRect();
    if(pr.width>0&&pr.height>0&&cr.width>0&&cr.height>0){
      mobileVoiceLayout.x=((pr.left+pr.width*.5-cr.left)/cr.width)*W;
      mobileVoiceLayout.y=((pr.top+pr.height*.5-cr.top)/cr.height)*H;
      mobileVoiceLayout.radius=buttonMode?(pr.width/cr.width)*W*.5:38;
      mobileVoiceLayout.valid=true;
      mobileVoiceLayout.buttonMode=buttonMode;
      mobileVoiceLayout.dirty=false;
    }else{
      mobileVoiceLayout.valid=false;
    }
    return mobileVoiceLayout;
  }
  // V19.20: en movil solo existe el control por botones/tacto.
  // Se elimina la seleccion y no se solicita permiso de giroscopio.
  const mobileControlMode='buttons';
  let mobileButtonTurn=0;
  let mobileTurnTarget=0,mobileTurnStartedAt=0;
  const MOBILE_TURN_START=0.28;
  const MOBILE_TURN_RAMP_MS=420;
  let mobileKeyboardActive=false;
  const MOBILE_KEYBOARD_CODES=new Set(['KeyA','KeyD','KeyW','ArrowLeft','ArrowRight','ArrowUp','Space','ControlLeft','ControlRight']);
  const mobileLeftPointers=new Set(),mobileRightPointers=new Set();
  // En modo BOTONES la mitad izquierda completa se dedica al giro:
  // cuarto izquierdo = giro izquierda, cuarto siguiente = giro derecha.
  // La mitad derecha queda exclusivamente para disparar/acelerar.
  // Las flechas siguen siendo la referencia visual, pero ya no son el unico hit-area.
  if(isMobile){
    const fireLabel=fireZone&&fireZone.querySelector('span');
    const thrustLabel=thrustZone&&thrustZone.querySelector('span');
    if(fireLabel)fireLabel.style.visibility='hidden';
    if(thrustLabel)thrustLabel.style.visibility='hidden';
  }
  let motionEnabled=false,motionTurn=0,motionNeutral=null,motionLastRaw=0,motionHasSample=false;
  let lastMotionSampleAt=0;
  let mobileFire=false,mobileThrust=false;
  const MOBILE_HOLD_MS=190;
  const MOBILE_FIRE_PULSE_MS=120;
  // V19.71: el segundo toque rapido se reconoce de forma explicita como
  // lanzamiento de bengalas. Antes dependia de que dos pulsos de 120 ms se
  // solaparan por casualidad, por eso en movil a veces no salian.
  const MOBILE_FLARE_DOUBLE_TAP_MS=360;
  const MOBILE_FLARE_PULSE_MS=300;
  let mobileFireTimer=null,lastMobileFireTapAt=0;
  const touchGestures=new Map();
  const mobileTouchRoles=new Map();

  // Solo quitamos el acento de las vocales; se conserva la letra enie.
  // NFC admite nombres escritos o pegados con acentos combinados.
  const vocalesSinTilde={
    '\u00e1':'a','\u00e9':'e','\u00ed':'i','\u00f3':'o','\u00fa':'u',
    '\u00c1':'A','\u00c9':'E','\u00cd':'I','\u00d3':'O','\u00da':'U'
  };
  function sinTildes(valor){
    return String(valor==null?'':valor).normalize('NFC').replace(
      /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da]/g,
      letra=>vocalesSinTilde[letra]
    );
  }
  const hudNameCache=[null,null,null,null];
  function hudPlayerName(p){
    const idx=Number(p&&p.i);
    const source=String(p&&p.n!=null?p.n:'');
    const cached=Number.isInteger(idx)?hudNameCache[idx]:null;
    if(cached&&cached.source===source)return cached.value;
    const raw=sinTildes(source).trim();
    const upper=raw.toUpperCase();
    const defaultNames=['JUGADOR','PLAYER','GIOCATORE','JOUEUR','SPIELER'];
    const isDefaultName=defaultNames.includes(upper)||defaultNames.some(name=>upper===`${name} ${idx+1}`);
    const value=(!raw||isDefaultName)?`J${idx+1}`:raw;
    if(Number.isInteger(idx)&&idx>=0&&idx<hudNameCache.length)hudNameCache[idx]={source,value};
    return value;
  }
  const campoNombre=document.getElementById('name');
  function normalizarNombreVisible(){
    const anterior=campoNombre.value,nuevo=sinTildes(anterior);
    if(nuevo===anterior)return;
    const inicio=campoNombre.selectionStart,fin=campoNombre.selectionEnd;
    campoNombre.value=nuevo;
    if(inicio!==null&&fin!==null){
      campoNombre.setSelectionRange(
        sinTildes(anterior.slice(0,inicio)).length,
        sinTildes(anterior.slice(0,fin)).length
      );
    }
  }
  campoNombre.addEventListener('input',e=>{
    if(!e.isComposing)normalizarNombreVisible();
  });
  campoNombre.addEventListener('compositionend',normalizarNombreVisible);

  const assetList={
    bg:isMobile?'assets/sprites/fondo_1280.jpg':null,
    bg02:isMobile?'assets/sprites/fondo02_1280.jpg':'assets/sprites/fondo02.jpg',
    bg03:isMobile?'assets/sprites/fondo03_1280.jpg':'assets/sprites/fondo03.jpg',
    bg04:isMobile?'assets/sprites/fondo04_1280.jpg':'assets/sprites/fondo04.jpg',
    bg05:isMobile?'assets/sprites/fondo05_1280.jpg':'assets/sprites/fondo05.jpg',
    giant:'assets/sprites/asteroidegrande_270.png',
    ufo:'assets/sprites/ovni.png?v=V21.63',
    pantA:'assets/sprites/pantA.png',pantB:'assets/sprites/pantB.png',pantC:'assets/sprites/pantC.png',pantD:'assets/sprites/pantD.png',
    ammo1:'assets/sprites/municion1.png',ammo3:'assets/sprites/municion3.png',cadence:'assets/sprites/cadencia.png',speed:'assets/sprites/velocidad.png',
    bengala:'assets/sprites/bengala.png',bengalahud:'assets/sprites/bengalahud.png',bengalasnave:'assets/sprites/bengalasnave.png',ojo:'assets/sprites/ojo.png',
    mira1:'assets/sprites/mira1.png',coete:'assets/sprites/coete.png',navemira:'assets/sprites/navemira.png',
    rocketA:'assets/sprites/coeteA.png',rocketB:'assets/sprites/coeteB.png',rocketC:'assets/sprites/coeteC.png',rocketD:'assets/sprites/coeteD.png',
    navemiraA:'assets/sprites/navemiraA.png',navemiraB:'assets/sprites/navemiraB.png',navemiraC:'assets/sprites/navemiraC.png',navemiraD:'assets/sprites/navemiraD.png',
    localizaA:'assets/sprites/localizaA.png',localizaB:'assets/sprites/localizaB.png',localizaC:'assets/sprites/localizaC.png',localizaD:'assets/sprites/localizaD.png',
    asteroid1:'assets/sprites/asteroide1.png',asteroid2:'assets/sprites/asteroide2.png',asteroid3:'assets/sprites/asteroide3.png',asteroid4:'assets/sprites/asteroide5.png',asteroid5:'assets/sprites/asteroide6.png',asteroid6:'assets/sprites/dos.png'
  };
  for(let i=1;i<=4;i++){
    assetList[`ship${i}`]=`assets/sprites/coete${i}.png`;
    assetList[`ship${i}a`]=`assets/sprites/coete${i}a.png`;
    assetList[`ship${i}f`]=`assets/sprites/coete${i}f.png`;
    assetList[`ship${i}af`]=`assets/sprites/coete${i}af.png`;
  }
  const warnedImages=new WeakSet();
  function reportImageFailure(im,error){
    if(!im||warnedImages.has(im))return;
    warnedImages.add(im);
    console.warn('[Galaxy Combat] Image unavailable; continuing without blocking the game.',im.currentSrc||im.src,error||'');
  }
  function decodeImageSafely(im,timeoutMs){
    return new Promise(resolve=>{
      let settled=false;
      const done=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
      const timer=setTimeout(()=>done(false),timeoutMs);
      try{
        if(typeof im.decode!=='function'){done(true);return;}
        const p=im.decode();
        if(p&&typeof p.then==='function')p.then(()=>done(true),()=>done(false));
        else done(true);
      }catch(_){done(false);}
    });
  }
  const imageDecodePromises={};
  for(const [k,url] of Object.entries(assetList)){
    if(!url)continue;
    const im=new Image();
    im.decoding='async';
    // Estos sprites aparecen desde el primer frame. Antes los asteroides tenian
    // prioridad baja y podian terminar de descargarse/decodificarse ya jugando.
    const critical=k==='bg'||k==='giant'||k==='ufo'||k.startsWith('ship')||k.startsWith('pant')||
      k.startsWith('asteroid')||k.startsWith('rocket')||k.startsWith('navemira')||k==='ammo1'||k==='ammo3'||k==='cadence'||k==='speed'||k==='bengala'||k==='bengalahud'||k==='bengalasnave'||k==='ojo';
    if('fetchPriority' in im)im.fetchPriority=critical?'high':'auto';
    imageDecodePromises[k]=new Promise(resolve=>{
      let settled=false;
      const done=value=>{if(settled)return;settled=true;clearTimeout(loadTimer);resolve(value);};
      const loadTimer=setTimeout(()=>{
        reportImageFailure(im,'load timeout');
        done(false);
      },isMobile?10000:15000);
      im.onerror=()=>{reportImageFailure(im);done(false);};
      im.onload=()=>{
        decodeImageSafely(im,isMobile?1200:2500).then(decoded=>{
          if(k==='bg'||k==='bg02'||k==='bg03'||k==='bg04'||k==='bg05'){
            backgroundCache=null;backgroundCacheW=0;backgroundCacheH=0;
            scheduleCanvasResolution();
          }
          done(decoded!==false);
        },()=>done(false));
      };
    });
    if(window.GalaxyGraphicsLoader)window.GalaxyGraphicsLoader.track(imageDecodePromises[k]);
    im.src=url;
    images[k]=im;
  }

  let rendererWarmed=false;
  function warmRendererCaches(){
    if(rendererWarmed)return;
    rendererWarmed=true;
    // Fuerza durante el menu las primeras subidas de texturas y rutas costosas
    // de Canvas (fuente, shadow blur y modos screen/lighter). Asi no aparecen
    // como compilacion/transferencia puntual durante los primeros disparos.
    try{
      const c=document.createElement('canvas');c.width=256;c.height=256;
      const g=c.getContext('2d',{alpha:true});
      if(!g)return;
      let x=0,y=0;
      for(const im of Object.values(images)){
        if(!imageReady(im))continue;
        try{g.drawImage(im,x,y,32,32);}catch(_){}
        x+=34;if(x>220){x=0;y+=34;if(y>200)y=0;}
      }
      g.font='20px Flashback,Arial';
      g.fillStyle='#fff';g.fillText('GALAXY 0123456789',4,238);
      g.shadowColor='rgba(90,225,255,.95)';g.shadowBlur=48;
      g.fillText('READY',120,238);
      g.shadowBlur=0;
      g.globalCompositeOperation='screen';g.fillRect(0,0,8,8);
      g.globalCompositeOperation='lighter';g.fillRect(10,0,8,8);
      g.globalCompositeOperation='source-over';
    }catch(_){}
  }
  let gameAssetsReady=false,gameAssetsPromise=null,gameAssetsIdleHandle=0;
  function prepareGameAssets(){
    if(gameAssetsReady)return Promise.resolve(true);
    if(gameAssetsPromise)return gameAssetsPromise;
    const fontPromise=(document.fonts&&typeof document.fonts.load==='function')
      ?Promise.allSettled([
        document.fonts.load('20px Flashback'),
        document.fonts.load('64px Flashback'),
        document.fonts.load('180px Flashback')
      ])
      :Promise.resolve();
    gameAssetsPromise=Promise.allSettled([...Object.values(imageDecodePromises),fontPromise]).then(()=>{
      // Construye la cache grande del fondo mientras aun estamos en menu/lobby,
      // no durante los primeros frames de la partida.
      updateCanvasResolution();
      warmRendererCaches();
      warmOnlineStartCaches(true);
      gameAssetsReady=true;
      return true;
    });
    return gameAssetsPromise;
  }
  function warmGameAssetsWhenIdle(){
    if(gameAssetsReady||gameAssetsPromise||gameAssetsIdleHandle)return;
    const run=()=>{gameAssetsIdleHandle=0;prepareGameAssets();};
    if(typeof requestIdleCallback==='function')gameAssetsIdleHandle=requestIdleCallback(run,{timeout:900});
    else gameAssetsIdleHandle=setTimeout(run,350);
  }
  warmGameAssetsWhenIdle();
  const AUDIO_ASSET_VERSION=String(window.GALAXY_BUILD&&window.GALAXY_BUILD.version||'dev');
  const soundDefs={
    laser:{url:'assets/sonido/laser_1.mp3?v='+AUDIO_ASSET_VERSION,size:8,volume:.55},
    impact:{url:'assets/sonido/impacto1.mp3?v='+AUDIO_ASSET_VERSION,size:5,volume:.75},
    pickup:{url:'assets/sonido/carga3.wav?v='+AUDIO_ASSET_VERSION,size:3,volume:.75},
    start:{url:'assets/sonido/inicio.wav?v='+AUDIO_ASSET_VERSION,size:1,volume:.75}
  };
  // Web Audio tambien en PC: cada efecto se descarga/decodifica una sola vez.
  // Los antiguos pools de varios <audio> podian provocar microtirones en los
  // primeros disparos/impactos al activar decodificadores distintos.
  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  const useWebAudio=!!AudioContextCtor;
  const gameVolume=isMobile?0.45:0.75;
  let gameAudioEnabled=true,audioUnlocked=false;
  // V22.05: en iPhone/iPad WebAudio puede quedar en la sesion "ambient" y
  // respetar el modo silencio del telefono. Forzamos "playback" mientras no
  // haya captura de voz para que musica y efectos sean audio multimedia normal.
  function usePlaybackAudioSession(){
    if(window.GalaxyVoiceCaptureActive)return false;
    try{
      if(navigator.audioSession&&'type' in navigator.audioSession){
        navigator.audioSession.type='playback';
        return true;
      }
    }catch(_){}
    return false;
  }
  usePlaybackAudioSession();
  const soundPools={};
  if(!useWebAudio){
    for(const [key,def] of Object.entries(soundDefs)){
      const items=[];
      for(let i=0;i<def.size;i++){
        const a=new Audio(def.url);a.preload='auto';a.volume=def.volume*gameVolume;items.push(a);
      }
      soundPools[key]={items,next:0};
    }
  }
  // V22.04: la musica del menu usa un elemento HTMLAudio independiente.
  // Los efectos siguen usando WebAudio. En iPhone esto evita que la musica
  // dependa de que el AudioContext del juego haya sido desbloqueado por el micro.
  sounds.music=new Audio('assets/sonido/musica.mp3?v='+AUDIO_ASSET_VERSION);
  sounds.music.preload='auto';sounds.music.loop=true;sounds.music.volume=.35*gameVolume;
  sounds.music.setAttribute('playsinline','');

  let audioCtx=null,masterGain=null,fxGain=null,musicGain=null;
  let webAudioLoadPromise=null,webMusicLoadPromise=null,webMusicSource=null,webMusicIdleHandle=0;
  const webAudioBuffers={};
  const webEffectGains={};
  function cleanupWebEffectSource(){
    try{this.disconnect();}catch(_){}
  }

  function ensureAudioContext(){
    usePlaybackAudioSession();
    if(!useWebAudio)return null;
    if(!audioCtx){
      audioCtx=new AudioContextCtor();
      masterGain=audioCtx.createGain();
      fxGain=audioCtx.createGain();
      musicGain=audioCtx.createGain();
      masterGain.gain.value=1;
      fxGain.gain.value=gameVolume;
      musicGain.gain.value=.35*gameVolume;
      fxGain.connect(masterGain);
      musicGain.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    }
    if(audioCtx.state!=='running'){
      try{const p=audioCtx.resume();if(p&&p.catch)p.catch(()=>{});}catch(_){}
    }
    return audioCtx;
  }

  async function loadWebAudio(){
    const ctx=ensureAudioContext();
    if(!ctx)return false;
    if(webAudioLoadPromise)return webAudioLoadPromise;
    webAudioLoadPromise=(async()=>{
      // Solo efectos de juego (~0,5 MB). La musica (~2,9 MB) se decodifica
      // aparte cuando el navegador esta ocioso en el menu.
      for(const [key,def] of Object.entries(soundDefs)){
        if(webAudioBuffers[key])continue;
        const res=await fetch(def.url,{cache:'force-cache'});
        if(!res.ok)throw new Error('audio '+key+' '+res.status);
        const data=await res.arrayBuffer();
        webAudioBuffers[key]=await ctx.decodeAudioData(data.slice(0));
      }
      return true;
    })().catch(err=>{
      console.warn('[Galaxy Combat] Web Audio no disponible:',err);
      webAudioLoadPromise=null;
      return false;
    });
    return webAudioLoadPromise;
  }

  async function loadWebMusic(){
    const ctx=ensureAudioContext();
    if(!ctx)return false;
    if(webAudioBuffers.music)return true;
    if(webMusicLoadPromise)return webMusicLoadPromise;
    webMusicLoadPromise=(async()=>{
      const url='assets/sonido/musica.mp3?v='+AUDIO_ASSET_VERSION;
      const res=await fetch(url,{cache:'force-cache'});
      if(!res.ok)throw new Error('audio music '+res.status);
      const data=await res.arrayBuffer();
      webAudioBuffers.music=await ctx.decodeAudioData(data.slice(0));
      return true;
    })().catch(err=>{
      console.warn('[Galaxy Combat] Musica Web Audio no disponible:',err);
      webMusicLoadPromise=null;
      return false;
    });
    return webMusicLoadPromise;
  }

  function warmWebMusicWhenIdle(){
    if(!useWebAudio||webAudioBuffers.music||webMusicLoadPromise||webMusicIdleHandle||!menu||menu.classList.contains('hidden'))return;
    const run=()=>{
      webMusicIdleHandle=0;
      if(!menu||menu.classList.contains('hidden')||!gameAudioEnabled)return;
      loadWebMusic().then(ok=>{if(ok&&menu&&!menu.classList.contains('hidden')&&gameAudioEnabled)playWebMusic();});
    };
    if(typeof requestIdleCallback==='function')webMusicIdleHandle=requestIdleCallback(run,{timeout:1200});
    else webMusicIdleHandle=setTimeout(run,650);
  }

  function playWebEffect(key){
    if(!useWebAudio||!audioCtx||audioCtx.state!=='running'||!webAudioBuffers[key]||!gameAudioEnabled)return false;
    try{
      const def=soundDefs[key];
      let gain=webEffectGains[key];
      if(!gain){
        gain=audioCtx.createGain();
        gain.gain.value=def?def.volume:1;
        gain.connect(fxGain);
        webEffectGains[key]=gain;
      }
      // Un BufferSource es de un solo uso por diseno de WebAudio, pero el Gain
      // y el callback se reutilizan. Antes cada disparo creaba ambos de nuevo.
      const src=audioCtx.createBufferSource();
      src.buffer=webAudioBuffers[key];
      src.connect(gain);
      src.onended=cleanupWebEffectSource;
      src.start(0);
      return true;
    }catch(_){return false;}
  }

  let lastSparkleAt=0;
  function playSparkleSound(){
    if(!useWebAudio||!gameAudioEnabled)return false;
    const ctx=ensureAudioContext();
    if(!ctx||ctx.state!=='running'||!fxGain)return false;
    const nowMs=performance.now();
    if(nowMs-lastSparkleAt<75)return true;
    lastSparkleAt=nowMs;
    try{
      // V20.33: ascuas/chispas mas presentes. Mezclamos pequenos tonos
      // metalicos con un soplo filtrado de ruido para que se oiga incluso
      // con musica y otros efectos, sin parecer una explosion.
      const now=ctx.currentTime;
      const bus=ctx.createGain();
      bus.gain.setValueAtTime(.0001,now);
      bus.gain.exponentialRampToValueAtTime(.62,now+.006);
      bus.gain.exponentialRampToValueAtTime(.0001,now+.46);
      bus.connect(fxGain);

      // Crujido/ascua: ruido muy corto filtrado en agudos.
      const frames=Math.max(1,Math.floor(ctx.sampleRate*.24));
      const buffer=ctx.createBuffer(1,frames,ctx.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<frames;i++){
        const env=1-i/frames;
        const gate=((i*17)%97)<18?1:.22;
        data[i]=(Math.random()*2-1)*env*gate;
      }
      const noise=ctx.createBufferSource();
      const hp=ctx.createBiquadFilter();
      const ng=ctx.createGain();
      noise.buffer=buffer;
      hp.type='highpass';hp.frequency.value=1700;hp.Q.value=.7;
      ng.gain.setValueAtTime(.18,now);
      ng.gain.exponentialRampToValueAtTime(.0001,now+.24);
      noise.connect(hp);hp.connect(ng);ng.connect(bus);
      noise.start(now);noise.stop(now+.245);

      const freqs=[1650,2140,2780,3460,4250];
      const delays=[0,.035,.078,.126,.182];
      for(let i=0;i<freqs.length;i++){
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        const start=now+delays[i];
        const stop=start+.12+i*.012;
        osc.type=i%2?'sine':'triangle';
        osc.frequency.setValueAtTime(freqs[i],start);
        osc.frequency.exponentialRampToValueAtTime(freqs[i]*1.07,stop);
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.exponentialRampToValueAtTime(.12-i*.012,start+.004);
        gain.gain.exponentialRampToValueAtTime(.0001,stop);
        osc.connect(gain);gain.connect(bus);
        osc.start(start);osc.stop(stop+.01);
      }
      return true;
    }catch(_){return false;}
  }

  function playShockwaveSound(){
    if(!useWebAudio||!gameAudioEnabled)return false;
    const ctx=ensureAudioContext();
    if(!ctx||ctx.state!=='running'||!fxGain)return false;
    try{
      const now=ctx.currentTime;
      const bus=ctx.createGain();
      bus.gain.setValueAtTime(.0001,now);
      bus.gain.exponentialRampToValueAtTime(.78,now+.018);
      bus.gain.exponentialRampToValueAtTime(.0001,now+1.35);
      bus.connect(fxGain);

      const low=ctx.createOscillator();
      const lowGain=ctx.createGain();
      low.type='sine';
      low.frequency.setValueAtTime(92,now);
      low.frequency.exponentialRampToValueAtTime(38,now+1.25);
      lowGain.gain.setValueAtTime(.0001,now);
      lowGain.gain.exponentialRampToValueAtTime(.95,now+.02);
      lowGain.gain.exponentialRampToValueAtTime(.0001,now+1.30);
      low.connect(lowGain);lowGain.connect(bus);
      low.start(now);low.stop(now+1.32);

      const body=ctx.createOscillator();
      const bodyGain=ctx.createGain();
      body.type='triangle';
      body.frequency.setValueAtTime(155,now);
      body.frequency.exponentialRampToValueAtTime(62,now+.95);
      bodyGain.gain.setValueAtTime(.0001,now);
      bodyGain.gain.exponentialRampToValueAtTime(.22,now+.012);
      bodyGain.gain.exponentialRampToValueAtTime(.0001,now+1.0);
      body.connect(bodyGain);bodyGain.connect(bus);
      body.start(now);body.stop(now+1.02);

      return true;
    }catch(_){return false;}
  }

  function playWebMusic(){
    if(!useWebAudio||!gameAudioEnabled||!menu||menu.classList.contains('hidden'))return false;
    const ctx=ensureAudioContext();
    if(!ctx||ctx.state!=='running'||!webAudioBuffers.music)return false;
    if(webMusicSource)return true;
    try{
      const src=ctx.createBufferSource();
      src.buffer=webAudioBuffers.music;src.loop=true;src.connect(musicGain);
      src.onended=()=>{if(webMusicSource===src)webMusicSource=null;};
      src.start(0);webMusicSource=src;musicStarted=true;return true;
    }catch(_){return false;}
  }

  function stopWebMusic(){
    if(!webMusicSource)return;
    const src=webMusicSource;webMusicSource=null;
    try{src.onended=null;src.stop(0);src.disconnect();}catch(_){}
  }

  async function unlockGameAudio(){
    if(useWebAudio){
      ensureAudioContext();
      const ok=await loadWebAudio();
      audioUnlocked=!!ok;
      return audioUnlocked;
    }
    if(audioUnlocked)return true;
    let successCount=0;
    const tests=[];
    for(const pool of Object.values(soundPools)){
      const a=pool&&pool.items&&pool.items[0];
      if(!a)continue;
      const oldVolume=a.volume;
      try{
        a.volume=0;a.currentTime=0;
        const p=a.play();
        if(p&&typeof p.then==='function'){
          tests.push(p.then(()=>{successCount++;try{a.pause();a.currentTime=0;a.volume=oldVolume;}catch(_){}}).catch(()=>{try{a.volume=oldVolume;}catch(_){}}));
        }else{successCount++;a.pause();a.currentTime=0;a.volume=oldVolume;}
      }catch(_){try{a.volume=oldVolume;}catch(__){}}
    }
    if(tests.length)await Promise.allSettled(tests);
    audioUnlocked=successCount>0;
    return audioUnlocked;
  }
  function loadJoystickPreference(){
    // V21.73: el modo sigue siendo solo PC, pero el mapa personalizado se
    // conserva en este navegador aunque JOYSTICK empiece desactivado.
    loadJoystickMap();
    joystickEnabled=false;
    if(isMobile&&joystickToggleButton){
      joystickToggleButton.style.display='none';
      joystickToggleButton.setAttribute('aria-hidden','true');
      joystickToggleButton.tabIndex=-1;
    }
  }
  function saveJoystickPreference(){
    try{localStorage.setItem(JOYSTICK_STORAGE_KEY,joystickEnabled?'1':'0');}catch(_){}
  }
  function validJoyIndex(value,fallback,max=63){
    const n=Number(value);
    return Number.isInteger(n)&&n>=-1&&n<=max?n:fallback;
  }
  function readJoystickMapCookie(){
    try{
      const prefix=JOYSTICK_MAP_COOKIE_KEY+'=';
      const parts=String(document.cookie||'').split(';');
      for(const part of parts){
        const item=part.trim();
        if(item.startsWith(prefix))return decodeURIComponent(item.slice(prefix.length));
      }
    }catch(_){}
    return '';
  }
  function writeJoystickMapCookie(raw){
    try{
      // Diez anos. La clave no contiene numero de version del juego, por lo que
      // las actualizaciones de Galaxy Combat no invalidan la configuracion.
      document.cookie=JOYSTICK_MAP_COOKIE_KEY+'='+encodeURIComponent(raw)+'; Max-Age=315360000; Path=/; SameSite=Lax';
    }catch(_){}
  }
  function loadJoystickMap(){
    joystickMap={...DEFAULT_JOYSTICK_MAP};
    try{
      // localStorage es la fuente principal. La cookie actua como respaldo
      // persistente ante limpiezas/migraciones puntuales de la PWA.
      let raw=localStorage.getItem(JOYSTICK_MAP_STORAGE_KEY);
      if(!raw)raw=readJoystickMapCookie();
      if(!raw)return;
      const saved=JSON.parse(raw);
      if(!saved||typeof saved!=='object')return;
      joystickMap={
        turnAxis:validJoyIndex(saved.turnAxis,DEFAULT_JOYSTICK_MAP.turnAxis,31),
        turnScale:Number(saved.turnScale)===1?1:-1,
        turnLeft:validJoyIndex(saved.turnLeft,DEFAULT_JOYSTICK_MAP.turnLeft),
        turnRight:validJoyIndex(saved.turnRight,DEFAULT_JOYSTICK_MAP.turnRight),
        thrust:validJoyIndex(saved.thrust,DEFAULT_JOYSTICK_MAP.thrust),
        fire:validJoyIndex(saved.fire,DEFAULT_JOYSTICK_MAP.fire),
        rocket:validJoyIndex(saved.rocket,DEFAULT_JOYSTICK_MAP.rocket),
        flare:validJoyIndex(saved.flare,DEFAULT_JOYSTICK_MAP.flare),
        shock:validJoyIndex(saved.shock,DEFAULT_JOYSTICK_MAP.shock),
        ptt:validJoyIndex(saved.ptt,DEFAULT_JOYSTICK_MAP.ptt)
      };
      // Autorrecuperacion: si vino de cookie, reponer tambien localStorage.
      const normalized=JSON.stringify(joystickMap);
      try{localStorage.setItem(JOYSTICK_MAP_STORAGE_KEY,normalized);}catch(_){}
      writeJoystickMapCookie(normalized);
    }catch(_){joystickMap={...DEFAULT_JOYSTICK_MAP};}
  }
  function saveJoystickMap(){
    const raw=JSON.stringify(joystickMap);
    try{localStorage.setItem(JOYSTICK_MAP_STORAGE_KEY,raw);}catch(_){}
    writeJoystickMapCookie(raw);
  }
  function joystickConfigText(){
    const lang=String(document.documentElement.lang||'es').slice(0,2).toLowerCase();
    return JOYSTICK_CONFIG_TEXT[lang]||JOYSTICK_CONFIG_TEXT.en;
  }
  function joystickButtonPressed(pad,index,threshold=.35){
    if(!pad||!Number.isInteger(index)||index<0)return false;
    const b=pad.buttons&&pad.buttons[index];
    return !!(b&&(b.pressed||Number(b.value)>threshold));
  }
  function joystickButtonLabel(index){
    const labels={0:'1',1:'2',2:'3',3:'4',4:'L1 / LB',5:'R1 / RB',6:'L2 / LT',7:'R2 / RT',8:'SELECT',9:'START',10:'L3',11:'R3',12:'DPAD ARRIBA',13:'DPAD ABAJO',14:'DPAD IZQ.',15:'DPAD DER.',16:'HOME'};
    return Object.prototype.hasOwnProperty.call(labels,index)?labels[index]:'B'+(Number(index)+1);
  }
  function joystickTurnLabel(map=joystickMap){
    if(Number(map.turnAxis)>=0)return Number(map.turnAxis)===0?'STICK IZQ.':'EJE '+(Number(map.turnAxis)+1);
    return joystickButtonLabel(map.turnLeft)+' / '+joystickButtonLabel(map.turnRight);
  }
  function joystickMapSummary(map=joystickMap){
    const t=joystickConfigText();
    return t.move+': '+joystickTurnLabel(map)+' · '+t.accelerate+': '+joystickButtonLabel(map.thrust)+' · '+t.fire+': '+joystickButtonLabel(map.fire)+' · '+t.rocket+': '+joystickButtonLabel(map.rocket)+' · '+t.flare+': '+joystickButtonLabel(map.flare)+' · '+t.shock+': '+joystickButtonLabel(map.shock)+' · '+t.voice+': '+joystickButtonLabel(map.ptt);
  }
  function seedJoystickConfigInput(pad){
    joystickConfigPadIndex=pad&&Number.isInteger(pad.index)?pad.index:-1;
    joystickConfigPrevButtons=pad&&pad.buttons?Array.from(pad.buttons,b=>!!(b&&(b.pressed||Number(b.value)>.55))):[];
    joystickConfigNeutralAxes=pad&&pad.axes?Array.from(pad.axes,a=>Number(a)||0):[];
  }
  function renderJoystickConfig(){
    if(!joystickConfigDialog)return;
    const t=joystickConfigText();
    if(joystickConfigTitle)joystickConfigTitle.textContent=t.title;
    if(joystickConfigReset)joystickConfigReset.textContent=t.reset;
    if(joystickConfigCancel)joystickConfigCancel.textContent=t.cancel;
    const pad=findJoystick();
    if(!joystickConfigDraft)joystickConfigDraft={...joystickMap};
    if(joystickConfigStepIndex>=6){
      if(joystickConfigStep)joystickConfigStep.textContent='';
      if(joystickConfigAction)joystickConfigAction.textContent='✓ '+t.saved;
      if(joystickConfigHint)joystickConfigHint.textContent=joystickMapSummary(joystickMap);
    }else if(!pad){
      if(joystickConfigStep)joystickConfigStep.textContent=t.step+' '+(joystickConfigStepIndex+1)+'/6';
      if(joystickConfigAction)joystickConfigAction.textContent=t.connect;
      if(joystickConfigHint)joystickConfigHint.textContent='';
    }else if(joystickConfigStepIndex===0){
      if(joystickConfigStep)joystickConfigStep.textContent=t.step+' 1/6';
      if(joystickConfigAction)joystickConfigAction.textContent=t.move;
      if(joystickConfigHint)joystickConfigHint.textContent=joystickConfigTurnStage==='right'?t.moveRight:t.moveLeft;
    }else{
      const step=JOYSTICK_CONFIG_STEPS[joystickConfigStepIndex-1];
      if(joystickConfigStep)joystickConfigStep.textContent=t.step+' '+(joystickConfigStepIndex+1)+'/6';
      if(joystickConfigAction)joystickConfigAction.textContent=t[step.text];
      if(joystickConfigHint)joystickConfigHint.textContent=t.press;
    }
    if(joystickConfigCurrent)joystickConfigCurrent.textContent=joystickMapSummary(joystickConfigDraft);
  }
  function finishJoystickConfig(){
    if(!joystickConfigDraft)return;
    joystickMap={...joystickConfigDraft};
    saveJoystickMap();
    joystickConfigStepIndex=6;
    joystickConfigActive=false;
    if(joystickConfigRaf){cancelAnimationFrame(joystickConfigRaf);joystickConfigRaf=0;}
    updateJoystickButton();
    renderJoystickConfig();
    clearTimeout(joystickConfigCloseTimer);
    joystickConfigCloseTimer=setTimeout(closeJoystickConfig,900);
  }
  function closeJoystickConfig(){
    joystickConfigActive=false;
    joystickConfigDraft=null;
    joystickConfigPadIndex=-1;
    if(joystickConfigRaf){cancelAnimationFrame(joystickConfigRaf);joystickConfigRaf=0;}
    clearTimeout(joystickConfigCloseTimer);joystickConfigCloseTimer=null;
    if(joystickConfigDialog)joystickConfigDialog.classList.add('hidden');
  }
  function resetJoystickConfig(){
    joystickMap={...DEFAULT_JOYSTICK_MAP};
    joystickConfigDraft={...joystickMap};
    saveJoystickMap();
    joystickConfigStepIndex=6;
    joystickConfigActive=false;
    updateJoystickButton();
    renderJoystickConfig();
    clearTimeout(joystickConfigCloseTimer);
    joystickConfigCloseTimer=setTimeout(closeJoystickConfig,900);
  }
  function pollJoystickConfig(){
    if(!joystickConfigActive)return;
    const pad=findJoystick();
    if(!pad){
      joystickConfigPadIndex=-1;
      renderJoystickConfig();
      joystickConfigRaf=requestAnimationFrame(pollJoystickConfig);
      return;
    }
    if(joystickConfigPadIndex!==pad.index){
      seedJoystickConfigInput(pad);
      renderJoystickConfig();
      joystickConfigRaf=requestAnimationFrame(pollJoystickConfig);
      return;
    }
    const buttons=pad.buttons?Array.from(pad.buttons,b=>!!(b&&(b.pressed||Number(b.value)>.55))):[];
    const rising=[];
    for(let i=0;i<buttons.length;i++)if(buttons[i]&&!joystickConfigPrevButtons[i])rising.push(i);

    if(joystickConfigStepIndex===0&&joystickConfigTurnStage==='left'){
      let capturedAxis=false;
      if(pad.axes){
        for(let i=0;i<pad.axes.length;i++){
          const value=Number(pad.axes[i])||0,neutral=Number(joystickConfigNeutralAxes[i])||0;
          if(Math.abs(neutral)<.30&&Math.abs(value)>.65){
            joystickConfigDraft.turnAxis=i;
            joystickConfigDraft.turnScale=value<0?-1:1;
            joystickConfigDraft.turnLeft=-1;joystickConfigDraft.turnRight=-1;
            joystickConfigStepIndex=1;joystickConfigTurnStage='';
            capturedAxis=true;break;
          }
        }
      }
      if(!capturedAxis&&rising.length){
        joystickConfigDraft.turnAxis=-1;
        joystickConfigDraft.turnLeft=rising[0];
        joystickConfigDraft.turnRight=-1;
        joystickConfigTurnStage='right';
      }
      if(capturedAxis||rising.length)renderJoystickConfig();
    }else if(joystickConfigStepIndex===0&&joystickConfigTurnStage==='right'){
      const candidate=rising.find(i=>i!==joystickConfigDraft.turnLeft);
      if(Number.isInteger(candidate)){
        joystickConfigDraft.turnRight=candidate;
        joystickConfigStepIndex=1;joystickConfigTurnStage='';
        renderJoystickConfig();
      }
    }else if(joystickConfigStepIndex>0&&joystickConfigStepIndex<6&&rising.length){
      const step=JOYSTICK_CONFIG_STEPS[joystickConfigStepIndex-1];
      joystickConfigDraft[step.field]=rising[0];
      joystickConfigStepIndex++;
      if(joystickConfigStepIndex>=6){finishJoystickConfig();return;}
      renderJoystickConfig();
    }
    joystickConfigPrevButtons=buttons;
    joystickConfigRaf=requestAnimationFrame(pollJoystickConfig);
  }
  function openJoystickConfig(){
    if(isMobile||!joystickEnabled||!joystickConfigDialog)return;
    joystickConfigDraft={...joystickMap};
    joystickConfigStepIndex=0;joystickConfigTurnStage='left';joystickConfigActive=true;
    joystickConfigDialog.classList.remove('hidden');
    seedJoystickConfigInput(findJoystick());
    renderJoystickConfig();
    if(joystickConfigRaf)cancelAnimationFrame(joystickConfigRaf);
    joystickConfigRaf=requestAnimationFrame(pollJoystickConfig);
  }
  function findJoystick(){
    if(!joystickEnabled||typeof navigator.getGamepads!=='function'){
      joystickIndex=-1;joystickConnected=false;return null;
    }
    const pads=navigator.getGamepads();
    let pad=null;
    if(Number.isInteger(joystickIndex)&&joystickIndex>=0)pad=pads[joystickIndex]||null;
    if(!pad||pad.connected===false){
      pad=null;
      for(let i=0;i<pads.length;i++){
        const candidate=pads[i];
        if(!candidate||candidate.connected===false)continue;
        // Preferimos el mapeo estandar, pero aceptamos mandos que no lo declaran.
        if(candidate.mapping==='standard'){pad=candidate;break;}
        if(!pad)pad=candidate;
      }
      joystickIndex=pad?pad.index:-1;
    }
    joystickConnected=!!pad;
    return pad;
  }
  function joystickControls(){
    if(isMobile)return {active:false,turn:0,thrust:false,fire:false,rocket:false,flare:false,shock:false,ptt:false};
    const pad=findJoystick();
    if(!pad)return {active:false,turn:0,thrust:false,fire:false,rocket:false,flare:false,shock:false,ptt:false};
    const dead=.18;
    const dpadLeft=joystickButtonPressed(pad,joystickMap.turnLeft);
    const dpadRight=joystickButtonPressed(pad,joystickMap.turnRight);
    let turn=0;
    if(Number(joystickMap.turnAxis)<0&&(dpadLeft||dpadRight)){
      turn=(dpadLeft?1:0)-(dpadRight?1:0);
    }else if(Number(joystickMap.turnAxis)>=0){
      const axisX=Number(pad.axes&&pad.axes.length>joystickMap.turnAxis?pad.axes[joystickMap.turnAxis]:0)||0;
      if(Math.abs(axisX)>dead){
        const normalized=(Math.abs(axisX)-dead)/(1-dead);
        turn=Math.sign(axisX)*(Number(joystickMap.turnScale)||-1)*Math.min(1,normalized);
      }else if(dpadLeft||dpadRight){
        turn=(dpadLeft?1:0)-(dpadRight?1:0);
      }
    }
    const thrust=joystickButtonPressed(pad,joystickMap.thrust);
    const fire=joystickButtonPressed(pad,joystickMap.fire);
    const rocket=joystickButtonPressed(pad,joystickMap.rocket);
    const flare=joystickButtonPressed(pad,joystickMap.flare);
    const shock=joystickButtonPressed(pad,joystickMap.shock);
    const ptt=joystickButtonPressed(pad,joystickMap.ptt);
    return {active:true,turn,thrust,fire,rocket,flare,shock,ptt};
  }
  function resetVictoryJoystickControls(){
    victoryJoystickPrevFire=false;
    victoryJoystickPrevMenu=false;
    victoryJoystickLastActionAt=0;
  }
  function pumpVictoryJoystick(now){
    if(!joystickEnabled||isMobile||victory.classList.contains('hidden')){
      resetVictoryJoystickControls();
      return;
    }
    const pad=joystickControls();
    if(!pad.active){
      resetVictoryJoystickControls();
      return;
    }
    const fireNow=!!pad.fire;
    // Boton fisico 3 = indice Gamepad 2. No depende del mapa configurable:
    // se reserva como acceso consistente a MENU PRINCIPAL en fin de partida.
    const rawPad=(navigator.getGamepads&&joystickIndex>=0)?navigator.getGamepads()[joystickIndex]:null;
    const menuNow=joystickButtonPressed(rawPad,2);
    const firePressed=fireNow&&!victoryJoystickPrevFire;
    const menuPressed=menuNow&&!victoryJoystickPrevMenu;
    victoryJoystickPrevFire=fireNow;
    victoryJoystickPrevMenu=menuNow;
    if(now-victoryJoystickLastActionAt<300)return;

    if(menuPressed){
      victoryJoystickLastActionAt=now;
      if(window.confirm(tr('abandonMatchConfirm')))returnToMainMenu();
      return;
    }
    if(firePressed){
      const restartBtn=document.getElementById('restartMatch');
      if(restartBtn&&!restartBtn.classList.contains('hidden')&&!restartBtn.disabled){
        victoryJoystickLastActionAt=now;
        restartBtn.click();
      }
    }
  }

  function updateControlHelp(){
    if(!controlHelpEl)return;
    if(joystickEnabled){
      const t=joystickConfigText();
      controlHelpEl.innerHTML=
        '<span><span>'+tr('rotateControl')+'</span> <b>'+joystickTurnLabel()+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+tr('accelerate')+'</span> <b>'+joystickButtonLabel(joystickMap.thrust)+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+tr('fire')+'</span> <b>'+joystickButtonLabel(joystickMap.fire)+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+t.rocket+'</span> <b>'+joystickButtonLabel(joystickMap.rocket)+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+t.flare+'</span> <b>'+joystickButtonLabel(joystickMap.flare)+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+t.shock+'</span> <b>'+joystickButtonLabel(joystickMap.shock)+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+tr('talk')+'</span> <b>'+joystickButtonLabel(joystickMap.ptt)+'</b></span>';
    }else{
      controlHelpEl.innerHTML=
        '<span><span>'+tr('rotateControl')+'</span> <b>A / D</b> <span>'+tr('orArrows')+'</span></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+tr('accelerate')+'</span> <b>'+tr('keyThrustCombo')+'</b></span>'+
        '<i aria-hidden="true"></i>'+
        '<span><span>'+tr('fire')+'</span> <b>'+tr('keyFireCombo')+'</b></span>';
    }
  }
  function updateJoystickButton(){
    if(!joystickToggleButton)return;
    findJoystick();
    const t=joystickConfigText();
    joystickToggleButton.classList.toggle('active',joystickEnabled);
    joystickToggleButton.setAttribute('aria-pressed',joystickEnabled?'true':'false');
    joystickToggleButton.textContent='JOYSTICK';
    if(joystickConfigButton){
      joystickConfigButton.classList.toggle('hidden',!joystickEnabled);
      joystickConfigButton.textContent=t.configure;
      joystickConfigButton.title=t.title;
    }
    joystickToggleButton.title=joystickEnabled
      ?(joystickConnected?tr('joystickActive')+' '+joystickMapSummary():tr('joystickConnect')+' '+joystickMapSummary())
      :tr('joystickEnable');
    updateControlHelp();
  }
  function notifyJoystickVoiceUi(){
    try{window.dispatchEvent(new CustomEvent('galaxy-joystickchange',{detail:{enabled:joystickEnabled,connected:joystickConnected}}));}catch(_){}
  }
  window.GalaxyJoystickEnabled=()=>!isMobile&&!!joystickEnabled;
  window.addEventListener('galaxy-languagechange',()=>{warmOnlineStartCaches(true);updateJoystickButton();if(joystickConfigDialog&&!joystickConfigDialog.classList.contains('hidden'))renderJoystickConfig();});
  function toggleJoystick(){
    if(isMobile)return;
    joystickEnabled=!joystickEnabled;
    if(!joystickEnabled){
      joystickIndex=-1;joystickConnected=false;
      if(joystickVoiceHeld){
        joystickVoiceHeld=false;
        if(voice&&!voice.keyVDown&&!voice.pttTouchActive)voice.setTalking(false);
      }
    }
    saveJoystickPreference();
    updateJoystickButton();
    notifyJoystickVoiceUi();
  }

  function updateAudioButton(){
    if(!audioToggleButton)return;
    audioToggleButton.classList.toggle('active',gameAudioEnabled);
    audioToggleButton.setAttribute('aria-pressed',gameAudioEnabled?'true':'false');
    audioToggleButton.textContent=gameAudioEnabled?tr('gameAudioOn'):tr('gameAudioOff');
  }
  function toggleGameAudio(){
    gameAudioEnabled=!gameAudioEnabled;
    updateAudioButton();
    if(gameAudioEnabled){
      // Este click es tambien un gesto valido para iOS.
      startMusic();
      unlockGameAudio();
    }else{
      stopMusic();
    }
  }
  function playSound(k){
    if(!gameAudioEnabled)return;
    if(k==='shockwave'){playShockwaveSound();return;}
    // V20.34: la desintegracion del cohete es deliberadamente muda.
    if(k==='sparkle')return;
    if(useWebAudio){
      ensureAudioContext();
      if(playWebEffect(k))return;
      loadWebAudio().then(ok=>{if(ok)playWebEffect(k);});
      return;
    }
    const pool=soundPools[k];if(!pool||!pool.items.length)return;
    const a=pool.items[pool.next++%pool.items.length];
    try{
      a.playbackRate=1;a.volume=(soundDefs[k]?soundDefs[k].volume:1)*gameVolume;
      a.currentTime=0;
      const promise=a.play();
      if(promise&&promise.catch)promise.catch(err=>console.warn('[Galaxy Combat] Efecto de audio bloqueado:',k,err&&err.name?err.name:err));
    }catch(err){console.warn('[Galaxy Combat] No se pudo reproducir efecto:',k,err);}
  }
  function startMusic(){
    if(!gameAudioEnabled||!menu||menu.classList.contains('hidden'))return;
    usePlaybackAudioSession();
    if(!sounds.music||!sounds.music.paused)return;
    // V22.04: la musica no depende del micro ni del AudioContext de efectos.
    // Si iOS exige gesto, el primer toque del menu vuelve a intentar play().
    const p=sounds.music.play();
    if(p&&typeof p.then==='function')p.then(()=>{musicStarted=true;}).catch(()=>{musicStarted=false;});
    else musicStarted=true;
  }
  function stopMusic(){
    if(webMusicIdleHandle){
      try{
        if(typeof cancelIdleCallback==='function')cancelIdleCallback(webMusicIdleHandle);
        else clearTimeout(webMusicIdleHandle);
      }catch(_){}
      webMusicIdleHandle=0;
    }
    stopWebMusic();
    if(sounds.music)try{sounds.music.pause();sounds.music.currentTime=0;}catch(_){}
    musicStarted=false;
  }
  function updateMobileControlUi(){
    if(mobileControls){
      mobileControls.classList.add('button-mode');
      mobileControls.classList.remove('motion-mode');
      mobileControls.classList.toggle('keyboard-mode',mobileKeyboardActive);
    }
  }
  function setMobileKeyboardActive(active){
    if(!isMobile)return;
    mobileKeyboardActive=!!active;
    if(mobileKeyboardActive){
      resetMobileTouchControls();
      mobileButtonTurn=0;mobileTurnTarget=0;mobileTurnStartedAt=0;
      mobileLeftPointers.clear();mobileRightPointers.clear();
      motionTurn=0;
    }
    updateMobileControlUi();
    invalidateMobileVoiceLayout();
  }
  function updateMobileButtonTurn(now=performance.now()){
    const nextTarget=(mobileLeftPointers.size?1:0)-(mobileRightPointers.size?1:0);
    if(nextTarget!==mobileTurnTarget){
      mobileTurnTarget=nextTarget;
      mobileTurnStartedAt=nextTarget?now:0;
      if(!nextTarget)mobileButtonTurn=0;
    }
    if(mobileTurnLeft)mobileTurnLeft.classList.toggle('active',mobileLeftPointers.size>0);
    if(mobileTurnRight)mobileTurnRight.classList.toggle('active',mobileRightPointers.size>0);
  }
  function progressiveMobileTurn(now=performance.now()){
    if(!mobileTurnTarget){
      mobileButtonTurn=0;
      return 0;
    }
    const elapsed=Math.max(0,now-mobileTurnStartedAt);
    const t=clamp(elapsed/MOBILE_TURN_RAMP_MS,0,1);
    // V19.25: un poco más de respuesta al inicio y una subida algo más rápida,
    // pero la fuerza sigue limitada a 1.0: la velocidad máxima no cambia.
    const eased=t*t*(3-2*t);
    const strength=MOBILE_TURN_START+(1-MOBILE_TURN_START)*eased;
    mobileButtonTurn=mobileTurnTarget*strength;
    return mobileButtonTurn;
  }
  function mobileTurnDirection(clientX){
    if(!mobileTurnPad)return 0;
    const rect=mobileTurnPad.getBoundingClientRect();
    if(!rect.width||clientX<rect.left||clientX>rect.right)return 0;
    return clientX<(rect.left+rect.width*.5)?1:-1;
  }
  function beginMobileTurnGesture(key,clientX){
    if(!isMobile||!inGame||mobileControlMode!=='buttons'||mobileKeyboardActive)return false;
    const dir=mobileTurnDirection(clientX);
    if(!dir)return false;
    mobileLeftPointers.delete(key);
    mobileRightPointers.delete(key);
    (dir>0?mobileLeftPointers:mobileRightPointers).add(key);
    updateMobileButtonTurn();
    return true;
  }
  function moveMobileTurnGesture(key,clientX){
    if(!mobileLeftPointers.has(key)&&!mobileRightPointers.has(key))return false;
    const dir=mobileTurnDirection(clientX);
    if(!dir)return true;
    const left=dir>0;
    if(left&&mobileLeftPointers.has(key))return true;
    if(!left&&mobileRightPointers.has(key))return true;
    mobileLeftPointers.delete(key);
    mobileRightPointers.delete(key);
    (left?mobileLeftPointers:mobileRightPointers).add(key);
    updateMobileButtonTurn();
    return true;
  }
  function endMobileTurnGesture(key){
    const changed=mobileLeftPointers.delete(key)|mobileRightPointers.delete(key);
    if(changed)updateMobileButtonTurn();
    return !!changed;
  }
  function bindMobileTurnPad(){
    if(!mobileTurnPad)return;

    mobileTurnPad.addEventListener('pointerdown',e=>{
      if(e.pointerType&&e.pointerType!=='touch'&&e.pointerType!=='pen')return;
      if(isIOS&&e.pointerType==='touch')return;
      if(!beginMobileTurnGesture(e.pointerId,e.clientX))return;
      try{mobileTurnPad.setPointerCapture?.(e.pointerId);}catch(_){}
      e.preventDefault();e.stopPropagation();
    },{passive:false});
    mobileTurnPad.addEventListener('pointermove',e=>{
      if(isIOS&&e.pointerType==='touch')return;
      if(moveMobileTurnGesture(e.pointerId,e.clientX)){
        e.preventDefault();e.stopPropagation();
      }
    },{passive:false});
    const releasePointer=e=>{
      if(isIOS&&e.pointerType==='touch')return;
      if(endMobileTurnGesture(e.pointerId)){
        e.preventDefault();e.stopPropagation();
      }
    };
    mobileTurnPad.addEventListener('pointerup',releasePointer,{passive:false});
    mobileTurnPad.addEventListener('pointercancel',releasePointer,{passive:false});
    mobileTurnPad.addEventListener('lostpointercapture',releasePointer);

    // En iOS los dos dedos (giro + acelerar/disparar) se gestionan juntos
    // desde #app para que cada touch.identifier conserve su funcion.
  }
  updateMobileControlUi();
  bindMobileTurnPad();

  function screenAngle(){
    if(screen.orientation&&Number.isFinite(screen.orientation.angle))return screen.orientation.angle;
    return Number.isFinite(window.orientation)?window.orientation:0;
  }
  function lateralTilt(ev){
    const beta=Number(ev.beta)||0,gamma=Number(ev.gamma)||0;
    let a=((screenAngle()%360)+360)%360;
    if(a===90)return beta;
    if(a===270)return -beta;
    if(a===180)return -gamma;
    return gamma;
  }
  function onDeviceOrientation(ev){
    // Safari puede entregar mas muestras de sensor de las que necesita el juego.
    // Limitar el trabajo a ~60 Hz evita competir con RAF + WebSocket en el
    // mismo hilo principal sin cambiar la respuesta percibida del control.
    const stamp=Number.isFinite(ev.timeStamp)?ev.timeStamp:performance.now();
    if(lastMotionSampleAt&&stamp-lastMotionSampleAt<15)return;
    lastMotionSampleAt=stamp;
    const raw=lateralTilt(ev);
    motionLastRaw=raw;motionHasSample=true;
    if(motionNeutral===null)motionNeutral=raw;
    let delta=raw-motionNeutral;
    // Compensa el salto de -180/180 en sensores que lo necesiten.
    if(delta>180)delta-=360;
    if(delta<-180)delta+=360;
    const dead=3.0;
    if(Math.abs(delta)<=dead){motionTurn=0;return;}
    const signed=delta>0?delta-dead:delta+dead;
    motionTurn=-clamp(signed/22,-1,1);
  }
  async function enableMobileMotion(){
    if(!isMobile)return true;
    try{
      if(typeof DeviceOrientationEvent==='undefined'){
        motionStatus.textContent=tr('sensorUnsupported');
        return false;
      }
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const result=await DeviceOrientationEvent.requestPermission();
        if(result!=='granted')throw new Error(tr('motionPermissionDenied'));
      }
      window.removeEventListener('deviceorientation',onDeviceOrientation);
      window.addEventListener('deviceorientation',onDeviceOrientation,{passive:true});
      motionNeutral=null;motionTurn=0;motionEnabled=true;motionHasSample=false;lastMotionSampleAt=0;
      motionStatus.textContent='';
      return true;
    }catch(err){
      motionStatus.textContent=tr('motionError',{detail:sinTildes(err&&err.message?err.message:tr('permissionUnavailable'))});
      return false;
    }
  }
  function calibrateMobileMotion(){
    if(!isMobile||!motionEnabled)return;
    motionNeutral=motionHasSample?motionLastRaw:null;
    motionTurn=0;
  }
  function refreshTouchControls(){
    mobileThrust=false;
    for(const gesture of touchGestures.values()){
      if(gesture&&gesture.accelerating){mobileThrust=true;break;}
    }
    if(fireZone)fireZone.classList.toggle('active',mobileFire);
    if(thrustZone)thrustZone.classList.toggle('active',mobileThrust);
    if(mobileControls){
      mobileControls.classList.toggle('firing',mobileFire);
      mobileControls.classList.toggle('thrusting',mobileThrust);
    }
  }
  function localPlayerHasSpecial(){
    const p=state&&Array.isArray(state.players)?state.players.find(x=>Number(x.i)===Number(myIndex)):null;
    return !!(p&&(p.shock===true||Number(p.flare)>0));
  }
  function triggerMobileFire(){
    const now=performance.now();
    // V20.68: el mismo doble toque sirve para esfera y bengala. Si existen
    // ambas, la fisica consume primero la esfera y conserva las bengalas.
    const doubleTap=localPlayerHasSpecial()&&lastMobileFireTapAt>0&&now-lastMobileFireTapAt<=MOBILE_FLARE_DOUBLE_TAP_MS;
    lastMobileFireTapAt=doubleTap?0:now;
    mobileFire=true;
    clearTimeout(mobileFireTimer);
    mobileFireTimer=setTimeout(()=>{
      mobileFireTimer=null;
      mobileFire=false;
      refreshTouchControls();
    },doubleTap?MOBILE_FLARE_PULSE_MS:MOBILE_FIRE_PULSE_MS);
    refreshTouchControls();
  }
  function resetMobileTouchControls(){
    for(const gesture of touchGestures.values()){
      if(gesture&&gesture.holdTimer)clearTimeout(gesture.holdTimer);
    }
    touchGestures.clear();
    mobileTouchRoles.clear();
    mobileLeftPointers.clear();mobileRightPointers.clear();
    mobileButtonTurn=0;mobileTurnTarget=0;mobileTurnStartedAt=0;
    updateMobileButtonTurn();
    clearTimeout(mobileFireTimer);mobileFireTimer=null;lastMobileFireTapAt=0;
    mobileFire=false;mobileThrust=false;
    if(mobileControls){
      mobileControls.classList.remove('firing','thrusting');
    }
    refreshTouchControls();
  }
  function mobileActionTargetAllowed(target){
    if(target&&target.closest&&target.closest('button,input,select,textarea,a,[contenteditable="true"]'))return false;
    if(mobileControlMode==='buttons'&&!(target&&target.closest&&target.closest('#mobileActionZone')))return false;
    return true;
  }
  function beginMobileActionGesture(key,target){
    if(!isMobile||!inGame||!mobileActionTargetAllowed(target))return false;
    if(mobileKeyboardActive){
      keys.clear();
      lastControlTurn=0;
      setMobileKeyboardActive(false);
    }
    // Si Safari reutiliza un identificador tras perder un final de gesto,
    // eliminamos primero cualquier estado antiguo asociado a ese contacto.
    const stale=touchGestures.get(key);
    if(stale&&stale.holdTimer)clearTimeout(stale.holdTimer);
    touchGestures.delete(key);
    const gesture={startedAt:performance.now(),accelerating:false,holdTimer:null};
    gesture.holdTimer=setTimeout(()=>{
      const current=touchGestures.get(key);
      if(!inGame||current!==gesture)return;
      current.accelerating=true;
      refreshTouchControls();
    },MOBILE_HOLD_MS);
    touchGestures.set(key,gesture);
    return true;
  }
  function endMobileActionGesture(key,allowFire=false){
    const gesture=touchGestures.get(key);
    if(!gesture)return false;
    clearTimeout(gesture.holdTimer);
    touchGestures.delete(key);
    const elapsed=performance.now()-gesture.startedAt;
    if(allowFire&&!gesture.accelerating&&elapsed<MOBILE_HOLD_MS)triggerMobileFire();
    refreshTouchControls();
    return true;
  }
  function mobilePointerDown(e){
    if(!isMobile||!inGame)return;
    if(e.pointerType&&e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    // En iPhone/iPad los gestos tactiles usan Touch Events nativos. Safari
    // puede perder pointerup/pointercancel durante un gesto y dejar thrust=true.
    if(isIOS&&e.pointerType==='touch')return;

    // V19.69: respaldo de giro para toda la mitad izquierda. Si por capas,
    // safe-area o el propio boton el evento no llega a #mobileTurnPad, la
    // coordenada horizontal sigue mandando: cuarto izq.=izquierda, siguiente=der.
    if(beginMobileTurnGesture(e.pointerId,e.clientX)){
      try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();
      return;
    }

    if(!beginMobileActionGesture(e.pointerId,e.target))return;
    try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  }
  function mobilePointerMove(e){
    if(isIOS&&e.pointerType==='touch')return;
    if(moveMobileTurnGesture(e.pointerId,e.clientX)&&e.cancelable)e.preventDefault();
  }
  function mobilePointerEnd(e){
    if(isIOS&&e.pointerType==='touch')return;
    const turned=endMobileTurnGesture(e.pointerId);
    const acted=endMobileActionGesture(e.pointerId,e.type==='pointerup');
    if((turned||acted||inGame)&&e.cancelable)e.preventDefault();
  }
  function mobileTouchTargetIsUi(target){
    // V19.26: las flechas de giro son botones HTML, pero forman parte del
    // control de juego. En iOS no deben filtrarse como interfaz, porque si no
    // tocar directamente sobre ← o → descarta el gesto antes de iniciar el giro.
    if(target&&target.closest&&target.closest('#mobileTurnPad'))return false;
    return !!(target&&target.closest&&target.closest('button,input,select,textarea,a,[contenteditable="true"]'));
  }
  function mobileTouchStart(e){
    if(!isIOS||!isMobile||!inGame)return;
    let handled=false;
    for(const touch of Array.from(e.changedTouches||[])){
      const id=touch.identifier;
      const key='touch:'+id;
      const target=touch.target||e.target;
      if(mobileTouchTargetIsUi(target))continue;

      const turnDir=mobileTurnDirection(touch.clientX);
      if(turnDir){
        if(beginMobileTurnGesture('turn-'+key,touch.clientX)){
          mobileTouchRoles.set(id,'turn');
          handled=true;
        }
      }else if(beginMobileActionGesture(key,target)){
        mobileTouchRoles.set(id,'action');
        handled=true;
      }
    }
    if(handled&&e.cancelable)e.preventDefault();
  }
  function mobileTouchMove(e){
    if(!isIOS||!isMobile||!inGame)return;
    let handled=false;
    for(const touch of Array.from(e.changedTouches||[])){
      const id=touch.identifier;
      if(mobileTouchRoles.get(id)!=='turn')continue;
      if(moveMobileTurnGesture('turn-touch:'+id,touch.clientX))handled=true;
    }
    if(handled&&e.cancelable)e.preventDefault();
  }
  function mobileTouchEnd(e){
    if(!isIOS||!isMobile)return;
    let handled=false;
    const allowFire=e.type==='touchend';
    for(const touch of Array.from(e.changedTouches||[])){
      const id=touch.identifier;
      const role=mobileTouchRoles.get(id);
      if(role==='turn'){
        if(endMobileTurnGesture('turn-touch:'+id))handled=true;
      }else if(role==='action'){
        if(endMobileActionGesture('touch:'+id,allowFire))handled=true;
      }
      mobileTouchRoles.delete(id);
    }
    if((handled||inGame)&&e.cancelable)e.preventDefault();
  }

  function cleanGameUrl(room=''){
    const u=new URL(location.href);
    u.search='';
    u.hash='';
    if(room)u.searchParams.set('room',String(room).trim().toUpperCase());
    return u.toString();
  }
  function showShareToast(text){
    if(!shareToast)return;
    clearTimeout(shareToastTimer);
    shareToast.textContent=String(text||'');
    shareToast.classList.remove('hidden');
    shareToastTimer=setTimeout(()=>shareToast.classList.add('hidden'),5200);
  }
  async function copyTextToClipboard(text){
    const value=String(text||'');
    try{
      if(navigator.clipboard&&window.isSecureContext){
        await navigator.clipboard.writeText(value);
        return true;
      }
    }catch(_){}
    try{
      const ta=document.createElement('textarea');
      ta.value=value;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';
      document.body.appendChild(ta);
      ta.select();ta.setSelectionRange(0,ta.value.length);
      const ok=document.execCommand('copy');
      ta.remove();
      return !!ok;
    }catch(_){return false;}
  }
  async function shareGameLink(){
    const url=cleanGameUrl();
    const ok=await copyTextToClipboard(url);
    showShareToast(ok?tr('shareGameCopied'):tr('shareGameCopyFailed'));
  }
  async function shareCurrentRoom(){
    if(!roomCode||roomCode==='LOCAL'){
      showShareToast(tr('shareRoomFirst'));
      return;
    }
    const url=cleanGameUrl(roomCode);
    const ok=await copyTextToClipboard(url);
    showShareToast(ok
      ? tr('shareRoomCopied',{code:roomCode})
      : tr('shareRoomCopyFailed'));
  }
  function joinSharedRoomDirect(){
    if(!sharedRoomCode||sharedRoomJoinStarted||roomCode||inGame)return false;
    if(!ws||ws.readyState!==WebSocket.OPEN)return false;
    sharedRoomJoinStarted=true;
    closeRoomDialogs();
    statusEl.textContent=tr('joiningRoom',{code:sharedRoomCode});
    send({
      t:'join',
      name:sinTildes(campoNombre.value),
      code:sharedRoomCode,
      authToken:authToken(),
      clientId:roomClientId(),
      testRoomToken:testRoomPermitToken()
    });
    return true;
  }

  function ensureP2P(){
    if(p2p||typeof window.GalaxyP2P!=='function')return p2p;
    p2p=new window.GalaxyP2P({
      sendSignal:o=>{if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify(o));return true;}return false;},
      onControl:(i,m)=>{if(hostPhysics)hostPhysics.setControl(i,m.turn,m.thrust,m.fire,m);},
      onState:m=>{
        const now=performance.now();
        const gap=lastP2PStateAt?now-lastP2PStateAt:Infinity;
        lastP2PStateAt=now;
        if(fallbackActive){
          if(gap<=180)p2pStableCount++;else p2pStableCount=1;
          if(p2pStableCount>=P2P_STABLE_STATES){
            fallbackActive=false;p2pStableCount=0;
            if(ws&&ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify({t:'fallback-clear'}));}catch(_){}}
            handle(m);
          }
          return;
        }
        handle(m);
      },
      onEvent:m=>{
        if(m&&m.t==='p2p-action'&&isHost&&m.action==='restart'&&hostPhysics){
          if(typeof hostPhysics.syncRoster==='function')hostPhysics.syncRoster(lobbyPlayers);
          send({t:'rank-restart'});
          if(hostPhysics.restart()){
            p2p.broadcastEvent({t:'restarted',rankRound:hostPhysics.rankRound});
            handle({t:'restarted',rankRound:hostPhysics.rankRound});
          }
        }else handle(m);
      },
      onPeerState:()=>{}
    });
    return p2p;
  }
  function stopP2P(){
    if(p2p)p2p.close();
    p2p=null;
    lastRestartedRound=0;
    netStartAt=0;lastP2PStateAt=0;lastFallbackRequestAt=0;lastFallbackStateSentAt=0;
    fallbackActive=false;p2pStableCount=0;fallbackPeers.clear();fallbackReconnectAt.clear();
    if(hostPhysics)hostPhysics.stop();
    hostPhysics=null;
    lobbyPlayers=[];
  }
  function p2pGameHealthy(now=performance.now()){
    if(!inGame||localCpuActive||!p2p)return false;
    if(isHost)return !!hostPhysics&&!hostPhysics.finished;
    return !!lastP2PStateAt&&(now-lastP2PStateAt)<2500;
  }

  function clientNeedsFallback(now=performance.now()){
    if(isHost||!inGame)return false;
    if(netStartAt&&now-netStartAt<FALLBACK_AFTER_MS)return false;
    return !lastP2PStateAt||now-lastP2PStateAt>FALLBACK_AFTER_MS;
  }
  function requestFallback(now=performance.now()){
    if(isHost||!ws||ws.readyState!==WebSocket.OPEN)return false;
    fallbackActive=true;
    if(now-lastFallbackRequestAt<FALLBACK_RETRY_MS)return true;
    lastFallbackRequestAt=now;p2pStableCount=0;
    try{ws.send(JSON.stringify({t:'fallback-request'}));return true;}catch(_){return false;}
  }
  function sendHostFallbackState(m){
    if(!fallbackPeers.size||!ws||ws.readyState!==WebSocket.OPEN)return false;
    if(Number(ws.bufferedAmount||0)>128*1024)return false;
    const now=performance.now();
    if(now-lastFallbackStateSentAt<FALLBACK_STATE_MS)return false;
    lastFallbackStateSentAt=now;
    try{ws.send(JSON.stringify({t:'fallback-state',to:[...fallbackPeers],state:m}));return true;}catch(_){return false;}
  }
  function sendHostFallbackEvent(m,forceReliable=false){
    // V19.79: los estados continuos siguen usando el camino P2P descartable,
    // pero los cambios finales de fase (especialmente VICTORY) se duplican por
    // WebSocket fiable. Un array "to" vacio hace que el servidor lo entregue a
    // todos los clientes de la sala; el resto de eventos solo va a peers fallback.
    if((!forceReliable&&!fallbackPeers.size)||!ws||ws.readyState!==WebSocket.OPEN)return false;
    const to=forceReliable?[]:[...fallbackPeers];
    try{ws.send(JSON.stringify({t:'fallback-event',to,event:m}));return true;}catch(_){return false;}
  }
  function startHostPhysics(players,rankRound=1){
    if(!isHost||typeof window.GalaxyHostPhysics!=='function')return false;
    hostPhysics=new window.GalaxyHostPhysics({
      code:roomCode,rankRound,rankHostToken:playerToken,
      onState:m=>{handle(m);if(p2p)p2p.broadcastState(m);sendHostFallbackState(m);},
      onEvent:m=>{
        if(m&&m.t==='victory')submitOnlineSeriesRound(m.winner,(hostPhysics&&hostPhysics.rankRound)||1);
        handle(m);
        if(p2p)p2p.broadcastEvent(m);
        sendHostFallbackEvent(m,m&&m.t==='victory');
      }
    });
    return hostPhysics.start(players||lobbyPlayers);
  }
  function apiBaseUrl(){
    const configured=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').trim();
    if(configured){
      try{const u=new URL(configured,location.href);u.pathname='';u.search='';u.hash='';return u.toString().replace(/\/$/,'');}
      catch(_){return '';}
    }
    if(location.hostname.endsWith('github.io'))return '';
    return location.origin;
  }
  function applyCpuLearningControl(control){
    const c=control&&typeof control==='object'?control:{};
    cpuLearningControl={
      autoTrainingEnabled:c.autoTrainingEnabled===true,
      localHardEnabled:c.localHardEnabled===true,
      ready:true
    };
    updateBuildVersionLearningState();
  }
  function updateBuildVersionLearningState(){
    if(!buildVersionEl)return;
    let mode='off',label='Aprendizaje desactivado';
    // Durante una partida CPU dificil, el aprendizaje local tiene prioridad visual.
    if(localCpuActive&&activeLocalDifficulty==='dificil'&&cpuLearningControl.localHardEnabled){
      mode='hard';label='Aprendizaje LOCAL DIFICIL activo';
    }else if(cpuLearningControl.autoTrainingEnabled){
      mode='training';label='Entrenamiento automatico activo';
    }else if(cpuLearningControl.localHardEnabled){
      mode='hard';label='Aprendizaje LOCAL DIFICIL activo';
    }
    buildVersionEl.classList.remove('learning-training','learning-hard','learning-off');
    buildVersionEl.classList.add(mode==='training'?'learning-training':mode==='hard'?'learning-hard':'learning-off');
    buildVersionEl.title=label;
    buildVersionEl.setAttribute('aria-label','Version del juego · '+label);
  }
  async function refreshCpuLearningControl(){
    // V19.76: el estado de aprendizaje solo cambia fuera del combate. Evitamos
    // fetch/AbortController/JSON/DOM cada 5 s mientras se esta jugando.
    if(inGame)return;
    const base=apiBaseUrl();
    if(!base){
      cpuLearningControl={autoTrainingEnabled:false,localHardEnabled:false,ready:false};
      updateBuildVersionLearningState();
      return;
    }
    const ctl=typeof AbortController==='function'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),1800):null;
    try{
      const res=await fetch(base+'/api/cpu-learning-status',{cache:'no-store',signal:ctl?ctl.signal:undefined});
      if(!res.ok)return;
      const data=await res.json();
      if(data&&data.ok)applyCpuLearningControl(data.control);
    }catch(_){}
    finally{if(timer)clearTimeout(timer);}
  }
  function postAnalyticsEvent(type){
    const base=apiBaseUrl();if(!base)return;
    try{
      fetch(base+'/api/analytics/event',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type}),
        keepalive:true
      }).catch(()=>{});
    }catch(_){}
  }
  function websocketUrl(){
    const configured=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').trim();
    if(configured){
      try{
        const u=new URL(configured,location.href);
        u.protocol=u.protocol==='https:'?'wss:':'ws:';
        u.pathname='/ws';u.search='';u.hash='';
        return u.toString();
      }catch(_){return null;}
    }
    // En desarrollo/local puede compartir origen con Node. GitHub Pages no
    // ejecuta WebSocket, por lo que alli hay que rellenar config.js.
    if(location.hostname.endsWith('github.io'))return null;
    const proto=location.protocol==='https:'?'wss:':'ws:';
    return `${proto}//${location.host}/ws`;
  }
  function setServerReady(ready){
    for(const b of serverButtons)b.disabled=!ready;
    statusEl.classList.toggle('ready',ready);
    statusEl.classList.toggle('waking',!ready);
    if(serverWait)serverWait.classList.toggle('hidden',ready);
  }
  function wakeStatus(){
    const secs=wakeStartedAt?Math.max(0,Math.floor((Date.now()-wakeStartedAt)/1000)):0;
    const dots='.'.repeat((connectAttempt%3)+1);
    const msg=secs<8
      ? tr('connectingServer',{dots})
      : tr('serverStarting',{dots,secs});
    statusEl.textContent=msg;
    if(serverWaitText)serverWaitText.textContent=msg;
  }
  function scheduleReconnect(delay=2200){
    clearTimeout(reconnectTimer);
    reconnectTimer=setTimeout(connect,delay);
  }
  function connect(){
    const url=websocketUrl();
    if(!url){
      setServerReady(false);
      statusEl.classList.remove('waking');
      statusEl.textContent=tr('serverConfigMissing');
      return;
    }
    if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING))return;
    if(!wakeStartedAt)wakeStartedAt=Date.now();
    connectAttempt++;
    setServerReady(false);
    wakeStatus();
    try{ws=new WebSocket(url);}catch(_){scheduleReconnect();return;}
    ws.onopen=()=>{
      clearTimeout(reconnectTimer);
      connectAttempt=0;wakeStartedAt=0;
      setServerReady(true);
      statusEl.textContent=tr('serverReady');
      const saved=(roomCode&&playerToken)?{code:roomCode,token:playerToken}:loadResumeSession();
      if(saved){
        if(roomMini)roomMini.textContent=tr('reconnecting');
        send({t:'resume',code:saved.code,token:saved.token});
      }else if(sharedRoomCode){
        setTimeout(joinSharedRoomDirect,0);
      }else{
        send({t:'public-rooms'});
      }
    };
    ws.onclose=()=>{
      pendingStateRaw=null;
      setServerReady(false);
      if(manualClose)return;
      const saved=(roomCode&&playerToken)?{code:roomCode,token:playerToken}:loadResumeSession();
      if(saved&&(inGame||roomCode)){
        statusEl.textContent=tr('reconnectingGame');
        if(roomMini)roomMini.textContent=tr('reconnecting');
        if(!resumeStartedAt){
          resumeStartedAt=Date.now();
          clearTimeout(resumeExpiryTimer);
          resumeExpiryTimer=setTimeout(()=>{
            if(!resumeStartedAt)return;
            // V20.64: si la partida P2P sigue viva, perder el servidor de
            // senalizacion no debe expulsar a los jugadores. Seguimos intentando
            // reconectar en segundo plano y conservamos la partida.
            if(p2pGameHealthy()){
              resumeStartedAt=0;
              clearTimeout(resumeExpiryTimer);resumeExpiryTimer=null;
              scheduleReconnect(1200);
              return;
            }
            clearResumeSession();playerToken='';
            alert(tr('resumeFailed'));
            returnToMainMenu(false);
          },RESUME_WINDOW_MS+1500);
        }
        scheduleReconnect(500);
      }else{
        wakeStatus();
        scheduleReconnect();
      }
    };
    ws.onerror=()=>{
      setServerReady(false);
      wakeStatus();
      // onclose programa el siguiente intento. No mostramos un error definitivo
      // porque un Render gratuito puede estar arrancando todavia.
    };
    ws.onmessage=e=>{
      // V20.63: una partida Contra la maquina es totalmente local. Mientras
      // esta activa, ningun mensaje tardio del servidor puede pisar su estado,
      // cerrar la partida ni inyectar snapshots de una sala online anterior.
      if(localCpuActive)return;
      const raw=e.data;
      // Los snapshots son reemplazables. No los parseamos en mitad de un frame:
      // conservamos el ultimo y lo procesamos al comienzo del siguiente RAF.
      if(typeof raw==='string'&&raw.startsWith('{"t":"state"')){
        pendingStateRaw=raw;
        return;
      }
      // Los eventos pequenos (sonido, voz, BRUTAL) no necesitan forzar el
      // parseo de un snapshot pendiente. Solo los cambios de fase de partida
      // requieren orden estricto con el ultimo estado recibido.
      let m;try{m=JSON.parse(raw);}catch(_){return;}
      if(m&&['p2p-offer','p2p-answer','p2p-ice','p2p-reconnect'].includes(m.t)){ensureP2P()?.handleSignal(m);return;}
      if(m&&m.t==='fallback-request'){
        if(isHost&&Number.isInteger(Number(m.from))){
          const i=Number(m.from);fallbackPeers.add(i);
          const now=performance.now(),last=fallbackReconnectAt.get(i)||0;
          if(now-last>=FALLBACK_RETRY_MS){fallbackReconnectAt.set(i,now);ensureP2P()?.reconnectPeer(i);}
        }
        return;
      }
      if(m&&m.t==='fallback-clear'){
        if(isHost&&Number.isInteger(Number(m.from))){const i=Number(m.from);fallbackPeers.delete(i);fallbackReconnectAt.delete(i);}
        return;
      }
      if(m&&m.t==='fallback-state'){
        if(!isHost&&m.state){fallbackActive=true;handle(m.state);}
        return;
      }
      if(m&&m.t==='fallback-event'){
        if(!isHost&&m.event){fallbackActive=true;handle(m.event);}
        return;
      }
      if(m&&m.t==='fallback-ctrl'){
        if(isHost&&hostPhysics)hostPhysics.setControl(Number(m.from),Number(m.turn)||0,!!m.thrust,!!m.fire,m);
        return;
      }
      if(m&&m.t==='fallback-action'){
        if(isHost&&m.action==='restart'&&hostPhysics){
          if(typeof hostPhysics.syncRoster==='function')hostPhysics.syncRoster(lobbyPlayers);
          send({t:'rank-restart'});
          if(hostPhysics.restart()){
            if(p2p)p2p.broadcastEvent({t:'restarted',rankRound:hostPhysics.rankRound});
            sendHostFallbackEvent({t:'restarted',rankRound:hostPhysics.rankRound});
            handle({t:'restarted',rankRound:hostPhysics.rankRound});
          }
        }
        return;
      }
      if(voice&&voice.isSignal(m)){voice.handleSignal(m);return;}
      if(m&&(['victory','restarted','closed','start'].includes(m.t)))flushPendingState(true);
      handle(m);
    };
  }
  function send(o){
    if(localCpuActive&&localCpu&&typeof localCpu.handleMessage==='function')return localCpu.handleMessage(o);
    if(ws&&ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify(o));return true;}
    if(!inGame){setServerReady(false);if(!wakeStartedAt)wakeStartedAt=Date.now();wakeStatus();connect();}
    return false;
  }
  function sendControl(turn,thrust,fire,actions={}){
    if(localCpuActive&&localCpu){localCpu.setControl(turn,thrust,fire,actions);return true;}
    if(inGame&&p2p){
      const now=performance.now();
      if(!isHost&&(fallbackActive||clientNeedsFallback(now))){
        requestFallback(now);
        if(ws&&ws.readyState===WebSocket.OPEN){
          // V20.83: en fallback tambien descartamos controles viejos si la
          // salida WebSocket esta congestionada. El siguiente heartbeat enviara
          // el estado actual y evita una cola de giros/disparos atrasados.
          if(Number(ws.bufferedAmount||0)>32*1024)return false;
          try{ws.send(JSON.stringify({t:'fallback-ctrl',turn,thrust:!!thrust,fire:!!fire,...actions}));return true;}catch(_){return false;}
        }
        return false;
      }
      return p2p.sendControl(turn,thrust,fire,actions);
    }
    if(!ws||ws.readyState!==WebSocket.OPEN)return false;
    // Los controles caducan enseguida. Si la salida esta congestionada, es
    // mejor omitir uno y mandar el mas reciente 33 ms despues que acumular lag.
    if(Number(ws.bufferedAmount||0)>32*1024)return false;
    try{ws.send(JSON.stringify({t:'ctrl',turn,thrust,fire,...actions}));return true;}catch(_){return false;}
  }
  function flushPendingState(force=false,stamp=performance.now()){
    if(!pendingStateRaw)return false;
    if(!force&&STATE_PROCESS_MS>0&&lastStateProcessedAt&&stamp-lastStateProcessedAt<STATE_PROCESS_MS)return false;
    const raw=pendingStateRaw;
    pendingStateRaw=null;
    const parseStart=perfStats?performance.now():0;
    let m;try{m=JSON.parse(raw);}catch(_){return false;}
    if(perfStats){perfStats.parseMs+=performance.now()-parseStart;perfStats.parseCount++;}
    lastStateProcessedAt=stamp;
    handle(m);
    return true;
  }
  function pumpControls(now){
    if(!inGame||onlinePreparing(now))return;
    const left=keys.has('KeyA')||keys.has('ArrowLeft');
    const right=keys.has('KeyD')||keys.has('ArrowRight');
    const keyboardTurn=(left?1:0)-(right?1:0);
    const pad=joystickControls();

    // V20.38: R1/RB funciona como PTT si JOYSTICK y MICRO estan activos.
    // No activa el micro por si solo: primero se pulsa ACTIVAR MICRO en el menu.
    const nextJoystickVoice=!!(joystickEnabled&&pad.active&&pad.ptt&&voice&&voice.enabled&&!voice.cpuMode);
    if(nextJoystickVoice!==joystickVoiceHeld){
      joystickVoiceHeld=nextJoystickVoice;
      if(voice){
        if(joystickVoiceHeld)voice.setTalking(true);
        else if(!voice.keyVDown&&!voice.pttTouchActive)voice.setTalking(false);
      }
    }

    const baseTurn=isMobile
      ?(mobileKeyboardActive?keyboardTurn:progressiveMobileTurn(now))
      :keyboardTurn;
    // Si el joystick esta activado y realmente mueve el stick/D-pad, toma el
    // giro; teclado y controles tactiles siguen disponibles simultaneamente.
    const rawTurn=pad.active&&Math.abs(pad.turn)>.01?pad.turn:baseTurn;
    // El sensor tiene un poco de ruido incluso con el telefono quieto. Redondear
    // a pasos de 1/64 evita JSON/WebSocket innecesarios sin alterar el tacto.
    const turn=Math.round(rawTurn*64)/64;
    const touchThrust=isMobile&&!mobileKeyboardActive?mobileThrust:false;
    const touchFire=isMobile&&!mobileKeyboardActive?mobileFire:false;
    const thrust=touchThrust||keys.has('KeyW')||keys.has('ArrowUp')||(pad.active&&pad.thrust);
    const fire=touchFire||keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight')||(pad.active&&pad.fire);
    const legacyFire=touchFire||keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight');
    const actions={directFire:!!(pad.active&&pad.fire&&!legacyFire),rocket:!!(pad.active&&pad.rocket),flare:!!(pad.active&&pad.flare),shock:!!(pad.active&&pad.shock)};
    const joystickActions=JSON.stringify(actions);
    if(Math.abs(rawTurn-lastControlTurn)>0.001){
      lastControlTurnChangedAt=now;
      lastControlTurn=rawTurn;
    }
    lastControlThrust=thrust;
    const changed=!Number.isFinite(lastSentControlTurn)||turn!==lastSentControlTurn||thrust!==lastSentControlThrust||fire!==lastSentControlFire||joystickActions!==lastSentJoystickActions;
    const elapsed=lastControlSentAt?now-lastControlSentAt:Infinity;
    if((changed&&elapsed>=CONTROL_SEND_MS-1)||elapsed>=CONTROL_HEARTBEAT_MS){
      if(sendControl(turn,thrust,fire,actions)){
        lastControlSentAt=now;
        lastSentControlTurn=turn;lastSentControlThrust=thrust;lastSentControlFire=fire;lastSentJoystickActions=joystickActions;
      }
    }
  }
  function uniqueLeaderFrom(players){
    if(!Array.isArray(players)||!players.length)return null;
    let max=0,leader=null,tied=false;
    for(const p of players){
      const score=Number(p&&p.k)||0;
      if(score>max){max=score;leader=p;tied=false;}
      else if(score===max&&score>0){tied=true;}
    }
    return max>0&&!tied?leader:null;
  }
  function updateLeaderAnnouncement(nextState,now){
    const leader=uniqueLeaderFrom(nextState&&nextState.players);
    const nextId=leader?leader.i:null;
    if(nextId!==lastUniqueLeader){
      lastUniqueLeader=nextId;
      if(leader){
        const cleanName=sinTildes(leader.n);
        leaderAnnouncement={
          i:leader.i,
          name:cleanName,
          text:null,
          until:now+4000
        };
      }
    }
  }
  function resetLeaderAnnouncement(){lastUniqueLeader=null;leaderAnnouncement=null;}
  function rebuildPreviousLookup(snapshot){
    previousLookup.players.clear();previousLookup.asteroids.clear();previousLookup.pickups.clear();previousLookup.flares.clear();previousLookup.meteors.clear();previousLookup.ufo.clear();
    if(!snapshot)return;
    for(const p of snapshot.players||[])previousLookup.players.set(p.i,p);
    for(const a of snapshot.asteroids||[])previousLookup.asteroids.set(a.id,a);
    for(const p of snapshot.pickups||[])previousLookup.pickups.set(p.id,p);
    for(const f of snapshot.flares||[])previousLookup.flares.set(f.id,f);
    for(const m of snapshot.meteors||[])previousLookup.meteors.set(m.id,m);
    const snapshotUfos=Array.isArray(snapshot.ufos)?snapshot.ufos:(snapshot.ufo?[snapshot.ufo]:[]);
    for(const u of snapshotUfos)if(u&&u.id!=null)previousLookup.ufo.set(u.id,u);
  }
  function syncVoicePlayers(players,force=false){
    if(!voice)return;
    let sig=0;
    if(Array.isArray(players))for(const p of players)if(p&&!p.cpu&&Number.isInteger(Number(p.i)))sig|=(1<<Number(p.i));
    if(!force&&sig===lastVoicePlayersSig)return;
    lastVoicePlayersSig=sig;
    voice.syncPlayers(players);
  }
  function closeRoomDialogs(){
    if(roomTypeDialog)roomTypeDialog.classList.add('hidden');
    if(publicRoomsDialog)publicRoomsDialog.classList.add('hidden');
    if(cpuSetupDialog)cpuSetupDialog.classList.add('hidden');
    if(menu)menu.classList.remove('submenu-open');
  }
  function showCpuSetupDialog(){
    if(!cpuSetupDialog)return;
    const difficulty=document.getElementById('difficulty');
    const cpuCount=document.getElementById('cpuCount');
    if(mobileDifficulty&&difficulty)mobileDifficulty.value=difficulty.value;
    if(mobileCpuCount&&cpuCount)mobileCpuCount.value=cpuCount.value;
    if(menu)menu.classList.add('submenu-open');
    cpuSetupDialog.classList.remove('hidden');
  }
  function confirmCpuSetup(){
    const difficulty=document.getElementById('difficulty');
    const cpuCount=document.getElementById('cpuCount');
    if(difficulty&&mobileDifficulty)difficulty.value=mobileDifficulty.value;
    if(cpuCount&&mobileCpuCount)cpuCount.value=mobileCpuCount.value;
    closeRoomDialogs();
    startLocalCpu();
  }
  function renderPublicRooms(){
    if(!publicRoomsList)return;
    publicRoomsList.textContent='';
    if(!publicRooms.length){
      const p=document.createElement('p');p.className='public-rooms-empty';p.textContent=tr('noPublicRooms');publicRoomsList.appendChild(p);return;
    }
    for(const room of publicRooms){
      const row=document.createElement('div');row.className='public-room-row public-room-row-detailed';
      const head=document.createElement('div');head.className='public-room-head';
      const info=document.createElement('div');info.className='public-room-info';
      const hostRow=document.createElement('div');hostRow.className='public-room-host-row';
      const lang=String(room.lang||'es').toLowerCase();
      const safeLang=['es','en','it','fr','de'].includes(lang)?lang:'es';
      const flag=document.createElement('span');flag.className=`language-flag room-language-flag flag-${safeLang}`;flag.setAttribute('role','img');flag.setAttribute('aria-label',safeLang.toUpperCase());flag.title=safeLang.toUpperCase();
      const host=document.createElement('span');host.className='public-room-host';host.textContent=sinTildes(room.host||tr('defaultPlayer'));
      hostRow.append(flag,host);
      const code=document.createElement('span');code.className='public-room-code';code.textContent=tr('roomPrefix')+' '+String(room.code||'');
      info.append(hostRow,code);

      const status=document.createElement('span');
      status.className='public-room-status '+(room.started?'playing':'waiting');
      status.textContent=room.started?tr('playingStatus'):tr('waitingStatus');

      const slots=Array.isArray(room.slots)?room.slots:[];
      const count=document.createElement('span');count.className='public-room-count';
      count.textContent=`${slots.length||Number(room.players)||0}/${Number(room.maxPlayers)||4}`;

      head.append(info,status,count);

      if(!room.started){
        const joinBtn=document.createElement('button');joinBtn.type='button';joinBtn.className='public-room-join';joinBtn.textContent=tr('join');
        joinBtn.addEventListener('click',()=>joinRoomByCode(room.code));
        head.append(joinBtn);
      }

      const players=document.createElement('div');players.className='public-room-players';
      for(const slot of slots){
        const player=document.createElement('div');
        player.className='public-room-player '+(slot.cpu?'cpu':'human');
        const label=document.createElement('span');label.className='public-room-player-name';
        label.style.color=playerColors[Number(slot.i)]||'#fff';
        label.textContent=`J${Number(slot.i)+1} · ${sinTildes(slot.n||tr('defaultPlayer'))}${slot.registered?' · ✓':''}`;
        player.append(label);
        if(slot.cpu){
          const take=document.createElement('button');
          take.type='button';take.className='public-room-cpu-join';take.textContent=tr('join');
          take.setAttribute('aria-label',tr('joinCpuSlot',{index:Number(slot.i)+1}));
          take.addEventListener('click',()=>joinRoomByCode(room.code,Number(slot.i)));
          player.append(take);
        }
        players.append(player);
      }
      row.append(head,players);
      publicRoomsList.appendChild(row);
    }
  }
  function showRoomTypeDialog(){
    if(menu)menu.classList.add('submenu-open');
    if(roomTypeDialog)roomTypeDialog.classList.remove('hidden');
  }
  function showPublicRoomsDialog(){
    if(joinCodeDialog&&!sharedRoomCode)joinCodeDialog.value='';
    // V19.50: en movil sacamos UNIRSE del launch-console transformado.
    // Asi el modal comparte la capa raiz del menu y puede quedar realmente
    // por encima de RANKING / MANUAL / INICIO / CUENTA / IDIOMA.
    if(isMobile&&menu&&publicRoomsDialog&&publicRoomsDialog.parentElement!==menu){
      menu.appendChild(publicRoomsDialog);
    }
    if(menu)menu.classList.add('submenu-open');
    if(publicRoomsDialog)publicRoomsDialog.classList.remove('hidden');
    renderPublicRooms();send({t:'public-rooms'});
  }
  async function prepareMobileControls(){
    if(!isMobile)return;
    updateMobileControlUi();
  }
  function authToken(){return window.GalaxyAuth&&typeof window.GalaxyAuth.getToken==='function'?window.GalaxyAuth.getToken():'';}
  function stopLocalCpu(){
    if(localCpu&&typeof localCpu.stop==='function')localCpu.stop();
    localCpu=null;localCpuActive=false;activeLocalDifficulty='';
    localCampaignLevel=1;localCampaignAwaitingContinue=false;localCampaignComplete=false;localCampaignGameOver=false;
    updateBuildVersionLearningState();
  }
  async function loadCpuBrain(){
    const base=apiBaseUrl();if(!base)return null;
    const ctl=typeof AbortController==='function'?new AbortController():null;
    const timer=ctl?setTimeout(()=>ctl.abort(),1400):null;
    try{
      const res=await fetch(base+'/api/cpu-brain',{cache:'no-store',signal:ctl?ctl.signal:undefined});
      if(!res.ok)return null;
      const data=await res.json();
      if(data&&data.control)applyCpuLearningControl(data.control);
      return data&&data.ok&&data.brain?data.brain:null;
    }catch(_){return null;}
    finally{if(timer)clearTimeout(timer);}
  }
  const CPU_LEARNING_DELTA_MAX=31;
  async function submitCpuLearning(deltas){
    const base=apiBaseUrl();if(!base||!Array.isArray(deltas)||!deltas.length)return;
    try{
      await fetch(base+'/api/cpu-brain/learn',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deltas:deltas.slice(0,CPU_LEARNING_DELTA_MAX)}),
        keepalive:true
      });
    }catch(_){}
  }
  async function startLocalCpu(){
    startMusic();await prepareMobileControls();closeRoomDialogs();
    const graphicsReady=prepareGameAssets();
    if(typeof window.GalaxyLocalCpu!=='function'){
      statusEl.textContent='MODO CPU LOCAL NO DISPONIBLE';
      return;
    }
    stopLocalCpu();
    localCampaignLevel=1;localCampaignAwaitingContinue=false;localCampaignComplete=false;localCampaignGameOver=false;
    // Aislar el modo CPU de cualquier sesion/red anterior. Un snapshot o evento
    // WebSocket retrasado no debe poder sustituir el estado LOCAL ni provocar
    // un reload/retorno al menu durante la partida.
    pendingStateRaw=null;
    stopP2P();
    stopResumeWindow();clearResumeSession();playerToken='';
    roomCode='';myIndex=null;isHost=false;
    const difficulty=document.getElementById('difficulty').value;
    activeLocalDifficulty=difficulty;
    updateBuildVersionLearningState();
    postAnalyticsEvent('cpu_match');
    const brain=difficulty==='dificil'?await loadCpuBrain():null;
    await graphicsReady;
    localCpu=new window.GalaxyLocalCpu({onState:m=>handle(m),onEvent:m=>handle(m)});
    localCpu.start(
      sinTildes(campoNombre.value),
      difficulty,
      document.getElementById('cpuCount').value,
      brain,
      cpuLearningControl.localHardEnabled===true,
      localCampaignLevel
    );
    localCpuActive=true;
    handle({t:'created',code:'LOCAL',index:0,cpu:true,playerToken:''});
    handle({t:'start'});
    handle(localCpu.publicState());
  }
  async function createOnlineRoom(isPublic){
    startMusic();prepareGameAssets();await prepareMobileControls();closeRoomDialogs();
    send({
      t:'create',
      name:sinTildes(campoNombre.value),
      public:!!isPublic,
      lang:(i18n&&typeof i18n.getLanguage==='function'?i18n.getLanguage():'es'),
      authToken:authToken(),
      clientId:roomClientId(),
      testRoomToken:testRoomPermitToken()
    });
  }
  async function joinRoomByCode(code,slot=null){
    prepareGameAssets();
    const clean=String(code||'').trim().toUpperCase();
    if(!clean){showPublicRoomsDialog();return;}
    startMusic();await prepareMobileControls();closeRoomDialogs();
    const msg={
      t:'join',
      name:sinTildes(campoNombre.value),
      code:clean,
      authToken:authToken(),
      clientId:roomClientId(),
      testRoomToken:testRoomPermitToken()
    };
    // Solo enviamos slot cuando el usuario ha pulsado UNIRSE sobre una CPU.
    // El boton general de una sala en espera no debe convertirse en slot 0.
    if(slot!==null&&slot!==undefined&&slot!==''){
      const selectedSlot=Number(slot);
      if(Number.isInteger(selectedSlot)&&selectedSlot>=0&&selectedSlot<4)msg.slot=selectedSlot;
    }
    send(msg);
  }
  function updateLobbyStartButton(canStart=false){
    if(!startBtn)return;
    // Solo el anfitrion necesita un control para iniciar la partida.
    startBtn.textContent=tr('start');
    startBtn.classList.toggle('hidden',!isHost);
    startBtn.disabled=isHost?!canStart:true;
    startBtn.classList.toggle('ready-to-start',!!(isHost&&canStart));
  }
  function updateCpuFillButton(on=cpuFillEnabled){
    cpuFillEnabled=!!on;
    if(shareRoomBtn)shareRoomBtn.classList.toggle('hidden',!isHost);
    if(!fillCpuBtn)return;
    fillCpuBtn.classList.toggle('hidden',!isHost);
    fillCpuBtn.classList.toggle('cpu-fill-active',!!(isHost&&cpuFillEnabled));
    fillCpuBtn.setAttribute('aria-pressed',cpuFillEnabled?'true':'false');
    fillCpuBtn.textContent=cpuFillEnabled?tr('removeCpuFill'):tr('fillCpuHard');
  }
  function updateWaitingPlayers(players){
    if(!waitingPlayersEl)return;
    const count=Array.isArray(players)?players.length:Number(players)||0;
    waitingPlayersEl.classList.toggle('hidden',count>1);
  }
  function clearLobbyChat(){
    if(!lobbyChatLog)return;
    lobbyChatLog.querySelectorAll('.lobby-chat-line').forEach(el=>el.remove());
    if(lobbyChatEmpty)lobbyChatEmpty.classList.remove('hidden');
    lobbyChatLog.scrollTop=lobbyChatLog.scrollHeight;
    if(lobbyChatInput)lobbyChatInput.value='';
  }
  function appendLobbyChatMessage(msg){
    if(!lobbyChatLog||!msg)return;
    const text=String(msg.text||'').trim();
    if(!text)return;
    if(lobbyChatEmpty)lobbyChatEmpty.classList.add('hidden');
    const line=document.createElement('div');line.className='lobby-chat-line';
    const who=document.createElement('span');who.className='lobby-chat-name';
    const idx=Number(msg.i);who.style.color=playerColors[idx]||'#fff';
    who.textContent=`J${Number.isFinite(idx)?idx+1:'?'} ${sinTildes(msg.n||tr('defaultPlayer'))}:`;
    const body=document.createElement('span');body.className='lobby-chat-text';body.textContent=sinTildes(text);
    line.append(who,body);lobbyChatLog.appendChild(line);
    while(lobbyChatLog.querySelectorAll('.lobby-chat-line').length>24){
      const first=lobbyChatLog.querySelector('.lobby-chat-line');if(!first)break;first.remove();
    }
    lobbyChatLog.scrollTop=lobbyChatLog.scrollHeight;
  }
  function loadLobbyChatHistory(messages){
    clearLobbyChat();
    for(const msg of (Array.isArray(messages)?messages:[]))appendLobbyChatMessage(msg);
  }
  function sendLobbyChat(){
    if(!roomCode||inGame||!lobbyChatInput)return;
    const text=sinTildes(String(lobbyChatInput.value||'').trim()).slice(0,120);
    if(!text)return;
    if(send({t:'chat',text}))lobbyChatInput.value='';
  }
  function hidePlayerChangeNotice(){
    if(!playerChangeNotice)return;
    playerChangeNotice.classList.add('hidden');
    playerChangeNotice.classList.remove('player-join-notice','player-leave-notice');
    playerChangeNotice.style.removeProperty('--join-player-color');
    playerChangeNotice.textContent='';
  }
  function showPlayerCpuReplaceNotice(name,index){
    if(!playerChangeNotice)return;
    clearTimeout(playerChangeNoticeTimer);
    const idx=Math.max(0,Math.min(3,Number(index)||0));
    const cleanName=sinTildes(String(name||tr('defaultPlayer')).trim());
    const slot=idx+1;
    playerChangeNotice.textContent='';
    playerChangeNotice.classList.add('player-join-notice','player-leave-notice');
    playerChangeNotice.style.setProperty('--join-player-color',playerColors[idx]||'#fff');

    const nameEl=document.createElement('strong');
    nameEl.className='player-join-name';
    nameEl.textContent=cleanName;

    const leaveEl=document.createElement('span');
    leaveEl.className='player-leave-copy';
    leaveEl.textContent=tr('playerLeftNotice');

    const detailEl=document.createElement('span');
    detailEl.className='player-leave-detail';
    detailEl.textContent=tr('playerCpuReplaceNotice',{index:slot});

    playerChangeNotice.append(nameEl,leaveEl,detailEl);
    playerChangeNotice.classList.remove('hidden');
    playerChangeNoticeTimer=setTimeout(()=>{
      playerChangeNoticeTimer=null;
      hidePlayerChangeNotice();
    },3000);
  }
  function showPlayerLeftNotice(name,index){
    if(!playerChangeNotice)return;
    clearTimeout(playerChangeNoticeTimer);
    const idx=Math.max(0,Math.min(3,Number(index)||0));
    const cleanName=sinTildes(String(name||tr('defaultPlayer')).trim());
    playerChangeNotice.textContent='';
    playerChangeNotice.classList.add('player-join-notice','player-leave-notice');
    playerChangeNotice.style.setProperty('--join-player-color',playerColors[idx]||'#fff');

    const nameEl=document.createElement('strong');
    nameEl.className='player-join-name';
    nameEl.textContent=cleanName;

    const leaveEl=document.createElement('span');
    leaveEl.className='player-leave-copy';
    leaveEl.textContent=tr('playerLeftNotice');

    playerChangeNotice.append(nameEl,leaveEl);
    playerChangeNotice.classList.remove('hidden');
    playerChangeNoticeTimer=setTimeout(()=>{
      playerChangeNoticeTimer=null;
      hidePlayerChangeNotice();
    },3000);
  }
  function showPlayerJoinedNotice(name,index){
    if(!playerChangeNotice)return;
    clearTimeout(playerChangeNoticeTimer);
    const idx=Math.max(0,Math.min(3,Number(index)||0));
    const cleanName=sinTildes(String(name||tr('defaultPlayer')).trim());
    playerChangeNotice.textContent='';
    playerChangeNotice.classList.add('player-join-notice');
    playerChangeNotice.style.setProperty('--join-player-color',playerColors[idx]||'#fff');
    const nameEl=document.createElement('strong');
    nameEl.className='player-join-name';
    nameEl.textContent=cleanName;
    const copyEl=document.createElement('span');
    copyEl.className='player-join-copy';
    copyEl.textContent=tr('playerJoinedNotice');
    playerChangeNotice.append(nameEl,copyEl);
    playerChangeNotice.classList.remove('hidden');
    playerChangeNoticeTimer=setTimeout(()=>{
      playerChangeNoticeTimer=null;
      hidePlayerChangeNotice();
    },3000);
  }
  function handle(m){
    if(m.t==='public-rooms'){
      publicRooms=Array.isArray(m.rooms)?m.rooms:[];renderPublicRooms();return;
    }
    if(m.t==='player-cpu-replaced'){showPlayerCpuReplaceNotice(m.name,m.index);return;}
    if(m.t==='player-left-live'){showPlayerLeftNotice(m.name,m.index);return;}
    if(m.t==='player-joined-live'){showPlayerJoinedNotice(m.name,m.index);return;}
    if(m.t==='chat-history'){loadLobbyChatHistory(m.messages);return;}
    if(m.t==='chat'){appendLobbyChatMessage(m);return;}
    if(m.t==='created'||m.t==='joined'){
      if(!m.started){inGame=false;resetOnlineStartCountdown();clearGameCanvas();}
      closeRoomDialogs();
      if(impactFX)impactFX.reset();resetGameFeelVisuals();resetLeaderAnnouncement();
      state=null;previousState=null;lastStateTime=0;previousStateTime=0;smoothedStateInterval=NET_FRAME_MS;resetLocalVisual();resetRemoteVisuals();lastVoicePlayersSig=0;rebuildPreviousLookup(null);
      roomCode=m.code;myIndex=m.index;playerToken=String(m.playerToken||'');isHost=m.t==='created';
      if(Array.isArray(m.players))lobbyPlayers=m.players.slice();
      if(m.seriesRound||m.seriesWins)applyOnlineSeriesState(m);
      cpuFillEnabled=!!m.cpuFill;ensureP2P()?.configure({myIndex,isHost,players:lobbyPlayers});
      saveResumeSession();stopResumeWindow();clearLobbyChat();updateLobbyStartButton(false);updateCpuFillButton(cpuFillEnabled);updateWaitingPlayers(m.players||(m.cpu?2:1));
      if(voice){voice.setSession(roomCode,myIndex,!!m.cpu);if(Array.isArray(m.players))syncVoicePlayers(m.players,true);}
      roomCodeEl.textContent=roomCode;roomMini.textContent='';stopMusic();menu.classList.add('hidden');
      if(voice&&typeof voice.startSelectedForSession==='function')voice.startSelectedForSession();
      if(m.started){lobby.classList.add('hidden');beginGame();}
      else if(!m.cpu)lobby.classList.remove('hidden');
    }
    else if(m.t==='resumed'){
      if(!m.started){inGame=false;resetOnlineStartCountdown();clearGameCanvas();}
      roomCode=String(m.code||roomCode);myIndex=Number(m.index);playerToken=String(m.playerToken||playerToken);isHost=!!m.host;
      if(Array.isArray(m.players)){lobbyPlayers=m.players.slice();cpuFillEnabled=!!m.cpuFill;ensureP2P()?.configure({myIndex,isHost,players:lobbyPlayers});syncVoicePlayers(lobbyPlayers,true);}
      if(m.seriesRound||m.seriesWins)applyOnlineSeriesState(m);
      updateCpuFillButton(cpuFillEnabled);saveResumeSession();stopResumeWindow();
      roomCodeEl.textContent=roomCode;if(roomMini)roomMini.textContent='';stopMusic();menu.classList.add('hidden');
      if(voice){voice.setSession(roomCode,myIndex,!!m.cpu);if(typeof voice.startSelectedForSession==='function')voice.startSelectedForSession();}
      if(m.started&&isHost&&!hostPhysics&&!inGame){
        clearResumeSession();playerToken='';
        alert(sinTildes(tr('resumeFailed')));
        send({t:'leave'});returnToMainMenu(false);return;
      }
      if(m.started){lobby.classList.add('hidden');if(!inGame)beginGame();}
      else if(!m.cpu){lobby.classList.remove('hidden');}
    }
    else if(m.t==='resume-failed'){
      if(inGame&&p2pGameHealthy()){
        // La sala puede haber caducado solo en el servidor mientras el P2P
        // seguia vivo. No destruimos una partida que aun esta funcionando.
        stopResumeWindow();
        statusEl.textContent=tr('reconnectingGame');
        scheduleReconnect(1200);
        return;
      }
      stopResumeWindow();clearResumeSession();playerToken='';
      if(inGame||roomCode){alert(sinTildes(trServer(m.message||tr('resumeFailed'))));returnToMainMenu(false);}
      else send({t:'public-rooms'});
    }
    else if(m.t==='lobby'){
      if(!inGame&&!onlineStartPending&&!lobby.classList.contains('hidden')){resetOnlineStartCountdown();clearGameCanvas();}
      roomCode=m.code;lobbyPlayers=Array.isArray(m.players)?m.players.slice():[];cpuFillEnabled=!!m.cpuFill;
      ensureP2P()?.configure({myIndex,isHost,players:lobbyPlayers});
      // El roster es la autoridad sobre si cada plaza es HUMANO o CPU,
      // tambien durante la victoria/espera entre partidas.
      if(isHost&&hostPhysics&&typeof hostPhysics.syncRoster==='function')hostPhysics.syncRoster(lobbyPlayers);
      syncVoicePlayers(m.players,true);roomCodeEl.textContent=m.code;
      playersEl.innerHTML=m.players.map(p=>`<div style="color:${playerColors[p.i]||'#fff'}">J${p.i+1} · ${escapeHtml(sinTildes(p.n))}${p.registered?' · ✓':''}${p.cpu?' · CPU':''}</div>`).join('');
      updateLobbyStartButton(!!m.canStart);updateCpuFillButton(cpuFillEnabled);updateWaitingPlayers(m.players);
    }
    else if(m.t==='start'){lastAcceptedStateRound=-1;lastAcceptedStateSeq=-1;lastP2PStateAt=0;lastFallbackRequestAt=0;lastFallbackStateSentAt=0;fallbackActive=false;p2pStableCount=0;fallbackPeers.clear();fallbackReconnectAt.clear();if(Array.isArray(m.players))lobbyPlayers=m.players.slice();onlineSessionWins.clear();onlineSeriesRound=Math.max(1,Number(m.rankRound)||1);onlineSeriesScoredRound=0;onlineSeriesComplete=false;onlineSeriesChampion=-1;if(m.seriesWins)applyOnlineSeriesState(m);ensureP2P()?.configure({myIndex,isHost,players:lobbyPlayers});beginOnlineStartCountdown(m.rankRound);}
    else if(m.t==='state'){
      // V19.55 OPT1: el DataChannel P2P es no ordenado para reducir latencia.
      // Nunca dejamos que un snapshot antiguo vuelva a mover la escena atras.
      // round permite que seq se reinicie de forma segura entre rondas.
      const incomingRound=Number(m.round),incomingSeq=Number(m.seq);
      // Un snapshot de la nueva ronda tambien recupera una cuenta atras si
      // el evento restarted se pierde; rankRound evita arrancarla dos veces.
      const previousRound=state&&Number(state.round);
      if(roomCode!=='LOCAL'&&Number.isInteger(incomingRound)&&previousRound>0&&incomingRound>previousRound&&m.started&&!m.finished){
        handle({t:'restarted',rankRound:incomingRound});
      }
      if(Number.isInteger(incomingRound)&&incomingRound>0&&currentMatchBackgroundRound!==incomingRound){
        selectMatchBackgroundForRound(incomingRound);
      }
      if(Number.isInteger(incomingRound)&&Number.isInteger(incomingSeq)){
        const stale=lastAcceptedStateRound>=0&&(
          incomingRound<lastAcceptedStateRound||
          (incomingRound===lastAcceptedStateRound&&incomingSeq<=lastAcceptedStateSeq)
        );
        if(stale)return;
        lastAcceptedStateRound=incomingRound;lastAcceptedStateSeq=incomingSeq;
      }
      const now=performance.now();
      if(impactFX)impactFX.consume(m,myIndex,now);
      consumeGameFeelFx(m,now);
      detectLocalMissileEvasion(m,now);
      updatePickupVisualBirths(m,now);
      if(Array.isArray(m.fx)){
        for(const e of m.fx){
          if(!e||e.kind!=='shockwave'||!Number.isSafeInteger(e.id))continue;
          if(shockwaveFx.some(x=>x.id===e.id))continue;
          shockwaveFx.push({id:e.id,x:Number(e.x)||0,y:Number(e.y)||0,born:now-Math.max(0,Number(e.age)||0)});
          if(shockwaveFx.length>12)shockwaveFx.shift();
        }
      }
      updateLeaderAnnouncement(m,now);

      // V21.65: aviso de OVNI exclusivamente local. Cada cliente lo deduce del
      // primer snapshot en el que aparece un OVNI; no se envia ningun evento por red.
      if(roomCode!=='LOCAL'){
        const oldUfos=state?(Array.isArray(state.ufos)?state.ufos:(state.ufo?[state.ufo]:[])):[];
        const newUfos=Array.isArray(m.ufos)?m.ufos:(m.ufo?[m.ufo]:[]);
        const oldIds=new Set(oldUfos.filter(Boolean).map(u=>String(u.id)));
        const appeared=newUfos.some(u=>u&&u.id!=null&&!oldIds.has(String(u.id)));
        if(appeared){
          playNoticeStart=now;
          playNoticeUntil=now+2200;
          playNoticeText=tr('ufoIdentifiedNotice');
          playNoticeKind='ufo';
        }
      }

      const oldLocal=state&&Array.isArray(state.players)?state.players.find(p=>p.i===myIndex):null;
      const newLocal=Array.isArray(m.players)?m.players.find(p=>p.i===myIndex):null;
      if(Array.isArray(m.players)){
        for(const np of m.players){
          const idx=Number(np&&np.i);
          if(!Number.isInteger(idx)||idx<0||idx>=invisibleHudUntil.length)continue;
          const op=state&&Array.isArray(state.players)?state.players.find(p=>Number(p.i)===idx):null;
          const oldCamo=Number(op&&op.camo)||0;
          const newCamo=Number(np&&np.camo)||0;
          if(newCamo>0&&oldCamo<=0){
            invisibleHudUntil[idx]=now+2000;
            // V21.61: el jugador local ya recibe su aviso de FANTASMA abajo.
            // El cartel grande superior queda solo para avisar de rivales.
            if(idx!==Number(myIndex)){
              invisibleNoticeIndex=idx;
              invisibleNoticeUntil=now+2000;
            }
          }

          // V21.18: aviso local cuando cualquier jugador alcanza 4/5.
          // No se envia por red; cada cliente lo deduce del snapshot recibido.
          const kills=Number(np&&np.k)||0;
          if(kills===4&&!nearWinActive.has(idx)){
            nearWinActive.add(idx);
            // V21.31: el aviso de "a una de ganar" solo alerta sobre rivales.
            // El propio jugador ya ve su 4/5 en el HUD y no necesita este cartel.
            if(idx!==Number(myIndex)){
              nearWinNoticeStart=now;
              nearWinNoticeUntil=now+2200;
              nearWinNoticeName=sinTildes(String(np&&np.n||('JUGADOR '+(idx+1)))).trim().toUpperCase();
              nearWinNoticeIndex=idx;
            }
          }else if(kills<4){
            nearWinActive.delete(idx);
          }
        }
      }
      if(oldLocal&&newLocal&&Number(newLocal.k)>Number(oldLocal.k)){
        // Confirmacion visual local de baja: no se envia por red y solo la ve
        // el jugador que acaba de sumar una muerte.
        if(lastLocalKillAt>0&&now-lastLocalKillAt<=3500){
          playNoticeStart=now;
          playNoticeUntil=now+1350;
          playNoticeText=tr('doubleMove');
          playNoticeKind='double';
        }
        lastLocalKillAt=now;
        killHudFlashStart=now;
        killHudFlashUntil=now+450;
        // El servidor suma la baja inmediatamente, pero visualmente mantenemos
        // el valor anterior hasta que empieza el pop de escala. De este modo
        // numero nuevo y animacion aparecen exactamente a la vez.
        // Si la baja anterior ya habia sido revelada, el nuevo valor de espera
        // parte del marcador que el jugador ya estaba viendo.
        if(killScoreHeldValue===null||now>=killScoreFxStart)killScoreHeldValue=Number(oldLocal.k)||0;
        killScorePendingValue=Number(newLocal.k)||0;
        killScoreFxStart=now+2000;
        killScoreFxUntil=killScoreFxStart+2000;
      } else if(oldLocal&&newLocal&&Number(newLocal.k)<Number(oldLocal.k)){
        killScoreHeldValue=null;
        killScorePendingValue=null;
        // El servidor descuenta la baja inmediatamente, pero visualmente primero
        // mostramos PENALIZACION -1. Durante ese aviso se conserva el valor
        // anterior; al terminar, aparece la resta con el efecto del HUD.
        crashScoreHeldValue=Number(oldLocal.k)||0;
        crashScorePendingValue=Number(newLocal.k)||0;
        penaltyMessageUntil=now+2000;
        crashScoreFxStart=penaltyMessageUntil;
        crashScoreFxUntil=crashScoreFxStart+950;
      }
      if(oldLocal&&newLocal&&Number(newLocal.d)>Number(oldLocal.d))lastLocalKillAt=0;
      if(lastStateTime>0){
        const arrived=now-lastStateTime;
        if(Number.isFinite(arrived)&&arrived>=16&&arrived<=100){
          const sample=clamp(arrived,24,60);
          smoothedStateInterval+=0.14*(sample-smoothedStateInterval);
        }
      }
      previousState=state;
      previousStateTime=lastStateTime;
      rebuildPreviousLookup(previousState);
      state=m;lastStateTime=now;
      if(!previousState){previousState=m;previousStateTime=now-NET_FRAME_MS;rebuildPreviousLookup(m);}
      syncVoicePlayers(m.players);
      maybeScheduleVictory();
      if(!inGame&&!onlineStartPending&&m.started&&!m.finished)beginGame();
    }
    else if(m.t==='brutal'){
      brutalFxStart=performance.now();
      brutalFxUntil=brutalFxStart+1850;
      brutalDistance=Number(m.distance)||0;
      brutalDistanceText=brutalDistance>0?(Math.round(brutalDistance*(8/48))+' m'):'';
      brutalShooter=sinTildes(String(m.shooter||'')).trim();
      brutalAmmoBonus=Math.max(0,Number(m.ammoBonus)||0);
      brutalCadenceMax=!!m.cadenceMax;
      brutalTitleKey=String(m.titleKey||'brutal');
    }
    else if(m.t==='pickup'){
      if(Number(m.index)===Number(myIndex)){
        const key={
          ammo1:'pickupAmmo1',ammo3:'pickupAmmo6',cadence:'pickupCadence',
          mira:'pickupAim',flare:'pickupFlare',shockwave:'pickupShockwave',
          speed:'pickupSpeed',shield:'pickupShield',camo:'pickupGhost'
        }[String(m.pickupType||'')];
        if(key){
          const pickedAt=performance.now();
          pickupNoticeStart=pickedAt;
          pickupNoticeUntil=pickupNoticeStart+950;
          pickupNoticeText=tr(key);
          if(m.pickupType==='shockwave'&&!seenShockwaveHelp){
            seenShockwaveHelp=true;
            specialHelpStart=pickedAt+980;
            specialHelpUntil=specialHelpStart+2200;
            specialHelpText=tr(isMobile?'specialMobileHelp':'specialPcHelp');
          }else if(m.pickupType==='flare'&&!seenFlareHelp){
            seenFlareHelp=true;
            specialHelpStart=pickedAt+980;
            specialHelpUntil=specialHelpStart+2200;
            specialHelpText=tr(isMobile?'specialMobileHelp':'specialPcHelp');
          }
        }
      }
    }
    else if(m.t==='shock-perfect'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1400;
        playNoticeText=tr('shockPerfectMove');
        playNoticeKind='shockperfect';
      }
    }
    else if(m.t==='shock-cancel'){
      if(Array.isArray(m.indices)&&m.indices.some(i=>Number(i)===Number(myIndex))){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1200;
        playNoticeText=tr('shockCancelMove');
        playNoticeKind='shockcancel';
      }
    }
    else if(m.t==='intercept'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1100;
        playNoticeText=tr('interceptMove');
        playNoticeKind='intercept';
      }
    }
    else if(m.t==='shield-break'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1200;
        playNoticeText=tr('shieldBreakMove');
        playNoticeKind='shieldbreak';
      }
    }
    else if(m.t==='hunter'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1200;
        playNoticeText=tr('hunterMove');
        playNoticeKind='hunter';
      }
    }
    else if(m.t==='pointblank'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1200;
        playNoticeText=tr('pointBlankMove');
        playNoticeKind='pointblank';
      }
    }
    else if(m.t==='flare-kill'){
      if(Number(m.index)===Number(myIndex)){
        playNoticeStart=performance.now();
        playNoticeUntil=playNoticeStart+1250;
        playNoticeText=tr('flareHitMove');
        playNoticeKind='flarehit';
      }
    }
    else if(m.t==='hunt'){
      huntFxStart=performance.now();
      huntFxUntil=huntFxStart+Math.max(2200,Number(m.graceMs)||0);
      huntText=tr('huntTarget',{name:String(m.name||tr('defaultPlayer')).trim()});
      huntCpuAmmo=!!m.cpuAmmo;
      huntCpuBonus=Math.max(0,Number(m.cpuAmmoBonus)||0);
      huntCpuIndices=Array.isArray(m.cpuIndices)?m.cpuIndices.map(Number).filter(Number.isFinite):[];
      huntCpuAmmoTotals.clear();
      if(Array.isArray(m.cpuAmmoTotals)){
        for(const pair of m.cpuAmmoTotals){
          if(!Array.isArray(pair)||pair.length<2)continue;
          const idx=Number(pair[0]),total=Number(pair[1]);
          if(Number.isInteger(idx)&&Number.isFinite(total))huntCpuAmmoTotals.set(idx,total);
        }
      }
    }
    else if(m.t==='series-state'){
      applyOnlineSeriesState(m);
    }
    else if(m.t==='series-lobby'){
      enterLobbyAfterSeries(m);
    }
    else if(m.t==='rank-round'){
      if(isHost&&hostPhysics&&Number.isFinite(Number(m.rankRound)))hostPhysics.rankRound=Number(m.rankRound);
      onlineSeriesRound=Math.max(1,Number(m.rankRound)||onlineSeriesRound||1);
      updateOnlineSeriesRoundUi(onlineSeriesRound);
    }
    else if(m.t==='sound'){playSound(m.kind);}
    else if(m.t==='cpu-learning'){submitCpuLearning(m.deltas);}
    else if(m.t==='victory'){
      // V21.72: la CPU emite VICTORY antes de publicar el snapshot final.
      // Leemos ese estado ya confirmado para preparar primero la ultima baja.
      if(localCpuActive&&localCpu)handle(localCpu.publicState());
      if(state)state.winner=m.winner;
      queueVictory(m.winner);
    }
    else if(m.t==='restarted'){
      const restartRound=roomCode==='LOCAL'?localCampaignLevel:Math.max(1,Number(m.rankRound)||(hostPhysics&&hostPhysics.rankRound)||currentMatchBackgroundRound+1);
      if(roomCode!=='LOCAL'&&restartRound<=lastRestartedRound)return;
      if(roomCode!=='LOCAL'){lastRestartedRound=restartRound;onlineSeriesRound=restartRound;updateOnlineSeriesRoundUi(restartRound);}
      resetOnlineStartCountdown();if(impactFX)impactFX.reset();resetGameFeelVisuals();invisibleHudUntil.fill(0);clearTimeout(victoryShowTimer);victoryShowTimer=null;pendingVictoryIndex=null;state=null;previousState=null;lastStateTime=0;previousStateTime=0;smoothedStateInterval=NET_FRAME_MS;resetLocalVisual();resetRemoteVisuals();rebuildPreviousLookup(null);killHudFlashStart=0;killHudFlashUntil=0;killScoreFxStart=0;killScoreFxUntil=0;killScoreHeldValue=null;killScorePendingValue=null;crashScoreFxStart=0;crashScoreFxUntil=0;crashScoreHeldValue=null;crashScorePendingValue=null;penaltyMessageUntil=0;brutalFxStart=0;brutalFxUntil=0;brutalDistance=0;brutalDistanceText='';brutalShooter='';brutalAmmoBonus=0;brutalCadenceMax=false;brutalTitleKey='brutal';playNoticeStart=0;playNoticeUntil=0;playNoticeText='';playNoticeKind='';lastLocalKillAt=0;lastSavedNoticeAt=0;huntFxStart=0;huntFxUntil=0;huntText='';huntCpuAmmo=false;huntCpuBonus=0;huntCpuIndices=[];huntCpuAmmoTotals.clear();invisibleNoticeIndex=-1;invisibleNoticeUntil=0;victory.classList.remove('winner-celebration');victory.classList.add('hidden');beginOnlineStartCountdown(restartRound);}
    else if(m.t==='error'){if(sharedRoomCode&&!roomCode)sharedRoomJoinStarted=false;statusEl.textContent=sinTildes(m.message?trServer(m.message):tr('error'));}
    else if(m.t==='closed'){
      const recoverable=String(m.cause||'')==='host_timeout'&&p2pGameHealthy();
      if(recoverable){
        stopResumeWindow();
        statusEl.textContent=tr('reconnectingGame');
        scheduleReconnect(1200);
        return;
      }
      stopResumeWindow();clearResumeSession();playerToken='';
      alert(sinTildes(m.reason?trServer(m.reason):tr('close')));
      returnToMainMenu(false);
    }
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function selectLocalCampaignBackground(level){
    const safeLevel=clamp(Math.round(Number(level)||1),1,LOCAL_CAMPAIGN_LEVELS);
    const index=safeLevel-1;
    currentMatchBackgroundRound=0;
    matchBackgroundCursor=index;
    applyMatchBackground(index);
    return index;
  }

  // V20.96: transicion puramente visual entre mundos de la campana CPU.
  // Se ejecuta con la partida terminada, en un canvas UI independiente, por lo
  // que no modifica fisica, red, temporizadores de simulacion ni colisiones.
  let interstellarTravelCanvas=null,interstellarTravelRaf=0,interstellarTravelResolve=null,interstellarTravelGeneration=0;
  function ensureInterstellarTravelCanvas(){
    if(interstellarTravelCanvas)return interstellarTravelCanvas;
    const c=document.createElement('canvas');
    c.id='interstellarTravelFx';
    c.setAttribute('aria-hidden','true');
    Object.assign(c.style,{
      position:'fixed',inset:'0',width:'100vw',height:'100vh',
      display:'none',pointerEvents:'none',zIndex:'10000'
    });
    document.body.appendChild(c);
    interstellarTravelCanvas=c;
    return c;
  }
  function cancelInterstellarTravel(){
    interstellarTravelGeneration++;
    if(interstellarTravelRaf)cancelAnimationFrame(interstellarTravelRaf);
    interstellarTravelRaf=0;
    if(interstellarTravelCanvas)interstellarTravelCanvas.style.display='none';
    if(interstellarTravelResolve){
      const resolve=interstellarTravelResolve;
      interstellarTravelResolve=null;
      resolve(false);
    }
  }
  function runInterstellarTravel(targetLevel){
    cancelInterstellarTravel();
    const generation=interstellarTravelGeneration;
    const c=ensureInterstellarTravelCanvas();
    const g=c.getContext('2d',{alpha:true});
    if(!g)return Promise.resolve(true);
    const cssW=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1280);
    const cssH=Math.max(1,window.innerHeight||document.documentElement.clientHeight||720);
    const dpr=Math.min(isMobile?1.25:1.5,Math.max(1,Number(window.devicePixelRatio)||1));
    c.width=Math.max(1,Math.round(cssW*dpr));
    c.height=Math.max(1,Math.round(cssH*dpr));
    c.style.display='block';
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration=reduced?700:(isMobile?2100:2450);
    const count=isMobile?46:78;
    const stars=new Array(count);
    for(let i=0;i<count;i++){
      stars[i]={
        angle:Math.random()*Math.PI*2,
        seed:Math.random(),
        speed:.72+Math.random()*1.15,
        width:.6+Math.random()*1.7
      };
    }
    victory.classList.add('hidden');
    return new Promise(resolve=>{
      interstellarTravelResolve=resolve;
      const started=performance.now();
      const finish=ok=>{
        if(interstellarTravelRaf)cancelAnimationFrame(interstellarTravelRaf);
        interstellarTravelRaf=0;
        c.style.display='none';
        if(interstellarTravelResolve===resolve)interstellarTravelResolve=null;
        resolve(ok);
      };
      const frame=now=>{
        if(generation!==interstellarTravelGeneration){finish(false);return;}
        const t=Math.max(0,Math.min(1,(now-started)/duration));
        const accel=t*t;
        g.setTransform(dpr,0,0,dpr,0,0);
        g.globalCompositeOperation='source-over';
        g.globalAlpha=1;
        g.fillStyle='rgb(1,3,12)';
        g.fillRect(0,0,cssW,cssH);
        const cx=cssW*.5,cy=cssH*.5,maxR=Math.hypot(cssW,cssH)*.62;

        // Tunel de estrellas: lineas reutilizan un conjunto fijo creado una vez.
        g.save();
        g.translate(cx,cy);
        g.globalCompositeOperation='lighter';
        for(const star of stars){
          const phase=(star.seed+t*(.18+2.2*accel)*star.speed)%1;
          const r1=Math.pow(phase,1.75)*maxR;
          const streak=4+(18+150*accel)*(.55+star.speed*.45);
          const r2=Math.min(maxR*1.12,r1+streak);
          const ca=Math.cos(star.angle),sa=Math.sin(star.angle);
          g.globalAlpha=Math.min(.92,.12+.78*t)*Math.min(1,.28+phase);
          g.strokeStyle=star.speed>1.25?'rgb(145,220,255)':'rgb(235,245,255)';
          g.lineWidth=star.width;
          g.beginPath();
          g.moveTo(ca*r1,sa*r1);
          g.lineTo(ca*r2,sa*r2);
          g.stroke();
        }
        g.restore();

        // Portal central sencillo y barato. El destello tapa el corte antes de
        // aparecer el siguiente fondo, sin necesitar texturas adicionales.
        const portal=Math.sin(Math.min(1,t*1.15)*Math.PI);
        g.save();
        g.globalCompositeOperation='lighter';
        g.globalAlpha=.12+.38*portal;
        g.fillStyle='rgb(80,175,255)';
        g.beginPath();g.arc(cx,cy,18+74*portal,0,Math.PI*2);g.fill();
        g.globalAlpha=.18+.52*portal;
        g.strokeStyle='rgb(210,245,255)';
        g.lineWidth=2+4*portal;
        g.beginPath();g.arc(cx,cy,42+145*portal,0,Math.PI*2);g.stroke();
        g.restore();

        const textAlpha=Math.min(1,t/.18)*Math.min(1,(1-t)/.12);
        g.save();
        g.globalAlpha=Math.max(0,textAlpha);
        g.textAlign='center';
        g.textBaseline='middle';
        g.fillStyle='#ffffff';
        g.font=(isMobile?'32px ':'42px ')+'Flashback,Arial,Helvetica,sans-serif';
        g.fillText(tr('interstellarTravel'),cx,cy-22);
        g.fillStyle='#8fe8ff';
        // V21.59: el destino de la siguiente fase debe leerse como parte
        // principal de la transicion, especialmente en movil.
        g.font=(isMobile?'28px ':'36px ')+'Flashback,Arial,Helvetica,sans-serif';
        g.fillText(tr('destinationLevel',{level:targetLevel,name:localCampaignWorldName(targetLevel)}),cx,cy+34);
        g.restore();

        // Flash final muy corto para enlazar de forma limpia con el nuevo mundo.
        if(t>.88){
          g.globalCompositeOperation='source-over';
          g.globalAlpha=Math.pow((t-.88)/.12,2)*.88;
          g.fillStyle='#ffffff';
          g.fillRect(0,0,cssW,cssH);
        }

        if(t>=1){finish(true);return;}
        interstellarTravelRaf=requestAnimationFrame(frame);
      };
      interstellarTravelRaf=requestAnimationFrame(frame);
    });
  }
  function beginGame(preparingOnline=false,backgroundRound=0){
    // En CPU el nivel decide el fondo: 1=fondo, 2=fondo02, 3=fondo03, 4=fondo04, 5=fondo05.
    // Online conserva su sincronizacion autoritativa por rankRound.
    victoryHudScoreShownAt=null;
    if(roomCode==='LOCAL')selectLocalCampaignBackground(localCampaignLevel);
    else if(Number(backgroundRound)>0)selectMatchBackgroundForRound(backgroundRound);
    else if(!roomCode)selectNextMatchBackground();
    stopMusic();updateMobileControlUi();resetLocalVisual();resetRemoteVisuals();lastControlThrust=false;lastControlSentAt=0;lastSentControlTurn=NaN;lastSentControlThrust=false;lastSentControlFire=false;inGame=true;menu.classList.add('hidden');lobby.classList.add('hidden');victory.classList.remove('winner-celebration');victory.classList.add('hidden');if(preparingOnline){topbar.classList.add('hidden');mobileControls.classList.add('hidden');if(mobileExit)mobileExit.classList.add('hidden');}else activateGameUi();scheduleCanvasResolution();}
  function queueVictory(i){
    const winnerIndex=Number(i);
    if(!inGame||!Number.isInteger(winnerIndex)||winnerIndex<0||winnerIndex>3)return;
    // El mismo VICTORY puede llegar por P2P y por el respaldo fiable WebSocket.
    // Si ya esta programado, no reiniciamos el temporizador.
    if(pendingVictoryIndex===winnerIndex)return;
    pendingVictoryIndex=winnerIndex;
    victoryHudScoreShownAt=null;
    clearTimeout(victoryShowTimer);victoryShowTimer=null;
    maybeScheduleVictory();
  }
  function victoryDisplayDelay(now){
    let delay=700;
    if(Number(pendingVictoryIndex)===Number(myIndex)&&killScorePendingValue!==null){
      delay=Math.max(delay,killScoreFxStart-now+650);
    }
    if(roomCode==='LOCAL'&&Number(pendingVictoryIndex)===Number(myIndex)){
      // Esperar a un fotograma que haya mostrado 5/5, tambien tras volver
      // de una pestaña en segundo plano o recibir un estado retrasado.
      if(victoryHudScoreShownAt===null)return Math.max(100,killScoreFxStart-now);
      return Math.max(0,victoryHudScoreShownAt+650-now);
    }
    return delay;
  }
  function maybeScheduleVictory(){
    if(pendingVictoryIndex===null||!inGame||victoryShowTimer)return;
    const winnerIndex=pendingVictoryIndex;
    const delay=victoryDisplayDelay(performance.now());
    victoryShowTimer=setTimeout(()=>{
      victoryShowTimer=null;
      if(pendingVictoryIndex!==winnerIndex||!inGame)return;
      const now=performance.now();
      // El snapshot final puede llegar DESPUES de programar el cartel.
      // Revalidar aqui impide que un temporizador antiguo lo adelante.
      const scoreStillPending=Number(winnerIndex)===Number(myIndex)&&killScorePendingValue!==null&&now<killScoreFxStart+650;
      const localHudStillPending=roomCode==='LOCAL'&&Number(winnerIndex)===Number(myIndex)&&(victoryHudScoreShownAt===null||now<victoryHudScoreShownAt+650);
      if(scoreStillPending||localHudStillPending){maybeScheduleVictory();return;}
      pendingVictoryIndex=null;
      showVictory(winnerIndex);
    },delay);
  }
  function onlineSessionPlayerKey(p){
    const idx=Number(p&&p.i);
    const name=sinTildes(String(p&&p.n||('JUGADOR '+(Number.isInteger(idx)?idx+1:'?')))).trim().toUpperCase();
    return String(Number.isInteger(idx)?idx:-1)+'|'+name;
  }
  function currentVictoryRoster(){
    const roster=Array.isArray(lobbyPlayers)&&lobbyPlayers.length?lobbyPlayers:
      (state&&Array.isArray(state.players)?state.players:[]);
    return roster
      .filter(p=>Number.isInteger(Number(p&&p.i))&&Number(p.i)>=0&&Number(p.i)<4)
      .map(p=>({i:Number(p.i),n:String(p.n||('JUGADOR '+(Number(p.i)+1))),cpu:!!p.cpu}));
  }
  function addOnlineSessionWin(winnerIndex){
    const winner=currentVictoryRoster().find(p=>p.i===Number(winnerIndex));
    if(!winner)return;
    const key=onlineSessionPlayerKey(winner);
    onlineSessionWins.set(key,(Number(onlineSessionWins.get(key))||0)+1);
  }
  function currentOnlineSeriesRound(){
    return Math.max(1,Number(onlineSeriesRound)||(state&&Number(state.round))||(hostPhysics&&Number(hostPhysics.rankRound))||Number(currentMatchBackgroundRound)||1);
  }
  function onlineSeriesRoundLabel(round=currentOnlineSeriesRound()){
    const r=Math.max(1,Number(round)||1);
    return r<=ONLINE_SERIES_BASE_ROUNDS?'RONDA '+r+'/'+ONLINE_SERIES_BASE_ROUNDS:'DESEMPATE · RONDA '+r;
  }
  function updateOnlineSeriesRoundUi(round=currentOnlineSeriesRound()){
    if(roomCode==='LOCAL')return;
    onlineSeriesRound=Math.max(1,Number(round)||1);
    const mini=document.getElementById('seriesRoundMini');
    if(mini)mini.textContent=onlineSeriesRoundLabel(onlineSeriesRound);
    const title=document.getElementById('sessionRankingTitle');
    if(title)title.textContent='SERIE · '+onlineSeriesRoundLabel(onlineSeriesRound);
  }
  function applyOnlineSeriesState(m){
    if(!m||roomCode==='LOCAL')return;
    const round=Math.max(0,Number(m.round??m.seriesRound)||0);
    const wins=Array.isArray(m.wins)?m.wins:(Array.isArray(m.seriesWins)?m.seriesWins:null);
    if(round>0){onlineSeriesRound=round;onlineSeriesScoredRound=round;}
    if(wins){
      onlineSessionWins.clear();
      for(const p of currentVictoryRoster()){
        onlineSessionWins.set(onlineSessionPlayerKey(p),Math.max(0,Number(wins[p.i])||0));
      }
    }
    onlineSeriesComplete=!!(m.complete??m.seriesComplete);
    onlineSeriesChampion=Number.isInteger(Number(m.champion??m.seriesChampion))?Number(m.champion??m.seriesChampion):-1;
    updateOnlineSeriesRoundUi(onlineSeriesRound||1);
    renderOnlineSessionRanking();
    if(onlineSeriesComplete&&onlineSeriesChampion>=0&&!victory.classList.contains('hidden')){
      showOnlineSeriesChampion(onlineSeriesChampion);
    }else if(!onlineSeriesComplete&&!victory.classList.contains('hidden')){
      const restartBtn=document.getElementById('restartMatch');
      if(restartBtn){
        restartBtn.classList.remove('hidden');
        restartBtn.disabled=false;
        restartBtn.textContent=onlineSeriesRound>=ONLINE_SERIES_BASE_ROUNDS?'DESEMPATE · SIGUIENTE RONDA':'SIGUIENTE RONDA';
      }
    }
  }
  function submitOnlineSeriesRound(winnerIndex,round){
    if(roomCode==='LOCAL'||!isHost||!ws||ws.readyState!==WebSocket.OPEN)return false;
    try{
      ws.send(JSON.stringify({t:'series-round-result',winnerIndex:Number(winnerIndex),rankRound:Math.max(1,Number(round)||1)}));
      return true;
    }catch(_){return false;}
  }
  function renderOnlineSessionRanking(){
    const box=document.getElementById('sessionRanking');
    const list=document.getElementById('sessionRankingList');
    if(!box||!list)return;
    if(roomCode==='LOCAL'||localCpuActive){
      box.classList.add('hidden');
      list.innerHTML='';
      return;
    }
    updateOnlineSeriesRoundUi(onlineSeriesRound||currentOnlineSeriesRound());
    const rows=currentVictoryRoster().map(p=>({
      ...p,
      wins:Number(onlineSessionWins.get(onlineSessionPlayerKey(p)))||0
    })).sort((a,b)=>(b.wins-a.wins)||(a.i-b.i));
    if(!rows.length){
      box.classList.add('hidden');
      list.innerHTML='';
      return;
    }
    list.innerHTML=rows.map((p,pos)=>{
      const color=playerColors[p.i]||'#fff';
      const winsLabel=p.wins===1?tr('gameWon'):tr('gamesWon');
      const place=pos===0?'<span class="cup" aria-hidden="true">🏆</span>':'<span>'+(pos+1)+'</span>';
      return '<div class="session-ranking-row'+(pos===0?' is-leader':'')+'">'+
        '<div class="session-ranking-position">'+place+'</div>'+
        '<div class="session-ranking-name" style="color:'+color+'">'+escapeHtml(sinTildes(p.n))+(p.cpu?' · CPU':'')+'</div>'+
        '<div class="session-ranking-wins">'+p.wins+' '+escapeHtml(winsLabel)+'</div>'+
      '</div>';
    }).join('');
    box.classList.remove('hidden');
  }
  function clearSeriesChampionPresentation(){
    const box=document.getElementById('seriesChampion');
    if(box)box.classList.add('hidden');
    const restartBtn=document.getElementById('restartMatch');
    const backBtn=document.getElementById('back');
    if(restartBtn)restartBtn.classList.remove('hidden');
    if(backBtn)backBtn.classList.remove('hidden');
    victory.classList.remove('series-champion-mode');
  }
  function showOnlineSeriesChampion(index){
    if(roomCode==='LOCAL')return;
    onlineSeriesComplete=true;onlineSeriesChampion=Number(index);
    const roster=currentVictoryRoster();
    const winner=roster.find(p=>p.i===Number(index))||null;
    const victoryText=document.getElementById('victoryText');
    const champ=document.getElementById('seriesChampion');
    const champName=document.getElementById('seriesChampionName');
    const champShip=document.getElementById('seriesChampionShip');
    const restartBtn=document.getElementById('restartMatch');
    const backBtn=document.getElementById('back');
    if(victoryText)victoryText.textContent='CAMPEON DE LA SERIE';
    if(champName){
      champName.textContent=winner?sinTildes(winner.n):('JUGADOR '+(Number(index)+1));
      champName.style.color=playerColors[Number(index)]||'#fff';
    }
    if(champShip){
      champShip.src='assets/sprites/coete'+(Number(index)+1)+'.png';
      champShip.alt=winner?sinTildes(winner.n):'Nave ganadora';
    }
    if(champ)champ.classList.remove('hidden');
    if(restartBtn)restartBtn.classList.add('hidden');
    if(backBtn)backBtn.classList.add('hidden');
    victory.style.setProperty('--winner-color',playerColors[Number(index)]||'#d8a7ff');
    victory.classList.remove('hidden');
    victory.classList.add('winner-celebration','series-champion-mode');
  }
  function enterLobbyAfterSeries(m={}){
    if(onlineSeriesReturnTimer){clearTimeout(onlineSeriesReturnTimer);onlineSeriesReturnTimer=null;}
    clearSeriesChampionPresentation();
    onlineSessionWins.clear();
    onlineSeriesRound=0;onlineSeriesScoredRound=0;onlineSeriesComplete=false;onlineSeriesChampion=-1;
    resetOnlineStartCountdown();
    clearTimeout(victoryShowTimer);victoryShowTimer=null;pendingVictoryIndex=null;
    inGame=false;
    if(isHost&&hostPhysics){hostPhysics.stop();hostPhysics=null;}
    state=null;previousState=null;pendingStateRaw=null;lastAcceptedStateRound=-1;lastAcceptedStateSeq=-1;lastRestartedRound=0;
    resetLocalVisual();resetRemoteVisuals();rebuildPreviousLookup(null);
    topbar.classList.add('hidden');victory.classList.add('hidden');mobileControls.classList.add('hidden');
    if(mobileExit)mobileExit.classList.add('hidden');
    resetMobileTouchControls();clearGameCanvas();
    if(Array.isArray(m.players))lobbyPlayers=m.players.slice();
    cpuFillEnabled=!!m.cpuFill;
    ensureP2P()?.configure({myIndex,isHost,players:lobbyPlayers});
    playersEl.innerHTML=lobbyPlayers.map(p=>`<div style="color:${playerColors[p.i]||'#fff'}">J${p.i+1} · ${escapeHtml(sinTildes(p.n))}${p.registered?' · ✓':''}${p.cpu?' · CPU':''}</div>`).join('');
    updateLobbyStartButton(!!m.canStart);updateCpuFillButton(cpuFillEnabled);updateWaitingPlayers(lobbyPlayers);
    const mini=document.getElementById('seriesRoundMini');if(mini)mini.textContent='';
    const sessionRanking=document.getElementById('sessionRanking');if(sessionRanking)sessionRanking.classList.add('hidden');
    lobby.classList.remove('hidden');
  }
  function showVictory(i){
    if(!inGame)return;
    inGame=false;leaderAnnouncement=null;
    topbar.classList.add('hidden');mobileControls.classList.add('hidden');
    if(mobileExit)mobileExit.classList.add('hidden');
    resetMobileTouchControls();
    const p=(state&&Array.isArray(state.players)&&state.players.find(x=>Number(x.i)===Number(i)))||
      (Array.isArray(lobbyPlayers)&&lobbyPlayers.find(x=>Number(x.i)===Number(i)))||null;
    const victoryText=document.getElementById('victoryText');
    const restartBtn=document.getElementById('restartMatch');
    const localCampaign=roomCode==='LOCAL'&&localCpuActive;
    const humanWon=localCampaign&&Number(i)===0;

    localCampaignAwaitingContinue=false;
    localCampaignComplete=false;
    localCampaignGameOver=false;

    if(localCampaign&&humanWon&&localCampaignLevel>=LOCAL_CAMPAIGN_LEVELS){
      victoryText.textContent=tr('campaignChampion');
      localCampaignComplete=true;
      if(restartBtn){restartBtn.disabled=false;restartBtn.classList.add('hidden');}
    }else if(localCampaign&&humanWon){
      victoryText.textContent=tr('campaignLevelComplete',{level:localCampaignLevel,name:localCampaignWorldName(localCampaignLevel)});
      localCampaignAwaitingContinue=true;
      if(restartBtn){
        restartBtn.classList.remove('hidden');
        restartBtn.disabled=false;
        restartBtn.textContent=tr('continueCampaign');
      }
    }else if(localCampaign){
      localCampaignGameOver=localCampaignLevel>1;
      victoryText.textContent=tr('campaignGameOver');
      if(restartBtn){
        restartBtn.classList.remove('hidden');
        restartBtn.disabled=false;
        restartBtn.textContent=localCampaignGameOver?tr('restartCampaign'):tr('retryLevel');
      }
    }else{
      const round=currentOnlineSeriesRound();
      if(onlineSeriesScoredRound!==round){
        addOnlineSessionWin(i);
        onlineSeriesScoredRound=round;
      }
      victoryText.textContent=onlineSeriesRoundLabel(round)+' · '+(p?sinTildes(p.n):('JUGADOR '+(Number(i)+1)))+' GANA';
      if(restartBtn){
        restartBtn.classList.remove('hidden');
        restartBtn.disabled=round>=ONLINE_SERIES_BASE_ROUNDS;
        restartBtn.textContent=round>=ONLINE_SERIES_BASE_ROUNDS?'COMPROBANDO SERIE...':'SIGUIENTE RONDA';
      }
    }

    if(!localCampaign){
      renderOnlineSessionRanking();
    }else{
      const sessionRanking=document.getElementById('sessionRanking');
      if(sessionRanking)sessionRanking.classList.add('hidden');
    }

    victory.style.setProperty('--winner-color',playerColors[Number(i)]||'#d8a7ff');
    resetVictoryJoystickControls();
    clearSeriesChampionPresentation();
    victory.classList.remove('hidden','winner-celebration');
    void victory.offsetWidth;
    if(!localCampaign||humanWon)victory.classList.add('winner-celebration');
    if(!localCampaign&&onlineSeriesComplete&&onlineSeriesChampion>=0)showOnlineSeriesChampion(onlineSeriesChampion);
  }

  postAnalyticsEvent('visit');
  function unlockAudioFromUserGesture(){
    if(!gameAudioEnabled)return;
    // V22.04: AUDIO y MICRO siguen siendo independientes, pero cualquier primer
    // gesto del menu sirve para cumplir la politica de autoplay de iOS.
    // La captura hace que funcione incluso si el boton MICRO detiene bubbling.
    startMusic();
    unlockGameAudio();
  }
  menu.addEventListener('pointerdown',unlockAudioFromUserGesture,{passive:true,capture:true});
  menu.addEventListener('touchstart',unlockAudioFromUserGesture,{passive:true,capture:true});
  menu.addEventListener('click',unlockAudioFromUserGesture,true);
  menu.addEventListener('keydown',unlockAudioFromUserGesture,true);
  updateAudioButton();
  // Primer intento inmediato: en navegadores que permiten reanudar audio
  // sonara al abrir el menu; en iOS se reintentara en el primer gesto.
  startMusic();
  // V22.05: al volver a una PWA desde segundo plano iOS puede restaurar una
  // sesion de audio distinta. Reaplicamos playback sin interferir con VOZ.
  window.addEventListener('pageshow',()=>{
    if(gameAudioEnabled&&!window.GalaxyVoiceCaptureActive)usePlaybackAudioSession();
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&gameAudioEnabled&&!window.GalaxyVoiceCaptureActive)usePlaybackAudioSession();
  });
  loadJoystickPreference();
  updateJoystickButton();
  notifyJoystickVoiceUi();
  if(audioToggleButton){
    if(isMobile){
      let audioTouchHandled=false;
      const handleMobileAudioToggle=e=>{
        e.preventDefault();
        e.stopPropagation();
        if(audioTouchHandled)return;
        audioTouchHandled=true;
        toggleGameAudio();
        setTimeout(()=>{audioTouchHandled=false;},220);
      };
      audioToggleButton.addEventListener('pointerdown',handleMobileAudioToggle,{passive:false});
      audioToggleButton.addEventListener('touchstart',e=>{
        // iOS puede emitir touchstart antes del pointerdown. Gestionamos solo
        // si PointerEvent no esta disponible para evitar doble cambio.
        if(window.PointerEvent)return;
        handleMobileAudioToggle(e);
      },{passive:false});
      audioToggleButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
    }else{
      audioToggleButton.addEventListener('click',toggleGameAudio);
    }
  }
  if(joystickToggleButton)joystickToggleButton.addEventListener('click',toggleJoystick);
  if(joystickConfigButton)joystickConfigButton.addEventListener('click',openJoystickConfig);
  if(joystickConfigClose)joystickConfigClose.addEventListener('click',closeJoystickConfig);
  if(joystickConfigCancel)joystickConfigCancel.addEventListener('click',closeJoystickConfig);
  if(joystickConfigReset)joystickConfigReset.addEventListener('click',resetJoystickConfig);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&joystickConfigDialog&&!joystickConfigDialog.classList.contains('hidden'))closeJoystickConfig();});
  window.addEventListener('gamepadconnected',e=>{
    if(!joystickEnabled)return;
    joystickIndex=Number.isInteger(e.gamepad&&e.gamepad.index)?e.gamepad.index:-1;
    joystickConnected=true;
    updateJoystickButton();
    notifyJoystickVoiceUi();
  });
  window.addEventListener('gamepaddisconnected',e=>{
    if(Number(e.gamepad&&e.gamepad.index)===joystickIndex)joystickIndex=-1;
    joystickConnected=false;
    updateJoystickButton();
    if(joystickVoiceHeld){
      joystickVoiceHeld=false;
      if(voice&&!voice.keyVDown&&!voice.pttTouchActive)voice.setTalking(false);
    }
    notifyJoystickVoiceUi();
  });

  if(shareGameBtn)shareGameBtn.addEventListener('click',shareGameLink);
  if(shareRoomBtn)shareRoomBtn.addEventListener('click',shareCurrentRoom);
  document.getElementById('create').addEventListener('click',()=>{startMusic();showRoomTypeDialog();});
  document.getElementById('cpu').addEventListener('click',()=>{if(isMobile){startMusic();showCpuSetupDialog();}else startLocalCpu();});
  document.getElementById('join').addEventListener('click',()=>{startMusic();showPublicRoomsDialog();});
  document.getElementById('createPublic').addEventListener('click',()=>createOnlineRoom(true));
  document.getElementById('createPrivate').addEventListener('click',()=>createOnlineRoom(false));
  document.getElementById('closeRoomType').addEventListener('click',closeRoomDialogs);
  document.getElementById('closePublicRooms').addEventListener('click',closeRoomDialogs);
  if(cpuSetupPlay)cpuSetupPlay.addEventListener('click',confirmCpuSetup);
  if(cpuSetupClose)cpuSetupClose.addEventListener('click',closeRoomDialogs);
  document.getElementById('joinByCodeDialog').addEventListener('click',()=>joinRoomByCode(joinCodeDialog&&joinCodeDialog.value));
  if(joinCodeDialog)joinCodeDialog.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();joinRoomByCode(joinCodeDialog.value);}});
  if(roomTypeDialog)roomTypeDialog.addEventListener('pointerdown',e=>{if(e.target===roomTypeDialog)closeRoomDialogs();});
  if(publicRoomsDialog)publicRoomsDialog.addEventListener('pointerdown',e=>{if(e.target===publicRoomsDialog)closeRoomDialogs();});
  if(cpuSetupDialog)cpuSetupDialog.addEventListener('pointerdown',e=>{if(e.target===cpuSetupDialog)closeRoomDialogs();});
  if(fillCpuBtn)fillCpuBtn.addEventListener('click',()=>{if(isHost&&!inGame)send({t:'cpu-fill',on:!cpuFillEnabled});});
  if(lobbyChatSend)lobbyChatSend.addEventListener('click',sendLobbyChat);
  if(lobbyChatInput)lobbyChatInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendLobbyChat();}
    // Evita que las teclas escritas en el chat controlen la nave si cambia el estado.
    e.stopPropagation();
  });
  if(lobbyChatInput)lobbyChatInput.addEventListener('keyup',e=>e.stopPropagation());
  if(isMobile){
    const appEl=document.getElementById('app');
    appEl.addEventListener('pointerdown',mobilePointerDown,{passive:false});
    appEl.addEventListener('pointermove',mobilePointerMove,{passive:false});
    appEl.addEventListener('pointerup',mobilePointerEnd,{passive:false});
    appEl.addEventListener('pointercancel',mobilePointerEnd,{passive:false});
    appEl.addEventListener('lostpointercapture',mobilePointerEnd,{passive:false});
    appEl.addEventListener('pointerleave',e=>{if(e.pointerType==='touch')mobilePointerEnd(e);},{passive:false});
    // V18.81: iOS usa Touch Events nativos para disparo/acelerador porque
    // Safari puede perder el final de un Pointer Event. touch.identifier se
    // conserva hasta touchend/touchcancel y evita que quede un gesto fantasma.
    if(isIOS){
      appEl.addEventListener('touchstart',mobileTouchStart,{passive:false});
      appEl.addEventListener('touchmove',mobileTouchMove,{passive:false});
      appEl.addEventListener('touchend',mobileTouchEnd,{passive:false});
      appEl.addEventListener('touchcancel',mobileTouchEnd,{passive:false});
    }
    // Respaldo global para Android/otros navegadores con Pointer Events.
    window.addEventListener('pointerup',mobilePointerEnd,{passive:false,capture:true});
    window.addEventListener('pointercancel',mobilePointerEnd,{passive:false,capture:true});
    window.addEventListener('lostpointercapture',mobilePointerEnd,{passive:false,capture:true});
    window.addEventListener('blur',resetMobileTouchControls);
    window.addEventListener('pagehide',resetMobileTouchControls);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)resetMobileTouchControls();
    });
    document.addEventListener('freeze',resetMobileTouchControls);
    window.addEventListener('orientationchange',()=>{
      motionNeutral=null;motionTurn=0;
      mobileButtonTurn=0;mobileTurnTarget=0;mobileTurnStartedAt=0;
      mobileLeftPointers.clear();mobileRightPointers.clear();
      resetMobileTouchControls();
      keys.clear();
    });
    if(screen.orientation)screen.orientation.addEventListener?.('change',()=>{motionNeutral=null;motionTurn=0;});
  }
  window.addEventListener('resize',()=>{invalidateMobileVoiceLayout();scheduleCanvasResolution();},{passive:true});
  window.addEventListener('orientationchange',()=>{invalidateMobileVoiceLayout();scheduleCanvasResolution();},{passive:true});
  scheduleCanvasResolution();
  updateBuildVersionLearningState();
  refreshCpuLearningControl();
  const cpuLearningStatusTimer=setInterval(refreshCpuLearningControl,5000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCpuLearningControl();});
  startBtn.addEventListener('click',async()=>{
    await Promise.all([prepareMobileControls(),prepareGameAssets()]);
    send({t:'start'});
  });
  function returnToMainMenu(notifyServer=true){
    resetVictoryJoystickControls();
    cancelInterstellarTravel();
    resetGameFeelVisuals();
    resetOnlineStartCountdown();
    onlineSessionWins.clear();
    onlineSeriesRound=0;onlineSeriesScoredRound=0;onlineSeriesComplete=false;onlineSeriesChampion=-1;
    if(onlineSeriesReturnTimer){clearTimeout(onlineSeriesReturnTimer);onlineSeriesReturnTimer=null;}
    clearSeriesChampionPresentation();
    const sessionRanking=document.getElementById('sessionRanking');
    const sessionRankingList=document.getElementById('sessionRankingList');
    if(sessionRanking)sessionRanking.classList.add('hidden');
    if(sessionRankingList)sessionRankingList.innerHTML='';
    if(!sharedRoomCode)sharedRoomJoinStarted=false;
    invisibleHudUntil.fill(0);
    clearTimeout(victoryShowTimer);victoryShowTimer=null;pendingVictoryIndex=null;
    victory.classList.remove('winner-celebration');
    const restartBtn=document.getElementById('restartMatch');
    if(restartBtn)restartBtn.classList.remove('hidden');
    const wasLocal=localCpuActive;
    if(wasLocal)stopLocalCpu();
    if(notifyServer&&!wasLocal&&roomCode)send({t:'leave'});
    if(voice)voice.clearSession();
    stopP2P();
    stopResumeWindow();clearResumeSession();playerToken='';
    inGame=false;clearGameCanvas();setMobileKeyboardActive(false);state=null;previousState=null;pendingStateRaw=null;lastStateTime=0;previousStateTime=0;smoothedStateInterval=NET_FRAME_MS;resetLocalVisual();resetRemoteVisuals();lastControlThrust=false;lastControlSentAt=0;lastSentControlTurn=NaN;lastSentControlThrust=false;lastSentControlFire=false;
    // Recuperar el testigo de aprendizaje al volver al menu sin esperar al
    // siguiente intervalo de 5 s.
    refreshCpuLearningControl();
    killScoreHeldValue=null;killScorePendingValue=null;killScoreFxStart=0;killScoreFxUntil=0;
    roomCode='';myIndex=null;isHost=false;cpuFillEnabled=false;lastVoicePlayersSig=0;lastAcceptedStateRound=-1;lastAcceptedStateSeq=-1;rebuildPreviousLookup(null);
    lobby.classList.add('hidden');victory.classList.add('hidden');topbar.classList.add('hidden');
    mobileControls.classList.add('hidden');if(mobileExit)mobileExit.classList.add('hidden');resetMobileTouchControls();
    roomCodeEl.textContent='';roomMini.textContent='';playersEl.innerHTML='';clearLobbyChat();updateLobbyStartButton(false);updateCpuFillButton(false);updateWaitingPlayers(1);
    menu.classList.remove('hidden');startMusic();scheduleCanvasResolution();
  }
  document.getElementById('leaveRoom').addEventListener('click',returnToMainMenu);
  if(mobileExit){
    // V16.4.54: salir en el primer toque. En algunos moviles el click sintetico
    // podia no llegar tras el primer pointerdown, obligando a tocar dos veces.
    let mobileExitHandled=false;
    mobileExit.addEventListener('pointerdown',e=>{
      e.preventDefault();
      e.stopPropagation();
      if(mobileExitHandled)return;
      mobileExitHandled=true;
      returnToMainMenu();
      setTimeout(()=>{mobileExitHandled=false;},250);
    },{passive:false});
    mobileExit.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
    });
  }
  const restartMatchBtn=document.getElementById('restartMatch');
  if(restartMatchBtn)restartMatchBtn.addEventListener('click',async()=>{
    restartMatchBtn.disabled=true;
    restartMatchBtn.textContent=tr('restarting');
    let ok=false;
    if(roomCode==='LOCAL'){
      const previousLevel=localCampaignLevel;
      const wasContinue=localCampaignAwaitingContinue;
      const wasGameOver=localCampaignGameOver;
      if(localCampaignComplete){
        restartMatchBtn.disabled=false;
        restartMatchBtn.classList.add('hidden');
        return;
      }
      if(wasContinue){
        const nextLevel=Math.min(LOCAL_CAMPAIGN_LEVELS,localCampaignLevel+1);
        restartMatchBtn.textContent=tr('interstellarTravel');
        const travelled=await runInterstellarTravel(nextLevel);
        if(!travelled||roomCode!=='LOCAL'||!localCpuActive)return;
        localCampaignLevel=nextLevel;
      }else if(wasGameOver)localCampaignLevel=1;
      localCampaignAwaitingContinue=false;localCampaignGameOver=false;
      ok=send({t:'restart',level:localCampaignLevel});
      if(!ok){
        localCampaignLevel=previousLevel;
        localCampaignAwaitingContinue=wasContinue;
        localCampaignGameOver=wasGameOver;
        if(wasContinue)victory.classList.remove('hidden');
      }
    }else if(isHost&&p2p){
      // El anfitrion no necesita red para reiniciar: sendAction ejecuta la
      // accion localmente y conserva la misma ruta autoritativa existente.
      ok=p2p.sendAction('restart');
    }else{
      // V20.83: REPETIR es una accion unica y no debe depender del DataChannel
      // no fiable (maxRetransmits:0). Preferimos el WebSocket fiable; P2P queda
      // solo como respaldo si en ese instante no hay servidor de senalizacion.
      if(ws&&ws.readyState===WebSocket.OPEN){
        try{ws.send(JSON.stringify({t:'fallback-action',action:'restart'}));ok=true;}catch(_){}
      }
      if(!ok&&p2p&&!fallbackActive)ok=p2p.sendAction('restart');
    }
    if(!ok){
      restartMatchBtn.disabled=false;
      if(roomCode==='LOCAL'){
        restartMatchBtn.textContent=localCampaignGameOver?tr('restartCampaign'):(localCampaignAwaitingContinue?tr('continueCampaign'):tr('retryLevel'));
      }else restartMatchBtn.textContent=tr('rematch');
    }
  });
  document.getElementById('back').addEventListener('click',returnToMainMenu);
  window.addEventListener('keydown',e=>{
    keys.add(e.code);
    if(isMobile&&inGame&&MOBILE_KEYBOARD_CODES.has(e.code)){
      if(!mobileKeyboardActive)setMobileKeyboardActive(true);
    }
    if(['ArrowUp','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
    if(e.code==='Escape'){
      if((roomTypeDialog&&!roomTypeDialog.classList.contains('hidden'))||(publicRoomsDialog&&!publicRoomsDialog.classList.contains('hidden'))){closeRoomDialogs();}
      else if(inGame)returnToMainMenu();
    }
  });
  window.addEventListener('keyup',e=>{
    keys.delete(e.code);
    if(isMobile&&mobileKeyboardActive&&MOBILE_KEYBOARD_CODES.has(e.code)){
      let keyboardStillHeld=false;
      for(const code of MOBILE_KEYBOARD_CODES){if(keys.has(code)){keyboardStillHeld=true;break;}}
      if(!keyboardStillHeld)setMobileKeyboardActive(false);
    }
  });
  // Si el navegador pierde el foco, puede no llegar el keyup de una tecla que
  // estaba pulsada. Limpiamos el estado para evitar giro/aceleracion/disparo
  // pegados al volver a la ventana.
  function clearHeldKeys(){
    keys.clear();
    lastControlTurn=0;
    if(isMobile)resetMobileTouchControls();
    if(inGame)sendControl(0,false,false);
  }
  window.addEventListener('blur',clearHeldKeys);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldKeys();});
  window.addEventListener('beforeunload',()=>{manualClose=true;clearTimeout(reconnectTimer);clearInterval(cpuLearningStatusTimer);stopLocalCpu();stopP2P();if(voice)voice.shutdown(true);try{if(ws)ws.close();}catch(_){}});

  function imageReady(im){
    // complete is ALSO true after a failed download. Check decoded dimensions.
    return Boolean(im&&im.complete&&im.naturalWidth>0&&im.naturalHeight>0);
  }
  function drawImageSafely(im,x,y,width,height){
    if(!imageReady(im))return false;
    try{
      if(width===undefined){ctx.drawImage(im,x,y);}
      else {ctx.drawImage(im,x,y,width,height);}
      return true;
    }catch(error){
      reportImageFailure(im,error);
      return false;
    }
  }
  function drawImageCentered(im,x,y,size,rot=0,alpha=1){
    if(!imageReady(im)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(rot))return false;
    // Asteroides, mejoras y meteorito gigante no rotados son la mayoria de
    // drawImage del frame. Evitamos save/translate/rotate/restore en ese caso.
    if(rot===0&&alpha===1){
      if(size)return drawImageSafely(im,x-size/2,y-size/2,size,size);
      return drawImageSafely(im,x-im.naturalWidth/2,y-im.naturalHeight/2);
    }
    ctx.save();
    try{
      ctx.globalAlpha=alpha;
      ctx.translate(x,y);
      if(rot!==0)ctx.rotate(rot*Math.PI/180);
      if(size)return drawImageSafely(im,-size/2,-size/2,size,size);
      return drawImageSafely(im,-im.naturalWidth/2,-im.naturalHeight/2);
    }finally{
      ctx.restore();
    }
  }
  function drawLocalizaMarker(x,y,owner,alpha=.92){
    const idx=Math.max(0,Math.min(3,Number(owner)||0));
    const im=images[localizaSpriteKeys[idx]];
    if(!imageReady(im))return false;
    return drawImageCentered(im,x,y,78,0,alpha);
  }
  const pickupSpriteMap={ammo1:'ammo1',ammo3:'ammo3',cadence:'cadence',speed:'speed',mira:'mira1',flare:'bengalahud',camo:'ojo'};
  function drawDeployedFlare(f,x,y,nowSec=0){
    const life=Math.max(0,Number(f&&f.life)||0);
    // V19.67: la bengala nace a tamaño completo y se encoge de forma continua
    // durante sus 3 s de vida. Al final queda casi diminuta y se desvanece.
    const remaining=clamp(life/3,0,1);
    const shrink=Math.pow(remaining,.72);
    const pulse=.86+.14*(.5+.5*Math.sin(nowSec*18+(Number(f&&f.id)||0)));
    const size=(5+29*shrink)*(.96+.04*pulse);
    const fade=clamp(life/.72,0,1);
    const alpha=fade*(.80+.20*pulse);
    if(imageReady(images.bengala)){
      drawImageCentered(images.bengala,x,y,size,Number(f&&f.a)||0,alpha);
      return;
    }
    const scale=size/34;
    ctx.save();
    ctx.globalAlpha=alpha;ctx.translate(x,y);
    ctx.scale(scale,scale);
    ctx.strokeStyle='#ff9d35';ctx.fillStyle='#fff1a6';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(18,0);ctx.moveTo(0,-18);ctx.lineTo(0,18);ctx.stroke();
    ctx.restore();
  }
  function pickupExpiryAlpha(pk,nowSec){
    const raw=pk&&pk.expiresIn;
    // null significa que esta mejora NO esta pendiente de desaparecer.
    // Importante: Number(null) === 0, por eso hay que comprobar null antes.
    if(raw===null||raw===undefined)return 1;
    const left=Number(raw);
    // Durante toda su vida permanece al 100%. Solo en los ultimos 2 segundos
    // parpadea de forma regular entre 50% y 100% de opacidad.
    if(!Number.isFinite(left)||left>2)return 1;
    const pulse=.5+.5*Math.sin(nowSec*Math.PI*2*3);
    return .5+.5*pulse;
  }
  function drawPickup(pk,x=pk.x,y=pk.y,nowSec=0){
    const born=pickupVisualBorn.get(String(pk&&pk.id));
    const intro=born===undefined?1:clamp((nowSec*1000-born)/320,0,1);
    const introEase=1-Math.pow(1-intro,3);
    const introScale=.34+.66*introEase;
    const introAlpha=.18+.82*introEase;
    const alpha=pickupExpiryAlpha(pk,nowSec)*introAlpha;
    if(pickupSpriteMap[pk.type]){
      // V20.96/V20.98: halo + materializacion visual. No cambia el radio real.
      const phase=(String(pk.id||'').charCodeAt(0)||0)*.07;
      const pulse=.5+.5*Math.sin(nowSec*3.7+phase);
      ctx.save();
      ctx.globalAlpha=alpha*(.18+.14*pulse);
      ctx.strokeStyle='rgba(160,235,255,.95)';
      ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,y,(27+4*pulse)*introScale,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=alpha*(.08+.08*pulse);
      ctx.fillStyle='rgba(95,190,255,.9)';
      ctx.beginPath();ctx.arc(x,y,(22+3*pulse)*introScale,0,Math.PI*2);ctx.fill();
      ctx.restore();
      drawImageCentered(images[pickupSpriteMap[pk.type]],x,y,(45+2*pulse)*introScale,0,alpha);
      return;
    }
    ctx.save();ctx.translate(x,y);ctx.scale(introScale,introScale);
    if(pk.type==='shockwave'){
      const pulse=.5+.5*Math.sin(nowSec*4.6+(Number(pk.id)||0));
      ctx.globalAlpha=alpha;
      ctx.fillStyle='rgba(230,245,255,'+(0.24+0.16*pulse).toFixed(3)+')';
      ctx.strokeStyle='rgba(245,252,255,'+(0.82+0.14*pulse).toFixed(3)+')';
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.globalAlpha=.6*alpha;
      ctx.strokeStyle='rgba(160,215,255,.9)';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,24+2*pulse,0,Math.PI*2);ctx.stroke();
    }
    else if(pk.type==='shield'){
      ctx.strokeStyle='#8ff5ff';ctx.lineWidth=4;ctx.globalAlpha=.9*alpha;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=.25*alpha;ctx.fillStyle='#5adfff';ctx.fill();
    }
    else if(pk.type==='camo'){
      // Invisibilidad: ojo tachado vectorial. Evita un asset adicional y
      // conserva el mismo peso/rendimiento del pickup anterior.
      ctx.globalAlpha=alpha;
      ctx.strokeStyle='#d1b4ff';
      ctx.fillStyle='rgba(160,100,255,.16)';
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.fill();ctx.stroke();

      // Ojo.
      ctx.globalAlpha=.95*alpha;
      ctx.strokeStyle='#ffffff';
      ctx.lineWidth=3;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      ctx.moveTo(-13,0);
      ctx.bezierCurveTo(-7,-9,7,-9,13,0);
      ctx.bezierCurveTo(7,9,-7,9,-13,0);
      ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,4.2,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();

      // Tachado diagonal.
      ctx.strokeStyle='#ffffff';
      ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(-14,-14);ctx.lineTo(14,14);ctx.stroke();
    }
    ctx.restore();
  }
  function drawGiantEntryWarning(giant,now){
    if(!giant)return;
    const x=Number(giant.x),y=Number(giant.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(x>=0&&x<=W&&y>=0&&y<=H)return;

    const distances=[
      {d:-x,edge:'left'},{d:x-W,edge:'right'},
      {d:-y,edge:'top'},{d:y-H,edge:'bottom'}
    ];
    let best=distances[0];
    for(const item of distances)if(item.d>best.d)best=item;
    const pulse=.5+.5*Math.sin(now*.010);
    const pad=isMobile?48:38;
    let px=clamp(x,pad,W-pad),py=clamp(y,pad,H-pad),rot=0;
    if(best.edge==='left'){px=pad;rot=0;}
    else if(best.edge==='right'){px=W-pad;rot=Math.PI;}
    else if(best.edge==='top'){py=pad;rot=Math.PI/2;}
    else{py=H-pad;rot=-Math.PI/2;}

    ctx.save();
    ctx.translate(px,py);ctx.rotate(rot);
    ctx.globalAlpha=.62+.32*pulse;
    ctx.fillStyle='#ff8a3d';
    ctx.shadowColor='rgba(255,95,35,.85)';
    ctx.shadowBlur=8+8*pulse;
    ctx.beginPath();
    ctx.moveTo(15,0);ctx.lineTo(-10,-9);ctx.lineTo(-10,9);ctx.closePath();ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha=.62+.28*pulse;
    ctx.textAlign='center';
    ctx.font=isMobile?'25px Flashback,Arial':'20px Flashback,Arial';
    ctx.fillStyle='#ffb05a';
    ctx.shadowColor='rgba(255,90,35,.65)';
    ctx.shadowBlur=6;
    ctx.fillText(tr('giantWarning'),W/2,state&&state.shower>0?232:190);
    ctx.restore();
  }

  function spawnProtectionAlpha(secondsLeft){
    if(!Number.isFinite(secondsLeft)||secondsLeft<=0)return 1;
    // Six soft pulses over three seconds. The ship never disappears fully.
    // Use the server timer, so all players see the same protection state.
    const elapsed=Math.max(0,3-secondsLeft);
    return .35+.65*(.5+.5*Math.cos(elapsed*Math.PI*4));
  }
  const SPAWN_MATERIALIZE_SECONDS=1.15;
  function spawnMaterializeProgress(secondsLeft){
    const left=Math.max(0,Number(secondsLeft)||0);
    return clamp(1-left/SPAWN_MATERIALIZE_SECONDS,0,1);
  }
  function drawSpawnMaterializeFx(x,y,index,secondsLeft,now){
    const t=spawnMaterializeProgress(secondsLeft);
    if(t>=1)return;
    const ease=1-Math.pow(1-t,3);
    const [rr,gg,bb]=playerRgb[Math.max(0,Math.min(3,Number(index)||0))]||playerRgb[0];
    const pulse=.5+.5*Math.sin(now*.035);
    ctx.save();
    try{
      ctx.translate(x,y);
      ctx.globalCompositeOperation='lighter';
      // Halo exterior que se cierra sobre el punto exacto de aparicion.
      const outer=118-58*ease;
      ctx.globalAlpha=.22+.46*(1-t);
      ctx.strokeStyle=`rgba(${rr},${gg},${bb},.95)`;
      ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(0,0,outer,0,Math.PI*2);ctx.stroke();
      // Segundo anillo en sentido contrario para que el punto se localice de un vistazo.
      const inner=30+40*ease;
      ctx.globalAlpha=.35+.35*pulse;
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,inner,0,Math.PI*2);ctx.stroke();
      // Cuatro trazos radiales convergentes, baratos de dibujar y muy visibles.
      ctx.globalAlpha=.75*(1-.55*t);
      ctx.lineWidth=4;
      const rayOuter=155-72*ease,rayInner=82-28*ease;
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+now*.0025;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*rayOuter,Math.sin(a)*rayOuter);
        ctx.lineTo(Math.cos(a)*rayInner,Math.sin(a)*rayInner);
        ctx.stroke();
      }
      // Destello central final: marca claramente el instante en que la nave queda activa.
      if(t>.68){
        const f=(t-.68)/.32;
        ctx.globalAlpha=(1-f)*.72;
        ctx.fillStyle=`rgba(${rr},${gg},${bb},.9)`;
        ctx.beginPath();ctx.arc(0,0,14+38*f,0,Math.PI*2);ctx.fill();
      }
    }finally{ctx.restore();}
  }
  function lerp(a,b,t){return a+(b-a)*t;}
  function lerpAngle(a,b,t){
    const delta=((b-a+540)%360)-180;
    return (a+delta*t+360)%360;
  }
  function lerpWrapped(a,b,size,t){
    let delta=b-a;
    if(delta>size/2)delta-=size;else if(delta<-size/2)delta+=size;
    return (a+delta*t+size)%size;
  }
  function interpolationAlpha(now){
    if(!previousState||previousState===state||!lastStateTime)return 1;
    return clamp((now-lastStateTime)/smoothedStateInterval,0,1);
  }
  function wrappedDelta(from,to,size){
    let d=to-from;
    if(d>size/2)d-=size;else if(d<-size/2)d+=size;
    return d;
  }
  function angleDelta(from,to){return ((to-from+540)%360)-180;}
  function ghostRevealAlpha(p,now){
    const camo=Number(p&&p.camo)||0;
    if(camo<=0)return 0;
    // El camuflaje dura 10 s. Para los rivales, la nave se revela brevemente
    // cada 4 s (aprox. en los segundos 4 y 8) con fundido de entrada/salida.
    const elapsed=Math.max(0,10-camo);
    if(elapsed<4)return 0;
    const phase=elapsed%4;
    const window=1.0;
    if(phase>=window)return 0;
    let alpha=1;
    if(phase<0.25)alpha=phase/0.25;
    else if(phase>0.75)alpha=(window-phase)/0.25;
    return Math.max(0,Math.min(1,alpha));
  }
  function drawShip(p,previous,blend,now){
    const local=p.i===myIndex;
    let x=p.x,y=p.y,r=p.r;
    if(local){
      // V16.4.41: pose visual continua para la nave local. Antes la posicion se
      // extrapolaba desde cero en cada snapshot. Si un paquete llegaba unos ms
      // tarde, la nave se reenganchaba a una posicion distinta y el microajuste
      // aumentaba con la velocidad. Ahora avanzamos una pose visual continua y
      // reconciliamos suavemente contra la posicion autoritativa del servidor.
      const age=Math.min(.05,Math.max(0,(now-lastStateTime)/1000));
      const targetX=(p.x+p.vx*age+W)%W;
      const targetY=(p.y+p.vy*age+H)%H;
      // En movil extrapolamos solo unas decimas del snapshot recibido. La pose
      // visual continua se encarga del resto y, en online, V19.22 evita corregir
      // contra snapshots atrasados mientras el giro local esta activo.
      const targetR=isMobile?(p.r+lastControlTurn*240*age+360)%360:(p.r+360)%360;
      const needsReset=!localVisual.ready||localVisual.index!==p.i||(previous&&previous.dead)||now-localVisual.lastAt>250;
      if(needsReset){
        localVisual.ready=true;localVisual.index=p.i;
        localVisual.x=targetX;localVisual.y=targetY;localVisual.r=targetR;
        localVisual.vx=p.vx;localVisual.vy=p.vy;localVisual.lastAt=now;localVisual.lastError=0;
      }else{
        const dt=Math.min(.05,Math.max(0,(now-localVisual.lastAt)/1000));
        localVisual.lastAt=now;
        // Prediccion visual con la misma aceleracion/drag que el servidor.
        // Es solo dibujo: la fisica autoritativa sigue estando en server.js.
        // Esto evita que la aceleracion avance en escalones de 30 Hz.
        localVisual.r=(localVisual.r+lastControlTurn*240*dt+360)%360;
        if(lastControlThrust){
          const rr=localVisual.r*Math.PI/180;
          const accel=240*(Number(p.spd)||1);
          localVisual.vx+=(-Math.sin(rr))*accel*dt;
          localVisual.vy+=(-Math.cos(rr))*accel*dt;
        }
        const drag=Math.pow(0.35,dt);
        localVisual.vx*=drag;localVisual.vy*=drag;
        const vmax=330*(Number(p.spd)||1);
        const visualSpeed=Math.hypot(localVisual.vx,localVisual.vy);
        if(visualSpeed>vmax){
          localVisual.vx=localVisual.vx/visualSpeed*vmax;
          localVisual.vy=localVisual.vy/visualSpeed*vmax;
        }
        localVisual.x=(localVisual.x+localVisual.vx*dt+W)%W;
        localVisual.y=(localVisual.y+localVisual.vy*dt+H)%H;

        // Reconciliacion suave de velocidad y posicion contra el servidor.
        // Las colisiones/respawns siguen mandando porque, si el error es grande,
        // hacemos snap inmediato.
        const velError=Math.hypot(p.vx-localVisual.vx,p.vy-localVisual.vy);
        const velocityFollow=1-Math.exp(-(velError>160?26:9)*dt);
        localVisual.vx+=(p.vx-localVisual.vx)*velocityFollow;
        localVisual.vy+=(p.vy-localVisual.vy)*velocityFollow;

        const dx=wrappedDelta(localVisual.x,targetX,W);
        const dy=wrappedDelta(localVisual.y,targetY,H);
        const error=Math.hypot(dx,dy);
        localVisual.lastError=error;
        if(perfStats&&error>perfStats.localErrMax)perfStats.localErrMax=error;
        if(error>48){
          // V21.29: en online la posicion dibujada no debe separarse demasiado
          // de la fisica autoritativa, especialmente con cuatro jugadores.
          localVisual.x=targetX;localVisual.y=targetY;
          localVisual.vx=p.vx;localVisual.vy=p.vy;
        }else{
          const positionFollow=1-Math.exp(-22*dt);
          localVisual.x=(localVisual.x+dx*positionFollow+W)%W;
          localVisual.y=(localVisual.y+dy*positionFollow+H)%H;
        }
        const dr=angleDelta(localVisual.r,targetR);
        // V19.22: en movil ONLINE la nave local tambien necesita un margen de
        // reconciliacion. Antes solo se aplicaba en PC: el movil mostraba el giro
        // al instante, recibia despues un snapshot anterior del anfitrion y lo
        // corregia hacia atras; el siguiente snapshot volvia a llevarlo al sitio.
        // El resultado visual era exactamente: gira -> vuelve -> gira otra vez.
        const mobileOnline=isMobile&&!localCpuActive&&roomCode&&roomCode!=='LOCAL';
        const rotationGraceMs=mobileOnline?260:180;
        const rotationGrace=(now-lastControlTurnChangedAt)<rotationGraceMs;
        const deferRotationCorrection=(!isMobile||mobileOnline)&&
          (Math.abs(lastControlTurn)>0.001||rotationGrace);
        if(!deferRotationCorrection){
          // Una vez que el estado autoritativo ha tenido tiempo de alcanzar al
          // input local, corregimos con suavidad. En movil online usamos la misma
          // respuesta tranquila que en PC en lugar de la correccion agresiva.
          const absDr=Math.abs(dr);
          const snapAngle=mobileOnline?70:55;
          if(absDr>snapAngle){
            localVisual.r=targetR;
          }else{
            const rotationRate=mobileOnline?8:(isMobile?20:8);
            const rotationFollow=1-Math.exp(-rotationRate*dt);
            localVisual.r=(localVisual.r+dr*rotationFollow+360)%360;
          }
        }
      }
      x=localVisual.x;y=localVisual.y;r=localVisual.r;
    }else{
      const remoteIndex=Number(p.i);
      const onlineRemote=!localCpuActive&&roomCode&&roomCode!=='LOCAL'&&
        Number.isInteger(remoteIndex)&&remoteIndex>=0&&remoteIndex<remoteVisuals.length;
      const visual=onlineRemote?remoteVisuals[remoteIndex]:null;

      if(visual){
        // V20.18: las naves remotas ya no esperan quietas entre snapshots.
        // Extrapolamos SOLO el dibujo con la velocidad autoritativa recibida y
        // reconciliamos suavemente al llegar el siguiente estado. Fisica,
        // colisiones y puntuacion siguen exclusivamente en el host.
        const rawAge=Math.max(0,(now-lastStateTime)/1000);
        const predictionAge=Math.min(.12,rawAge);
        const targetX=(p.x+p.vx*predictionAge+W)%W;
        const targetY=(p.y+p.vy*predictionAge+H)%H;

        let angularVelocity=0;
        if(previous&&!previous.dead){
          const sampleDt=Math.max(.03,Math.min(.12,smoothedStateInterval/1000));
          angularVelocity=clamp(angleDelta(previous.r,p.r)/sampleDt,-240,240);
        }
        const targetR=(p.r+angularVelocity*predictionAge+360)%360;

        const needsReset=!visual.ready||(previous&&previous.dead)||now-visual.lastAt>250;
        if(needsReset){
          visual.ready=true;
          visual.x=targetX;visual.y=targetY;visual.r=targetR;
          visual.vx=p.vx;visual.vy=p.vy;visual.lastAt=now;
        }else{
          const dt=Math.min(.05,Math.max(0,(now-visual.lastAt)/1000));
          visual.lastAt=now;

          // Seguir la velocidad del host sin cambios bruscos al recibir paquete.
          const velocityFollow=1-Math.exp(-14*dt);
          visual.vx+=(p.vx-visual.vx)*velocityFollow;
          visual.vy+=(p.vy-visual.vy)*velocityFollow;

          // Solo predecimos hasta 120 ms. Si hay un corte mayor, dejamos que la
          // nave se asiente en la ultima posicion predicha en vez de inventar
          // movimiento indefinidamente.
          if(rawAge<.12){
            visual.x=(visual.x+visual.vx*dt+W)%W;
            visual.y=(visual.y+visual.vy*dt+H)%H;
          }

          const dx=wrappedDelta(visual.x,targetX,W);
          const dy=wrappedDelta(visual.y,targetY,H);
          const error=Math.hypot(dx,dy);
          if(error>120){
            // Respawn/teletransporte/impacto fuerte: manda el estado del host.
            visual.x=targetX;visual.y=targetY;
            visual.vx=p.vx;visual.vy=p.vy;
          }else{
            const positionFollow=1-Math.exp(-11*dt);
            visual.x=(visual.x+dx*positionFollow+W)%W;
            visual.y=(visual.y+dy*positionFollow+H)%H;
          }

          const dr=angleDelta(visual.r,targetR);
          if(Math.abs(dr)>75){
            visual.r=targetR;
          }else{
            const rotationFollow=1-Math.exp(-15*dt);
            visual.r=(visual.r+dr*rotationFollow+360)%360;
          }
        }
        x=visual.x;y=visual.y;r=visual.r;
      }else if(previous&&!previous.dead){
        // En CPU local conservamos la interpolacion existente.
        x=lerpWrapped(previous.x,p.x,W,blend);
        y=lerpWrapped(previous.y,p.y,H,blend);
        r=lerpAngle(previous.r,p.r,blend);
      }
    }
    // The short explosion is drawn by impactFX, never from a PNG download.
    if(p.dead)return;
    const spawnFxLeft=Math.max(0,Number(p.spawnFx)||0);
    if(spawnFxLeft>0)drawSpawnMaterializeFx(x,y,p.i,spawnFxLeft,now);
    const localizedOwner=localizedTargetOwners[Number(p.i)];
    const localized=Number.isInteger(localizedOwner)&&localizedOwner>=0;
    let alpha=1;
    if(p.camo>0&&!local){
      const revealAlpha=ghostRevealAlpha(p,now);
      if(revealAlpha<=0){
        // Un efecto puramente visual nunca debe delatar la posicion de FANTASMA.
        suppressEngineTrail(p.i,true);
        if(localized)drawLocalizaMarker(x,y,localizedOwner,.92);
        return;
      }
      suppressEngineTrail(p.i,false);
      // Revelacion encadenada: aparece y desaparece suavemente.
      alpha=.78*revealAlpha;
    }else suppressEngineTrail(p.i,false);
    if(p.camo>0&&local){alpha=.42;if(p.camo<=3)alpha=(Math.floor(now/160)%2===0)?.55:.22;}
    if(p.prot>0)alpha*=spawnProtectionAlpha(p.prot);
    if(p.shield>0){
      let shieldAlpha=alpha;
      // Aviso visual en los ultimos 3 segundos: el escudo parpadea suavemente
      // sin modificar su duracion ni la proteccion real en el servidor.
      if(p.shield<=3){
        const shieldPulse=.38+.62*(.5+.5*Math.sin(now*.012));
        shieldAlpha*=shieldPulse;
      }
      ctx.save();ctx.globalAlpha=shieldAlpha;ctx.strokeStyle='rgba(130,245,255,.95)';ctx.fillStyle='rgba(80,220,255,.12)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,SHIELD_DRAW_RADIUS,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    }
    // Python: armado = balas > 0 y recarga terminada. El servidor confirma
    // ese estado; no cambiamos el movimiento ni el efecto de propulsion web.
    const variants=SHIP_IMAGE_KEYS[p.i]||SHIP_IMAGE_KEYS[0];
    // La propulsion visual depende del acelerador, no de la velocidad.
    // Para la nave local usamos el control de este mismo frame para que el PNG
    // cambie al instante al pulsar/soltar, incluso mientras sigue por inercia.
    const materializing=spawnFxLeft>0;
    const thrusting=!materializing&&(Number(p.i)===Number(myIndex)?!!lastControlThrust:p.thrust===true);
    if(thrusting){
      const visualVx=local&&localVisual.ready?localVisual.vx:p.vx;
      const visualVy=local&&localVisual.ready?localVisual.vy:p.vy;
      emitEngineParticle(p,x,y,r,now,visualVx,visualVy);
    }
    const armed=p.armed===true;
    const selected=images[thrusting?(armed?variants.af:variants.a):(armed?variants.f:variants.base)];
    const normal=images[thrusting?variants.a:variants.base]||images[variants.base];
    // Si el PNG aun no esta disponible, dibujar la nave normal sin bloquear.
    const im=imageReady(selected)?selected:normal;
    // Los PNG originales de las naves apuntan hacia ARRIBA.
    // La fisica usa rot=0 arriba, 90 izquierda, 180 abajo y 270 derecha.
    // Canvas gira en el sentido visual contrario a esa convencion, por eso
    // dibujamos con -rot. Asi el morro coincide exactamente con el avance.
    let shipSize=SHIP_DRAW_SIZE;
    if(materializing){
      const mt=spawnMaterializeProgress(spawnFxLeft);
      const me=1-Math.pow(1-mt,3);
      shipSize*=.28+.72*me;
      alpha*=.18+.82*me;
    }
    drawImageCentered(im,x,y,shipSize,-r,alpha);
    // V20.98: confirmacion visual muy corta de impacto. Solo se alimenta de
    // eventos ya recibidos y nunca revela una nave rival en modo FANTASMA.
    const hitLeft=Number(shipHitFlashUntil[Number(p.i)]||0)-now;
    if(hitLeft>0&&(local||Number(p.camo)<=0)){
      const hitT=clamp(hitLeft/165,0,1);
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      drawImageCentered(im,x,y,shipSize*1.025,-r,Math.min(.42,alpha*.42)*hitT);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.82*hitT;
      ctx.strokeStyle='#fff3bd';
      ctx.lineWidth=2.2;
      ctx.beginPath();ctx.arc(x,y,SHIP_DRAW_SIZE*.52+7*(1-hitT),0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    // V19.66: la bengala equipada se indica sobre la propia nave, igual que
    // la capa de MIRA/misil. Solo se dibuja una vez aunque haya varias cargas.
    if((Number(p.flare)||0)>0&&imageReady(images.bengalasnave)){
      drawImageCentered(images.bengalasnave,x,y,64,-r,Math.min(1,alpha*.95));
    }
    if(p.shock===true){
      // V20.78: el testigo de onda se dibuja antes que la capa MIRA/misil,
      // para que el indicador del misil quede siempre visualmente por encima.
      const noseRot=(Number(r)||0)*Math.PI/180;
      const noseX=-Math.sin(noseRot),noseY=-Math.cos(noseRot);
      const sx=x+noseX*19,sy=y+noseY*19;
      ctx.save();
      ctx.globalAlpha=Math.min(1,alpha*.9);
      ctx.fillStyle='rgba(150,215,255,.10)';
      ctx.strokeStyle='#8ed8ff';
      ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(sx,sy,9,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.globalAlpha=Math.min(1,alpha*.42);
      ctx.strokeStyle='#e8f8ff';
      ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(sx,sy,6,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    if(p.mira===true){
      const navemiraKey=NAVEMIRA_IMAGE_KEYS[Math.max(0,Math.min(3,Number(p.i)||0))]||NAVEMIRA_IMAGE_KEYS[0];
      const navemiraIm=imageReady(images[navemiraKey])?images[navemiraKey]:images.navemira;
      if(imageReady(navemiraIm))drawImageCentered(navemiraIm,x,y,64,-r,Math.min(1,alpha*.95));
    }
    if(localized)drawLocalizaMarker(x,y,localizedOwner,Math.min(1,alpha*.95));
  }
  function drawIncomingMissileWarning(now,projectileAge,blend,part='all'){
    if(!state||!Array.isArray(state.players)||!Array.isArray(state.bullets))return;
    const me=state.players.find(p=>Number(p&&p.i)===Number(myIndex));
    if(!me||me.dead)return;

    let threat=null,best=Infinity;
    for(const b of state.bullets){
      if(!b)continue;
      const guided=!!(b.g||b.guided);
      const ownerIndex=Number(b.o!==undefined?b.o:b.owner);
      if(!guided||ownerIndex===Number(myIndex))continue;

      const x=Number(b.x)+(Number(b.vx)||0)*projectileAge;
      const y=Number(b.y)+(Number(b.vy)||0)*projectileAge;
      const ddx=wrappedDelta(x,Number(me.x),W),ddy=wrappedDelta(y,Number(me.y),H);
      const d=Math.hypot(ddx,ddy);
      if(!Number.isFinite(d)||d<1)continue;

      // V21.42: primero usamos el objetivo autoritativo del misil.
      // Si por un snapshot P2P ese dato falta, inferimos persecucion solo cuando
      // el misil enemigo esta realmente cerrando hacia la nave local.
      const rawTarget=b.wt!==undefined?b.wt:(b.gt!==undefined?b.gt:b.target);
      const targetIndex=Number(rawTarget);
      const explicitTarget=targetIndex===Number(myIndex);
      const vx=Number(b.vx)||0,vy=Number(b.vy)||0;
      const speed=Math.hypot(vx,vy);
      const towardMe=speed>1?((vx*ddx+vy*ddy)/(speed*d)):0;
      // V21.44: en CONTRA LA MAQUINA el misil puede venir fisicamente hacia
      // el humano aunque el target del snapshot local llegue desfasado.
      // En LOCAL aceptamos la trayectoria real como autoridad visual.
      const localCpuMode=roomCode==='LOCAL'||(state&&state.mode==='cpu');
      const geometricTarget=d<1500&&towardMe>.76&&(localCpuMode||targetIndex<0);
      if(!explicitTarget&&!geometricTarget)continue;

      if(d<best){best=d;threat={id:String(b.id),x,y};}
    }
    if(!threat)return;

    if(incomingMissileNoticeId!==threat.id){
      incomingMissileNoticeId=threat.id;
      incomingMissileNoticeUntil=now+2000;
    }

    const old=previousLookup.players.get(me.i);
    const mx=old&&!old.dead?lerpWrapped(old.x,me.x,W,blend):Number(me.x);
    const my=old&&!old.dead?lerpWrapped(old.y,me.y,H,blend):Number(me.y);
    // La direccion debe señalar el camino corto en el mundo toroidal.
    const dx=wrappedDelta(mx,threat.x,W),dy=wrappedDelta(my,threat.y,H);
    const distance=Math.hypot(dx,dy)||1;
    const ux=dx/distance,uy=dy/distance;
    // V21.43: restaurado el indicador clasico alrededor de la nave.
    // La flecha apunta al lugar por donde llega el misil: naranja a distancia
    // y roja, mas grande y con pulso rapido, cuando ya esta cerca.
    const localCpuMode=roomCode==='LOCAL'||(state&&state.mode==='cpu');
    const radius=isMobile?94:(localCpuMode?86:80);
    const ax=clamp(mx+ux*radius,30,W-30);
    const ay=clamp(my+uy*radius,30,H-30);
    const warning=distance<760;
    const critical=distance<320;
    const veryClose=distance<200;
    const pulse=.5+.5*Math.sin(now*(critical?.024:.014));
    const scale=(veryClose?1.14:(critical?1.08:(warning?1.00:.94)))*(1+(critical?.08:.03)*pulse);

    if(part!=='label'){
      ctx.save();
      try{
        ctx.translate(ax,ay);
        ctx.rotate(Math.atan2(uy,ux));
        ctx.scale(scale,scale);
        // V21.48: flecha opaca y de alto contraste:
        // blanca a distancia, amarilla cuando se acerca y roja muy cerca.
        ctx.globalAlpha=1;
        if(critical){
          ctx.fillStyle='#ff251a';
          ctx.shadowColor='rgba(255,35,25,.95)';
          ctx.shadowBlur=veryClose?13:10;
        }else if(warning){
          ctx.fillStyle='#ffe100';
          ctx.shadowColor='rgba(255,225,0,.90)';
          ctx.shadowBlur=8;
        }else{
          ctx.fillStyle='#ffffff';
          ctx.shadowColor='rgba(255,255,255,.80)';
          ctx.shadowBlur=5;
        }
        ctx.beginPath();
        ctx.moveTo(13,0);
        ctx.lineTo(-7,-7);
        ctx.lineTo(-3,0);
        ctx.lineTo(-7,7);
        ctx.closePath();
        ctx.fill();
      }finally{ctx.restore();}
    }

    // El texto es un aviso breve: dura 2 segundos por cada misil nuevo.
    // La flecha sigue visible mientras el misil continue siendo una amenaza.
    if(part!=='arrow'&&now<incomingMissileNoticeUntil){
      ctx.save();
      try{
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font=isMobile?'26px Flashback,Arial':'20px Flashback,Arial';
        ctx.globalAlpha=.68+.28*pulse;
        ctx.fillStyle=critical?'#ff5a4f':'#ffad62';
        ctx.strokeStyle='rgba(0,0,0,.82)';
        ctx.lineWidth=4;
        const labelY=clamp(my-(isMobile?112:96),30,H-30);
        const label=tr('incomingMissile');
        ctx.strokeText(label,mx,labelY);
        ctx.fillText(label,mx,labelY);
      }finally{ctx.restore();}
    }
  }

  function drawHud(now){
    if(!state)return;
    let max=0,leader=null,tied=false;
    for(const p of state.players){
      const score=Number(p.k)||0;
      if(score>max){max=score;leader=p.i;tied=false;}
      else if(score===max&&score>0){tied=true;}
    }
    if(max<=0||tied)leader=null;
    for(const p of state.players){
      // HUD ligeramente mayor en ambas plataformas para mejorar la lectura.
      // Movil conserva un refuerzo extra porque muestra todo el campo 16:9.
      const hudScale=HUD_SCALE;
      const panelW=HUD_PANEL_W,panelH=HUD_PANEL_H;
      const left=p.i%2===0,top=p.i<2;
      const px=left?10:W-10-panelW;
      const bottomHudMargin=isMobile?45:36;
      const py=top?5:H-bottomHudMargin-157*hudScale;
      const color=playerColors[p.i];
      const localKillFlash=p.i===myIndex&&now<killHudFlashUntil;
      const flashElapsed=localKillFlash?Math.max(0,now-killHudFlashStart):0;
      const localKillScoreFx=p.i===myIndex&&now>=killScoreFxStart&&now<killScoreFxUntil;
      const scoreFxElapsed=localKillScoreFx?Math.max(0,now-killScoreFxStart):0;
      const localCrashScoreFx=p.i===myIndex&&now>=crashScoreFxStart&&now<crashScoreFxUntil;
      const crashFxElapsed=localCrashScoreFx?Math.max(0,now-crashScoreFxStart):0;
      const panel=images[p.i===0?'pantA':p.i===1?'pantB':p.i===2?'pantC':'pantD'];
      const cpuAmmoFlash=huntCpuAmmo&&now<huntFxUntil&&huntCpuIndices.includes(Number(p.i));
      if(cpuAmmoFlash){
        const age=Math.max(0,now-huntFxStart);
        const envelope=clamp(1-age/2200,0,1);
        const pulse=.55+.45*(.5+.5*Math.sin(age*.024));
        ctx.save();
        ctx.shadowColor='rgba(255,230,70,.98)';
        ctx.shadowBlur=(20+34*pulse)*hudScale;
        ctx.globalAlpha=1;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.globalCompositeOperation='screen';
        ctx.globalAlpha=(.18+.30*pulse)*envelope;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.restore();
      }else if(localKillFlash){
        const flash=1-flashElapsed/450;
        ctx.save();
        ctx.shadowColor=color;
        ctx.shadowBlur=34*flash*hudScale;
        ctx.globalAlpha=1;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.globalCompositeOperation='screen';
        ctx.globalAlpha=.32*flash;
        drawImageSafely(panel,px,py,panelW,panelH);
        ctx.restore();
      }else{
        drawImageSafely(panel,px,py,panelW,panelH);
      }
      const rightHud=p.i===1||p.i===3;
      const nameX=rightHud?px+panelW-4*hudScale:px+4*hudScale;
      ctx.font=HUD_NAME_FONT;ctx.fillStyle=color;ctx.textAlign=rightHud?'right':'left';ctx.textBaseline='top';let alpha=1;if(leader===p.i)alpha=.62+.38*(.5+.5*Math.sin(now*.0042));ctx.globalAlpha=alpha;ctx.fillText(hudPlayerName(p),nameX,py+157*hudScale);ctx.globalAlpha=1;
      const tx=px+(left?50:46)*hudScale;ctx.textAlign='left';ctx.fillStyle=color;if(isMobile)ctx.font=HUD_VALUE_FONT;
      const immediateAmmo=huntCpuAmmo&&huntCpuAmmoTotals.has(Number(p.i))?huntCpuAmmoTotals.get(Number(p.i)):null;
      if(immediateAmmo!==null){
        const cached=hudValueCache[p.i]||hudValueCache[0];
        if(cached.ammoValue!==immediateAmmo){cached.ammoValue=immediateAmmo;cached.ammoText=String(immediateAmmo);}
      }
      ctx.fillText(immediateAmmo!==null?String(immediateAmmo):hudAmmoText(p),tx,py+15*hudScale);ctx.fillText(hudSpeedText(p),tx,py+80*hudScale);
      if(cpuAmmoFlash&&huntCpuBonus>0){
        const age=Math.max(0,now-huntFxStart);
        const t=clamp(age/2200,0,1);
        const pop=Math.sin(Math.min(1,t*2.2)*Math.PI);
        ctx.save();
        ctx.translate(tx+(isMobile?54:42)*hudScale,py+15*hudScale);
        ctx.scale(1+.55*pop,1+.55*pop);
        ctx.textAlign='left';
        ctx.textBaseline='alphabetic';
        ctx.font=isMobile?`900 ${24*HUD_SCALE}px Arial Black,Arial,sans-serif`:`900 ${19*HUD_SCALE}px Arial Black,Arial,sans-serif`;
        ctx.fillStyle='#ffe64a';
        ctx.strokeStyle='rgba(0,0,0,.9)';
        ctx.lineWidth=4*HUD_SCALE;
        ctx.shadowColor='rgba(255,230,70,.95)';
        ctx.shadowBlur=18*HUD_SCALE*(1-t);
        const bonusText='+'+huntCpuBonus;
        ctx.strokeText(bonusText,0,0);
        ctx.fillText(bonusText,0,0);
        ctx.restore();
      }
      let displayedKills=Number(p.k)||0;
      if(p.i===myIndex&&killScorePendingValue!==null){
        if(now<killScoreFxStart){
          displayedKills=killScoreHeldValue===null?displayedKills:killScoreHeldValue;
        }else{
          // El nuevo valor aparece justo al comenzar el escalado del marcador.
          displayedKills=killScorePendingValue;
          if(now>=killScoreFxUntil){
            killScoreHeldValue=null;
            killScorePendingValue=null;
          }
        }
      }
      if(p.i===myIndex&&crashScorePendingValue!==null){
        if(now<crashScoreFxStart){
          // Mientras se ve PENALIZACION -1, el HUD conserva el valor anterior.
          displayedKills=crashScoreHeldValue===null?displayedKills:crashScoreHeldValue;
        }else{
          // La resta aparece exactamente cuando comienza el efecto del HUD.
          displayedKills=crashScorePendingValue;
          if(now>=crashScoreFxUntil){
            crashScoreHeldValue=null;
            crashScorePendingValue=null;
          }
        }
      }
      const killText=hudKillText(p,state.scoreToWin,displayedKills);
      if(Number(p.i)===Number(pendingVictoryIndex)&&pendingVictoryIndex!==null&&displayedKills>=(Number(state.scoreToWin)||5)&&victoryHudScoreShownAt===null){
        victoryHudScoreShownAt=now;
      }
      if(localCrashScoreFx){
        // Explosion local del contador cuando una colision propia resta una baja.
        // El nuevo valor ya viene del servidor; aqui solo reforzamos visualmente
        // la penalizacion sin alterar puntuacion, fisica ni red.
        const duration=950;
        const t=clamp(crashFxElapsed/duration,0,1);
        const envelope=1-t;
        const burst=Math.sin(Math.min(1,t*2.4)*Math.PI);
        const kx=tx,ky=py+115*hudScale;
        const shake=envelope*5*hudScale;
        const sx=Math.sin(crashFxElapsed*.12)*shake;
        const sy=Math.cos(crashFxElapsed*.10)*shake*.55;
        ctx.save();
        ctx.translate(kx+sx,ky+sy);
        const scoreScale=1+0.72*burst*envelope;
        ctx.scale(scoreScale,scoreScale);
        ctx.shadowColor='rgba(255,70,20,.95)';
        ctx.shadowBlur=(18+42*envelope)*hudScale;
        ctx.fillStyle='#ff5b2d';
        ctx.globalAlpha=.75+.25*envelope;
        ctx.fillText(killText,0,0);
        ctx.restore();

        // Onda expansiva y chispas alrededor del contador.
        ctx.save();
        ctx.translate(kx,ky+7*hudScale);
        ctx.globalAlpha=Math.max(0,envelope);
        ctx.strokeStyle='#ff7a2f';
        ctx.lineWidth=3*hudScale;
        ctx.shadowColor='rgba(255,80,20,.9)';
        ctx.shadowBlur=14*hudScale*envelope;
        ctx.beginPath();
        ctx.arc(0,0,(10+42*t)*hudScale,0,Math.PI*2);
        ctx.stroke();
        for(let n=0;n<12;n++){
          const a=(Math.PI*2*n/12)+0.18;
          const inner=(12+28*t)*hudScale;
          const outer=(24+58*t)*hudScale;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
          ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);
          ctx.stroke();
        }
        ctx.restore();
      }else if(localKillScoreFx){
        // Dos segundos despues de la baja, el marcador hace un efecto muy
        // evidente: entrada rapida, gran escala, dos pulsos y brillo fuerte.
        // La animacion completa dura dos segundos.
        const t=clamp(scoreFxElapsed/2000,0,1);
        const intro=clamp(scoreFxElapsed/160,0,1);
        const after=clamp((scoreFxElapsed-160)/1840,0,1);
        const introEase=1-Math.pow(1-intro,3);
        // V16.4.6: pop mucho mas exagerado. El numero entra pequeno y salta
        // hasta unas 3 veces su tamano antes de asentarse con rebotes visibles.
        let scale=.42+2.58*introEase;
        if(scoreFxElapsed>=160){
          const elastic=Math.exp(-after*4.1)*(0.55+0.45*Math.cos(after*18));
          scale=1+2.0*elastic;
        }
        const pulse=.5+.5*Math.sin(scoreFxElapsed*.018);
        const envelope=1-t;
        const kx=tx,ky=py+115*hudScale;
        ctx.save();
        ctx.translate(kx,ky);
        ctx.scale(scale,scale);
        ctx.shadowColor=color;
        ctx.shadowBlur=(34+74*envelope*(.55+.45*pulse))*hudScale;
        ctx.fillStyle=color;
        ctx.globalAlpha=.94+.06*pulse;
        ctx.fillText(killText,0,0);
        ctx.restore();

        // Anillo expansivo adicional para remarcar el momento exacto del cambio.
        if(scoreFxElapsed<720){
          const rt=clamp(scoreFxElapsed/720,0,1);
          ctx.save();
          ctx.translate(kx,ky+7*hudScale);
          ctx.globalAlpha=(1-rt)*.72;
          ctx.strokeStyle=color;
          ctx.lineWidth=3*hudScale;
          ctx.shadowColor=color;
          ctx.shadowBlur=22*hudScale*(1-rt);
          ctx.beginPath();
          ctx.arc(0,0,(12+58*rt)*hudScale,0,Math.PI*2);
          ctx.stroke();
          ctx.restore();
        }
      }else{
        ctx.fillText(killText,tx,py+115*hudScale);
      }
      ctx.fillStyle='#be0000';ctx.fillRect(tx,py+53*hudScale,Math.max(0,(30-p.cad)*2.3*hudScale),7*hudScale);ctx.fillRect(tx,py+105*hudScale,67*clamp((p.spd-1),0,1)*hudScale,7*hudScale);
    }
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function centerNoticeY(kind,now,defaultY){
    const shower=!!(state&&Number(state.shower)>0);
    const hunt=!!(huntFxUntil&&now<huntFxUntil&&huntText);
    const brutal=!!(brutalFxUntil&&now<brutalFxUntil);
    const ghost=!!(invisibleNoticeUntil&&now<invisibleNoticeUntil&&invisibleNoticeIndex>=0);
    const special=!!(playNoticeUntil&&now<playNoticeUntil&&playNoticeText);
    const count=(shower?1:0)+(hunt?1:0)+(brutal?1:0)+(ghost?1:0)+(special?1:0);
    if(count<=1)return defaultY;

    let idx=-1,cursor=0;
    if(shower){if(kind==='shower')idx=cursor;cursor++;}
    if(hunt){if(kind==='hunt')idx=cursor;cursor++;}
    if(brutal){if(kind==='brutal')idx=cursor;cursor++;}
    if(ghost){if(kind==='ghost')idx=cursor;cursor++;}
    if(special){if(kind==='special')idx=cursor;cursor++;}
    if(idx<0)return defaultY;

    if(count===2)return idx===0?H*.34:H*.57;
    if(count===3)return idx===0?H*.28:(idx===1?H*.48:H*.68);
    if(count===4)return idx===0?H*.23:(idx===1?H*.39:(idx===2?H*.55:H*.71));
    if(count===5)return idx===0?H*.18:(idx===1?H*.32:(idx===2?H*.46:(idx===3?H*.60:H*.74)));
    return H*(.15+idx*.13);
  }

  function drawPenaltyAnnouncement(now){
    if(!penaltyMessageUntil||now>=penaltyMessageUntil)return;
    const remaining=penaltyMessageUntil-now;
    const age=2000-remaining;
    const fadeIn=clamp(age/180,0,1);
    const fadeOut=clamp(remaining/320,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const pulse=.94+.06*Math.sin(age*.012);
    ctx.save();
    try{
      ctx.translate(W/2,105);
      ctx.scale(pulse,pulse);
      ctx.font=isMobile?'34px Flashback,Arial':'26px Flashback,Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#ff6a32';
      ctx.strokeStyle='rgba(0,0,0,.82)';
      ctx.lineWidth=5;
      ctx.shadowColor='rgba(255,70,20,.9)';
      ctx.shadowBlur=14;
      const text=tr('penalty');
      ctx.strokeText(text,0,0);
      ctx.fillText(text,0,0);
    }finally{
      ctx.restore();
    }
  }

  function buildOnlineStartTitleCache(text,fill,glow,fontSize,lineWidth){
    const cache=document.createElement('canvas');
    cache.width=1400;cache.height=420;
    const c=cache.getContext('2d');
    if(!c)return null;
    c.clearRect(0,0,cache.width,cache.height);
    c.textAlign='center';c.textBaseline='middle';
    c.font=fontSize+'px Flashback,Arial,sans-serif';
    c.lineWidth=lineWidth;
    c.strokeStyle='rgba(0,0,0,.9)';
    c.shadowColor=glow;c.shadowBlur=58;
    c.fillStyle=fill;
    c.strokeText(text,cache.width/2,cache.height/2);
    c.fillText(text,cache.width/2,cache.height/2);
    return cache;
  }
  function warmOnlineStartCaches(force=false){
    if(force){onlineReadyRedCache=null;onlineReadyOrangeCache=null;onlineGoCache=null;}
    if(!onlineReadyRedCache)onlineReadyRedCache=buildOnlineStartTitleCache(tr('readyNotice'),'#ff2b24','rgba(255,35,20,.98)',126,14);
    if(!onlineReadyOrangeCache)onlineReadyOrangeCache=buildOnlineStartTitleCache(tr('readyNotice'),'#ff8a20','rgba(255,115,20,.98)',126,14);
    if(!onlineGoCache)onlineGoCache=buildOnlineStartTitleCache(tr('goNotice'),'#54ff63','rgba(55,255,95,.98)',178,16);
    return !!(onlineReadyRedCache&&onlineReadyOrangeCache&&onlineGoCache);
  }
  function clearGameCanvas(){
    ctx.save();
    try{
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }finally{ctx.restore();}
  }
  function resetOnlineStartCountdown(){
    onlineStartGeneration++;onlineStartPending=false;
    if(onlineStartTimer){clearTimeout(onlineStartTimer);onlineStartTimer=null;}
    onlineStartAt=0;onlineGoAt=0;onlineStartEndAt=0;onlineStartRankRound=1;
  }
  function onlinePreparing(now=performance.now()){return onlineStartPending||(onlineGoAt>0&&now<onlineGoAt);}
  function activateGameUi(){
    topbar.classList.remove('hidden');
    if(isMobile){
      mobileControls.classList.remove('hidden');
      if(mobileExit)mobileExit.classList.remove('hidden');
    }
  }
  function launchOnlineAfterReady(){
    onlineStartTimer=null;
    if(!inGame||!onlineGoAt)return;
    // V19.57: VAMOS es tambien la salida real en CPU local. Hasta este
    // instante ni la IA ni la fisica local han avanzado un solo tick.
    activateGameUi();
    if(roomCode!=='LOCAL'&&isHost&&!hostPhysics)startHostPhysics(lobbyPlayers,onlineStartRankRound);
    playSound('start');
  }
  function prepareMatchBackground(rankRound){
    const index=roomCode==='LOCAL'
      ?clamp(Math.round(Number(localCampaignLevel)||1)-1,0,LOCAL_CAMPAIGN_LEVELS-1)
      :(Math.max(1,Number(rankRound)||1)-1)%MATCH_BACKGROUNDS.length;
    const cfg=MATCH_BACKGROUNDS[index];
    if(imageDecodePromises[cfg.mobileKey])return imageDecodePromises[cfg.mobileKey];
    // En PC el primer fondo vive en CSS: tambien esperamos su decodificacion.
    const im=new Image();im.decoding='async';
    const ready=new Promise(resolve=>{
      im.onerror=()=>{reportImageFailure(im);resolve(false);};
      im.onload=()=>{
        const decoded=typeof im.decode==='function'?im.decode():Promise.resolve();
        Promise.resolve(decoded).then(()=>resolve(true),()=>resolve(false));
      };
    });
    imageDecodePromises[cfg.mobileKey]=ready;
    images[cfg.mobileKey]=im;im.src=cfg.file;
    return ready;
  }
  async function beginOnlineStartCountdown(rankRound=1){
    resetOnlineStartCountdown();
    if(roomCode!=='LOCAL')updateOnlineSeriesRoundUi(Math.max(1,Number(rankRound)||1));
    const generation=onlineStartGeneration,startingRoom=roomCode;
    onlineStartPending=true;
    await Promise.all([prepareGameAssets(),prepareMatchBackground(rankRound)]);
    if(generation!==onlineStartGeneration)return;
    if(roomCode!==startingRoom){onlineStartPending=false;return;}
    onlineStartPending=false;
    const now=performance.now();
    onlineStartAt=now;onlineGoAt=now+ONLINE_READY_MS;onlineStartEndAt=onlineGoAt+ONLINE_GO_MS;
    onlineStartRankRound=Math.max(1,Number(rankRound)||1);
    netStartAt=roomCode==='LOCAL'?0:onlineGoAt;
    warmOnlineStartCaches(true);
    beginGame(true,onlineStartRankRound);
    onlineStartTimer=setTimeout(launchOnlineAfterReady,ONLINE_READY_MS);
  }
  function drawOnlineStartAnnouncement(now){
    if(!inGame||!menu.classList.contains('hidden')||!lobby.classList.contains('hidden')||!onlineStartAt||now<onlineStartAt||now>=onlineStartEndAt)return;
    warmOnlineStartCaches();
    const age=now-onlineStartAt;
    ctx.save();
    try{
      ctx.translate(W/2,H*.48);
      ctx.textAlign='center';ctx.textBaseline='middle';
      if(age<ONLINE_READY_MS){
        const t=clamp(age/ONLINE_READY_MS,0,1);
        const intro=clamp(age/240,0,1);
        const ease=1-Math.pow(1-intro,3);
        const pulse=1+Math.sin(age*.012)*.022;
        const scale=(.58+.42*ease)*pulse;
        const fadeIn=clamp(age/140,0,1);
        ctx.scale(scale,scale);
        if(onlineReadyRedCache){
          ctx.globalAlpha=fadeIn*(1-t*.92);
          ctx.drawImage(onlineReadyRedCache,-onlineReadyRedCache.width/2,-onlineReadyRedCache.height/2);
        }
        if(onlineReadyOrangeCache){
          ctx.globalAlpha=fadeIn*t;
          ctx.drawImage(onlineReadyOrangeCache,-onlineReadyOrangeCache.width/2,-onlineReadyOrangeCache.height/2);
        }
        if(roomCode==='LOCAL'){
          ctx.globalAlpha=fadeIn;
          const worldText=tr('campaignLevelTitle',{level:localCampaignLevel,name:localCampaignWorldName(localCampaignLevel)});
          ctx.font=isMobile?'900 30px Flashback,Arial':'900 36px Flashback,Arial';
          ctx.lineWidth=isMobile?7:9;
          ctx.strokeStyle='rgba(0,0,0,.92)';
          ctx.fillStyle='#9eeaff';
          ctx.shadowColor='rgba(80,220,255,.72)';
          ctx.shadowBlur=isMobile?12:16;
          ctx.strokeText(worldText,0,112);
          ctx.fillText(worldText,0,112);
          ctx.shadowBlur=0;
        }
      }else{
        const goAge=age-ONLINE_READY_MS;
        const intro=clamp(goAge/180,0,1);
        const ease=1-Math.pow(1-intro,3);
        const remaining=ONLINE_GO_MS-goAge;
        const fadeOut=clamp(remaining/220,0,1);
        const kick=1+Math.sin(Math.min(1,goAge/360)*Math.PI)*.13;
        const scale=(.34+.66*ease)*kick;
        ctx.scale(scale,scale);
        ctx.globalAlpha=Math.min(1,clamp(goAge/90,0,1),fadeOut);
        if(onlineGoCache)ctx.drawImage(onlineGoCache,-onlineGoCache.width/2,-onlineGoCache.height/2);
      }
    }finally{ctx.restore();}
  }

  function getBrutalTitleCache(){
    const text=tr(brutalTitleKey||'brutal');
    if(brutalTitleCache&&brutalTitleCacheText===text&&brutalTitleCacheMobile===isMobile)return brutalTitleCache;
    const cache=document.createElement('canvas');
    // Margen amplio para que el glow quede contenido y no fuerce recortes.
    cache.width=520;
    cache.height=210;
    const c=cache.getContext('2d');
    if(!c)return null;
    c.clearRect(0,0,cache.width,cache.height);
    c.textAlign='center';
    c.textBaseline='middle';
    c.font=isMobile?'900 72px Arial Black,Arial,sans-serif':'900 64px Arial Black,Arial,sans-serif';
    c.lineWidth=10;
    c.strokeStyle='rgba(0,0,0,.86)';
    c.shadowColor='rgba(255,85,20,.95)';
    // Glow fijo prerenderizado: visualmente conserva el efecto pero evita
    // recalcular un blur de 34-62 px en cada frame del juego.
    c.shadowBlur=48;
    c.fillStyle='#ffdb35';
    c.strokeText(text,cache.width/2,cache.height/2);
    c.fillText(text,cache.width/2,cache.height/2);
    brutalTitleCache=cache;
    brutalTitleCacheText=text;
    brutalTitleCacheMobile=isMobile;
    return cache;
  }

  function drawBrutalAnnouncement(now){
    if(!brutalFxUntil||now>=brutalFxUntil)return;
    const age=now-brutalFxStart;
    const total=1650;
    const t=clamp(age/total,0,1);
    const fadeIn=clamp(age/120,0,1);
    const fadeOut=clamp((total-age)/320,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const intro=clamp(age/180,0,1);
    const introEase=1-Math.pow(1-intro,3);
    const wobble=Math.sin(age*.035)*Math.max(0,1-t)*.055;
    const scale=(.28+1.72*introEase)*(1+wobble);
    const y=centerNoticeY('brutal',now,H*.43)-Math.min(32,age*.025);
    ctx.save();
    try{
      ctx.translate(W/2,y);
      ctx.rotate(Math.sin(age*.025)*.025*(1-t));
      ctx.scale(scale,scale);
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      // BRUTAL conserva escala, rotacion y fade, pero el texto con glow ya
      // viene rasterizado y aqui solo hacemos un drawImage muy barato.
      ctx.globalAlpha=alpha*.82;
      const title=getBrutalTitleCache();
      if(title)ctx.drawImage(title,-title.width/2,-title.height/2);
      else{
        ctx.font=isMobile?'900 72px Arial Black,Arial,sans-serif':'900 64px Arial Black,Arial,sans-serif';
        ctx.lineWidth=10;
        ctx.strokeStyle='rgba(0,0,0,.86)';
        ctx.fillStyle='#ffdb35';
        const titleText=tr(brutalTitleKey||'brutal');
        ctx.strokeText(titleText,0,0);
        ctx.fillText(titleText,0,0);
      }
      if(brutalDistance>0){
        ctx.shadowBlur=0;
        ctx.font=isMobile?'800 24px Arial,Helvetica,sans-serif':'800 20px Arial,Helvetica,sans-serif';
        ctx.fillStyle='#ffffff';
        // Escala fisica del juego: diametro de colision de nave = 48 px = 8 m.
        ctx.fillText(brutalDistanceText,0,58);
        if(brutalShooter){
          ctx.font=isMobile?'800 20px Arial,Helvetica,sans-serif':'800 17px Arial,Helvetica,sans-serif';
          ctx.fillStyle='#ffdb35';
          ctx.fillText(brutalShooter,0,84);
        }
        if(brutalAmmoBonus>0||brutalCadenceMax){
          ctx.font=isMobile?'900 23px Arial Black,Arial,sans-serif':'900 19px Arial Black,Arial,sans-serif';
          ctx.fillStyle='#7dff75';
          const reward=(brutalAmmoBonus>0?('+'+brutalAmmoBonus+' BALAS'):'')+
            (brutalAmmoBonus>0&&brutalCadenceMax?' · ':'')+
            (brutalCadenceMax?'CADENCIA MAX':'');
          ctx.fillText(reward,0,112);
        }
      }
    }finally{ctx.restore();}
  }

  function drawHuntAnnouncement(now){
    if(!huntFxUntil||now>=huntFxUntil||!huntText)return;
    const age=now-huntFxStart,total=2200;
    const fadeIn=clamp(age/180,0,1),fadeOut=clamp((total-age)/420,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const pulse=1+Math.sin(age*.018)*.025;
    ctx.save();
    try{
      ctx.translate(W/2,centerNoticeY('hunt',now,H*.37));
      ctx.scale(pulse,pulse);
      ctx.textAlign='center';ctx.textBaseline='middle';
      // V21.31: aviso "A POR..." mas pequeno y discreto para no tapar la accion.
      ctx.globalAlpha=alpha*.72;
      ctx.font=isMobile?'900 34px Arial Black,Arial,sans-serif':'900 28px Arial Black,Arial,sans-serif';
      ctx.lineWidth=isMobile?5:4;ctx.strokeStyle='rgba(0,0,0,.78)';
      ctx.shadowColor='rgba(255,45,45,.72)';ctx.shadowBlur=12;
      ctx.fillStyle='#ff5b5b';
      ctx.strokeText(huntText,0,0);ctx.fillText(huntText,0,0);
      if(huntCpuAmmo){
        ctx.font=isMobile?'900 20px Arial Black,Arial,sans-serif':'900 17px Arial Black,Arial,sans-serif';
        ctx.lineWidth=isMobile?4:3;
        ctx.shadowBlur=8;
        ctx.fillStyle='#ffe86b';
        const ammoLabel=(huntCpuBonus>0?('+'+huntCpuBonus+' '):'')+tr('cpuAmmoLabel');
        ctx.strokeText(ammoLabel,0,isMobile?40:34);
        ctx.fillText(ammoLabel,0,isMobile?40:34);
      }
    }finally{ctx.restore();}
  }

  function drawPickupNotice(now){
    if(!pickupNoticeUntil||now>=pickupNoticeUntil||!pickupNoticeText)return;
    const age=Math.max(0,now-pickupNoticeStart),total=950;
    const alpha=Math.min(clamp(age/100,0,1),clamp((total-age)/220,0,1));
    const scale=.82+.18*(1-Math.pow(1-clamp(age/140,0,1),3));
    ctx.save();
    try{
      ctx.translate(W/2,H*.79);
      ctx.scale(scale,scale);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.globalAlpha=alpha*.9;
      ctx.font=isMobile?'34px Flashback,Arial':'26px Flashback,Arial';
      ctx.lineWidth=isMobile?5:4;
      ctx.strokeStyle='rgba(0,0,0,.78)';
      ctx.fillStyle='#b8f3ff';
      if(isMobile){
        ctx.shadowColor='transparent';
        ctx.shadowBlur=0;
      }else{
        ctx.shadowColor='rgba(90,210,255,.65)';
        ctx.shadowBlur=10*(1-clamp(age/700,0,1));
      }
      ctx.strokeText(pickupNoticeText,0,0);
      ctx.fillText(pickupNoticeText,0,0);
    }finally{ctx.restore();}
  }

  function drawSpecialHelp(now){
    if(!specialHelpText||now<specialHelpStart||now>=specialHelpUntil)return;
    const total=Math.max(1,specialHelpUntil-specialHelpStart);
    const age=now-specialHelpStart;
    const remaining=specialHelpUntil-now;
    const alpha=Math.min(clamp(age/140,0,1),clamp(remaining/300,0,1));
    ctx.save();
    try{
      ctx.translate(W/2,H*.79);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.globalAlpha=alpha*.95;
      ctx.font=isMobile?'30px Flashback,Arial':'24px Flashback,Arial';
      ctx.lineWidth=isMobile?5:4;
      ctx.strokeStyle='rgba(0,0,0,.82)';
      ctx.fillStyle='#66ff7a';
      if(isMobile){
        ctx.shadowColor='transparent';
        ctx.shadowBlur=0;
      }else{
        ctx.shadowColor='rgba(55,255,100,.75)';
        ctx.shadowBlur=12;
      }
      ctx.strokeText(specialHelpText,0,0);
      ctx.fillText(specialHelpText,0,0);
    }finally{ctx.restore();}
  }

  function drawNearWinWarning(now){
    if(!nearWinNoticeUntil||now>=nearWinNoticeUntil)return;
    const age=Math.max(0,now-nearWinNoticeStart),total=2200;
    const remaining=Math.max(0,total-age);
    const alpha=Math.min(clamp(age/140,0,1),clamp(remaining/360,0,1));
    const pulse=1+.045*Math.sin(age*.018);
    const color=playerColors[Math.max(0,Math.min(3,Number(nearWinNoticeIndex)||0))]||'#ffcc4d';
    ctx.save();
    try{
      ctx.translate(W/2,H*.22);
      ctx.scale(pulse,pulse);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.globalAlpha=alpha*.95;
      ctx.font=isMobile?'34px Flashback,Arial':'27px Flashback,Arial';
      ctx.lineWidth=isMobile?6:5;
      ctx.strokeStyle='rgba(0,0,0,.88)';
      ctx.fillStyle='#ffb347';
      ctx.shadowColor='rgba(255,95,40,.85)';
      ctx.shadowBlur=16;
      const title=tr('nearWinWarning');
      ctx.strokeText(title,0,0);
      ctx.fillText(title,0,0);
      if(nearWinNoticeName){
        ctx.font=isMobile?'24px Flashback,Arial':'19px Flashback,Arial';
        ctx.fillStyle=color;
        ctx.shadowBlur=8;
        ctx.strokeText(nearWinNoticeName,0,isMobile?42:34);
        ctx.fillText(nearWinNoticeName,0,isMobile?42:34);
      }
    }finally{ctx.restore();}
  }

  function drawPlayNotice(now){
    if(!playNoticeUntil||now>=playNoticeUntil||!playNoticeText)return;
    const total=playNoticeKind==='double'?1350:1050;
    const age=Math.max(0,now-playNoticeStart);
    const remaining=Math.max(0,total-age);
    const fadeIn=clamp(age/110,0,1);
    const fadeOut=clamp(remaining/260,0,1);
    const alpha=Math.min(fadeIn,fadeOut);
    const intro=clamp(age/160,0,1);
    const ease=1-Math.pow(1-intro,3);
    const scale=.72+.28*ease+Math.sin(Math.min(1,age/420)*Math.PI)*.08;
    const double=playNoticeKind==='double';
    const color=double?'#ffe44c':'#79f6ff';
    ctx.save();
    try{
      ctx.translate(W/2,centerNoticeY('special',now,H*.61));
      ctx.scale(scale,scale);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.globalAlpha=alpha*.92;
      ctx.font=isMobile?'42px Flashback,Arial':'32px Flashback,Arial';
      ctx.lineWidth=isMobile?6:5;
      ctx.strokeStyle='rgba(0,0,0,.82)';
      ctx.shadowColor=double?'rgba(255,165,35,.9)':'rgba(70,220,255,.85)';
      ctx.shadowBlur=16*(1-clamp(age/900,0,1));
      ctx.fillStyle=color;
      ctx.strokeText(playNoticeText,0,0);
      ctx.fillText(playNoticeText,0,0);
    }finally{ctx.restore();}
  }

  function drawLeaderAnnouncement(now){
    if(!leaderAnnouncement)return;
    if(now>=leaderAnnouncement.until){leaderAnnouncement=null;return;}
    const color=playerColors[leaderAnnouncement.i]||'#fff';
    ctx.save();
    try{
      ctx.font=isMobile?'44px Flashback,Arial':'34px Flashback,Arial';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,.9)';
      ctx.shadowBlur=7;
      ctx.lineWidth=4;
      ctx.strokeStyle='rgba(0,0,0,.78)';
      const text=tr('leader',{name:leaderAnnouncement.name});
      ctx.strokeText(text,W/2,145);
      ctx.fillText(text,W/2,145);
    }finally{
      ctx.restore();
    }
  }
  function hexToRgb(hex){
    const v=String(hex||'').trim();
    const m=/^#([0-9a-f]{6})$/i.exec(v);
    if(!m)return {r:215,g:182,b:255};
    const n=parseInt(m[1],16);
    return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
  }
  function drawInvisibleModeNotice(now){
    if(!state||!Array.isArray(state.players)||invisibleNoticeIndex<0||now>=invisibleNoticeUntil)return;
    const p=state.players.find(q=>Number(q.i)===Number(invisibleNoticeIndex));
    if(!p)return;
    const remaining=Math.max(0,invisibleNoticeUntil-now);
    const fadeIn=Math.min(1,(2000-remaining)/180);
    const fadeOut=Math.min(1,remaining/380);
    const alpha=.58*Math.min(fadeIn,fadeOut);
    const color=playerColors[Number(p.i)]||'#d8a7ff';
    const name=hudPlayerName(p).toUpperCase();
    ctx.save();
    try{
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=isMobile?'44px Flashback,Arial':'36px Flashback,Arial';
      ctx.fillStyle=color;
      ctx.globalAlpha=alpha;
      ctx.shadowColor=color;
      ctx.shadowBlur=isMobile?14:10;
      ctx.fillText(name+' · FANTASMA',W/2,centerNoticeY('ghost',now,275));
    }finally{
      ctx.restore();
    }
  }

  function drawGhostStatus(now){
    if(!state||!Array.isArray(state.players))return;
    const fontSize=isMobile?27:21;
    const pillH=isMobile?40:32;
    const pillW=isMobile?170:138;
    const hudScale=HUD_SCALE;
    const panelW=HUD_PANEL_W;
    const sideGap=isMobile?14:12;
    const bottomHudMargin=isMobile?45:36;

    ctx.save();
    try{
      ctx.font=`800 ${fontSize}px Arial,Helvetica,sans-serif`;
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.globalAlpha=1;
      ctx.shadowColor='transparent';
      ctx.shadowBlur=0;

      for(const p of state.players){
        if(!(Number(p&&p.camo)>0))continue;
        const left=p.i%2===0;
        const top=p.i<2;
        const panelX=left?10:W-10-panelW;
        const panelY=top?5:H-bottomHudMargin-157*hudScale;
        const x=left?panelX+panelW+sideGap+pillW/2:panelX-sideGap-pillW/2;
        const y=panelY+pillH/2+6;
        const wave=.5+.5*Math.sin(now*.0045+(p.i||0)*.9);
        const styleStep=Math.max(0,Math.min(15,Math.round(wave*15)));
        ctx.fillStyle=(ghostFillStyles[p.i]||ghostFillStyles[0])[styleStep];
        ctx.strokeStyle=(ghostBorderStyles[p.i]||ghostBorderStyles[0])[styleStep];
        ctx.lineWidth=2;
        ctx.beginPath();
        if(typeof ctx.roundRect==='function')ctx.roundRect(x-pillW/2,y-pillH/2,pillW,pillH,pillH/2);
        else ctx.rect(x-pillW/2,y-pillH/2,pillW,pillH);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle='#000';
        ctx.fillText(tr('ghost'),x,y+1);
      }
    }finally{ctx.restore();}
  }

  function drawMobileControlLabels(){
    if(!isMobile||!inGame)return;
    ctx.save();
    try{
      ctx.font='800 34px Arial,Helvetica,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.globalAlpha=1;
      ctx.shadowColor='transparent';
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,0.20)';
      if(mobileThrust)ctx.fillText(tr('thrustControl'),W/2,H-72);
      else if(mobileFire)ctx.fillText(tr('fireControl'),W/2,H-72);
      else ctx.fillText(tr('mobileTouchGuide'),W/2,H-72);
    }finally{
      ctx.restore();
    }
  }
  function drawMobileExitControl(){
    if(!isMobile||!inGame)return;
    const x=W/2,y=68;
    ctx.save();
    try{
      // V16.4.5: el boton visible vive en el canvas, en la capa baja.
      // La zona HTML sigue encima pero es invisible y solo sirve para pulsarlo.
      // V16.4.52: boton SALIR mas grande y visible en movil.
      // V16.4.53: pastilla mas transparente, texto blanco opaco y algo mas abajo.
      // V16.4.54: se baja un poco mas y la zona tactil se alinea con el dibujo.
      // Usamos alpha real en cada color para evitar que Safari multiplique
      // transparencias y lo deje demasiado apagado.
      ctx.globalAlpha=1;
      ctx.font='800 19px Arial,Helvetica,sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.lineWidth=1.7;
      ctx.strokeStyle='rgba(255,255,255,.58)';
      ctx.fillStyle='rgba(5,7,15,.46)';
      const bw=108,bh=42,r=9;
      ctx.beginPath();
      ctx.roundRect(x-bw/2,y-bh/2,bw,bh,r);
      ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff';
      ctx.fillText(tr('exit'),x,y+1);
    }finally{ctx.restore();}
  }
  function drawMobileVoiceControl(){
    if(!isMobile||!inGame||!voice||voice.cpuMode)return;
    let x=W/2,y=H-96,radius=38;
    const buttonMode=mobileControlMode==='buttons'&&!mobileKeyboardActive;
    // La zona tactil del micro se mueve con CSS. V19.76 conserva sus medidas
    // en cache y solo vuelve a leer el DOM cuando cambia resolucion/orientacion
    // o el modo de control, en vez de hacerlo en cada frame.
    const voiceLayout=refreshMobileVoiceLayout(buttonMode);
    if(voiceLayout.valid){
      x=voiceLayout.x;y=voiceLayout.y;radius=voiceLayout.radius;
    }
    const talking=!!voice.talking;
    const enabled=!!voice.enabled;
    const unit=radius/38;
    ctx.save();
    try{
      // Mismo lenguaje visual que las flechas: fondo oscuro translucido,
      // borde blanco fino y estado activo cian. Se mantiene en la capa baja.
      // V19.27: micro mas discreto para no competir con el HUD.
      ctx.globalAlpha=talking?.72:.46;
      ctx.fillStyle=talking?'rgba(35,122,163,.42)':'rgba(6,18,31,.22)';
      ctx.strokeStyle=talking?'rgba(134,233,255,.58)':'rgba(255,255,255,.24)';
      ctx.lineWidth=Math.max(.8,1.4*unit);
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();

      ctx.globalAlpha=talking?.84:(enabled?.58:.38);
      ctx.strokeStyle='#ffffff';
      ctx.fillStyle='#ffffff';
      ctx.lineWidth=3.2*unit;
      ctx.lineCap='round';ctx.lineJoin='round';

      // Icono de microfono proporcionado al mismo boton circular.
      ctx.beginPath();
      ctx.roundRect(x-8*unit,y-17*unit,16*unit,25*unit,8*unit);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x,y-3*unit,14*unit,0,Math.PI,false);
      ctx.stroke();
      ctx.beginPath();ctx.moveTo(x,y+11*unit);ctx.lineTo(x,y+19*unit);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-8*unit,y+19*unit);ctx.lineTo(x+8*unit,y+19*unit);ctx.stroke();

      // Si aun no esta habilitado, una pequena marca + indica que este mismo
      // boton sirve para ACTIVAR MICRO en el primer toque.
      if(!enabled){
        ctx.globalAlpha=.78;
        ctx.lineWidth=2.4*unit;
        ctx.beginPath();
        ctx.arc(x+20*unit,y-20*unit,8*unit,0,Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x+16*unit,y-20*unit);ctx.lineTo(x+24*unit,y-20*unit);
        ctx.moveTo(x+20*unit,y-24*unit);ctx.lineTo(x+20*unit,y-16*unit);
        ctx.stroke();
      }
    }finally{
      ctx.restore();
    }
  }
  // V20.81: mas estrellas animadas, con tres escalas visuales.
  // Se mantienen como coordenadas fijas para evitar aleatoriedad/recalculo por frame.
  // Formato: [x,y,desfase,ciclo,tamano].
  const DECOR_STARS=[
    [86,92,0,2400,1],[214,178,620,3100,1],[356,104,1410,2200,2],[488,226,960,2800,1],[634,74,1780,3500,1],[772,196,320,2600,2],
    [914,126,1560,3000,1],[1068,238,2480,3300,1],[1216,94,730,2100,2],[1374,186,1990,2900,1],[1518,112,1040,3400,1],[1712,214,2750,2500,2],
    [154,418,1310,2700,1],[318,556,470,3600,2],[528,432,2340,2300,1],[744,612,890,3200,1],[972,476,1920,2800,2],[1196,584,150,3500,1],
    [1438,438,1660,2400,1],[1674,628,520,3000,2],[236,842,2190,3300,1],[514,928,1140,2600,2],[846,804,390,3100,1],[1128,914,2070,3500,1],
    [1396,826,780,2700,2],[1748,904,2580,3400,1],[124,692,1480,2900,1],[430,742,660,2200,2],[1042,706,2240,3200,1],[1576,756,970,3600,2],
    [58,318,1820,2500,1],[278,326,1160,3400,1],[410,82,510,3000,2],[586,338,2710,2300,1],[702,482,1360,2800,3],[832,344,190,3500,1],
    [1006,332,1620,2600,2],[1158,388,860,3100,1],[1306,314,2370,2900,1],[1492,356,430,3300,2],[1816,348,2050,2400,1],
    [92,548,720,3200,2],[250,646,1730,2700,1],[592,652,280,3500,1],[676,858,1490,3000,2],[912,944,2320,2600,1],
    [1028,612,1010,3400,2],[1262,704,1840,2300,1],[1518,566,560,3100,3],[1802,584,2170,2800,1],
    [182,1002,1260,3600,1],[370,986,400,2500,2],[690,1018,1950,3300,1],[1248,1008,820,2900,2],[1548,994,2460,3200,1],[1840,1012,1530,2700,2],

    // Refuerzo V20.81: nuevas estrellas repartidas por zonas antes mas vacias.
    [126,146,840,2850,2],[302,248,2140,3450,1],[456,164,360,2550,1],[552,286,1690,3150,2],[678,154,2520,3750,1],
    [808,86,1180,2950,1],[946,224,430,3650,3],[1112,146,2010,2750,1],[1288,246,990,3350,2],[1602,156,2260,3050,1],
    [1766,102,570,3550,2],[1862,258,1470,2450,1],[168,512,2310,3250,1],[384,484,1030,2850,2],[662,548,1770,3450,1],
    [884,556,520,2550,2],[1108,512,2630,3750,1],[1328,526,1320,3050,3],[1588,482,260,2650,1],[1848,486,1880,3350,2],
    [144,774,1970,3550,2],[342,872,690,2950,1],[620,748,2410,3250,1],[780,918,1240,3650,2],[1002,846,450,2750,1],
    [1206,804,1720,3150,2],[1464,914,2860,3450,1],[1662,842,880,2550,3],[1874,786,2210,3750,1],[1080,1042,1180,2850,2]
  ];
  function drawDecorativeStars(now){
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#fff';
    for(const s of DECOR_STARS){
      const cycle=s[3];
      const phase=(now+s[2])%cycle;
      const visible=cycle*.52;
      if(phase>visible)continue;
      const edge=Math.min(phase,visible-phase);
      const size=s[4]||1;
      const peak=size>=3?.92:(size===2?.78:.62);
      ctx.globalAlpha=Math.max(.06,Math.min(peak,(edge/280)*peak));
      if(size===1){
        ctx.fillRect(s[0],s[1],1,1);
      }else if(size===2){
        ctx.fillRect(s[0]-1,s[1],3,1);
        ctx.fillRect(s[0],s[1]-1,1,3);
      }else{
        // Muy pocas estrellas grandes: cruz corta, sin blur ni sombras costosas.
        ctx.fillRect(s[0]-2,s[1],5,1);
        ctx.fillRect(s[0],s[1]-2,1,5);
        ctx.globalAlpha*=.55;
        ctx.fillRect(s[0]-1,s[1]-1,3,3);
      }
    }
    ctx.restore();
  }

  function render(rafNow){
    requestAnimationFrame(render);
    if(!gameAssetsReady)return;
    const now=Number.isFinite(rafNow)?rafNow:performance.now();
    sampleDisplayRefresh(now);
    flushPendingState(false,now);
    if(joystickEnabled&&joystickToggleButton&&!inGame){
      const before=joystickConnected;
      findJoystick();
      if(before!==joystickConnected)updateJoystickButton();
    }
    pumpVictoryJoystick(now);
    pumpControls(now);
    if(localCpuActive&&localCpu&&!onlinePreparing(now))localCpu.advance(now);
    if(hostPhysics&&isHost&&!onlinePreparing(now))hostPhysics.advance(now);

    // V20.86: fuera de una partida no repintamos el canvas del combate.
    // El RAF sigue vivo para joystick, red, reconexion y tareas de interfaz,
    // pero evitamos clearRect/drawImage/HUD/particulas debajo de menu, lobby o
    // victoria. Al entrar de nuevo en partida, el siguiente RAF pinta normal.
    if(!inGame){
      renderCadenceTick=0;
      lastPaintAt=0;
      if(perfStats)perfStats.lastPaint=0;
      return;
    }

    // Fisica y controles siguen ejecutandose en todos los RAF. Solo el pintado
    // usa un divisor entero para conservar un frame pacing regular.
    renderCadenceTick++;
    if(renderDivisor>1&&(renderCadenceTick%renderDivisor)!==0)return;
    lastPaintAt=now;
    if(perfStats){
      if(perfStats.lastPaint){
        const dt=now-perfStats.lastPaint;perfStats.lastFrame=dt;perfStats.frames++;
        if(dt>25)perfStats.longFrames++;
        if(dt>perfStats.maxFrame)perfStats.maxFrame=dt;
      }
      perfStats.lastPaint=now;
      if(now-perfStats.windowStart>=5000){
        const seconds=(now-perfStats.windowStart)/1000;
        const dbg=collectPerfDebugSnapshot();
        perfStats.report={fps:seconds>0?perfStats.frames/seconds:0,long:perfStats.longFrames,max:perfStats.maxFrame,frame:perfStats.lastFrame,parse:perfStats.parseCount?perfStats.parseMs/perfStats.parseCount:0,localErr:perfStats.localErrMax,...dbg};
        perfStats.windowStart=now;perfStats.frames=0;perfStats.longFrames=0;perfStats.maxFrame=0;perfStats.parseMs=0;perfStats.parseCount=0;perfStats.localErrMax=0;
      }
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;
    ctx.filter='none';
    ctx.shadowColor='rgba(0,0,0,0)';
    ctx.shadowBlur=0;
    ctx.shadowOffsetX=0;
    ctx.shadowOffsetY=0;
    if(useStaticPcBackground){
      // PC: el fondo vive debajo del canvas. Solo borramos los objetos del
      // frame anterior; no volvemos a transferir/copyar 1920x1080 de fondo.
      ctx.globalCompositeOperation='source-over';
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }else{
      // Movil mantiene la ruta opaca/cacheada que ya va fluida.
      ctx.globalCompositeOperation='copy';
      if(backgroundCache&&backgroundCacheW===canvas.width&&backgroundCacheH===canvas.height){
        ctx.drawImage(backgroundCache,0,0,canvas.width,canvas.height);
      }else{
        ctx.fillStyle='#020714';ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      ctx.globalCompositeOperation='source-over';
    }
    let shakeX=0,shakeY=0;
    if(now<cameraShakeUntil&&cameraShakeUntil>cameraShakeStart){
      const st=clamp((now-cameraShakeStart)/(cameraShakeUntil-cameraShakeStart),0,1);
      const envelope=(1-st)*(1-st);
      const phase=(now-cameraShakeStart)*.075+cameraShakeSeed;
      shakeX=Math.sin(phase*1.71)*cameraShakePower*envelope;
      shakeY=Math.sin(phase*2.19+1.1)*cameraShakePower*envelope;
    }else if(cameraShakeUntil){
      cameraShakeUntil=0;cameraShakePower=0;
    }
    ctx.setTransform(renderScale,0,0,renderScale,shakeX*renderScale,shakeY*renderScale);
    if(!useStaticPcBackground&&!backgroundCache&&!drawImageSafely(activeMobileBackground(),0,0,W,H)){
      ctx.fillStyle='#020714';ctx.fillRect(0,0,W,H);
    }
    if((MATCH_BACKGROUNDS[currentMatchBackground]||MATCH_BACKGROUNDS[0]).stars)drawDecorativeStars(now);
    if(!state){drawOnlineStartAnnouncement(now);return;}

    const nowSec=now/1000;
    // Extrapolacion corta compartida por proyectiles y avisos de misiles.
    const age=Math.min(.05,Math.max(0,(now-lastStateTime)/1000));
    const blend=interpolationAlpha(now);
    const prev=previousState||state;
    localizedTargetOwners.fill(-1);
    for(const p of state.players||[]){
      if(p&&p.mira===true){
        const target=Number(p.mt),owner=Number(p.i);
        if(Number.isInteger(target)&&target>=0&&target<localizedTargetOwners.length&&Number.isInteger(owner)){
          localizedTargetOwners[target]=owner;
        }
      }
    }
    for(const b of state.bullets||[]){
      if(b&&b.g===true){
        const target=Number(b.gt),owner=Number(b.o);
        if(Number.isInteger(target)&&target>=0&&target<localizedTargetOwners.length&&Number.isInteger(owner)){
          localizedTargetOwners[target]=owner;
        }
      }
    }

    // Capa de controles visuales movil: despues del fondo y antes de cualquier
    // objeto de juego, asi todos los elementos de la partida pasan por encima.
    drawMobileControlLabels();
    drawMobileExitControl();
    drawMobileVoiceControl();

    // Los avisos FANTASMA y BRUTAL viven en la capa baja: siguen visibles,
    // pero meteoritos, asteroides, naves, balas y mejoras pasan por encima.
    drawGhostStatus(now);
    drawBrutalAnnouncement(now);
    // V21.71: los textos de aviso se dibujan antes que los jugadores.
    drawIncomingMissileWarning(now,age,blend,'label');
    drawPenaltyAnnouncement(now);
    drawLeaderAnnouncement(now);
    drawPlayNotice(now);
    drawPickupNotice(now);
    drawSpecialHelp(now);
    drawNearWinWarning(now);
    drawHuntAnnouncement(now);
    drawInvisibleModeNotice(now);
    if(state.shower>0){
      const pulse=.58+.42*(.5+.5*Math.sin(now*.005));
      ctx.save();
      ctx.globalAlpha=pulse;
      ctx.font=isMobile?'38px Flashback,Arial':'28px Flashback,Arial';
      ctx.textAlign='center';
      ctx.fillStyle='rgb(255,170,70)';
      ctx.shadowColor='rgba(255,135,35,.65)';
      ctx.shadowBlur=8+5*(1-pulse);
      ctx.fillText(tr('meteorShower'),W/2,185);
      ctx.restore();
    }
    drawOnlineStartAnnouncement(now);
    drawAsteroidDust(Math.min(.033,Math.max(.008,smoothedStateInterval/1000)));

    for(const a of state.asteroids){
      const old=previousLookup.asteroids.get(a.id);
      const x=old?lerp(old.x,a.x,blend):a.x;
      const y=old?lerp(old.y,a.y,blend):a.y;
      drawImageCentered(images[ASTEROID_IMAGE_KEYS[a.type]]||images.asteroid1,x,y,a.fragment===true?56:Math.max(56,Math.round((Number(a.r)||45)*2)));
    }
    for(const pk of state.pickups){
      const old=previousLookup.pickups.get(pk.id);
      drawPickup(pk,old?lerp(old.x,pk.x,blend):pk.x,old?lerp(old.y,pk.y,blend):pk.y,nowSec);
    }
    for(const f of state.flares||[]){
      const old=previousLookup.flares.get(f.id);
      const x=old?lerp(old.x,f.x,blend):f.x;
      const y=old?lerp(old.y,f.y,blend):f.y;
      drawDeployedFlare(f,x,y,nowSec);
    }
    for(const m of state.meteors){
      const old=previousLookup.meteors.get(m.id);
      const x=old?lerp(old.x,m.x,blend):m.x;
      const y=old?lerp(old.y,m.y,blend):m.y;
      const angle=old?lerpAngle(old.a,m.a,blend):m.a;
      drawImageCentered(images[ASTEROID_IMAGE_KEYS[m.type]]||images.asteroid1,x,y,METEOR_DRAW_SIZES[m.type]||25,angle);
    }
    if(state.giant){
      const old=prev.giant;
      const giantX=old?lerp(old.x,state.giant.x,blend):state.giant.x;
      const giantY=old?lerp(old.y,state.giant.y,blend):state.giant.y;
      drawGiantEntryWarning({x:giantX,y:giantY},now);
      drawImageCentered(images.giant,giantX,giantY,270,0,1);
    }
    {
      const visibleUfos=Array.isArray(state.ufos)?state.ufos:(state.ufo?[state.ufo]:[]);
      // V21.62: el rastro se genera y evoluciona solo en este cliente.
      // Se pinta antes del PNG para quedar por detras del platillo.
      updateUfoLocalFx(now,visibleUfos,blend);
      drawUfoParticles(now);
      for(const ufo of visibleUfos){
        if(!ufo)continue;
        const oldUfo=previousLookup.ufo.get(ufo.id);
        const ufoX=oldUfo?lerp(oldUfo.x,ufo.x,blend):ufo.x;
        const ufoY=oldUfo?lerp(oldUfo.y,ufo.y,blend):ufo.y;
        // V21.61: cada OVNI gira de forma visual e independiente.
        // La fase depende de su id; no toca trayectoria, IA ni colisiones.
        const ufoAngle=(now*.072+(Number(ufo.id)||0)*37)%360;
        drawImageCentered(images.ufo,ufoX,ufoY,56,ufoAngle,1);
      }
    }
    detectGiantAsteroidDebris(now,state.giant,state.asteroids);
    drawRockDebris(now);


    // V21.47: la flecha se pinta ANTES del combate para que misiles,
    // disparos, particulas y naves queden visualmente por encima.
    drawIncomingMissileWarning(now,age,blend,'arrow');

    // V20.4: el cohete mantiene su fisica/red intactas. Solo generamos aqui
    // sus particulas visuales locales usando datos que ya estaban en el estado.
    updateRocketLocalFx(now,state.bullets,age);
    drawRocketParticles(now);

    for(const b of state.bullets){
      const x=b.x+b.vx*age,y=b.y+b.vy*age;
      const sp=Math.hypot(b.vx,b.vy)||1;
      if(b.g){
        const rocketKey=ROCKET_IMAGE_KEYS[Math.max(0,Math.min(3,Number(b.o)||0))]||ROCKET_IMAGE_KEYS[0];
        const rocketIm=imageReady(images[rocketKey])?images[rocketKey]:images.coete;
        if(imageReady(rocketIm)){
          const bulletRot=(Math.atan2(-b.vx,-b.vy)*180/Math.PI+360)%360;
          drawImageCentered(rocketIm,x,y,42,-bulletRot,1);
          continue;
        }
      }
      ctx.strokeStyle=b.g?'#ff3b48':'#50ff78';ctx.lineWidth=b.g?4:3;ctx.beginPath();ctx.moveTo(x-b.vx/sp*(b.g?15:12),y-b.vy/sp*(b.g?15:12));ctx.lineTo(x,y);ctx.stroke();
    }
    // El rastro se calcula y pinta solo en esta maquina. Las nuevas particulas
    // se emiten al dibujar las naves y apareceran desde el siguiente frame.
    drawEngineParticles(now);
    for(const p of state.players){
      const old=previousLookup.players.get(p.i);
      drawShip(p,old,blend,now);
    }
    if(shockwaveFx.length){
      let write=0;
      ctx.save();
      ctx.lineWidth=4;
      for(const e of shockwaveFx){
        const age=now-e.born;
        if(age<0||age>1350)continue;
        const t=Math.max(0,Math.min(1,age/1350));
        // V20.53: expansion rapida al inicio y progresivamente mas lenta.
        // easeOutCubic mantiene el frente avanzando pero desacelera claramente.
        const eased=1-Math.pow(1-t,3);
        const r=28+192*eased;
        const a=(1-t)*.72;
        ctx.globalAlpha=a;
        ctx.strokeStyle='rgba(205,238,255,.95)';
        ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();
        ctx.globalAlpha=a*.34;
        ctx.lineWidth=8;
        ctx.strokeStyle='rgba(120,200,255,.75)';
        ctx.beginPath();ctx.arc(e.x,e.y,r-5,0,Math.PI*2);ctx.stroke();
        ctx.lineWidth=4;
        shockwaveFx[write++]=e;
      }
      shockwaveFx.length=write;
      ctx.restore();
    }
    if(impactFX)impactFX.draw(ctx,now);
    drawHud(now);
    if(perfStats){
      const r=perfStats.report;
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.82;
      ctx.fillStyle='rgba(0,0,0,.68)';ctx.fillRect(8,8,520,120);
      ctx.globalAlpha=1;ctx.fillStyle='#8dffb0';ctx.font='12px Arial,Helvetica,sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillText(`FPS ${r.fps.toFixed(0)}  FRAME ${r.frame.toFixed(1)}ms  MAX ${r.max.toFixed(1)}ms  >25ms ${r.long}/5s`,16,16);
      ctx.fillText(`JSON ${r.parse.toFixed(2)}ms  ERR ${r.localErr.toFixed(1)}px  HEAP ${r.heap>=0?r.heap.toFixed(1)+' MB':'n/d'}`,16,36);
      ctx.fillText(`OBJ P${r.players} B${r.bullets} F${r.flares} A${r.asteroids} M${r.meteors} PK${r.pickups} FX${r.impacts}`,16,56);
      ctx.fillText(`NET WS ${Math.round(r.wsBuf/1024)} KB  P2P ${Math.round(r.p2pBuf/1024)} KB/${r.p2pPeers} peers  Q ${r.queue}`,16,76);
      ctx.fillText(`PHYS ${r.physicsTickAvg.toFixed(2)}ms avg  ${r.physicsTickMax.toFixed(2)}ms max  DROPS ${r.physicsDrops}`,16,96);
      ctx.restore();
    }
  }
  window.addEventListener('galaxy-languagechange',()=>{
    updateAudioButton();
    renderPublicRooms();
    updateLobbyStartButton(startBtn&&!startBtn.disabled);
    updateCpuFillButton(cpuFillEnabled);
    if(menu&&!menu.classList.contains('hidden')){
      if(ws&&ws.readyState===WebSocket.OPEN)statusEl.textContent=tr('serverReady');
      else wakeStatus();
    }
  });
  const startupGraphics=prepareGameAssets();
  if(window.GalaxyGraphicsLoader)window.GalaxyGraphicsLoader.track(startupGraphics);
  connect();render();
})();
