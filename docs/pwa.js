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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update().catch(() => {}))
      .catch(err => console.warn('[PWA] Service worker no disponible:', err));
  });
})();