'use strict';
(() => {
  const apiBase=String((window.GALAXY_CONFIG&&window.GALAXY_CONFIG.serverUrl)||'').replace(/\/$/,'');
  const $=id=>document.getElementById(id);
  const openBtn=$('rankingOpen'),dialog=$('rankingDialog'),closeBtn=$('rankingClose');
  const rowsEl=$('rankingRows'),message=$('rankingMessage');
  const listView=$('rankingListView'),detail=$('rankingDetail'),backBtn=$('rankingBack');
  if(!openBtn||!dialog||!closeBtn||!rowsEl||!message||!listView||!detail||!backBtn)return;

  let rankingData=[];

  const text={
    es:{ranking:'RANKING',position:'PUESTO',player:'JUGADOR',wins:'VICTORIAS',losses:'DERROTAS',played:'PARTIDAS',back:'← VOLVER',loading:'CARGANDO...',empty:'TODAVIA NO HAY JUGADORES EN EL RANKING.',error:'NO SE PUDO CARGAR EL RANKING.'},
    en:{ranking:'RANKING',position:'PLACE',player:'PLAYER',wins:'WINS',losses:'LOSSES',played:'MATCHES',back:'← BACK',loading:'LOADING...',empty:'THERE ARE NO PLAYERS IN THE RANKING YET.',error:'THE RANKING COULD NOT BE LOADED.'},
    it:{ranking:'CLASSIFICA',position:'POS.',player:'GIOCATORE',wins:'VITTORIE',losses:'SCONFITTE',played:'PARTITE',back:'← INDIETRO',loading:'CARICAMENTO...',empty:'NON CI SONO ANCORA GIOCATORI IN CLASSIFICA.',error:'IMPOSSIBILE CARICARE LA CLASSIFICA.'},
    fr:{ranking:'CLASSEMENT',position:'PLACE',player:'JOUEUR',wins:'VICTOIRES',losses:'DEFAITES',played:'PARTIES',back:'← RETOUR',loading:'CHARGEMENT...',empty:'AUCUN JOUEUR DANS LE CLASSEMENT POUR LE MOMENT.',error:'IMPOSSIBLE DE CHARGER LE CLASSEMENT.'},
    de:{ranking:'RANGLISTE',position:'PLATZ',player:'SPIELER',wins:'SIEGE',losses:'NIEDERLAGEN',played:'SPIELE',back:'← ZURUCK',loading:'LADEN...',empty:'NOCH KEINE SPIELER IN DER RANGLISTE.',error:'RANGLISTE KONNTE NICHT GELADEN WERDEN.'}
  };
  function lang(){const l=window.GalaxyI18n&&GalaxyI18n.getLanguage?GalaxyI18n.getLanguage():'es';return text[l]?l:'es';}
  function tr(k){return text[lang()][k]||text.es[k]||k;}
  function updateLanguage(){
    openBtn.textContent=tr('ranking');$('rankingTitle').textContent=tr('ranking');
    $('rankingColPosition').textContent=tr('position');$('rankingColPlayer').textContent=tr('player');
    $('rankingDetailPositionLabel').textContent=tr('position');$('rankingDetailWinsLabel').textContent=tr('wins');
    $('rankingDetailLossesLabel').textContent=tr('losses');$('rankingDetailPlayedLabel').textContent=tr('played');
    backBtn.textContent=tr('back');
  }
  function setMessage(v,kind=''){message.textContent=String(v||'');message.className='ranking-message'+(kind?' '+kind:'');}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function showList(){detail.classList.add('hidden');listView.classList.remove('hidden');}
  function showDetail(row){
    if(!row)return;
    $('rankingDetailPosition').textContent='#'+(Number(row.position)||0);
    $('rankingDetailPlayer').textContent=String(row.username||'');
    $('rankingDetailWins').textContent=String(Number(row.wins)||0);
    $('rankingDetailLosses').textContent=String(Number(row.losses)||0);
    $('rankingDetailPlayed').textContent=String(Number(row.played)||0);
    listView.classList.add('hidden');detail.classList.remove('hidden');
    requestAnimationFrame(()=>backBtn.focus({preventScroll:true}));
  }
  async function load(){
    rankingData=[];rowsEl.innerHTML='';showList();setMessage(tr('loading'));
    if(!apiBase){setMessage(tr('error'),'error');return;}
    try{
      const res=await fetch(apiBase+'/api/ranking',{cache:'no-store'});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.ok)throw new Error(data.message||data.code||'ERROR');
      rankingData=Array.isArray(data.ranking)?data.ranking:[];
      if(!rankingData.length){setMessage(tr('empty'));return;}
      const me=window.GalaxyAuth&&typeof window.GalaxyAuth.getUser==='function'?window.GalaxyAuth.getUser():null;
      const myName=me&&me.username?String(me.username).toLowerCase():'';
      rowsEl.innerHTML=rankingData.map((row,index)=>{
        const mine=myName&&String(row.username||'').toLowerCase()===myName?' class="ranking-me"':'';
        return `<tr${mine}><td class="rank-pos">${Number(row.position)||0}</td><td class="rank-player"><button class="rank-player-btn" type="button" data-rank-index="${index}">${esc(row.username)}</button></td></tr>`;
      }).join('');
      setMessage('');
    }catch(err){console.error('[Galaxy Combat] Ranking:',err);setMessage(tr('error'),'error');}
  }
  function show(){dialog.classList.remove('hidden');showList();load();requestAnimationFrame(()=>closeBtn.focus({preventScroll:true}));}
  function hide(){dialog.classList.add('hidden');showList();}
  openBtn.addEventListener('click',show);closeBtn.addEventListener('click',hide);backBtn.addEventListener('click',showList);
  rowsEl.addEventListener('click',e=>{
    const btn=e.target.closest('.rank-player-btn');
    if(!btn)return;
    const index=Number(btn.dataset.rankIndex);
    if(Number.isInteger(index)&&rankingData[index])showDetail(rankingData[index]);
  });
  dialog.addEventListener('pointerdown',e=>{if(e.target===dialog)hide();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.classList.contains('hidden')){if(!detail.classList.contains('hidden'))showList();else hide();}},true);
  window.addEventListener('galaxy-languagechange',updateLanguage);
  updateLanguage();
})();
