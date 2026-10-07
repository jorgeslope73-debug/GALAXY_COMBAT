(() => {
  const installBtn=document.getElementById('orientationInstallGame');
  const installCopy=document.getElementById('orientationInstallCopy');
  const isHandheld=document.documentElement.classList.contains('handheld-device')
    || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
  const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')
    || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let deferredPrompt=null;
  const tr=(key,fallback)=>{
    try{
      if(window.GalaxyI18n&&typeof window.GalaxyI18n.t==='function')return window.GalaxyI18n.t(key);
    }catch(_){}
    return fallback;
  };

  function isInstalled(){
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || navigator.standalone===true;
  }

  function showInstallMessage(text){
    const toast=document.getElementById('shareToast');
    if(toast){
      toast.textContent=String(text||'');
      toast.classList.remove('hidden');
      clearTimeout(showInstallMessage.timer);
      showInstallMessage.timer=setTimeout(()=>toast.classList.add('hidden'),6500);
    }else{
      alert(String(text||''));
    }
  }

  function refreshInstallButton(){
    const hideInstall=!isHandheld||isInstalled();
    if(installBtn)installBtn.classList.toggle('pwa-hidden',hideInstall);
    if(installCopy)installCopy.classList.toggle('pwa-hidden',hideInstall);
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    refreshInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    refreshInstallButton();
    showInstallMessage(tr('pwaInstalled','GALAXY COMBAT INSTALADO.'));
  });

  if(installBtn){
    installBtn.addEventListener('click',async()=>{
      if(isInstalled()){
        refreshInstallButton();
        return;
      }
      if(deferredPrompt){
        const prompt=deferredPrompt;
        deferredPrompt=null;
        try{
          await prompt.prompt();
          await prompt.userChoice;
        }catch(_){}
        refreshInstallButton();
        return;
      }
      if(isIOS){
        showInstallMessage(tr('pwaIosInstall','EN IPHONE/IPAD: PULSA COMPARTIR Y DESPUES AÑADIR A PANTALLA DE INICIO.'));
      }else{
        showInstallMessage(tr('pwaBrowserInstall','ABRE EL MENU DEL NAVEGADOR Y ELIGE AÑADIR A PANTALLA DE INICIO.'));
      }
    });
  }

  refreshInstallButton();

  if (!('serviceWorker' in navigator)) return;

  // V20.90: una actualizacion nunca puede recargar la pagina mientras hay
  // una sala, partida o pantalla de victoria activa. El nuevo SW puede quedar
  // controlando la pagina, pero la recarga se aplaza hasta volver al menu.
  let reloadingForUpdate=false;
  let pendingUpdateReload=false;

  function safeToReloadForUpdate(){
    const menu=document.getElementById('menu');
    return !!(menu&&!menu.classList.contains('hidden'));
  }

  function reloadForPendingUpdate(){
    if(reloadingForUpdate||!pendingUpdateReload||!safeToReloadForUpdate())return false;
    reloadingForUpdate=true;
    pendingUpdateReload=false;
    location.reload();
    return true;
  }

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloadingForUpdate)return;
    pendingUpdateReload=true;
    reloadForPendingUpdate();
  });

  const mainMenu=document.getElementById('menu');
  if(mainMenu&&typeof MutationObserver==='function'){
    const menuObserver=new MutationObserver(()=>reloadForPendingUpdate());
    menuObserver.observe(mainMenu,{attributes:true,attributeFilter:['class']});
  }

  async function refreshServiceWorker(){
    try{
      const reg=await navigator.serviceWorker.getRegistration('./');
      if(reg)await reg.update();
    }catch(_){}
  }

  window.addEventListener('load', () => {
    const swUrl=(window.GALAXY_BUILD&&typeof window.GALAXY_BUILD.versioned==='function')
      ?window.GALAXY_BUILD.versioned('./sw.js')
      :'./sw.js?v=V22.27';
    navigator.serviceWorker.register(swUrl,{updateViaCache:'none',scope:'./'})
      .then(async reg=>{
        try{await reg.update();}catch(_){}
      })
      .catch(err => console.warn('[PWA] Service worker no disponible:', err));
  });

  // Al volver a la pestaña o ventana, comprobar si GitHub Pages ya tiene una
  // version nueva. Es barato y evita mantener una PWA abierta con version vieja.
  window.addEventListener('focus',refreshServiceWorker);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshServiceWorker();});
})();