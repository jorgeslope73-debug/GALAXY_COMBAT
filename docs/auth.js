'use strict';
(() => {
  const STORAGE_KEY='galaxyCombatAuthTokenV1';
  const apiBase=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').replace(/\/$/,'');
  const $=id=>document.getElementById(id);
  const loginOpen=$('authLoginOpen'),registerOpen=$('authRegisterOpen'),userOpen=$('authUserOpen');
  const dialog=$('authDialog'),closeBtn=$('authClose'),title=$('authDialogTitle'),message=$('authMessage');
  const loginForm=$('authLoginForm'),registerForm=$('authRegisterForm'),accountPanel=$('authAccountPanel');
  const nameField=$('name');
  let token='';
  let user=null;

  const text={
    es:{login:'INICIO',register:'REGÍSTRATE Y PUNTÚA',loginTitle:'INICIO DE SESION',registerTitle:'REGISTRO',name:'NOMBRE',email:'CORREO',password:'CLAVE',repeat:'REPETIR CLAVE',enter:'ENTRAR',create:'CREAR CUENTA',logout:'CERRAR SESION',mismatch:'Las dos claves no coinciden.',working:'Conectando...',account:'CUENTA',invalid:'No se pudo iniciar sesion.',created:'Cuenta creada.',unavailable:'El servicio de cuentas no esta configurado todavia.'},
    en:{login:'LOGIN',register:'REGISTER AND SCORE',loginTitle:'LOGIN',registerTitle:'REGISTER',name:'NAME',email:'EMAIL',password:'PASSWORD',repeat:'REPEAT PASSWORD',enter:'LOGIN',create:'CREATE ACCOUNT',logout:'LOG OUT',mismatch:'The two passwords do not match.',working:'Connecting...',account:'ACCOUNT',invalid:'Could not log in.',created:'Account created.',unavailable:'The account service is not configured yet.'},
    it:{login:'ACCESSO',register:'REGISTRATI E FAI PUNTI',loginTitle:'ACCESSO',registerTitle:'REGISTRO',name:'NOME',email:'EMAIL',password:'PASSWORD',repeat:'RIPETI PASSWORD',enter:'ENTRA',create:'CREA ACCOUNT',logout:'ESCI ACCOUNT',mismatch:'Le due password non coincidono.',working:'Connessione...',account:'ACCOUNT',invalid:'Accesso non riuscito.',created:'Account creato.',unavailable:'Il servizio account non e ancora configurato.'},
    fr:{login:'CONNEXION',register:'INSCRIS-TOI ET MARQUE',loginTitle:'CONNEXION',registerTitle:'INSCRIPTION',name:'NOM',email:'EMAIL',password:'MOT DE PASSE',repeat:'REPETER LE MOT DE PASSE',enter:'ENTRER',create:'CREER LE COMPTE',logout:'DECONNEXION',mismatch:'Les deux mots de passe ne correspondent pas.',working:'Connexion...',account:'COMPTE',invalid:'Connexion impossible.',created:'Compte cree.',unavailable:'Le service de comptes n est pas encore configure.'},
    de:{login:'ANMELDEN',register:'REGISTRIEREN & PUNKTEN',loginTitle:'ANMELDEN',registerTitle:'REGISTRIEREN',name:'NAME',email:'E-MAIL',password:'PASSWORT',repeat:'PASSWORT WIEDERHOLEN',enter:'ANMELDEN',create:'KONTO ERSTELLEN',logout:'ABMELDEN',mismatch:'Die Passwoerter stimmen nicht ueberein.',working:'Verbinden...',account:'KONTO',invalid:'Anmeldung fehlgeschlagen.',created:'Konto erstellt.',unavailable:'Der Kontodienst ist noch nicht eingerichtet.'}
  };
  function lang(){const l=window.GalaxyI18n&&GalaxyI18n.getLanguage?GalaxyI18n.getLanguage():'es';return text[l]?l:'es';}
  function tr(k){return text[lang()][k]||text.es[k]||k;}
  function setMessage(v,kind=''){message.textContent=String(v||'');message.className='auth-message'+(kind?' '+kind:'');}
  function saveToken(v){token=String(v||'');try{token?localStorage.setItem(STORAGE_KEY,token):localStorage.removeItem(STORAGE_KEY);}catch(_){}}
  function loadToken(){try{return localStorage.getItem(STORAGE_KEY)||'';}catch(_){return '';}}
  async function api(path,{method='GET',body=null,auth=true}={}){
    if(!apiBase)throw new Error('NO_SERVER');
    const headers={};if(body)headers['Content-Type']='application/json';if(auth&&token)headers.Authorization='Bearer '+token;
    const res=await fetch(apiBase+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
    let data={};try{data=await res.json();}catch(_){data={ok:false};}
    if(!res.ok){const err=new Error(data.message||data.code||'ERROR');err.code=data.code;throw err;}
    return data;
  }
  function applyUser(next){
    user=next||null;
    const logged=!!user;
    loginOpen.classList.toggle('hidden',logged);registerOpen.classList.toggle('hidden',logged);userOpen.classList.toggle('hidden',!logged);
    if(logged){
      userOpen.textContent='✓ '+user.username;
      if(nameField){nameField.value=user.username;nameField.readOnly=true;nameField.classList.add('registered-name');}
    }else if(nameField){nameField.readOnly=false;nameField.classList.remove('registered-name');}
    window.dispatchEvent(new CustomEvent('galaxy-authchange',{detail:{user}}));
  }
  function show(mode){
    setMessage('');
    loginForm.classList.toggle('hidden',mode!=='login');
    registerForm.classList.toggle('hidden',mode!=='register');
    accountPanel.classList.toggle('hidden',mode!=='account');
    title.textContent=mode==='login'?tr('loginTitle'):mode==='register'?tr('registerTitle'):tr('account');
    if(mode==='account'&&user){$('authAccountName').textContent=user.username;$('authAccountEmail').textContent=user.email||'';}
    dialog.classList.remove('hidden');
    requestAnimationFrame(()=>{const el=mode==='login'?$('authLoginName'):mode==='register'?$('authRegisterName'):closeBtn;el&&el.focus({preventScroll:true});});
  }
  function hide(){dialog.classList.add('hidden');setMessage('');}
  function updateLanguage(){
    loginOpen.textContent=tr('login');registerOpen.textContent=tr('register');registerOpen.setAttribute('aria-label',tr('register'));
    $('authLoginNameLabel').textContent=tr('name');$('authLoginPasswordLabel').textContent=tr('password');$('authLoginSubmit').textContent=tr('enter');
    $('authRegisterNameLabel').textContent=tr('name');$('authRegisterEmailLabel').textContent=tr('email');$('authRegisterPasswordLabel').textContent=tr('password');$('authRegisterRepeatLabel').textContent=tr('repeat');$('authRegisterSubmit').textContent=tr('create');$('authLogout').textContent=tr('logout');
  }
  loginOpen.addEventListener('click',()=>show('login'));registerOpen.addEventListener('click',()=>show('register'));userOpen.addEventListener('click',()=>show('account'));
  closeBtn.addEventListener('click',hide);dialog.addEventListener('pointerdown',e=>{if(e.target===dialog)hide();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.classList.contains('hidden'))hide();},true);
  window.addEventListener('galaxy-languagechange',updateLanguage);

  loginForm.addEventListener('submit',async e=>{
    e.preventDefault();setMessage(tr('working'));
    try{
      const data=await api('/api/auth/login',{method:'POST',auth:false,body:{username:$('authLoginName').value,password:$('authLoginPassword').value}});
      saveToken(data.token);applyUser(data.user);$('authLoginPassword').value='';hide();
    }catch(err){setMessage(err.code==='DB_NOT_CONFIGURED'?tr('unavailable'):(err.message||tr('invalid')),'error');}
  });
  registerForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const pass=$('authRegisterPassword').value,repeat=$('authRegisterRepeat').value;
    if(pass!==repeat){setMessage(tr('mismatch'),'error');return;}
    setMessage(tr('working'));
    try{
      const data=await api('/api/auth/register',{method:'POST',auth:false,body:{username:$('authRegisterName').value,email:$('authRegisterEmail').value,password:pass}});
      saveToken(data.token);applyUser(data.user);$('authRegisterPassword').value='';$('authRegisterRepeat').value='';hide();
    }catch(err){setMessage(err.code==='DB_NOT_CONFIGURED'?tr('unavailable'):(err.message||String(err.code||'ERROR')),'error');}
  });
  $('authLogout').addEventListener('click',async()=>{
    try{if(token)await api('/api/auth/logout',{method:'POST'});}catch(_){}
    saveToken('');applyUser(null);hide();
  });

  async function restore(){
    token=loadToken();if(!token){applyUser(null);return;}
    try{const data=await api('/api/auth/me');applyUser(data.user);}catch(_){saveToken('');applyUser(null);}
  }
  window.GalaxyAuth={getToken:()=>token,getUser:()=>user,isLoggedIn:()=>!!user};
  updateLanguage();restore();
})();
