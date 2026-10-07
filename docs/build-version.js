'use strict';
(() => {
  // ÚNICA fuente runtime de versión de GALAXY COMBAT.
  // En futuras versiones solo debe cambiar esta línea.
  const VERSION='V22.39';
  const root=typeof self!=='undefined'?self:globalThis;
  const versioned=src=>src+(src.includes('?')?'&':'?')+'v='+encodeURIComponent(VERSION);

  const HEAD_LINKS=[
    {rel:'manifest',href:'manifest.webmanifest'},
    {rel:'apple-touch-icon',href:'assets/icons/apple-touch-icon.png'},
    {rel:'stylesheet',href:'style.css'},
    {rel:'stylesheet',href:'menu-portada.css'},
    {rel:'stylesheet',href:'voz.css'}
  ];

  const RUNTIME_SCRIPTS=[
    'config.js',
    'menu-loader.js',
    'menu-decor.js',
    'i18n.js',
    'campaign-config.js',
    'manual.js',
    'impactos.js',
    'voz.js',
    'auth.js',
    'ranking.js',
    'physics-core.js',
    'local-cpu.js',
    'host-physics.js',
    'p2p-network.js',
    'game.js',
    'pwa.js'
  ];

  function writeHeadAssets(){
    if(typeof document==='undefined'||document.readyState!=='loading')return false;
    document.write(HEAD_LINKS.map(item=>{
      const href=versioned(item.href);
      return '<link rel="'+item.rel+'" href="'+href+'">';
    }).join(''));
    return true;
  }

  function loadRuntime(){
    if(typeof document==='undefined')return false;
    const badge=document.getElementById('buildVersion');
    if(badge)badge.textContent=VERSION;

    if(document.readyState==='loading'){
      document.write(RUNTIME_SCRIPTS.map(src=>'<script src="'+versioned(src)+'"><\\/script>').join(''));
      return true;
    }

    // Fallback si en el futuro se invoca tras terminar el parseo del documento.
    let chain=Promise.resolve();
    for(const src of RUNTIME_SCRIPTS){
      chain=chain.then(()=>new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=versioned(src);
        script.async=false;
        script.onload=resolve;
        script.onerror=reject;
        document.head.appendChild(script);
      }));
    }
    root.GALAXY_BUILD_READY=chain;
    return true;
  }

  root.GALAXY_BUILD=Object.freeze({
    version:VERSION,
    versioned,
    writeHeadAssets,
    loadRuntime
  });

  // El testigo visual no depende ya de loadRuntime().
  if(typeof document!=='undefined'){
    const applyBadge=()=>{
      const badge=document.getElementById('buildVersion');
      if(badge)badge.textContent=VERSION;
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBadge,{once:true});
    else applyBadge();
  }
})();
