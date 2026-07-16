// ml-app.js — Init app, events statiques, boot
'use strict';

function openLegalModal(key,title){
  document.getElementById('modal-legal-title').textContent=title;
  const raw=siteConfig?.[key];
  document.getElementById('modal-legal-content').innerHTML=raw
    ? renderMd(raw)
    : '<p style="color:var(--text3);">Ce contenu n\'a pas encore été renseigné.</p>';
  openModal('modal-legal');
}

function initApp(){
  if(window.__appInitialized)return;
  window.__appInitialized=true;
  loadSavedTheme();
  updateUserAvatar();
  document.getElementById('btn-user-menu').addEventListener('click',e=>{e.stopPropagation();const m=document.getElementById('user-menu');m.style.display=m.style.display==='none'?'':'none';});
  document.getElementById('btn-user-menu-mobile')?.addEventListener('click',e=>{e.stopPropagation();const m=document.getElementById('user-menu');m.style.display=m.style.display==='none'?'':'none';});
  document.addEventListener('click',()=>{document.getElementById('user-menu').style.display='none';document.getElementById('fun-menu').style.display='none';document.getElementById('secondary-controls')?.classList.remove('secondary-controls-open');});
  document.getElementById('btn-logout').addEventListener('click',async()=>{await API.logout();location.reload();});
  document.getElementById('btn-history').addEventListener('click',openHistoryModal);
  document.getElementById('btn-share-settings').addEventListener('click',openShareModal);
  document.getElementById('btn-account-settings').addEventListener('click',()=>openAccountModal());
  document.getElementById('footer-contact')?.addEventListener('click',e=>{e.preventDefault();openSupportPage();});
  document.getElementById('btn-open-support-page')?.addEventListener('click',()=>openSupportPage());
  document.getElementById('btn-close-support')?.addEventListener('click',closeSupportPage);
  document.getElementById('support-page-tabs')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-support-tab]');if(!btn)return;
    switchSupportTab(btn.dataset.supportTab);
  });
  document.getElementById('footer-legal')?.addEventListener('click',e=>{e.preventDefault();openLegalModal('legal_mentions','Mentions légales');});
  document.getElementById('footer-privacy')?.addEventListener('click',e=>{e.preventDefault();openLegalModal('privacy_policy','Politique de confidentialité');});
  document.getElementById('btn-close-legal').addEventListener('click',closeModals);
  document.getElementById('btn-admin-panel').addEventListener('click',openAdminPage);
  document.getElementById('btn-roulette').addEventListener('click',openRouletteModal);
  document.getElementById('btn-tutorial').addEventListener('click',openTutorial);
  document.getElementById('btn-stats').addEventListener('click',openStatsModal);
  document.getElementById('btn-news').addEventListener('click',openNewsModal);
  document.getElementById('btn-museum')?.addEventListener('click',()=>{/* musée — pas encore construit */});
  window.addEventListener('ml:session-expired',()=>location.reload());

  // Menu "Fonctionnalités" (mobile) — miroir des actions desktop
  document.getElementById('btn-fun-menu')?.addEventListener('click',e=>{
    e.stopPropagation();
    const m=document.getElementById('fun-menu');
    m.style.display=m.style.display==='none'?'':'none';
  });
  document.getElementById('btn-roulette-mobile')?.addEventListener('click',()=>{document.getElementById('fun-menu').style.display='none';openRouletteModal();});
  document.getElementById('btn-museum-mobile')?.addEventListener('click',()=>{document.getElementById('fun-menu').style.display='none';/* musée — pas encore construit */});
  document.getElementById('btn-news-mobile')?.addEventListener('click',()=>{document.getElementById('fun-menu').style.display='none';openNewsModal();});

  // Recherche globale — ouverture/fermeture de l'interface, moteur de recherche à construire
  document.getElementById('btn-global-search')?.addEventListener('click',()=>{
    if(window.matchMedia('(min-width:600px)').matches){
      const btn=document.getElementById('btn-global-search'),input=document.getElementById('global-search-input');
      btn.style.display='none';input.style.display='';input.focus();
    }else{
      document.getElementById('global-search-overlay').style.display='';
      document.getElementById('global-search-overlay-input').focus();
    }
  });
  document.getElementById('global-search-input')?.addEventListener('blur',()=>{
    const btn=document.getElementById('btn-global-search'),input=document.getElementById('global-search-input');
    if(!input.value){input.style.display='none';btn.style.display='';}
  });
  document.getElementById('btn-global-search-close')?.addEventListener('click',()=>{document.getElementById('global-search-overlay').style.display='none';});

  // Gestion des catégories
  document.getElementById('btn-manage-categories')?.addEventListener('click',()=>{
    if(!state.categories.length)openPresetsModal();
    else openManageCategoriesModal();
  });
  document.getElementById('btn-close-manage-cats')?.addEventListener('click',closeModals);
  document.getElementById('btn-manage-cats-done')?.addEventListener('click',closeModals);
  document.getElementById('btn-manage-cats-add')?.addEventListener('click',()=>{closeModals();setTimeout(openPresetsModal,300);});

  // Raccourcis clavier (désactivés dans les inputs)
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||document.activeElement?.isContentEditable)return;
    if(e.key==='n'||e.key==='N'){e.preventDefault();openEntryModal();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();filterFav=!filterFav;renderContent();}
    if(e.key==='Escape')closeModals();
  });

  // Bouton remonter en haut
  const fab=document.getElementById('fab-back-top');
  window.addEventListener('scroll',()=>{if(fab)fab.style.display=window.scrollY>300?'flex':'none';},{passive:true});
  fab?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  if(state.categories.length===0){render();openTutorial();}
  else render();
  renderNews(); // async, non-bloquant
  initStaticEvents();
}

function updateUserAvatar(){
  const btn=document.getElementById('btn-user-menu');
  const btnMobile=document.getElementById('btn-user-menu-mobile');
  const uname=currentUser.username||'?';
  if(currentUser.avatar_url){
    const img=`<img src="${esc(currentUser.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    btn.innerHTML=img;btn.style.padding='0';
    if(btnMobile){btnMobile.innerHTML=img;btnMobile.style.padding='0';}
  }else{
    btn.textContent=uname[0].toUpperCase();btn.style.padding='';
    if(btnMobile){btnMobile.textContent=uname[0].toUpperCase();btnMobile.style.padding='';}
  }
  document.getElementById('user-menu-name').textContent=uname;
  document.getElementById('user-menu-email').textContent=currentUser.email;
  if(currentUser.role==='admin')document.getElementById('btn-admin-panel').style.display='';
}

function initStaticEvents(){
  document.getElementById('fab-add-entry').addEventListener('click',()=>openEntryModal());
  document.getElementById('btn-close-entry').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-entry').addEventListener('click',closeModals);
  document.getElementById('btn-save-entry').addEventListener('click',saveEntry);
  document.getElementById('btn-delete-entry').addEventListener('click',deleteEntry);
  document.getElementById('btn-close-category').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-category').addEventListener('click',closeModals);
  document.getElementById('btn-save-category').addEventListener('click',saveCategory);
  document.getElementById('btn-add-col-cat').addEventListener('click',()=>{tempNewCols.push({name:'',type:'text'});renderNewCols();});
  document.getElementById('btn-close-columns').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-columns').addEventListener('click',closeModals);
  document.getElementById('btn-save-columns').addEventListener('click',saveColumns);
  document.getElementById('btn-add-col').addEventListener('click',()=>{tempColumns.push({id:uid(),name:'',type:'text'});renderColsList();});
  document.getElementById('cols-preview-tabs').addEventListener('click',e=>{
    const btn=e.target.closest('[data-preview-layout]');if(!btn)return;
    const wasActive=btn.classList.contains('active');
    document.querySelectorAll('#cols-preview-tabs .view-btn').forEach(b=>b.classList.remove('active'));
    if(wasActive){
      previewLayout=null;
    }else{
      previewLayout=btn.dataset.previewLayout;
      btn.classList.add('active');
    }
    renderColsPreview();
  });
  document.getElementById('btn-close-import').addEventListener('click',closeModals);
  document.getElementById('btn-cancel-import').addEventListener('click',closeModals);
  document.getElementById('btn-do-import').addEventListener('click',doImport);
  document.getElementById('btn-close-share').addEventListener('click',closeModals);
  document.getElementById('btn-close-share-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-account').addEventListener('click',closeModals);
  document.getElementById('btn-close-account-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-admin').addEventListener('click',closeAdminPage);
  document.getElementById('admin-tabs').addEventListener('click',e=>{
    const btn=e.target.closest('[data-admin-tab]');if(!btn)return;
    switchAdminTab(btn.dataset.adminTab);
  });
  document.getElementById('wiki-bl-exact-add').addEventListener('click',()=>addWikiBlacklistTerm('exact'));
  document.getElementById('wiki-bl-regex-add').addEventListener('click',()=>addWikiBlacklistTerm('regex'));
  document.getElementById('wiki-bl-exact-input').addEventListener('keydown',e=>{if(e.key==='Enter')addWikiBlacklistTerm('exact');});
  document.getElementById('wiki-bl-regex-input').addEventListener('keydown',e=>{if(e.key==='Enter')addWikiBlacklistTerm('regex');});
  document.getElementById('btn-close-roulette').addEventListener('click',closeModals);
  document.getElementById('btn-close-roulette-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-tutorial').addEventListener('click',closeModals);
  document.getElementById('btn-close-tutorial-ok')?.addEventListener('click',closeModals);
  document.getElementById('btn-close-stats').addEventListener('click',closeModals);
  document.getElementById('btn-close-stats-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-news').addEventListener('click',closeModals);
  document.getElementById('btn-close-news-ok').addEventListener('click',closeModals);
  document.getElementById('btn-close-presets').addEventListener('click',closeModals);
  document.getElementById('btn-presets-zero').addEventListener('click',()=>{closeModals();setTimeout(()=>openCategoryModal(false),300);});
  document.getElementById('btn-presets-apply').addEventListener('click',applyPresets);
  document.getElementById('modal-backdrop').addEventListener('click',()=>{closeInlinePopup();closeModals();});

  document.getElementById('cat-color-picker').addEventListener('click',e=>{const s=e.target.closest('.color-swatch');if(!s)return;tempCatColor=s.dataset.color;document.querySelectorAll('.color-swatch').forEach(sw=>sw.classList.toggle('active',sw===s));});
  document.querySelectorAll('.import-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.import-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('itab-csv').style.display=btn.dataset.itab==='csv'?'':'none';document.getElementById('itab-paste').style.display=btn.dataset.itab==='paste'?'':'none';}));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('touchmove',e=>e.stopPropagation()));

  // Boutons ? génériques (hors modales dynamiques)
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.btn-help');
    if(btn&&!e.target.closest('#modal-roulette-body'))showHelpPopup(btn.dataset.help,btn);
  });

  // Wiki toggle dans modale colonnes — variables temp uniquement, jamais de mutation directe de cat (commit seulement au Sauvegarder)
  document.getElementById('wiki-toggle-cb')?.addEventListener('change',function(){
    tempWikiEnabled=this.checked;
    document.getElementById('wiki-settings-panel').style.display=tempWikiEnabled?'':'none';
    renderColsList();
  });

  // Share
  document.getElementById('share-toggle').addEventListener('change',async function(){
    try{const data=await API.toggleShare();this.checked=data.share_enabled;document.getElementById('share-link-block').style.display=data.share_enabled?'':'none';if(data.share_token)document.getElementById('share-link-input').value=`${location.origin}/share/${data.share_token}`;}catch(e){alert(e.message);}
  });
  document.getElementById('btn-copy-link').addEventListener('click',()=>{const input=document.getElementById('share-link-input');input.select();navigator.clipboard?.writeText(input.value)||document.execCommand('copy');document.getElementById('btn-copy-link').textContent='Copié !';setTimeout(()=>{document.getElementById('btn-copy-link').textContent='Copier';},2000);});
  document.getElementById('btn-regen-token').addEventListener('click',async()=>{if(!confirm('Nouveau lien ? L\'ancien sera invalidé.'))return;try{const data=await API.regenToken();document.getElementById('share-link-input').value=`${location.origin}/share/${data.share_token}`;document.getElementById('share-toggle').checked=true;document.getElementById('share-link-block').style.display='';}catch(e){alert(e.message);}});

  // Account
  document.getElementById('btn-change-pw').addEventListener('click',async()=>{
    const newPw=document.getElementById('acc-new-pw').value,errEl=document.getElementById('acc-pw-error');errEl.style.display='none';
    try{await API.updatePassword(newPw);alert('Mot de passe mis à jour !');closeModals();}catch(e){errEl.textContent=e.message;errEl.style.display='';}
  });

  // Admin config
  document.getElementById('btn-save-config').addEventListener('click',async()=>{
    const cfg={site_name:document.getElementById('admin-site-name').value,site_logo:document.getElementById('admin-site-logo').value,site_subtitle:document.getElementById('admin-site-sub').value,site_logo_url:document.getElementById('admin-logo-url').value,staging_banner_enabled:document.getElementById('admin-staging-banner-enabled').checked?'true':'false',staging_banner_text:document.getElementById('admin-staging-banner-text').value,staging_banner_link:document.getElementById('admin-staging-banner-link').value,legal_mentions:document.getElementById('admin-legal-mentions').value,privacy_policy:document.getElementById('admin-privacy-policy').value};
    const msgEl=document.getElementById('admin-config-msg');msgEl.style.display='none';
    try{await API.adminSaveConfig(cfg);applySiteConfig(cfg);msgEl.className='auth-error auth-success';msgEl.textContent='✓ Sauvegardé !';msgEl.style.display='';}
    catch(e){msgEl.className='auth-error';msgEl.textContent=e.message;msgEl.style.display='';}
    setTimeout(()=>msgEl.style.display='none',3000);
  });

  // Admin news
  document.getElementById('btn-add-news').addEventListener('click',async()=>{
    const title=document.getElementById('news-title').value.trim(),content=document.getElementById('news-content').value.trim(),image_url=document.getElementById('news-image-url').value.trim(),pinned=document.getElementById('news-pinned').checked;
    if(!title){alert('Titre obligatoire.');return;}
    try{await API.addNews({title,content,image_url,pinned});document.getElementById('news-title').value='';document.getElementById('news-content').value='';document.getElementById('news-image-url').value='';document.getElementById('news-pinned').checked=false;newsData=null;loadAdminNews();}
    catch(e){alert(e.message);}
  });

  // Admin tutorial save
  document.getElementById('btn-save-tutorial').addEventListener('click',async()=>{
    const validSteps=adminTutoSteps.filter(s=>s&&s.title&&s.title.trim());
    try{
      await API.adminSaveTutorial(validSteps);
      tutorialSteps=validSteps;
      const msgEl=document.getElementById('tuto-save-msg');
      if(msgEl){msgEl.style.display='';setTimeout(()=>msgEl.style.display='none',2500);}
      else alert('Tutoriel sauvegardé !');
    }catch(e){alert(e.message);}
  });
}


// ── Boot ─────────────────────────────────────────────
route();
