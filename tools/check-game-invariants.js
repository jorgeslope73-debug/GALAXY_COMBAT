'use strict';

const fs=require('fs');

function read(path){return fs.readFileSync(path,'utf8');}
function fail(errors,msg){errors.push(msg);}
function method(source,name){
  const re=new RegExp('^\\s{4}'+name+'\\s*\\([^)]*\\)\\s*\\{','m');
  const m=re.exec(source);
  if(!m)return '';
  const start=m.index,brace=start+m[0].lastIndexOf('{');
  let depth=0,quote='',escaped=false,line=false,block=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(line){if(ch==='\n')line=false;continue;}
    if(block){if(ch==='*'&&next==='/'){block=false;i++;}continue;}
    if(quote){
      if(escaped){escaped=false;continue;}
      if(ch==='\\'){escaped=true;continue;}
      if(ch===quote)quote='';
      continue;
    }
    if(ch==='/'&&next==='/'){line=true;i++;continue;}
    if(ch==='/'&&next==='*'){block=true;i++;continue;}
    if(ch==="'"||ch==='"'||ch==='\x60'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  return '';
}
function startBlock(source){
  const a=source.indexOf('const ASTEROID_STARTS=[');
  const b=source.indexOf('const ASTEROID_MAX_ACTIVE',a);
  return a>=0&&b>a?source.slice(a,b):'';
}

const local=read('docs/local-cpu.js');
const host=read('docs/host-physics.js');
const game=read('docs/game.js');
const p2p=read('docs/p2p-network.js');
const core=read('docs/physics-core.js');
const build=read('docs/build-version.js');
const index=read('docs/index.html');
const sw=read('docs/sw.js');
const trainingPage=read('docs/cpu-training.html');
const menuLoader=read('docs/menu-loader.js');
const server=read('server/p2p-server.js');
const style=read('docs/style.css');
const errors=[];

for(const [label,src] of [['local',local],['online',host]]){
  const starts=startBlock(src);
  if(/\[[^\]]*,\s*5\]/.test(starts))fail(errors,label+': el meteorito pequeno solitario tipo 5 ha vuelto a ASTEROID_STARTS');

  const target=method(src,'guidedTargetFor');
  if(!target.includes('PHYSICS_CORE.guidedTargetFor'))fail(errors,label+': guidedTargetFor ya no delega en physics-core');

  const bullets=method(src,'updateBullets');
  if(!bullets.includes('PHYSICS_CORE.projectileAsteroidHit'))fail(errors,label+': colision proyectil-asteroide ya no delega en physics-core');
  if(bullets.includes('for(let aIndex=this.asteroids.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-asteroide');
  if(!bullets.includes('asteroidHit.impactX')||!bullets.includes('asteroidHit.impactY'))fail(errors,label+': misil contra asteroide pierde el punto real de impacto');
  if(!bullets.includes('PHYSICS_CORE.projectileGiantHit'))fail(errors,label+': colision proyectil-gigante ya no delega en physics-core');
  if(bullets.includes('sweptCircles(b,BULLET_RADIUS,this.giant,GIANT_RADIUS,false)'))fail(errors,label+': ha vuelto la deteccion inline proyectil-gigante');
  if(!bullets.includes('giantHit.impactX')||!bullets.includes('giantHit.impactY'))fail(errors,label+': impacto contra gigante pierde el punto real');
  if(!bullets.includes('PHYSICS_CORE.projectileMeteorHit'))fail(errors,label+': colision proyectil-lluvia ya no delega en physics-core');
  if(bullets.includes('for(let m=this.meteors.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-lluvia');
  if(!bullets.includes('this.meteors.splice(meteorHit.index,1)'))fail(errors,label+': el meteorito de lluvia impactado ya no se elimina por indice compartido');
  if(!bullets.includes('meteorHit.impactX')||!bullets.includes('meteorHit.impactY'))fail(errors,label+': impacto contra lluvia pierde el punto real');
  if(!bullets.includes('PHYSICS_CORE.projectilePickupHit'))fail(errors,label+': colision bala-pickup ya no delega en physics-core');
  if(bullets.includes('for(let p=this.pickups.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-pickup');
  if(!bullets.includes('this.pickups.splice(pickupHit.index,1)'))fail(errors,label+': el pickup impactado ya no se elimina por indice compartido');
  if(!bullets.includes('PHYSICS_CORE.projectileFlareHit'))fail(errors,label+': colision proyectil-bengala ya no delega en physics-core');
  if(bullets.includes('for(let f=this.flares.length-1'))fail(errors,label+': ha vuelto la deteccion inline proyectil-bengala');
  if(!bullets.includes('this.flares.splice(flareHit.index,1)'))fail(errors,label+': la bengala impactada ya no se elimina por indice compartido');
  if(!bullets.includes("t:'intercept',index:flareHit.flareOwner,guided:flareHit.guided"))fail(errors,label+': se ha perdido el evento de intercepcion de bengala');
  if(!bullets.includes('PHYSICS_CORE.resolveProjectileInterceptions'))fail(errors,label+': intercepcion proyectil-proyectil ya no delega en physics-core');
  if(bullets.includes('const aMissile=!!a.guided,bMissile=!!b.guided'))fail(errors,label+': han vuelto las reglas inline proyectil-proyectil');
  if(!bullets.includes('destroyedProjectileScratch'))fail(errors,label+': se ha perdido el scratch Set reutilizable de proyectiles');
  if(!bullets.includes('PHYSICS_CORE.projectileUfoHit'))fail(errors,label+': colision proyectil-OVNI ya no delega en physics-core');
  if(bullets.includes('sweptCircles(b,BULLET_RADIUS,this.ufo,UFO_RADIUS,false)'))fail(errors,label+': ha vuelto la deteccion inline proyectil-OVNI');
  if(!bullets.includes('if(ufoHit.destroyed)this.destroyUfo(ufoHit.owner)'))fail(errors,label+': el OVNI destruido ya no acredita al tirador');
  if(!bullets.includes('ufoHit.impactX')||!bullets.includes('ufoHit.impactY'))fail(errors,label+': impacto contra OVNI pierde el punto real');
  if(!bullets.includes('PHYSICS_CORE.projectileShipHit'))fail(errors,label+': colision proyectil-nave ya no delega en physics-core');
  if(bullets.includes('for(const p of this.players)'))fail(errors,label+': ha vuelto la deteccion inline proyectil-nave');
  if(!bullets.includes("shipHit.reward==='brutal'"))fail(errors,label+': se ha perdido la recompensa BRUTAL tras la clasificacion compartida');
  if(!bullets.includes("shipHit.reward==='goodShot'"))fail(errors,label+': se ha perdido GOOD SHOT tras la clasificacion compartida');
  if(!bullets.includes("shipHit.reward==='hunter'"))fail(errors,label+': se ha perdido HUNTER tras la clasificacion compartida');
  if(!bullets.includes('if(shipHit.guided)'))fail(errors,label+': se ha perdido el tratamiento visual/escudo del misil contra nave');
  if(bullets.includes('splitGiantMeteor'))fail(errors,label+': el meteorito gigante vuelve a fragmentarse por misil');

  const split=method(src,'splitAsteroidByMissile');
  if(!split.includes('PHYSICS_CORE.asteroidMissileFracture'))fail(errors,label+': la fragmentacion ya no delega en physics-core');

  const asteroids=method(src,'updateAsteroids');
  if(asteroids.includes('collidableAsteroids=this.asteroids.filter'))fail(errors,label+': ha vuelto una asignacion filter() al bucle de colisiones de 60 Hz');
  if(!asteroids.includes('if(!b||b.exiting)continue;'))fail(errors,label+': asteroides exiting pueden volver a participar en colisiones');
  if(!asteroids.includes('if(a.fragment===true)'))fail(errors,label+': falta la salida definitiva de fragmentos');

  const update=method(src,'update');
  if(update){
    if(!update.includes('PHYSICS_CORE.refreshGuidedState'))fail(errors,label+': el estado guided/guidedTarget ya no se refresca desde physics-core');
    if(!update.includes('PHYSICS_CORE.tryFireProjectile'))fail(errors,label+': la creacion/consumo de proyectiles ya no delega en physics-core');
    if(update.includes('this.bullets.push({id:uid(),owner:p.index'))fail(errors,label+': ha vuelto la creacion inline de proyectiles');
  }

  const pickup=method(src,'updatePickups');
  if(pickup.includes("pk.type==='mira'")&&!pickup.includes('p.guidedAmmo=(Number(p.guidedAmmo)||0)+1'))fail(errors,label+': pickup de misil no incrementa guidedAmmo');
}

const hostCycle=method(host,'updateHazardCycle');
if(hostCycle.includes('this.giant=null'))fail(errors,'online: el cambio de fase vuelve a borrar el meteorito gigante en seco');
const hostReset=method(host,'resetHazardCycle');
if(hostReset.includes('this.giant=null'))fail(errors,'online: resetHazardCycle vuelve a borrar un gigante en pantalla');
const hostGiant=method(host,'updateGiant');
if(!hostGiant.includes('if(!this.giant&&!giantEnabled)return;'))fail(errors,'online: falta conservar el gigante cuando termina su fase');
if(!hostGiant.includes('this.nextGiant=giantEnabled?rand(130,190):999999'))fail(errors,'online: la salida del gigante no respeta si la fase sigue habilitada');

if(!core.includes('const TARGET_MIN_ALIGN=.8660254038'))fail(errors,'core: falta el cono de adquisicion +/-30 grados');
if(!core.includes('if(align<minAlign)continue;'))fail(errors,'core: la adquisicion puede aceptar objetivos fuera del cono');
if(!core.includes('resolveAsteroidPairCollision'))fail(errors,'core: falta resolver colision asteroide-asteroide');
if(!core.includes('resolveGiantAsteroidCollision'))fail(errors,'core: falta resolver colision gigante-asteroide');
if(!core.includes('function reloadTimeFor'))fail(errors,'core: falta la cadencia compartida de disparo');
if(!core.includes('function bulletSpeedFor'))fail(errors,'core: falta la velocidad compartida de bala');
if(!core.includes('function guidedProjectileSpeedFor'))fail(errors,'core: falta la velocidad compartida de misil');
if(!core.includes('function refreshGuidedState'))fail(errors,'core: falta refrescar guided/guidedTarget de forma compartida');
if(!core.includes('function tryFireProjectile'))fail(errors,'core: falta la creacion compartida de proyectiles');
if(!core.includes('p.guidedAmmo=Math.max(0,(Number(p.guidedAmmo)||0)-1)'))fail(errors,'core: el misil no consume guidedAmmo en el nucleo compartido');
if(!core.includes('p.bullets=Math.max(0,(Number(p.bullets)||0)-1)'))fail(errors,'core: la bala no consume bullets en el nucleo compartido');
if(!core.includes('p.reload=reloadTimeFor(p)'))fail(errors,'core: bala y misil ya no comparten la misma cadencia');
if(!core.includes('function projectileAsteroidHit'))fail(errors,'core: falta la colision compartida proyectil-asteroide');
if(!core.includes('function projectileGiantHit'))fail(errors,'core: falta la colision compartida proyectil-gigante');
if(!core.includes('function projectileMeteorHit'))fail(errors,'core: falta la colision compartida proyectil-lluvia');
if(!core.includes('function projectilePickupHit'))fail(errors,'core: falta la colision compartida proyectil-pickup');
if(!core.includes('function projectileFlareHit'))fail(errors,'core: falta la colision compartida proyectil-bengala');
if(!core.includes('function resolveProjectileInterceptions'))fail(errors,'core: falta la intercepcion compartida proyectil-proyectil');
if(!core.includes('function projectileShipHit'))fail(errors,'core: falta la colision compartida proyectil-nave');
if(!core.includes('if((Number(target.index)===owner&&!guided)||target.dead||Number(target.protection)>0)continue;'))fail(errors,'core: se han perdido inmunidad de aparicion o regla de autodano');
if(!core.includes("if(longShot)reward=guided?'goodShot':'brutal';"))fail(errors,'core: se ha perdido la clasificacion BRUTAL/GOOD SHOT');
if(!core.includes("else if(guided&&enemyHit)reward='hunter';"))fail(errors,'core: se ha perdido la clasificacion HUNTER');
if(!core.includes('const pointBlank=enemyHit&&!guided&&travel<=pointBlankDistance;'))fail(errors,'core: se ha perdido la clasificacion point-blank');
if(!core.includes('function projectileUfoHit'))fail(errors,'core: falta la colision compartida proyectil-OVNI');
if(!core.includes('const damage=guided?2:1;'))fail(errors,'core: se ha perdido el dano 2 de misil / 1 de bala contra OVNI');
if(!core.includes('ufo.hp=hp;'))fail(errors,'core: el dano contra OVNI ya no actualiza su vida');
if(!core.includes('destroyed:hp<=0'))fail(errors,'core: falta indicar destruccion del OVNI');
if(!core.includes('if(Number(a.owner)===Number(b.owner))continue;'))fail(errors,'core: proyectiles del mismo jugador pueden autointerceptarse');
if(!core.includes('if(!aMissile&&!bMissile)continue;'))fail(errors,'core: dos balas normales ya no se atraviesan');
if(!core.includes('sweptCircles(a,missileRadius,b,missileRadius,false)'))fail(errors,'core: falta colision misil-misil');
if(!core.includes('sweptCircles(missile,missileRadius,bullet,bulletRadius,false)'))fail(errors,'core: falta colision bala-misil');
if(!core.includes('flareRadius=12'))fail(errors,'core: la bengala ha perdido su radio de colision compartido');
if(!core.includes('intercept:flareOwner!==projectileOwner'))fail(errors,'core: se ha perdido la distincion de bengala propia/ajena');
if(!core.includes('if(projectile.guided)return null;'))fail(errors,'core: los misiles ya no atraviesan los pickups');
if(!core.includes('pickupRadius=22'))fail(errors,'core: el pickup ha perdido su radio de colision compartido');
if(!core.includes('meteorRadius=14'))fail(errors,'core: la lluvia ha perdido su radio de colision compartido');
if(!core.includes('guided:!!projectile.guided'))fail(errors,'core: la colision compartida no conserva el tipo de proyectil');
if(!core.includes('fracture:!!projectile.guided'))fail(errors,'core: misil contra asteroide ya no activa fragmentacion');
if(!core.includes('impactX:Number(projectile.x)||0'))fail(errors,'core: falta conservar X real del impacto contra asteroide');
if(!core.includes('impactY:Number(projectile.y)||0'))fail(errors,'core: falta conservar Y real del impacto contra asteroide');
if(!core.includes('function asteroidMissileFracture'))fail(errors,'core: falta la fragmentacion compartida por misil');
if(!core.includes('type:Number(asteroid.type)||1'))fail(errors,'core: los fragmentos no conservan la textura original');
if(!core.includes('fragment:true'))fail(errors,'core: los fragmentos no quedan marcados como temporales');
if(local.includes('[...this.asteroids]')||host.includes('[...this.asteroids]'))fail(errors,'fisica: ha vuelto la copia temporal [...this.asteroids] en ruta caliente');

if(!game.includes('const ASTEROID_DUST_MAX=isMobile?24:36'))fail(errors,'render: el polvo de asteroide ha perdido su pool fijo');
if(!game.includes("}else if(e.kind==='asteroidDust'){"))fail(errors,'render: falta consumir el FX local de polvo');
if(!p2p.includes('firstOpenPeer(){'))fail(errors,'P2P: falta busqueda de peer sin array temporal');
if(p2p.includes('[...this.peers.values()].find'))fail(errors,'P2P: ha vuelto la asignacion de array temporal al buscar peer');
if(!p2p.includes("createDataChannel('galaxy-fast',{ordered:false,maxRetransmits:0})"))fail(errors,'P2P: falta canal fast no fiable para estado/controles');
if(!p2p.includes("createDataChannel('galaxy-reliable',{ordered:true})"))fail(errors,'P2P: falta canal fiable para eventos/acciones');
if(!p2p.includes('const next=connected&&fastOpen&&reliableOpen;'))fail(errors,'P2P: peer puede marcarse abierto sin ambos canales');

const p2pControl=method(p2p,'sendControl');
if(!p2pControl.includes('rec.fastDc')||p2pControl.includes('rec.reliableDc'))fail(errors,'P2P: controles no usan exclusivamente el canal fast');
const p2pState=method(p2p,'flushBroadcastState');
if(!p2pState.includes('rec.fastDc')||p2pState.includes('rec.reliableDc'))fail(errors,'P2P: estados no usan exclusivamente el canal fast');
const p2pEvent=method(p2p,'broadcastEvent');
if(!p2pEvent.includes('rec.reliableDc')||p2pEvent.includes('rec.fastDc'))fail(errors,'P2P: eventos no usan exclusivamente el canal fiable');
const p2pAction=method(p2p,'sendAction');
if(!p2pAction.includes('rec.reliableDc')||p2pAction.includes('rec.fastDc'))fail(errors,'P2P: acciones no usan exclusivamente el canal fiable');
if(!p2p.includes('this.hostIndex=0'))fail(errors,'P2P: falta hostIndex dinamico');
if(!p2pControl.includes('this.hostIndex'))fail(errors,'P2P: controles no se enrutan al host actual');
if(!p2pAction.includes('this.hostIndex'))fail(errors,'P2P: acciones no se enrutan al host actual');

// V22.20: build-version.js sigue siendo la versión canónica, pero index carga
// scripts estáticos para evitar parser/document.write problemático en Safari iOS.
const buildVersionMatch=build.match(/const VERSION='(V\d+\.\d+)';/);
if(!buildVersionMatch)fail(errors,'version: build-version.js no define VERSION');
const buildVersion=buildVersionMatch?buildVersionMatch[1]:'';
const indexVersions=[...index.matchAll(/[?&]v=(V\d+\.\d+)/g)].map(m=>m[1]);
if(!indexVersions.length)fail(errors,'version: index no lleva cache-busting estático');
if(indexVersions.some(v=>v!==buildVersion))fail(errors,'version: index y build-version.js están desincronizados');
for(const script of ['build-version.js','config.js','menu-loader.js','menu-decor.js','i18n.js','campaign-config.js','manual.js','impactos.js','voz.js','auth.js','ranking.js','physics-core.js','local-cpu.js','host-physics.js','p2p-network.js','game.js','pwa.js']){
  if(!index.includes(script+'?v='+buildVersion))fail(errors,'version: falta '+script+' sincronizado en index');
}
if(!index.includes("handheld?4000:15000"))fail(errors,'mobile loader: falta fallback independiente en index');
if(!sw.includes("importScripts('./build-version.js');"))fail(errors,'version: sw.js no importa la fuente central');
if(/const VERSION\s*=\s*['"]V\d+\.\d+/.test(sw))fail(errors,'version: sw.js vuelve a hardcodear VERSION');
if(!game.includes("AUDIO_ASSET_VERSION=String(window.GALAXY_BUILD&&window.GALAXY_BUILD.version||'dev')"))fail(errors,'version: audio no usa GALAXY_BUILD');
if(!sw.includes("cache.match(request,{ignoreSearch:true})"))fail(errors,'PWA: falta fallback offline ignorando query de versión');

if(!trainingPage.includes('<script src="build-version.js"></script>'))fail(errors,'training: cpu-training.html no usa build-version.js');
if(!trainingPage.includes("build.versioned(src)"))fail(errors,'training: scripts del entrenamiento no usan la versión central');
if(/[?&]v=V\d+\.\d+/.test(trainingPage))fail(errors,'training: vuelve a haber una versión hardcodeada en cpu-training.html');
for(const script of ['config.js','campaign-config.js','physics-core.js','local-cpu.js']){
  if(!trainingPage.includes("'"+script+"'"))fail(errors,'training: falta '+script+' en el runtime del entrenamiento');
}
if(!trainingPage.includes("window.GalaxyPhysicsCore"))fail(errors,'training: falta verificación de physics-core');
if(!trainingPage.includes("window.GalaxyLocalCpu"))fail(errors,'training: falta verificación de GalaxyLocalCpu');

if(!menuLoader.includes('decodeWithTimeout'))fail(errors,'mobile loader: falta timeout seguro para Image.decode');
if(!menuLoader.includes('watchdogTimer'))fail(errors,'mobile loader: falta watchdog anti-bloqueo');
if(!menuLoader.includes('isMobile?6000:18000'))fail(errors,'mobile loader: falta watchdog específico para móvil');
if(!menuLoader.includes('},2500):0;'))fail(errors,'mobile loader: falta liberación rápida en móvil');
if(!menuLoader.includes('if(isMobile)done();else decodeWithTimeout'))fail(errors,'mobile loader: iOS vuelve a esperar Image.decode');
if(!game.includes('function decodeImageSafely'))fail(errors,'mobile loader: game.js no blinda Image.decode');
if(!game.includes("reportImageFailure(im,'load timeout')"))fail(errors,'mobile loader: game.js no limita la espera de imágenes');
if(!read('docs/pwa.js').includes("window.GALAXY_BUILD.versioned('./sw.js')"))fail(errors,'PWA: Service Worker no usa URL versionada');

if(!server.includes("m.t==='series-round-result'"))fail(errors,'series: servidor no registra ganador de ronda');
if(!server.includes('round>=5&&leaders.length===1'))fail(errors,'series: falta regla de 5 rondas + desempate');
if(!server.includes("t:'series-lobby'"))fail(errors,'series: falta retorno autoritativo a sala');
if(!game.includes('ONLINE_SERIES_BASE_ROUNDS=5'))fail(errors,'series: cliente no define serie base de 5 rondas');
if(!game.includes('showOnlineSeriesChampion'))fail(errors,'series: falta pantalla final de campeon');
if(!game.includes("assets/sprites/coete'+(Number(index)+1)+'.png'"))fail(errors,'series: falta nave del campeon');
if(!game.includes("t:'series-round-result'"))fail(errors,'series: host no reporta ganador de ronda');
if(!index.includes('id="seriesChampion"'))fail(errors,'series: falta markup de campeon');
if(!index.includes('id="seriesRoundMini"'))fail(errors,'series: falta contador de ronda durante partida');
if(!style.includes('.series-champion-cup'))fail(errors,'series: falta copa grande en CSS');
if(!style.includes('#victory .series-champion-ship{\n  width:100px;\n  height:100px;'))fail(errors,'series: la nave campeona no mantiene 100x100 px');
if(!server.includes('scheduleSeriesLobby(r,wss,30000)'))fail(errors,'series: falta retorno automático de seguridad tras CONTINUAR');
if(!server.includes('lastSeriesChampionToken'))fail(errors,'series: el servidor no conserva la identidad del campeon anterior');
if(!server.includes('champion:!!(r.lastSeriesChampionToken'))fail(errors,'series: roster humano no marca al campeon');
if(!server.includes('lastSeriesChampionCpu'))fail(errors,'series: roster CPU no conserva campeon');
if(!game.includes("p.champion?' · 🏆':''"))fail(errors,'series: la sala no muestra la copa del campeon');
if(!server.includes("r.lastSeriesChampionToken=''"))fail(errors,'series: la copa no se limpia al iniciar una nueva serie');
if(!server.includes("m.t==='series-continue'"))fail(errors,'series: servidor no acepta CONTINUAR');
if(!server.includes('finishSeriesToLobby(r,wss)'))fail(errors,'series: CONTINUAR no vuelve a la sala');
if(!index.includes('id="seriesChampionContinue"'))fail(errors,'series: falta botón CONTINUAR en la ventana del campeón');
if(!game.includes("send({t:'series-continue'})"))fail(errors,'series: botón CONTINUAR no envía la acción');
if(!game.includes("continueBtn.textContent='CONTINUAR'"))fail(errors,'series: falta estado visual de CONTINUAR');
if(!style.includes('.series-champion-continue'))fail(errors,'series: falta estilo del botón CONTINUAR');
const championPos=index.indexOf('id="seriesChampion"');
const rankingPos=index.indexOf('id="sessionRanking"');
const continuePos=index.indexOf('id="seriesChampionContinue"');
if(!(championPos>=0&&rankingPos>championPos&&continuePos>rankingPos))fail(errors,'V22.30 series: CONTINUAR debe quedar debajo de la clasificacion');
if(!style.includes('overflow-wrap:anywhere'))fail(errors,'V22.30 series: el nombre largo del campeon puede volver a recortarse');
if(!style.includes('#victory.series-champion-mode #victoryText{\n  margin-bottom:0;'))fail(errors,'V22.30 series: separacion vertical de titulo/copa no protegida');

if(!server.includes('function currentHost(r)'))fail(errors,'host migration: falta resolver host actual');
if(!server.includes('function promoteHost(r,wss'))fail(errors,'host migration: falta promocion automatica');
if(!server.includes("t:'host-migrated'"))fail(errors,'host migration: servidor no notifica cambio de host');
if(!server.includes('hostIndex:0'))fail(errors,'host migration: sala no guarda hostIndex');
if(server.includes("find(p=>p.i===0)"))fail(errors,'host migration: queda autoridad hardcodeada al jugador 0');
if(!game.includes("m.t==='host-migrated'"))fail(errors,'host migration: cliente no procesa host-migrated');
if(!game.includes('hostIndex=0'))fail(errors,'host migration: cliente no mantiene hostIndex');
if(!game.includes("ERES EL NUEVO SERVIDOR P2P"))fail(errors,'host migration: falta confirmacion de nuevo host');
if(!game.includes("handle({t:'restarted',rankRound:round,hostMigration:true})"))fail(errors,'host migration: la ronda actual no se reinicia bajo nuevo host');
if(!server.includes('hostEpoch:1'))fail(errors,'host epoch: la sala no inicia una autoridad versionada');
if(!server.includes('r.hostEpoch=Math.max(1,Number(r.hostEpoch)||1)+1'))fail(errors,'host epoch: migrar host no incrementa epoch');
if(!server.includes('hostEpoch:r.hostEpoch'))fail(errors,'host epoch: servidor no propaga epoch');
if(!host.includes('hostEpoch:this.hostEpoch'))fail(errors,'host epoch: snapshots no llevan epoch');
if(!p2p.includes('resetStateOrder()'))fail(errors,'host epoch: P2P no reinicia el orden al cambiar autoridad');
if(!p2p.includes('lastStateEpoch'))fail(errors,'host epoch: P2P no ordena por epoch');
if(!game.includes('lastAcceptedStateEpoch'))fail(errors,'host epoch: cliente no protege contra snapshots de host antiguo');
if(!p2p.includes('controlSeq:seq'))fail(errors,'control seq: P2P no numera controles fast');
if(!host.includes('if(seq<=last)return false'))fail(errors,'control seq: host no descarta controles antiguos');
if(!game.includes('controlSeq=0'))fail(errors,'control seq: cliente no mantiene contador monotono');
if(!server.includes('controlSeq:Math.max(0,Number(m.controlSeq)||0)'))fail(errors,'control seq: fallback WS no conserva secuencia');
if(!p2p.includes("t:'input-action'"))fail(errors,'input action: falta canal fiable de acciones especiales');
if(!host.includes('applyInputAction(index,kind,actionId)'))fail(errors,'input action: host no deduplica acciones');
if(!local.includes('applyInputAction(kind,actionId)'))fail(errors,'input action: local CPU no acepta acciones fiables del joystick');
if(!game.includes("queueInputAction(kind)"))fail(errors,'input action: cliente no genera actionId');
if(!game.includes("localCpu.applyInputAction(action,id)"))fail(errors,'input action: cliente no entrega acciones fiables a la fisica local');
if(game.includes("function sendInputAction(kind,actionId){\n    if(localCpuActive&&localCpu)return false;"))fail(errors,'V22.36: un return temprano vuelve a bloquear cohete/bengala/onda contra CPU');
if(game.includes("if(isMobile||!joystickEnabled||!joystickConfigDialog)return;"))fail(errors,'V22.39: configurador de joystick vuelve a bloquear movil');
if(game.includes("if(isMobile)return {active:false,turn:0,thrust:false,fire:false,rocket:false,flare:false,shock:false,ptt:false};"))fail(errors,'V22.39: lectura de joystick vuelve a bloquear movil');
if(game.includes("if(isMobile)return;\n    joystickEnabled=!joystickEnabled;"))fail(errors,'V22.39: boton JOYSTICK vuelve a bloquear movil');
if(!game.includes("window.GalaxyJoystickEnabled=()=>!!joystickEnabled;"))fail(errors,'V22.39: estado global del joystick no incluye movil');
if(!local.includes("if(c&&c.flarePulse)this.deployFlares(p)"))fail(errors,'input action: local CPU no consume pulso fiable de bengalas');
if(!local.includes("if(c&&c.shockPulse)this.deployShockwave(p)"))fail(errors,'input action: local CPU no consume pulso fiable de onda');
if(!local.includes("!!(c&&c.rocketPulse)||(rocketHeld&&!p.joystickRocketHeld)"))fail(errors,'input action: local CPU no consume pulso fiable de cohete');
if(!server.includes("m.t==='fallback-input-action'"))fail(errors,'input action: fallback WS no reenvia acciones fiables');
if(!core.includes('bounceBodyFromFlare'))fail(errors,'V22.34: falta fisica comun de rebote de bengalas');
if(!local.includes("this.trainingTestProfile='standard'"))fail(errors,'V22.35: STANDARD no es el perfil privado por defecto');
if(!local.includes("p.bullets=500"))fail(errors,'V22.38: HARD local no carga 500 balas');
if(!local.includes("p.guidedAmmo=500"))fail(errors,'V22.38: HARD local no carga 500 misiles');
if(!local.includes("p.flare=100"))fail(errors,'V22.38: HARD local no carga 100 bengalas');
if(local.includes("p.cadence=1"))fail(errors,'V22.38: HARD local vuelve a alterar cadencia');
if(local.includes("p.speed=2"))fail(errors,'V22.38: HARD local vuelve a alterar velocidad');
if(!local.includes("return ASTEROID_MAX_ACTIVE"))fail(errors,'V22.38: HARD local debe conservar densidad estándar');
const training=read('docs/cpu-training.html');
if(!training.includes('id="trainingProfileStandard"')||!training.includes('id="trainingProfileHard"'))fail(errors,'V22.35: faltan botones STANDARD/HARD en entrenamiento privado');
if(!training.includes("TRAINING_TEST_PROFILE_STORAGE='galaxyCpuTestProfileV1'"))fail(errors,'V22.37: HARD no persiste desde entrenamiento');
if(!game.includes("localCpu.setTrainingTestProfile(privateTestProfile())"))fail(errors,'V22.37: CONTRA LA MAQUINA no carga HARD privado');
if(!game.includes("hostPhysics.setTestProfile(onlineTestProfile)"))fail(errors,'V22.37: host online no carga HARD privado');
if(!host.includes("testProfile:this.testProfile"))fail(errors,'V22.37: snapshot online no conserva perfil HARD');
if(!host.includes("p.bullets=500")||!host.includes("p.guidedAmmo=500"))fail(errors,'V22.38: HARD online no equipa 500 balas/misiles');
if(!host.includes("p.flare=100"))fail(errors,'V22.38: HARD online no equipa 100 bengalas');
if(host.includes("p.cadence=1"))fail(errors,'V22.38: HARD online vuelve a alterar cadencia');
if(host.includes("p.speed=2"))fail(errors,'V22.38: HARD online vuelve a alterar velocidad');
if(!host.includes("asteroidMaxActive(){return ASTEROID_MAX_ACTIVE;}"))fail(errors,'V22.38: HARD online debe conservar densidad estándar');
if(!local.includes("return this.trainingTestProfile==='hard'"))fail(errors,'V22.37: HARD local sigue limitado a cpu-training');
for(const [label,src] of [['host',host],['local',local]]){
  if(!src.includes('PHYSICS_CORE.bounceBodyFromFlare(a,f,radius,FLARE_RADIUS,190,105)'))fail(errors,'V22.34 '+label+': bengala no hace rebotar asteroide mediano');
  if(!src.includes('PHYSICS_CORE.bounceBodyFromFlare(g,flare,GIANT_RADIUS,FLARE_RADIUS,90,68)'))fail(errors,'V22.34 '+label+': bengala no hace rebotar meteorito gigante');
  if(!src.includes("this.emitRocketDisintegrateAt(Number(flare&&flare.x)||flareHit.impactX"))fail(errors,'V22.34 '+label+': bala normal no deshace visualmente la bengala');
}
if(!game.includes("hostPhysics.resetControlSequence(Number(m.from))"))fail(errors,'control seq: reconexion no reinicia secuencia del jugador');
if(!game.includes('pendingCriticalServerOps'))fail(errors,'round reconcile: falta cola de operaciones criticas');
if(!game.includes("queueCriticalServerOp({t:'rank-restart'"))fail(errors,'round reconcile: cambio de ronda no se encola');
if(!game.includes("t:'series-round-result'"))fail(errors,'round reconcile: resultado de serie no se encola');
if(!game.includes("m.t==='critical-ack'"))fail(errors,'round reconcile: cliente no procesa ACK');
if(!game.includes('restoreCriticalServerOps()'))fail(errors,'round reconcile: operaciones criticas no sobreviven a reconexion');
if(!server.includes("t:'critical-ack'"))fail(errors,'round reconcile: servidor no confirma operaciones criticas');
if(!server.includes("t:'critical-nack'"))fail(errors,'round reconcile: servidor no informa desajustes');
if(!server.includes('targetRound===current&&fromRound===current-1'))fail(errors,'round reconcile: rank-restart no es idempotente');
if(!server.includes('round<=Number(r.seriesLastScoredRound)'))fail(errors,'round reconcile: resultado de ronda puede duplicarse');
if(!host.includes('restart(targetRound=null)'))fail(errors,'round reconcile: fisica no acepta ronda exacta');

if(!build.includes("const VERSION='V22.39'"))fail(errors,'V22.39: testigo de version no actualizado');
if(host.includes('cpu.bullets+=4')||local.includes('cpu.bullets+=4'))fail(errors,'V22.31: A POR EL vuelve a regalar balas a las CPU');
if(!host.includes("cpuAmmo:false,cpuAmmoBonus:0")||!local.includes("cpuAmmo:false,cpuAmmoBonus:0"))fail(errors,'V22.31: A POR EL debe anunciarse sin bonus de municion');

for(const [label,src] of [['host',host],['local',local]]){
  if(!src.includes('CPU_QUICK_DEATH_WINDOW=6'))fail(errors,'V22.29 '+label+': falta ventana de muerte rapida');
  if(!src.includes('CPU_RESPAWN_RETHINK_SECONDS=2'))fail(errors,'V22.29 '+label+': falta proteccion anti-persecucion tras respawn');
  if(!src.includes('CPU_LOOP_EVASION_BASE=7'))fail(errors,'V22.29 '+label+': falta duracion base de EVASION');
  if(!src.includes('noteCpuLoopDeath(victim,attacker)'))fail(errors,'V22.29 '+label+': no registra el rival que repite la baja');
  if(!src.includes('armCpuLoopRespawn(p)'))fail(errors,'V22.29 '+label+': no arma la memoria al reaparecer');
  if(!src.includes('cpuAntiLoopControl(cpu)'))fail(errors,'V22.29 '+label+': falta control anti-bucle');
  if(!src.includes('const lateralSide=low?1:-1'))fail(errors,'V22.29 '+label+': falta ruptura lateral determinista de simetria');
  if(!src.includes('cpuLoopPressure=Math.min(4'))fail(errors,'V22.29 '+label+': falta escalado de huida por reincidencia');
}

const stress=read('tools/stress-game.js');
if(!stress.includes('STRESS_SECONDS'))fail(errors,'stress: falta duración configurable');
if(!stress.includes('startTraining(null)'))fail(errors,'stress: no usa la simulación real de 4 CPU');
if(!stress.includes("fragmento eterno"))fail(errors,'stress: falta detector de fragmentos eternos');
if(!stress.includes("asteroide demasiado tiempo fuera de escena"))fail(errors,'stress: falta detector de asteroides fuera de escena');
if(!stress.includes("mecánicas no ejercitadas"))fail(errors,'stress: falta comprobación de cobertura');

if(errors.length){
  console.error('\nGALAXY COMBAT - FALLO DE INVARIANTES\n');
  for(const e of errors)console.error(' - '+e);
  process.exit(1);
}
console.log('Galaxy Combat: invariantes OK - meteoritos, misiles, municion, gigante online, FX y rutas calientes.');
