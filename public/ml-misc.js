let newsData=null;
let lastSeenNews=localStorage.getItem('ml_last_news')||'';
let myTicketsData=null;
let lastSeenTicketMsg=localStorage.getItem('ml_last_ticket_msg')||'';
// ml-misc.js — Export, import, partage, compte, tutoriel, help popups
'use strict';

let helpTextsCache = null;

async function loadHelpTexts(){
  if(helpTextsCache)return helpTextsCache;
  try{
    const data=await API.getHelpTexts();
    helpTextsCache=Object.fromEntries(data.map(h=>[h.id,h]));
    return helpTextsCache;
  }catch{return {};}
}

function showHelpPopup(id, anchor){
  closeHelpPopup();
  loadHelpTexts().then(texts=>{
    const help=texts[id];
    if(!help)return;
    const popup=document.createElement('div');
    popup.id='active-help-popup';
    popup.className='help-popup';
    popup.innerHTML=`<div class="help-popup-title">${esc(help.title)}</div><div class="help-popup-content">${renderMd(help.content)}</div>`;
    document.body.appendChild(popup);
    const rect=anchor.getBoundingClientRect();
    const pw=Math.min(300,window.innerWidth-16);
    popup.style.width=pw+'px';
    let left=rect.left+window.scrollX;
    if(left+pw>window.innerWidth-8)left=window.innerWidth-pw-8;
    popup.style.left=Math.max(8,left)+'px';
    const top=rect.bottom+window.scrollY+6;
    popup.style.top=(top+200>window.scrollY+window.innerHeight?rect.top+window.scrollY-200-10:top)+'px';
    setTimeout(()=>document.addEventListener('click',outsideHelp,true),10);
  });
}
async function openShareModal(){
  closeInlinePopup();
  const me=await API.me();
  document.getElementById('share-toggle').checked=!!me.share_enabled;
  document.getElementById('share-link-block').style.display=me.share_enabled?'':'none';
  if(me.share_token&&me.share_enabled)document.getElementById('share-link-input').value=`${location.origin}/share/${me.share_token}`;
  openModal('modal-share');
}

let accountSectionObserver=null;

function switchAccountSection(sectionId){
  document.getElementById(sectionId)?.scrollIntoView({behavior:'smooth',block:'start'});
}

function setupAccountScrollSpy(){
  accountSectionObserver?.disconnect();
  const body=document.getElementById('account-modal-body');
  accountSectionObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        document.querySelectorAll('.account-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.section===entry.target.id));
        if(entry.target.id==='acc-sec-support')markTicketsSeen();
      }
    });
  },{root:body,threshold:0,rootMargin:'-10% 0px -70% 0px'});
  document.querySelectorAll('.account-section').forEach(s=>accountSectionObserver.observe(s));
}

function showDeletionPendingPage(){
  showPage('deletion');
  const d=new Date(currentUser.deletion_scheduled_for);
  document.getElementById('deletion-date').textContent=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});

  const cancelBtn=document.getElementById('btn-cancel-deletion');
  const downloadBtn=document.getElementById('btn-download-before-deletion');
  const logoutBtn=document.getElementById('btn-logout-deletion');
  // Ré-affecte les listeners (onclick plutôt qu'addEventListener empilé,
  // pour rester idempotent si cette page est réaffichée plusieurs fois
  // dans la même session — pas de cas normal aujourd'hui mais défensif).
  cancelBtn.onclick=async()=>{
    cancelBtn.disabled=true;cancelBtn.textContent='Annulation…';
    try{
      await API.cancelAccountDeletion();
      currentUser.deletion_scheduled_for=null;
      try{tutorialSteps=await API.getTutorial();}catch{tutorialSteps=[];}
      showPage('app');initApp();
    }catch(e){alert(e.message);cancelBtn.disabled=false;cancelBtn.textContent='Annuler la suppression';}
  };
  downloadBtn.onclick=()=>exportAll();
  logoutBtn.onclick=async()=>{await API.logout();location.reload();};
}

function openAccountModal(targetSection){
  closeInlinePopup();
  const avatarPreview=currentUser.avatar_url?`<img src="${esc(currentUser.avatar_url)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;"/>`:
    `<div style="width:64px;height:64px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;">${(currentUser.username[0]||'?').toUpperCase()}</div>`;
  document.getElementById('account-info').innerHTML=`
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
      <div id="avatar-preview">${avatarPreview}</div>
      <div><strong style="font-size:16px;">${esc(currentUser.username)}</strong><br/><span style="font-size:13px;color:var(--text3);">${esc(currentUser.email)}</span><br/><span class="col-tag" style="margin-top:4px;display:inline-flex;">${currentUser.role}</span></div>
    </div>
    <div class="field-group"><label class="field-label">Pseudo</label><input type="text" id="acc-username" class="field-input" value="${esc(currentUser.username)}"/></div>
    <div class="field-group"><label class="field-label">Photo de profil (URL)</label><input type="url" id="acc-avatar-url" class="field-input" value="${esc(currentUser.avatar_url||'')}" placeholder="https://…"/><p style="font-size:12px;color:var(--text3);margin-top:4px;">Colle l'URL d'une image (imgur, gravatar…)</p></div>
    <div id="acc-profile-error" class="auth-error" style="display:none;"></div>
    <button class="btn btn-ghost" id="btn-save-profile">Mettre à jour le profil</button>`;

  document.getElementById('account-params').innerHTML=`
    <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">🎨 Thème</h3>
    <div id="account-theme-picker" style="margin-bottom:20px;"></div>
    <hr style="border-color:var(--border);margin-bottom:20px;"/>
    <div class="field-group" style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="acc-hide-broken-banner" ${localStorage.getItem(userKey('ml_hide_broken_banner'))==='true'?'checked':''}/>
      <label for="acc-hide-broken-banner" style="font-size:13px;">Masquer le bandeau d'alerte des dates à valider (calendrier)</label>
    </div>
    <div class="field-group">
      <label class="field-label">Format des dates ambiguës (JJ/MM/AAAA)</label>
      <select class="field-input" id="acc-date-order">
        <option value="DM" ${dateOrder==='DM'?'selected':''}>Jour/Mois (ex : 15/03/2026)</option>
        <option value="MD" ${dateOrder==='MD'?'selected':''}>Mois/Jour (ex : 03/15/2026)</option>
      </select>
    </div>
    <p style="font-size:12px;color:var(--text3);margin-top:20px;">⌨️ Raccourcis clavier (desktop) : <strong>N</strong> nouvelle entrée, <strong>F</strong> favoris, <strong>Échap</strong> fermer.</p>
    <hr style="border-color:var(--border);margin:20px 0;"/>
    <p style="font-size:13px;color:var(--text3);">🚪 Il paraît qu'une porte fermée se cache quelque part sur le site… à vous de la trouver.</p>
    <hr style="border-color:var(--danger);opacity:.3;margin:24px 0 16px;"/>
    <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;color:var(--danger);">Zone de danger</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:10px;">Ton compte sera immédiatement inaccessible normalement, puis supprimé définitivement (toi et toutes tes données) après 7 jours. Tu peux annuler à tout moment pendant ce délai.</p>
    <button class="btn btn-ghost" id="btn-request-deletion" style="width:100%;border-color:var(--danger);color:var(--danger);">Supprimer mon compte</button>`;
  renderThemeSection(document.getElementById('account-theme-picker'));

  document.getElementById('account-io').innerHTML=`
    <div class="field-group">
      <label class="field-label">Exporter</label>
      <p style="font-size:12px;color:var(--text3);margin-bottom:10px;">Télécharge toutes tes catégories (CSV + JSON) dans une archive ZIP.</p>
      <button class="btn btn-ghost" id="btn-export-all-acc" style="width:100%;">⬇️ Exporter tout</button>
    </div>
    <hr style="border-color:var(--border);margin:20px 0;"/>
    <div class="field-group">
      <label class="field-label">Importer</label>
      <p style="font-size:12px;color:var(--text3);margin-bottom:10px;">Depuis un lien Google Sheets, ou en collant des données CSV/TSV.</p>
      <button class="btn btn-ghost" id="btn-import-acc" style="width:100%;">⬆️ Importer des données</button>
    </div>`;
  document.getElementById('btn-export-all-acc').addEventListener('click',exportAll);
  document.getElementById('btn-import-acc').addEventListener('click',()=>{closeModals();setTimeout(openImportModal,300);});

  document.querySelectorAll('.account-nav-btn').forEach(btn=>btn.addEventListener('click',()=>switchAccountSection(btn.dataset.section)));
  document.getElementById('account-modal-body').scrollTop=0;
  loadSupportSection();
  setTimeout(setupAccountScrollSpy,50);
  if(targetSection)setTimeout(()=>switchAccountSection(targetSection),60);

  document.getElementById('acc-hide-broken-banner').addEventListener('change',e=>{
    localStorage.setItem(userKey('ml_hide_broken_banner'),e.target.checked?'true':'false');
    if(viewMode==='calendar')renderContent();
  });
  document.getElementById('acc-date-order').addEventListener('change',e=>{
    dateOrder=e.target.value;
    localStorage.setItem(userKey('ml_date_order'),dateOrder);
    if(viewMode==='calendar')renderContent();
  });
  document.getElementById('btn-request-deletion').addEventListener('click',async()=>{
    if(!confirm('Avant de continuer : veux-tu télécharger tes données ? (Annuler pour le faire d\'abord, OK pour continuer sans)'))return;
    if(!confirm('Confirmer la suppression de ton compte ? Il sera immédiatement inaccessible normalement, puis définitivement supprimé dans 7 jours. Tu pourras annuler pendant ce délai.'))return;
    try{
      const r=await API.requestAccountDeletion();
      closeModals();
      currentUser.deletion_scheduled_for=r.deletion_scheduled_for;
      showDeletionPendingPage();
    }catch(e){alert(e.message);}
  });
  document.getElementById('acc-new-pw').value='';document.getElementById('acc-pw-error').style.display='none';
  document.getElementById('acc-avatar-url').addEventListener('input',e=>{const url=e.target.value.trim();const preview=document.getElementById('avatar-preview');if(url)preview.innerHTML=`<img src="${esc(url)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'"/>`;});
  document.getElementById('btn-save-profile').addEventListener('click',async()=>{
    const username=document.getElementById('acc-username').value.trim(),avatar_url=document.getElementById('acc-avatar-url').value.trim();
    const errEl=document.getElementById('acc-profile-error');errEl.style.display='none';
    try{await API.updateProfile({username,avatar_url});currentUser.username=username;currentUser.avatar_url=avatar_url||null;updateUserAvatar();errEl.className='auth-error auth-success';errEl.textContent='✓ Profil mis à jour !';errEl.style.display='';}
    catch(e){errEl.textContent=e.message;errEl.style.display='';}
    setTimeout(()=>errEl.style.display='none',2500);
  });
  openModal('modal-account');
}

function openTutorial(){
  closeInlinePopup();
  const steps=tutorialSteps.length>0?tutorialSteps:[
    {icon:'📂',title:'Catégories',content:'Clique sur ⊕ dans le header pour créer une catégorie. Chaque catégorie a ses propres colonnes personnalisables.'},
    {icon:'➕',title:'Ajouter une entrée',content:'Clique sur + en bas à droite pour ajouter une œuvre. Tu peux aussi appuyer sur N depuis n\'importe où (hors champ de saisie).'},
    {icon:'✏️',title:'Modifier rapidement',content:'Clique directement sur une valeur dans la liste pour la modifier. En vue tableur, textes et nombres sont éditables en place.'},
    {icon:'⭐',title:'Favoris & filtres',content:'Le ☆ met une œuvre en favori. La barre de filtres permet de voir uniquement tes favoris, les œuvres à voir, ou celles déjà vues.'},
    {icon:'🔀',title:'Vues & tri',content:'Choisis entre liste, grille, compact ou tableur. Trie par n\'importe quelle colonne. En liste, glisse ⠿ pour réordonner.'},
    {icon:'🎰',title:'Roulette',content:'Clique sur la roulette dans le header pour laisser le hasard choisir une œuvre selon des critères que tu définis.'},
    {icon:'📊',title:'Graphiques',content:'Clique sur 📊 pour voir les statistiques visuelles : statuts, notes, évolution dans le temps.'},
    {icon:'🔗',title:'Partage',content:'Menu utilisateur → Partage : active un lien public pour que d\'autres consultent ta collection en lecture seule.'},
  ];
  document.getElementById('tutorial-steps-body').innerHTML=steps.map(s=>`
    <div class="tutorial-step">
      <div class="tutorial-icon">${esc(s.icon||'📌')}</div>
      <div><strong>${esc(s.title)}</strong><p>${esc(s.content)}</p></div>
    </div>`).join('');
  openModal('modal-tutorial');
}

async function renderNews(){
  lastSeenNews=localStorage.getItem(userKey('ml_last_news'))||lastSeenNews;
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  const badge=document.getElementById('news-badge');
  if(badge&&newsData.length>0){
    const latest=newsData[0]?.created_at||'';
    badge.style.display=latest>lastSeenNews?'':'none';
  }
}

function latestAdminMsgAcrossTickets(){
  if(!myTicketsData?.length)return'';
  let latest='';
  for(const t of myTicketsData){
    for(const m of (t.contact_ticket_messages||[])){
      if(m.sender_type==='admin'&&m.created_at>latest)latest=m.created_at;
    }
  }
  return latest;
}

function refreshSupportBadges(){
  lastSeenTicketMsg=localStorage.getItem(userKey('ml_last_ticket_msg'))||lastSeenTicketMsg;
  const latest=latestAdminMsgAcrossTickets();
  const show=!!latest&&latest>lastSeenTicketMsg;
  const b1=document.getElementById('support-unread-badge');if(b1)b1.style.display=show?'':'none';
  const b2=document.getElementById('support-badge-nav');if(b2)b2.style.display=show?'':'none';
}

function markTicketsSeen(){
  const latest=latestAdminMsgAcrossTickets();
  if(!latest)return;
  lastSeenTicketMsg=latest;
  localStorage.setItem(userKey('ml_last_ticket_msg'),lastSeenTicketMsg);
  refreshSupportBadges();
}

async function loadSupportSection(){
  if(!currentUser)return;
  setupSupportForm();
  try{
    myTicketsData=await API.getMyTickets();
  }catch(e){
    document.getElementById('support-tickets-list').innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;
    return;
  }
  refreshSupportBadges();
  renderTicketsList();
}

function ticketStatusLabel(s){return{nouveau:'Nouveau',en_cours:'En cours',traite:'Traité'}[s]||s;}

function renderTicketsList(){
  const wrap=document.getElementById('support-tickets-list');
  if(!wrap)return;
  if(!myTicketsData?.length){
    wrap.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun ticket pour le moment.</p>';
    return;
  }
  wrap.innerHTML=myTicketsData.map(t=>{
    const msgs=t.contact_ticket_messages||[];
    const hasUnread=msgs.some(m=>m.sender_type==='admin'&&m.created_at>lastSeenTicketMsg);
    return`<div class="ticket-item" data-ticket-id="${t.id}">
      <div class="ticket-item-top">
        <span class="ticket-item-subject">${esc(t.subject)}${hasUnread?' <span class="news-badge-dot news-badge-dot-inline"></span>':''}</span>
        <span class="ticket-status ticket-status-${t.status}">${ticketStatusLabel(t.status)}</span>
      </div>
      <div class="ticket-item-meta">${msgs.length} message${msgs.length>1?'s':''} · mis à jour le ${new Date(t.updated_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</div>
      <div class="ticket-thread-wrap" id="ticket-thread-${t.id}" style="display:none;margin-top:12px;"></div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.ticket-item').forEach(item=>{
    item.querySelector('.ticket-item-top').addEventListener('click',()=>toggleTicketThread(item.dataset.ticketId));
    item.querySelector('.ticket-item-meta').addEventListener('click',()=>toggleTicketThread(item.dataset.ticketId));
  });
}

function toggleTicketThread(ticketId){
  const threadEl=document.getElementById(`ticket-thread-${ticketId}`);
  if(!threadEl)return;
  const opening=threadEl.style.display==='none';
  document.querySelectorAll('.ticket-thread-wrap').forEach(el=>el.style.display='none');
  if(!opening)return;
  const t=myTicketsData.find(x=>x.id===ticketId);if(!t)return;
  const msgs=t.contact_ticket_messages||[];
  threadEl.innerHTML=`
    ${msgs.map(m=>`<div class="ticket-thread-msg msg-${m.sender_type}">
      <div class="ticket-thread-meta">${m.sender_type==='admin'?'Équipe MediaLog':'Toi'} · ${new Date(m.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      ${esc(m.body)}
    </div>`).join('')}
    <div class="field-group" style="margin-top:10px;">
      <textarea class="field-textarea ticket-reply-input" style="min-height:70px;" placeholder="Relancer sur ce ticket…"></textarea>
      <button class="btn btn-ghost btn-sm ticket-reply-btn" style="margin-top:6px;">Envoyer la relance</button>
    </div>`;
  threadEl.style.display='';
  threadEl.querySelector('.ticket-reply-btn')?.addEventListener('click',async()=>{
    const ta=threadEl.querySelector('.ticket-reply-input');
    const msg=ta.value.trim();if(!msg)return;
    const btn=threadEl.querySelector('.ticket-reply-btn');btn.disabled=true;btn.textContent='Envoi…';
    try{
      await API.replyTicket(ticketId,msg);
      myTicketsData=await API.getMyTickets();
      renderTicketsList();
      refreshSupportBadges();
      setTimeout(()=>toggleTicketThread(ticketId),0);
    }catch(e){alert(e.message);}
    finally{btn.disabled=false;btn.textContent='Envoyer la relance';}
  });
}

const DRAFT_KEY='ml_ticket_draft';
let draftSaveTimer=null;

function saveDraft(){
  clearTimeout(draftSaveTimer);
  draftSaveTimer=setTimeout(()=>{
    const draft={
      subject:document.getElementById('ticket-subject')?.value||'',
      message:document.getElementById('ticket-message')?.value||'',
      contact:document.getElementById('ticket-contact')?.value||'',
    };
    if(draft.subject||draft.message||draft.contact)localStorage.setItem(userKey(DRAFT_KEY),JSON.stringify(draft));
    else localStorage.removeItem(userKey(DRAFT_KEY));
  },400);
}

function restoreDraft(){
  try{
    const raw=localStorage.getItem(userKey(DRAFT_KEY));
    if(!raw)return;
    const draft=JSON.parse(raw);
    document.getElementById('ticket-subject').value=draft.subject||'';
    document.getElementById('ticket-message').value=draft.message||'';
    document.getElementById('ticket-contact').value=draft.contact||'';
  }catch{}
}

function setupSupportForm(){
  const sendBtn=document.getElementById('btn-send-ticket');
  if(!sendBtn||sendBtn.dataset.wired)return;
  sendBtn.dataset.wired='1';
  ['ticket-subject','ticket-message','ticket-contact'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',saveDraft);
  });
  sendBtn.addEventListener('click',async()=>{
    const subject=document.getElementById('ticket-subject').value.trim();
    const message=document.getElementById('ticket-message').value.trim();
    const contact=document.getElementById('ticket-contact').value.trim();
    const errEl=document.getElementById('ticket-new-error');
    errEl.style.display='none';
    if(!subject||!message){errEl.textContent='Sujet et message obligatoires.';errEl.style.display='';return;}
    sendBtn.disabled=true;sendBtn.textContent='Envoi…';
    try{
      await API.newTicket(subject,message,contact);
      document.getElementById('ticket-subject').value='';
      document.getElementById('ticket-message').value='';
      document.getElementById('ticket-contact').value='';
      localStorage.removeItem(userKey(DRAFT_KEY));
      myTicketsData=await API.getMyTickets();
      renderTicketsList();
      switchSupportTab('list');
    }catch(e){errEl.textContent=e.message;errEl.style.display='';}
    finally{sendBtn.disabled=false;sendBtn.textContent='Envoyer';}
  });
}

function switchSupportTab(tabId){
  document.querySelectorAll('#support-page-tabs .admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.supportTab===tabId));
  document.querySelectorAll('#page-support .admin-panel').forEach(p=>p.classList.toggle('active',p.dataset.supportPanel===tabId));
}

function openSupportPage(){
  closeModals();
  document.getElementById('page-support').style.display='flex';
  document.body.style.overflow='hidden';
  switchSupportTab('new');
  setupSupportForm();
  restoreDraft();
  loadSupportSection();
}

function closeSupportPage(){
  document.getElementById('page-support').style.display='none';
  document.body.style.overflow='';
}

function exportCSV(){
  const cat=getActiveCat();
  if(!cat||!cat.entries.length){alert('Aucune donnée à exporter.');return;}
  const headers=cat.columns.map(c=>c.name);
  const rows=cat.entries.map(entry=>
    cat.columns.map(col=>{
      const val=entry[col.id];
      if(val===null||val===undefined||val==='')return'';
      const str=String(val);
      return str.includes(',')||str.includes('"')||str.includes('\n')?`"${str.replace(/"/g,'""')}"`:str;
    })
  );
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  downloadText('\uFEFF'+csv,`${cat.name}-${new Date().toISOString().slice(0,10)}.csv`,'text/csv;charset=utf-8;');
  API.logEvent('export_csv');
}

function downloadText(content, filename, mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

async function exportAll(){
  if(!state.categories.length){alert('Aucune donnée à exporter.');return;}
  // Générer un CSV par catégorie et les zipper via JSZip
  if(typeof JSZip==='undefined'){alert('Chargement de JSZip...');return;}
  const zip=new JSZip();
  state.categories.forEach(cat=>{
    if(!cat.entries.length)return;
    const headers=cat.columns.map(c=>c.name);
    const rows=cat.entries.map(entry=>
      cat.columns.map(col=>{
        const val=entry[col.id];
        if(val===null||val===undefined||val==='')return'';
        const str=String(val);
        return str.includes(',')||str.includes('"')||str.includes('\n')?`"${str.replace(/"/g,'""')}"`:str;
      })
    );
    const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
    zip.file(`${cat.name}.csv`,'\uFEFF'+csv);
  });
  // Aussi exporter en JSON
  zip.file('medialog-export.json',JSON.stringify({
    exported_at:new Date().toISOString(),
    categories:state.categories
  },null,2));
  const blob=await zip.generateAsync({type:'blob'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`medialog-export-${new Date().toISOString().slice(0,10)}.zip`;
  a.click();URL.revokeObjectURL(url);
  API.logEvent('export_all');
}

function openImportModal(){
  const sel=document.getElementById('import-cat');
  sel.innerHTML=state.categories.map(c=>`<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join('');
  sel.value=activeCatId||state.categories[0]?.id;
  document.getElementById('import-url').value='';document.getElementById('import-paste').value='';
  document.getElementById('import-status').style.display='none';openModal('modal-import');
}

function parseCSVLine(line,sep){if(sep==='\t')return line.split('\t');const r=[];let cur='',inQ=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(ch===sep&&!inQ){r.push(cur);cur='';}else cur+=ch;}r.push(cur);return r;}

function parseDelimited(text,sep){const lines=text.split(/\r?\n/).filter(l=>l.trim());if(lines.length<2)return[];const headers=parseCSVLine(lines[0],sep);return lines.slice(1).map(line=>{const vals=parseCSVLine(line,sep);const obj={};headers.forEach((h,i)=>{obj[h.trim()]=(vals[i]||'').trim();});return obj;}).filter(row=>Object.values(row).some(v=>v));}

async function doImport(){
  const catId=document.getElementById('import-cat').value,cat=getCat(catId);if(!cat)return;
  const tab=document.querySelector('.import-tab.active')?.dataset.itab;
  const btn=document.getElementById('btn-do-import');btn.textContent='Import…';btn.disabled=true;
  try{
    let rows=[];
    if(tab==='paste'){const text=document.getElementById('import-paste').value.trim();if(!text){showImportStatus('error','Colle des données.');return;}rows=parseDelimited(text,text.includes('\t')?'\t':',');}
    else{const url=document.getElementById('import-url').value.trim();if(!url){showImportStatus('error','URL manquante.');return;}const resp=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);if(!resp.ok)throw new Error('Impossible de récupérer.');rows=parseDelimited((await resp.json()).contents,',');}
    if(!rows.length){showImportStatus('error','Aucune donnée reconnue.');return;}
    let imported=0;
    rows.forEach(row=>{const entry={id:uid(),_created:Date.now(),_order:cat.entries.length};cat.columns.forEach(col=>{const key=Object.keys(row).find(k=>k.toLowerCase().trim()===col.name.toLowerCase().trim()||col.name.toLowerCase().trim().startsWith(k.toLowerCase().trim().slice(0,5)));let val=key?row[key]:'';if(col.type==='number'&&val)val=parseFloat(val.replace(',','.'))||null;if(col.type==='rating'&&val)val=Math.min(5,Math.max(0,parseInt(val)||0));entry[col.id]=val;});const nameC=cat.columns.find(c=>c.required);if(entry[nameC?.id]){cat.entries.push(entry);imported++;}});
    scheduleSave();showImportStatus('success',`${imported} entrée(s) importée(s) !`);setTimeout(()=>{closeModals();render();},1600);
  }catch(e){showImportStatus('error',`Erreur : ${e.message}`);}
  finally{btn.textContent='Importer';btn.disabled=false;}
}

function showImportStatus(type,msg){const s=document.getElementById('import-status');s.style.display='';s.className=`import-status import-status-${type}`;s.textContent=msg;}

async function openNewsModal(){
  closeInlinePopup();openModal('modal-news');
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  // Marquer comme lu
  if(newsData.length>0){lastSeenNews=newsData[0].created_at;localStorage.setItem(userKey('ml_last_news'),lastSeenNews);}
  const badge=document.getElementById('news-badge');if(badge)badge.style.display='none';
  const body=document.getElementById('news-body');
  if(!newsData.length){body.innerHTML='<p style="color:var(--text3);text-align:center;padding:40px;">Aucune actualité pour le moment.</p>';return;}
  body.innerHTML=newsData.map(n=>`
    <article class="news-article${n.pinned?' news-pinned':''}">
      ${n.pinned?'<div class="news-pin-badge">📌 Épinglé</div>':''}
      ${n.image_url?`<div class="news-article-img"><img src="${esc(n.image_url)}" alt="${esc(n.title)}" onerror="this.parentElement.style.display='none'"/></div>`:''}
      <h2 class="news-article-title">${esc(n.title)}</h2>
      <div class="news-article-date">${new Date(n.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</div>
      ${n.content?`<div class="news-article-content">${renderMd(n.content)}</div>`:''}
    </article>`).join('');
}

// ── THÈMES ────────────────────────────────────────────────
const THEMES = {
  nuit:  { label:'Nuit',  colors:['#0f0f12','#7C6FE0'] },
  jour:  { label:'Jour',  colors:['#f5f4ff','#7C6FE0'] },
  trans: { label:'Trans', colors:['#0d1b2a','#f5a7c7'] },
  foret: { label:'Forêt', colors:['#0b120d','#52C07A'] },
  braise:{ label:'Braise',colors:['#120808','#E09E52'] },
  ocean: { label:'Océan', colors:['#060d18','#52A0E0'] },
  custom:{ label:'Perso', colors:['#000000','#ffffff'] },
};

const CUSTOM_VARS = [
  {id:'custom-bg',    label:'Fond principal'},
  {id:'custom-bg2',   label:'Fond secondaire'},
  {id:'custom-bg3',   label:'Fond tertiaire'},
  {id:'custom-accent',label:'Couleur accent'},
  {id:'custom-text',  label:'Texte principal'},
  {id:'custom-text2', label:'Texte secondaire'},
];

function applyTheme(theme, customVars={}){
  document.documentElement.dataset.theme = theme === 'nuit' ? '' : theme;
  Object.entries(customVars).forEach(([k,v])=>{
    document.documentElement.style.setProperty('--'+k, v);
  });
  localStorage.setItem(userKey('ml_theme'), theme);
  localStorage.setItem(userKey('ml_custom_vars'), JSON.stringify(customVars));
}

function saveThemeToProfile(theme, customVars){
  if(currentUser){currentUser.theme=theme;currentUser.theme_vars=customVars;}
  API.updateProfile({theme, theme_vars:JSON.stringify(customVars)}).catch(()=>{});
}

function parseThemeVars(v){
  if(!v)return{};
  if(typeof v==='object')return v;
  try{return JSON.parse(v);}catch{return{};}
}

function loadSavedTheme(){
  // La base fait foi dès qu'un profil est chargé (fonctionne quel que soit
  // le navigateur) ; le cache local ne sert que de préchargement optimiste
  // avant que le profil ne soit disponible (évite un flash au premier rendu).
  let theme,vars;
  if(currentUser&&currentUser.theme){
    theme=currentUser.theme;
    vars=parseThemeVars(currentUser.theme_vars);
  }else{
    theme=localStorage.getItem(userKey('ml_theme'))||'nuit';
    vars=JSON.parse(localStorage.getItem(userKey('ml_custom_vars'))||'{}');
  }
  applyTheme(theme,vars);
}

function renderThemeSection(container){
  const currentTheme=currentUser?.theme||localStorage.getItem(userKey('ml_theme'))||'nuit';
  const customVars=currentUser?.theme?parseThemeVars(currentUser.theme_vars):JSON.parse(localStorage.getItem(userKey('ml_custom_vars'))||'{}');

  const swatches=Object.entries(THEMES).map(([key,t])=>{
    const bg=t.colors[0],accent=t.colors[1];
    const isCustom=key==='custom';
    return`<div class="theme-swatch ${currentTheme===key?'active':''}"
      data-theme="${key}" title="${t.label}"
      style="${isCustom?'':`background:linear-gradient(135deg,${bg} 60%,${accent} 60%)`}">
    </div>`;
  }).join('');

  const customEditor=`<div class="custom-theme-editor" id="custom-editor" style="display:${currentTheme==='custom'?'grid':'none'};">
    ${CUSTOM_VARS.map(v=>`<div class="color-row">
      <label>${v.label}</label>
      <input type="color" id="cp-${v.id}" value="${customVars[v.id]||'#7C6FE0'}"/>
      <input type="text" id="ct-${v.id}" value="${customVars[v.id]||'#7C6FE0'}" maxlength="7"/>
    </div>`).join('')}
  </div>`;

  container.innerHTML=`
    <div class="theme-picker">${swatches}</div>
    <div id="theme-labels" style="font-size:13px;color:var(--text3);margin-top:8px;">${THEMES[currentTheme]?.label||'Nuit'}</div>
    ${customEditor}`;

  let selectedVars={...customVars};

  CUSTOM_VARS.forEach(v=>{
    const cp=container.querySelector(`#cp-${v.id}`);
    const ct=container.querySelector(`#ct-${v.id}`);
    if(!cp||!ct)return;
    cp.addEventListener('input',()=>{ct.value=cp.value;selectedVars[v.id]=cp.value;applyTheme('custom',selectedVars);});
    cp.addEventListener('change',()=>saveThemeToProfile('custom',selectedVars));
    ct.addEventListener('input',()=>{if(/^#[0-9a-fA-F]{6}$/.test(ct.value)){cp.value=ct.value;selectedVars[v.id]=ct.value;applyTheme('custom',selectedVars);saveThemeToProfile('custom',selectedVars);}});
  });

  container.querySelectorAll('.theme-swatch').forEach(sw=>{
    sw.addEventListener('click',()=>{
      container.querySelectorAll('.theme-swatch').forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
      const selectedTheme=sw.dataset.theme;
      container.querySelector('#theme-labels').textContent=THEMES[selectedTheme]?.label||'';
      container.querySelector('#custom-editor').style.display=selectedTheme==='custom'?'grid':'none';
      applyTheme(selectedTheme,selectedVars);
      saveThemeToProfile(selectedTheme,selectedVars);
    });
  });
}

// ── HISTORIQUE DE SESSION ──────────────────────────────────
const MAX_HISTORY=25;

function pushHistory(label, undoFn){
  mlHistory.unshift({label,undoFn,time:new Date()});
  if(mlHistory.length>MAX_HISTORY)mlHistory.pop();
}

function openHistoryModal(){
  const existing=document.getElementById('history-modal-wrap');
  if(existing)existing.remove();
  const wrap=document.createElement('div');
  wrap.id='history-modal-wrap';
  wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:flex-end;justify-content:center;';
  const items=mlHistory.length
    ?mlHistory.map((h,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);">
        <div style="flex:1;font-size:13px;">${esc(h.label)}<div style="font-size:11px;color:var(--text3);">${h.time.toLocaleTimeString('fr-FR')}</div></div>
        <button class="btn btn-ghost btn-sm hist-undo" data-i="${i}">Annuler</button>
      </div>`).join('')
    :'<div style="padding:24px;text-align:center;color:var(--text3);">Aucune action dans cette session.</div>';
  wrap.innerHTML=`<div style="background:var(--bg2);border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:70vh;display:flex;flex-direction:column;border:1px solid var(--border);">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <span style="font-family:var(--font-display);font-weight:700;">Historique de session</span>
      <button class="btn-icon" id="hist-close">✕</button>
    </div>
    <div style="font-size:11px;color:var(--text3);padding:8px 16px;background:var(--bg3);">⚠ L'historique est perdu à la fermeture de l'onglet</div>
    <div style="overflow-y:auto;flex:1;">${items}</div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  wrap.querySelector('#hist-close').addEventListener('click',()=>wrap.remove());
  wrap.querySelectorAll('.hist-undo').forEach(btn=>btn.addEventListener('click',()=>{
    const h=mlHistory[+btn.dataset.i];
    if(h?.undoFn){h.undoFn();mlHistory.splice(+btn.dataset.i,1);wrap.remove();render();}
  }));
}
