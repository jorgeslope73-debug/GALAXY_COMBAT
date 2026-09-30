'use strict';
(() => {
  const FIRST_KEY='galaxyMenuGraphicsReadyV1';
  const loader=document.getElementById('menuFirstLoader');
  if(!loader)return;

  const progressEl=document.getElementById('menuFirstLoaderProgress');
  const barEl=document.getElementById('menuFirstLoaderBar');
  const labelEl=document.getElementById('menuFirstLoaderLabel');

  let firstVisit=true;
  try{firstVisit=localStorage.getItem(FIRST_KEY)!=='1';}catch(_){}

  const assets=[
    'assets/sprites/INTRO.png?v=V20.13',
    'assets/sprites/asteroide1.png?v=V20.13',
    'assets/sprites/asteroide2.png?v=V20.13',
    'assets/sprites/asteroide3.png?v=V20.13',
    'assets/sprites/asteroide5.png?v=V20.13',
    'assets/sprites/asteroide6.png?v=V20.13',
    'assets/sprites/asteroidegrande_270.png?v=V20.13'
  ];

  function setProgress(done,total){
    const pct=Math.max(0,Math.min(100,Math.round((done/Math.max(1,total))*100)));
    if(progressEl)progressEl.textContent=pct+'%';
    if(barEl)barEl.style.transform='scaleX('+(pct/100)+')';
  }

  function hideLoader(){
    loader.classList.add('is-ready');
    window.setTimeout(()=>{
      loader.hidden=true;
      document.documentElement.classList.remove('menu-first-loading');
    },420);
  }

  if(!firstVisit){
    loader.hidden=true;
    document.documentElement.classList.remove('menu-first-loading');
    return;
  }

  document.documentElement.classList.add('menu-first-loading');
  loader.hidden=false;
  if(labelEl)labelEl.textContent='CARGANDO GRAFICOS...';
  setProgress(0,assets.length);

  let finished=false;
  const finish=()=>{
    if(finished)return;
    finished=true;
    try{localStorage.setItem(FIRST_KEY,'1');}catch(_){}
    setProgress(assets.length,assets.length);
    hideLoader();
  };

  let done=0;
  const oneDone=()=>{
    done++;
    setProgress(done,assets.length);
    if(done>=assets.length)finish();
  };

  for(const src of assets){
    const im=new Image();
    im.decoding='async';
    im.onload=()=>{
      if(typeof im.decode==='function'){
        im.decode().catch(()=>{}).finally(oneDone);
      }else oneDone();
    };
    im.onerror=oneDone;
    im.src=src;
  }

  // Seguridad: una imagen corrupta/lenta nunca debe dejar bloqueado el juego.
  window.setTimeout(finish,8000);
})();