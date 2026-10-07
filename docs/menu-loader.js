'use strict';
(() => {
  const loader=document.getElementById('menuFirstLoader');
  if(!loader)return;
  const progressEl=document.getElementById('menuFirstLoaderProgress');
  const barEl=document.getElementById('menuFirstLoaderBar');
  const labelEl=document.getElementById('menuFirstLoaderLabel');
  let total=0,done=0,registrationComplete=false,finished=false;
  const isMobile=document.documentElement.classList.contains('handheld-device')||
    matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  document.documentElement.classList.add('menu-first-loading');
  loader.hidden=false;
  loader.classList.remove('is-ready');
  if(labelEl)labelEl.textContent='CARGANDO GRAFICOS...';

  function updateProgress(){
    const pct=finished?100:Math.min(99,Math.round(done/Math.max(1,total)*100));
    if(progressEl)progressEl.textContent=pct+'%';
    if(barEl)barEl.style.transform='scaleX('+(pct/100)+')';
  }
  const slowTimer=window.setTimeout(()=>{
    if(!finished&&labelEl)labelEl.textContent='CARGANDO GRAFICOS... ESPERA UN MOMENTO';
  },8000);
  // V22.19: Safari/iOS puede dejar Image.decode() o una petición de imagen
  // pendiente indefinidamente. El cargador nunca debe bloquear el menú por eso.
  const watchdogTimer=window.setTimeout(()=>{
    if(finished)return;
    registrationComplete=true;
    done=Math.max(done,total);
    if(labelEl)labelEl.textContent='INICIANDO...';
    finishIfReady();
  },isMobile?12000:18000);
  function finishIfReady(){
    if(finished||!registrationComplete||done<total)return;
    finished=true;
    window.clearTimeout(slowTimer);
    window.clearTimeout(watchdogTimer);
    updateProgress();
    loader.classList.add('is-ready');
    window.setTimeout(()=>{
      loader.hidden=true;
      document.documentElement.classList.remove('menu-first-loading');
    },420);
  }
  function track(promise){
    total++;
    updateProgress();
    const settled=()=>{done++;updateProgress();finishIfReady();};
    Promise.resolve(promise).then(settled,settled);
    return promise;
  }
  // game.js registra sus texturas y la preparacion final de fuentes y caches.
  window.GalaxyGraphicsLoader={track};
  const assets=[
    isMobile?'assets/sprites/INTRO_MOBILE.png':'assets/sprites/INTRO.png',
    'assets/sprites/asteroide1.png','assets/sprites/asteroide2.png',
    'assets/sprites/asteroide3.png','assets/sprites/asteroide5.png',
    'assets/sprites/asteroide6.png','assets/sprites/asteroidegrande_270.png'
  ];
  function decodeWithTimeout(im,timeoutMs){
    return new Promise(resolve=>{
      let settled=false;
      const done=()=>{if(settled)return;settled=true;window.clearTimeout(timer);resolve();};
      const timer=window.setTimeout(done,timeoutMs);
      try{
        if(typeof im.decode!=='function'){done();return;}
        const p=im.decode();
        if(p&&typeof p.then==='function')p.then(done,done);
        else done();
      }catch(_){done();}
    });
  }
  for(const src of assets){
    track(new Promise(resolve=>{
      const im=new Image();
      im.decoding='async';
      let settled=false;
      const done=()=>{if(settled)return;settled=true;window.clearTimeout(loadTimer);resolve();};
      const loadTimer=window.setTimeout(done,isMobile?8000:12000);
      im.onload=()=>{decodeWithTimeout(im,isMobile?1200:2500).then(done,done);};
      im.onerror=done;
      im.src=src;
    }));
  }
  function completeRegistration(){registrationComplete=true;finishIfReady();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',completeRegistration,{once:true});
  else completeRegistration();
})();
