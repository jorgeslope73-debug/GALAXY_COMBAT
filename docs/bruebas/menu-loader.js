'use strict';
(() => {
  const loader=document.getElementById('menuFirstLoader');
  if(!loader)return;
  const progressEl=document.getElementById('menuFirstLoaderProgress');
  const barEl=document.getElementById('menuFirstLoaderBar');
  const labelEl=document.getElementById('menuFirstLoaderLabel');
  let total=0,done=0,registrationComplete=false,finished=false;
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
  function finishIfReady(){
    if(finished||!registrationComplete||done<total)return;
    finished=true;
    window.clearTimeout(slowTimer);
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
  const isMobile=document.documentElement.classList.contains('handheld-device')||
    matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const assets=[
    isMobile?'assets/sprites/INTRO_MOBILE.png':'assets/sprites/INTRO.png',
    'assets/sprites/asteroide1.png','assets/sprites/asteroide2.png',
    'assets/sprites/asteroide3.png','assets/sprites/asteroide5.png',
    'assets/sprites/asteroide6.png','assets/sprites/asteroidegrande_270.png'
  ];
  for(const src of assets){
    track(new Promise(resolve=>{
      const im=new Image();
      im.decoding='async';
      im.onload=()=>{
        const decoded=typeof im.decode==='function'?im.decode():Promise.resolve();
        Promise.resolve(decoded).then(resolve,resolve);
      };
      im.onerror=resolve;
      im.src=src;
    }));
  }
  function completeRegistration(){registrationComplete=true;finishIfReady();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',completeRegistration,{once:true});
  else completeRegistration();
})();
