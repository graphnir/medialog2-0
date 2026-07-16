// ml-core.js — État global, utilitaires, sauvegarde, routing, auth, modales
'use strict';

// ── État global ───────────────────────────────────────────
let state={categories:[]}, currentUser=null, activeCatId=null;
let searchQuery='', sortKey='', sortDir='desc';
let viewMode='cards', cardLayout='cards-list';
let calBrokenOpen=false, calBrokenExpanded=new Set();
let dateOrder='DM';
let filterFav=false, filterStatus='all';
let saveTimer=null, saveStatus='saved';
let tempCatColor='#7C6FE0', tempNewCols=[], tempColumns=[], previewLayout=null, tempWikiEnabled=false, tempWikiMediaType='generic';
let colDragSrcIdx=null, colDragOverIdx=null;
let entryDragSrcId=null, entryDragOverId=null;
let editingEntryId=null;
let tableSelectMode=false, tableSelected=new Set();
let searchDebounce=null;
let filterTag='';
let mlHistory=[];
let tutorialSteps=[];

// ── Utilitaires ───────────────────────────────────────────
const uid=()=>Math.random().toString(36).slice(2,10);
const getCat=id=>state.categories.find(c=>c.id===id);
const getActiveCat=()=>getCat(activeCatId);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function formatDate(str){if(!str)return'';const[y,m,d]=str.split('-').map(Number);if(!y)return str;return new Date(y,m-1,d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}
function todayStr(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const STAT_TYPES=[
  {key:'total',label:'Total'},
  {key:'moyenne',label:'Moyenne'},
  {key:'favoris',label:'Favoris'},
  {key:'a_voir',label:'À voir'},
  {key:'vus',label:'Vus'},
  {key:'ce_mois',label:'Ajoutés ce mois'},
  {key:'cette_annee',label:'Ajoutés cette année'},
];
function getCatStatsConfig(cat){
  if(Array.isArray(cat.statsConfig))return cat.statsConfig;
  if(cat.showStats===false)return [];
  return ['total','moyenne','favoris'];
}
const FR_MONTHS={janvier:1,janv:1,fevrier:2,fevr:2,fev:2,mars:3,avril:4,avr:4,mai:5,juin:6,juillet:7,juil:7,aout:8,septembre:9,sept:9,octobre:10,oct:10,novembre:11,nov:11,decembre:12,dec:12};
function stripAccents(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function toInputDate(str){
  if(!str)return'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(str)){
    const[a,b,y]=str.split('/').map(Number);
    let day=dateOrder==='MD'?b:a, month=dateOrder==='MD'?a:b;
    if(month>12&&day<=12){[day,month]=[month,day];}
    return`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const fm=str.match(/^(\d{1,2})(?:er)?\s+([a-zûéèA-ZÛÉÈ.]+)\.?\s+(\d{4})$/);
  if(fm){const mo=FR_MONTHS[stripAccents(fm[2].toLowerCase().replace(/\.$/,''))];if(mo)return`${fm[3]}-${String(mo).padStart(2,'0')}-${fm[1].padStart(2,'0')}`;}
  return'';
}
function guessDate(str){
  if(!str)return null;
  const iso=toInputDate(str);if(iso)return iso;
  let m=str.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){let[,a,b,y]=m;y=y.length===2?'20'+y:y;a=+a;b=+b;let day=dateOrder==='MD'?b:a,month=dateOrder==='MD'?a:b;if(month>12&&day<=12){[day,month]=[month,day];}if(day>=1&&day<=31&&month>=1&&month<=12)return`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  m=str.match(/(\d{1,2})(?:er)?\s+([a-zûéèA-ZÛÉÈ.]+)\.?\s+(\d{4})/);
  if(m){const mo=FR_MONTHS[stripAccents(m[2].toLowerCase().replace(/\.$/,''))];if(mo)return`${m[3]}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
  m=str.match(/\b(19|20)\d{2}\b/);
  if(m)return`${m[0]}-01-01`;
  return null;
}
function parseDate(str){
  if(!str)return 0;
  if(/^\d{4}-\d{2}-\d{2}$/.test(str)){const[y,m,d]=str.split('-').map(Number);return new Date(y,m-1,d).getTime();}
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(str)){const[d,m,y]=str.split('/').map(Number);return new Date(y,m-1,d).getTime();}
  const t=new Date(str).getTime();return isNaN(t)?0:t;
}
function isUnseen(e){const s=(e.statut||'').toLowerCase();return s.includes('à voir')||s.includes('à faire')||s.includes('à lire')||s.includes('à paraître');}
function renderMd(text){if(!text)return'';return esc(text).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/^- (.+)/gm,'<li>$1</li>').replace(/<li>/g,'<ul><li>').replace(/<\/li>(?![\s\S]*<li>)/g,'</li></ul>').replace(/\n\n/g,'</p><p>').replace(/^(?!<)/gm,'<p>').replace(/$(?!>)/gm,'</p>').replace(/<p><\/p>/g,'');}

// ── Sauvegarde auto ───────────────────────────────────────
function scheduleSave(){
  saveStatus='saving'; updateSaveIndicator();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{await API.saveData(state.categories);saveStatus='saved';}
    catch(e){saveStatus='error';console.error(e);}
    updateSaveIndicator();
  },1500);
}
function updateSaveIndicator(){
  const el=document.getElementById('save-indicator');
  if(!el)return;
  const map={saving:'💾 Sauvegarde…',saved:'✓ Sauvegardé',error:'⚠ Erreur'};
  el.textContent=map[saveStatus]||'';
  el.className=`save-indicator save-${saveStatus}`;
}

// ── Routing ───────────────────────────────────────────────
async function route(){
  // Charger le thème sauvegardé immédiatement (préchargement optimiste via dernier utilisateur connu)
  const lastUid=localStorage.getItem('ml_last_uid');
  const themeKey=lastUid?'ml_theme_'+lastUid:'ml_theme';
  const varsKey=lastUid?'ml_custom_vars_'+lastUid:'ml_custom_vars';
  const savedTheme=localStorage.getItem(themeKey)||'nuit';
  const savedVars=JSON.parse(localStorage.getItem(varsKey)||'{}');
  if(savedTheme!=='nuit'){
    document.documentElement.dataset.theme=savedTheme;
    Object.entries(savedVars).forEach(([k,v])=>document.documentElement.style.setProperty('--'+k,v));
  }
  const path=window.location.pathname;
  if(path==='/confirm')return showConfirmPage();
  const shareMatch=path.match(/^\/share\/([a-zA-Z0-9-]+)$/i);
  if(shareMatch)return initSharePage(shareMatch[1]);
  try{applySiteConfig(await API.getConfig());}catch{}
  if(!API.isLoggedIn()){showPage('auth');initAuthPage();return;}
  try{
    currentUser=await API.me();
    migrateLegacyPrefs();
    localStorage.setItem('ml_last_uid',currentUser.id);
    if(typeof loadSavedTheme==='function')loadSavedTheme();
    const data=await API.getData();
    state.categories=data.categories||[];
    restoreActiveCat();
    restoreDateOrder();
    if(currentUser.deletion_scheduled_for && new Date(currentUser.deletion_scheduled_for) > new Date()){
      showDeletionPendingPage();
      return;
    }
    try{tutorialSteps=await API.getTutorial();}catch{tutorialSteps=[];}
    showPage('app');initApp();
  }catch(e){console.error('[route] échec chargement app:',e);API.clearTokens();showPage('auth');initAuthPage();}
}

function showPage(name){['auth','app','share','confirm','deletion'].forEach(p=>{const el=document.getElementById(`page-${p}`);if(el)el.style.display=p===name?'':'none';});}

async function showConfirmPage(){
  showPage('confirm');
  const content=document.getElementById('confirm-content');
  const params=new URLSearchParams(window.location.search);
  const token_hash=params.get('token_hash');
  const type=params.get('type');
  const hashParams=new URLSearchParams(window.location.hash.slice(1));
  const accessToken=hashParams.get('access_token');
  const refreshToken=hashParams.get('refresh_token');
  if(type==='recovery'&&token_hash){
    try{await API.verifyOtp(token_hash,'recovery');}
    catch(e){content.innerHTML=`<div style="font-size:64px;">❌</div><h2 class="auth-title">Lien invalide</h2><p style="color:var(--text2);margin-bottom:20px;">${esc(e.message||'Lien expiré.')}</p><a href="/" class="btn btn-primary">Retour</a>`;return;}
    content.innerHTML=`<div style="font-size:64px;margin-bottom:16px;">🔑</div><h2 class="auth-title">Nouveau mot de passe</h2><p style="color:var(--text2);margin-bottom:20px;">Tu peux maintenant définir un nouveau mot de passe.</p><input type="password" id="new-pw-reset" class="field-input" placeholder="8 caractères minimum" style="margin-bottom:12px;"/><div id="pw-reset-error" class="auth-error" style="display:none;"></div><button class="btn btn-primary" id="btn-pw-reset" style="width:100%;">Enregistrer</button>`;
    document.getElementById('btn-pw-reset').addEventListener('click',async()=>{
      const pw=document.getElementById('new-pw-reset').value;
      const err=document.getElementById('pw-reset-error');err.style.display='none';
      try{await API.updatePassword(pw);content.innerHTML=`<div style="font-size:64px;">✅</div><h2 class="auth-title">Mot de passe mis à jour !</h2><p style="margin-top:12px;"><a href="/" class="btn btn-primary">Se connecter</a></p>`;}
      catch(e){err.textContent=e.message;err.style.display='';}
    });
  }else if((type==='email'||type==='signup')&&token_hash){
    try{await API.verifyOtp(token_hash,type==='signup'?'signup':'email');content.innerHTML=`<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Compte confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Tu peux maintenant te connecter.</p><a href="/" class="btn btn-primary">Se connecter</a>`;}
    catch(e){content.innerHTML=`<div style="font-size:64px;">❌</div><h2 class="auth-title">Lien invalide</h2><p style="color:var(--text2);margin-bottom:20px;">${esc(e.message||'Lien expiré.')}</p><a href="/" class="btn btn-primary">Retour</a>`;}
  }else if(accessToken&&refreshToken){
    content.innerHTML=`<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Compte confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Tu peux maintenant te connecter.</p><a href="/" class="btn btn-primary">Se connecter</a>`;
  }else{
    content.innerHTML=`<div style="font-size:64px;margin-bottom:16px;">✅</div><h2 class="auth-title">Email confirmé !</h2><p style="color:var(--text2);margin-bottom:24px;">Tu peux maintenant te connecter.</p><a href="/" class="btn btn-primary">Se connecter</a>`;
  }
}

let siteConfig=null;
function applySiteConfig(cfg){
  if(!cfg)return;
  siteConfig=cfg;
  const name=cfg.site_name||'MediaLog',logo=cfg.site_logo||'ML',sub=cfg.site_subtitle||'Mon journal culturel';
  const banner=document.getElementById('staging-banner');
  if(banner){
    const on=cfg.staging_banner_enabled==='true';
    banner.style.display=on?'':'none';
    if(on){
      document.getElementById('staging-banner-text').textContent=cfg.staging_banner_text||'⚠️ Ceci est une version de test, pas le site principal.';
      const link=document.getElementById('staging-banner-link');
      if(cfg.staging_banner_link){link.href=cfg.staging_banner_link;link.style.display='';}
      else link.style.display='none';
    }
  }
  document.title=name;
  ['app-logo','auth-logo-text','share-logo'].forEach(id=>{const el=document.getElementById(id);if(!el)return;if(cfg.site_logo_url){el.innerHTML=`<img src="${esc(cfg.site_logo_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>`;el.style.padding='0';}else el.textContent=logo;});
  ['app-site-name','auth-site-name','share-site-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=name;});
  ['app-site-sub','auth-site-sub'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=sub;});
}

// ── Auth ──────────────────────────────────────────────────
function initAuthPage(){
  document.querySelectorAll('.auth-tab').forEach(tab=>tab.addEventListener('click',()=>{
    document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');
    document.getElementById('auth-login').style.display=tab.dataset.tab==='login'?'':'none';
    document.getElementById('auth-register').style.display=tab.dataset.tab==='register'?'':'none';
  }));
  document.getElementById('btn-login').addEventListener('click',async()=>{
    const email=document.getElementById('login-email').value.trim();
    const pw=document.getElementById('login-pw').value;
    const errEl=document.getElementById('login-error');errEl.style.display='none';
    const btn=document.getElementById('btn-login');btn.disabled=true;btn.textContent='Connexion…';
    try{
      await API.login(email,pw);
      currentUser=await API.me();
      migrateLegacyPrefs();
      localStorage.setItem('ml_last_uid',currentUser.id);
      if(typeof loadSavedTheme==='function')loadSavedTheme();
      const d=await API.getData();state.categories=d.categories||[];
      restoreActiveCat();
      restoreDateOrder();
      try{tutorialSteps=await API.getTutorial();}catch{tutorialSteps=[];}
      showPage('app');initApp();
    }catch(e){
      console.error('[login] échec:',e);
      errEl.textContent=e.message==='Email not confirmed'?'📧 Confirme ton email avant de te connecter.':e.message;
      errEl.style.display='';
    }finally{btn.disabled=false;btn.textContent='Se connecter';}
  });
  ['login-email','login-pw'].forEach(id=>document.getElementById(id)?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('btn-login').click();}));
  document.getElementById('btn-register').addEventListener('click',async()=>{
    const username=document.getElementById('reg-username').value.trim();
    const email=document.getElementById('reg-email').value.trim();
    const pw=document.getElementById('reg-pw').value;
    const errEl=document.getElementById('reg-error');errEl.style.display='none';
    if(!username||username.length<3){errEl.textContent='Pseudo trop court (3 car. min.)';errEl.style.display='';return;}
    if(!email.includes('@')){errEl.textContent='Email invalide.';errEl.style.display='';return;}
    if(pw.length<8){errEl.textContent='Mot de passe trop court (8 car. min.)';errEl.style.display='';return;}
    const btn=document.getElementById('btn-register');btn.disabled=true;btn.textContent='Inscription…';
    try{
      await API.register(username,email,pw);
      document.getElementById('auth-register').innerHTML=`<div class="auth-confirm-msg"><div style="font-size:48px;margin-bottom:16px;">📧</div><h3>Vérifie ta boîte mail !</h3><p>Un email de confirmation a été envoyé à <strong>${esc(email)}</strong>.</p><p style="margin-top:8px;color:var(--text3);">Clique sur le lien dans l'email pour activer ton compte, puis connecte-toi ici.</p></div>`;
    }catch(e){errEl.textContent=e.message;errEl.style.display='';}
    finally{btn.disabled=false;btn.textContent='Créer mon compte';}
  });
  // Boutons affichage mot de passe
  document.querySelectorAll('.pw-toggle').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const input=document.getElementById(btn.dataset.target);
      if(!input)return;
      input.type=input.type==='password'?'text':'password';
      btn.textContent=input.type==='password'?'👁':'🙈';
    });
  });
  document.getElementById('btn-forgot-pw')?.addEventListener('click',async()=>{
    const email=document.getElementById('login-email').value.trim();
    if(!email){alert("Saisis ton email d'abord.");return;}
    try{await API.resetPassword(email);alert('📧 Email envoyé !');}catch(e){alert(e.message);}
  });
}


function closeInlinePopup(){document.getElementById('active-inline-popup')?.remove();document.removeEventListener('click',outsidePopup);}

function outsidePopup(e){const p=document.getElementById('active-inline-popup');if(p&&!p.contains(e.target))closeInlinePopup();}

function userKey(base){return currentUser?base+'_'+currentUser.id:base;}
function migrateLegacyPrefs(){
  if(!currentUser)return;
  ['ml_active_cat','ml_sort_by_cat','ml_hide_broken_banner','ml_last_news','ml_theme','ml_custom_vars'].forEach(base=>{
    const scoped=userKey(base);
    if(localStorage.getItem(scoped)===null){
      const legacy=localStorage.getItem(base);
      if(legacy!==null)localStorage.setItem(scoped,legacy);
    }
  });
}

function restoreActiveCat(){
  const saved=localStorage.getItem(userKey('ml_active_cat'));
  activeCatId=(saved&&state.categories.find(c=>c.id===saved))?saved:(state.categories[0]?.id||null);
  loadSortForCat(activeCatId);
}

function restoreDateOrder(){dateOrder=localStorage.getItem(userKey('ml_date_order'))||'DM';}

function loadSortForCat(catId){
  try{
    const all=JSON.parse(localStorage.getItem(userKey('ml_sort_by_cat'))||'{}');
    const s=catId?all[catId]:null;
    sortKey=s?.key||'';sortDir=s?.dir||'desc';
  }catch{sortKey='';sortDir='desc';}
}

function saveSortForCat(catId){
  if(!catId)return;
  try{
    const all=JSON.parse(localStorage.getItem(userKey('ml_sort_by_cat'))||'{}');
    all[catId]={key:sortKey,dir:sortDir};
    localStorage.setItem(userKey('ml_sort_by_cat'),JSON.stringify(all));
  }catch{}
}

function loadCalColForCat(catId){
  try{
    const all=JSON.parse(localStorage.getItem(userKey('ml_cal_col_by_cat'))||'{}');
    return catId?(all[catId]||''):'';
  }catch{return'';}
}

function saveCalColForCat(catId,colId){
  if(!catId)return;
  try{
    const all=JSON.parse(localStorage.getItem(userKey('ml_cal_col_by_cat'))||'{}');
    all[catId]=colId;
    localStorage.setItem(userKey('ml_cal_col_by_cat'),JSON.stringify(all));
  }catch{}
}

function closeHelpPopup(){document.getElementById('active-help-popup')?.remove();document.removeEventListener('click',outsideHelp,true);}

function outsideHelp(e){const p=document.getElementById('active-help-popup');if(p&&!p.contains(e.target))closeHelpPopup();}

// ── Modales ───────────────────────────────────────────────
function openModal(id){
  closeInlinePopup();
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow='hidden';
  const m=document.getElementById(id);
  m.style.display='flex';
  requestAnimationFrame(()=>{
    m.classList.add('open');
    const body=m.querySelector('.modal-body');
    if(body)body.scrollTop=0;
  });
}
function closeModals(){
  closeHelpPopup();
  document.getElementById('modal-backdrop').classList.remove('open');
  document.body.style.overflow='';
  document.querySelectorAll('.modal').forEach(m=>{m.classList.remove('open');setTimeout(()=>{if(!m.classList.contains('open'))m.style.display='none';},300);});
}