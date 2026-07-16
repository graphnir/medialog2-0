// ml-admin.js — Panel admin
'use strict';

let adminTutoSteps=[];
let wikiBlacklistData=[];
let adminUsersCache=[];
let adminUsagePeriod='all';
let adminUsageExcluded=new Set();

function openAdminPage(){
  closeInlinePopup();
  document.getElementById('page-admin').style.display='flex';
  document.body.style.overflow='hidden';
  switchAdminTab('apparence');

  API.adminGetConfig().then(cfg=>{
    document.getElementById('admin-site-name').value=cfg.site_name||'';
    document.getElementById('admin-site-logo').value=cfg.site_logo||'';
    document.getElementById('admin-site-sub').value=cfg.site_subtitle||'';
    document.getElementById('admin-logo-url').value=cfg.site_logo_url||'';
    document.getElementById('admin-staging-banner-enabled').checked=cfg.staging_banner_enabled==='true';
    document.getElementById('admin-staging-banner-text').value=cfg.staging_banner_text||'';
    document.getElementById('admin-staging-banner-link').value=cfg.staging_banner_link||'';
    document.getElementById('admin-legal-mentions').value=cfg.legal_mentions||'';
    document.getElementById('admin-privacy-policy').value=cfg.privacy_policy||'';
  }).catch(e=>console.error('[admin] config:',e.message));

  API.adminGetStats().then(stats=>{
    document.getElementById('admin-stats').innerHTML=`<div class="admin-stat"><span>${stats.total_users}</span>Membres</div><div class="admin-stat"><span>${stats.new_last_7_days}</span>Nouveaux (7j)</div><div class="admin-stat"><span>${stats.sharing_enabled}</span>Partages actifs</div><div class="admin-stat"><span>${stats.admins}</span>Admins</div>`;
  }).catch(e=>{document.getElementById('admin-stats').textContent=`Erreur : ${e.message}`;});

  API.adminGetUsers().then(usersData=>{
    adminUsersCache=usersData.users||[];
    renderAdminUsers(usersData.users);
  }).catch(e=>{
    document.getElementById('admin-users-list').innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;
  }).finally(()=>{
    loadAdminUsageStats().catch(e=>console.error('[admin] usage-stats:',e.message));
  });

  loadAdminNews().catch(e=>console.error('[admin] news:',e.message));
  loadAdminTutorial().catch(e=>console.error('[admin] tutorial:',e.message));
  loadAdminHelpTexts().catch(e=>console.error('[admin] help-texts:',e.message));
  loadWikiBlacklist().catch(e=>console.error('[admin] wiki-blacklist:',e.message));
  loadAdminSupport().catch(e=>console.error('[admin] support:',e.message));
}

function closeAdminPage(){
  document.getElementById('page-admin').style.display='none';
  document.body.style.overflow='';
}

function switchAdminTab(tabId){
  const root=document.getElementById('page-admin');
  root.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===tabId));
  root.querySelectorAll('.admin-panel').forEach(p=>p.classList.toggle('active',p.dataset.adminPanel===tabId));
  root.querySelector('.admin-page-body')?.scrollTo(0,0);
}

async function loadAdminNews(){
  if(!newsData){try{newsData=await API.getNews();}catch{newsData=[];}}
  const container=document.getElementById('admin-news-list');
  container.innerHTML=!newsData.length?'<p style="color:var(--text3);font-size:13px;">Aucun article.</p>':
    newsData.map(n=>`<div class="admin-news-item" data-id="${n.id}">
      <div style="flex:1;"><strong>${esc(n.title)}</strong>${n.pinned?' 📌':''}<p style="font-size:13px;color:var(--text3);">${n.content?esc(n.content.slice(0,80))+'…':''}</p></div>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-nid="${n.id}">✕</button>
    </div>`).join('');
  container.querySelectorAll('[data-nid]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer?'))return;await API.deleteNews(btn.dataset.nid);newsData=null;loadAdminNews();}));
}

async function loadAdminHelpTexts(){
  const container=document.getElementById('admin-help-texts-list');
  if(!container)return;
  try{
    const texts=await API.adminGetHelpTexts();
    const addForm=`<div style="margin-bottom:16px;background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius-sm);padding:12px;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">Ajouter un nouveau texte d'aide</div>
      <div class="field-group"><label class="field-label">ID (ex : cal_broken_banner)</label><input type="text" class="field-input" id="help-new-id" placeholder="identifiant_unique"/></div>
      <div class="field-group"><label class="field-label">Titre</label><input type="text" class="field-input" id="help-new-title"/></div>
      <div class="field-group"><label class="field-label">Contenu (Markdown)</label><textarea class="field-textarea" id="help-new-content" style="min-height:80px;"></textarea></div>
      <button class="btn btn-ghost btn-sm" id="help-add-btn">+ Ajouter</button>
    </div>`;
    container.innerHTML=addForm+texts.map(h=>`<div style="margin-bottom:16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;">
      <div style="font-size:12px;color:var(--text3);margin-bottom:6px;">ID: <code>${esc(h.id)}</code></div>
      <div class="field-group"><label class="field-label">Titre</label><input type="text" class="field-input help-title-input" data-hid="${esc(h.id)}" value="${esc(h.title)}"/></div>
      <div class="field-group"><label class="field-label">Contenu (Markdown)</label><textarea class="field-textarea help-content-input" data-hid="${esc(h.id)}" style="min-height:80px;">${esc(h.content)}</textarea></div>
      <button class="btn btn-ghost btn-sm help-save-btn" data-hid="${esc(h.id)}">Sauvegarder</button>
    </div>`).join('');
    document.getElementById('help-add-btn').addEventListener('click',async()=>{
      const id=document.getElementById('help-new-id').value.trim();
      const title=document.getElementById('help-new-title').value.trim();
      const content=document.getElementById('help-new-content').value.trim();
      if(!id){alert('L\'ID est obligatoire.');return;}
      if(texts.some(h=>h.id===id)){alert('Cet ID existe déjà.');return;}
      try{await API.adminSaveHelpText(id,title,content);loadAdminHelpTexts();}
      catch(e){alert(e.message);}
    });
    container.querySelectorAll('.help-save-btn').forEach(btn=>btn.addEventListener('click',async()=>{
      const id=btn.dataset.hid;
      const title=container.querySelector(`.help-title-input[data-hid="${id}"]`).value;
      const content=container.querySelector(`.help-content-input[data-hid="${id}"]`).value;
      try{await API.adminSaveHelpText(id,title,content);btn.textContent='✓ Sauvegardé';setTimeout(()=>btn.textContent='Sauvegarder',2000);}
      catch(e){alert(e.message);}
    }));
  }catch(e){container.innerHTML=`<p style="color:var(--danger);">Erreur : ${esc(e.message)}</p>`;}
}

function renderAdminTutorialSteps(){
  const container=document.getElementById('admin-tutorial-steps');
  container.innerHTML=`<div style="font-size:13px;color:var(--text3);margin-bottom:12px;">Modifie ou ajoute des étapes :</div>`+
    adminTutoSteps.map((s,i)=>`<div class="col-row" style="flex-direction:column;align-items:stretch;gap:6px;margin-bottom:12px;background:var(--bg3);border-radius:var(--radius-sm);padding:10px;border:1px solid var(--border);">
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" class="field-input tuto-icon" style="width:52px;font-size:20px;text-align:center;" value="${esc(s.icon||'📌')}" data-ti="${i}"/>
        <input type="text" class="field-input tuto-title" value="${esc(s.title)}" placeholder="Titre de l'étape" data-ti="${i}" style="flex:1;"/>
        <button class="btn-del tuto-del" data-ti="${i}">✕</button>
      </div>
      <textarea class="field-textarea tuto-content" style="min-height:60px;" data-ti="${i}" placeholder="Description…">${esc(s.content)}</textarea>
    </div>`).join('')+
    `<button class="btn btn-ghost" id="btn-add-tuto-step" style="width:100%;margin-top:4px;">+ Ajouter une étape</button>`;
  container.querySelectorAll('.tuto-icon').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].icon=e.target.value;}));
  container.querySelectorAll('.tuto-title').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].title=e.target.value;}));
  container.querySelectorAll('.tuto-content').forEach(el=>el.addEventListener('input',e=>{adminTutoSteps[+e.target.dataset.ti].content=e.target.value;}));
  container.querySelectorAll('.tuto-del').forEach(el=>el.addEventListener('click',e=>{adminTutoSteps.splice(+e.target.dataset.ti,1);renderAdminTutorialSteps();}));
  document.getElementById('btn-add-tuto-step')?.addEventListener('click',()=>{adminTutoSteps.push({icon:'📌',title:'',content:''});renderAdminTutorialSteps();});
}

async function loadAdminTutorial(){
  adminTutoSteps=await API.adminGetTutorial();
  renderAdminTutorialSteps();
}

function renderAdminUsers(users){
  const el=document.getElementById('admin-users-list');
  if(!users.length){el.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun utilisateur.</p>';return;}
  el.innerHTML=`<div class="admin-users-table">${users.map(u=>`<div class="admin-user-row"><div class="admin-user-avatar">${(u.username[0]||'?').toUpperCase()}</div><div class="admin-user-info"><strong>${esc(u.username)}</strong> <span class="col-tag">${u.role}</span><div style="font-size:12px;color:var(--text3);">${esc(u.email)}</div><div style="font-size:11px;color:var(--text3);">Inscrit ${new Date(u.created_at).toLocaleDateString('fr-FR')} · Connexion : ${u.last_login?new Date(u.last_login).toLocaleDateString('fr-FR'):'jamais'}</div></div><div class="admin-user-actions">${u.role!=='admin'?`<button class="btn btn-ghost btn-sm" data-uid="${u.id}" data-action="promote">Admin</button>`:''}${u.id!==currentUser.id?`<button class="btn btn-ghost btn-sm" style="color:var(--danger);" data-uid="${u.id}" data-action="delete">✕</button>`:''}</div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer ?'))return;try{await API.adminDeleteUser(btn.dataset.uid);openAdminPage();}catch(e){alert(e.message);}}));
  el.querySelectorAll('[data-action="promote"]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Promouvoir en admin ?'))return;try{await API.adminSetRole(btn.dataset.uid,'admin');openAdminPage();}catch(e){alert(e.message);}}));
}

async function loadWikiBlacklist(){
  try{
    wikiBlacklistData=await API.adminGetWikiBlacklist();
    renderWikiBlacklist();
  }catch(e){
    const c=document.getElementById('wiki-bl-exact-list');
    if(c)c.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;
  }
}

function renderWikiBlacklist(){
  const exactList=document.getElementById('wiki-bl-exact-list');
  const regexList=document.getElementById('wiki-bl-regex-list');
  if(!exactList||!regexList)return;
  const exact=wikiBlacklistData.filter(t=>t.type==='exact');
  const regex=wikiBlacklistData.filter(t=>t.type==='regex');
  exactList.innerHTML=exact.length?exact.map(t=>`<div class="wiki-bl-item"><span>${esc(t.pattern)}</span><button class="btn-del" data-blid="${t.id}">✕</button></div>`).join('')
    :'<p style="color:var(--text3);font-size:13px;">Aucun terme exact.</p>';
  regexList.innerHTML=regex.length?regex.map(t=>`<div class="wiki-bl-item wiki-bl-regex"><span>${esc(t.pattern)}</span><button class="btn-del" data-blid="${t.id}">✕</button></div>`).join('')
    :'<p style="color:var(--text3);font-size:13px;">Aucune regex.</p>';
  document.querySelectorAll('#wiki-bl-exact-list [data-blid],#wiki-bl-regex-list [data-blid]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      if(!confirm('Supprimer ce motif ?'))return;
      try{await API.adminDeleteWikiBlacklist(btn.dataset.blid);loadWikiBlacklist();}
      catch(e){alert(e.message);}
    });
  });
}

async function addWikiBlacklistTerm(type){
  const input=document.getElementById(type==='exact'?'wiki-bl-exact-input':'wiki-bl-regex-input');
  const pattern=input.value.trim();
  if(!pattern)return;
  try{
    await API.adminAddWikiBlacklist(type,pattern);
    input.value='';
    loadWikiBlacklist();
  }catch(e){alert(e.message);}
}

// ── Support (tickets) ──────────────────────────────────────

let adminSupportFilter='';
let adminSupportPage=1;
let adminCannedResponses=[];
let adminSupportTicketsCache=[];

function ticketStatusLabelAdmin(s){return{nouveau:'Nouveau',en_cours:'En cours',traite:'Traité'}[s]||s;}

async function loadAdminSupport(){
  document.getElementById('admin-support-filters')?.querySelectorAll('.admin-support-filter').forEach(btn=>{
    if(!btn.dataset.wired){
      btn.dataset.wired='1';
      btn.addEventListener('click',()=>{
        adminSupportFilter=btn.dataset.status;
        adminSupportPage=1;
        document.querySelectorAll('.admin-support-filter').forEach(b=>b.classList.toggle('active',b===btn));
        loadAdminTicketsList();
      });
    }
  });
  document.getElementById('btn-support-back-to-list')?.addEventListener('click',()=>{
    document.getElementById('admin-support-detail-view').style.display='none';
    document.getElementById('admin-support-list-view').style.display='';
  });
  document.getElementById('btn-add-canned')?.addEventListener('click',addCannedResponse);
  await Promise.all([loadAdminTicketsList(), loadAdminCannedResponses()]);
  // Badge : y a-t-il des tickets "nouveau" ? (indépendant du filtre affiché)
  try{
    const r=await API.adminGetTickets('nouveau',1);
    const b=document.getElementById('admin-support-badge');
    if(b)b.style.display=(r.total>0)?'':'none';
  }catch{}
}

async function loadAdminTicketsList(){
  const wrap=document.getElementById('admin-support-tickets');
  wrap.innerHTML='<p style="color:var(--text3);font-size:13px;">Chargement…</p>';
  try{
    const r=await API.adminGetTickets(adminSupportFilter,adminSupportPage);
    adminSupportTicketsCache=r.tickets;
    if(!r.tickets.length){
      wrap.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun ticket ici.</p>';
      document.getElementById('admin-support-pagination').innerHTML='';
      return;
    }
    wrap.innerHTML=r.tickets.map(t=>`
      <div class="ticket-item" data-ticket-id="${t.id}">
        <div class="ticket-item-top">
          <span class="ticket-item-subject">${esc(t.subject)}</span>
          <span class="ticket-status ticket-status-${t.status}">${ticketStatusLabelAdmin(t.status)}</span>
        </div>
        <div class="ticket-item-user">${esc(t.profiles?.username||'?')} · ${esc(t.profiles?.email||'')}</div>
        ${t.last_message?`<div class="ticket-item-preview">${t.last_message.sender_type==='admin'?'Toi : ':''}${esc(t.last_message.body)}</div>`:''}
        <div class="ticket-item-meta">${t.message_count} message${t.message_count>1?'s':''} · mis à jour le ${new Date(t.updated_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</div>
      </div>`).join('');
    wrap.querySelectorAll('.ticket-item').forEach(item=>item.addEventListener('click',()=>openAdminTicketDetail(item.dataset.ticketId)));
    const pager=document.getElementById('admin-support-pagination');
    const totalPages=Math.ceil(r.total/r.perPage);
    pager.innerHTML=totalPages>1?`
      <button class="btn btn-ghost btn-sm" id="support-page-prev" ${adminSupportPage<=1?'disabled':''}>← Précédent</button>
      <span style="font-size:12px;color:var(--text3);align-self:center;">Page ${adminSupportPage}/${totalPages}</span>
      <button class="btn btn-ghost btn-sm" id="support-page-next" ${adminSupportPage>=totalPages?'disabled':''}>Suivant →</button>`:'';
    document.getElementById('support-page-prev')?.addEventListener('click',()=>{adminSupportPage--;loadAdminTicketsList();});
    document.getElementById('support-page-next')?.addEventListener('click',()=>{adminSupportPage++;loadAdminTicketsList();});
  }catch(e){wrap.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;}
}

async function openAdminTicketDetail(ticketId){
  document.getElementById('admin-support-list-view').style.display='none';
  const detailView=document.getElementById('admin-support-detail-view');
  detailView.style.display='';
  const threadEl=document.getElementById('admin-support-thread');
  threadEl.innerHTML='<p style="color:var(--text3);font-size:13px;">Chargement…</p>';
  let t;
  try{t=await API.adminGetTicket(ticketId);}
  catch(e){threadEl.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;return;}

  const cannedChips=adminCannedResponses.length?`
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
      ${adminCannedResponses.map(c=>`<button class="admin-support-filter" data-canned-id="${c.id}" type="button">${esc(c.title)}</button>`).join('')}
    </div>`:'';

  threadEl.innerHTML=`
    <div class="ticket-thread-header">
      <div><strong>${esc(t.subject)}</strong><div class="ticket-item-user">${esc(t.profiles?.username||'?')} · ${esc(t.profiles?.email||'')}${t.contact_method?` · ${esc(t.contact_method)}`:''}</div></div>
      <select id="admin-ticket-status-select" class="field-input" style="width:auto;">
        <option value="nouveau" ${t.status==='nouveau'?'selected':''}>Nouveau</option>
        <option value="en_cours" ${t.status==='en_cours'?'selected':''}>En cours</option>
        <option value="traite" ${t.status==='traite'?'selected':''}>Traité</option>
      </select>
    </div>
    ${t.contact_ticket_messages.map(m=>`<div class="ticket-thread-msg msg-${m.sender_type}">
      <div class="ticket-thread-meta">${m.sender_type==='admin'?'Toi':esc(t.profiles?.username||'Utilisateur')} · ${new Date(m.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      ${esc(m.body)}
    </div>`).join('')}
    ${cannedChips}
    <div class="field-group">
      <textarea class="field-textarea" id="admin-ticket-reply-input" style="min-height:90px;" placeholder="Réponse…"></textarea>
      <button class="btn btn-primary" id="btn-admin-send-reply" style="margin-top:8px;">Envoyer la réponse</button>
    </div>`;

  threadEl.querySelectorAll('[data-canned-id]').forEach(chip=>chip.addEventListener('click',()=>{
    const c=adminCannedResponses.find(x=>x.id===chip.dataset.cannedId);
    if(!c)return;
    const ta=document.getElementById('admin-ticket-reply-input');
    ta.value=ta.value?`${ta.value}\n\n${c.body}`:c.body;
    ta.focus();
  }));
  document.getElementById('admin-ticket-status-select').addEventListener('change',async e=>{
    try{await API.adminSetTicketStatus(ticketId,e.target.value);}
    catch(err){alert(err.message);}
  });
  document.getElementById('btn-admin-send-reply').addEventListener('click',async()=>{
    const msg=document.getElementById('admin-ticket-reply-input').value.trim();
    if(!msg)return;
    const status=document.getElementById('admin-ticket-status-select').value;
    const btn=document.getElementById('btn-admin-send-reply');btn.disabled=true;btn.textContent='Envoi…';
    try{
      await API.adminReplyTicket(ticketId,msg,status);
      openAdminTicketDetail(ticketId);
      loadAdminTicketsList();
    }catch(e){alert(e.message);}
    finally{btn.disabled=false;btn.textContent='Envoyer la réponse';}
  });
}

async function loadAdminCannedResponses(){
  try{
    adminCannedResponses=await API.getCannedResponses();
    renderCannedResponsesList();
  }catch(e){
    const c=document.getElementById('admin-canned-list');
    if(c)c.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(e.message)}</p>`;
  }
}

function renderCannedResponsesList(){
  const wrap=document.getElementById('admin-canned-list');
  if(!wrap)return;
  wrap.innerHTML=adminCannedResponses.length?adminCannedResponses.map(c=>`
    <div class="canned-item">
      <span class="canned-item-title">${esc(c.title)}</span>
      <button class="btn-del" data-cid="${c.id}">✕</button>
    </div>`).join(''):'<p style="color:var(--text3);font-size:13px;">Aucune réponse préfaite.</p>';
  wrap.querySelectorAll('[data-cid]').forEach(btn=>btn.addEventListener('click',async()=>{
    if(!confirm('Supprimer cette réponse préfaite ?'))return;
    try{await API.deleteCannedResponse(btn.dataset.cid);loadAdminCannedResponses();}
    catch(e){alert(e.message);}
  }));
}

async function addCannedResponse(){
  const title=document.getElementById('canned-title-input').value.trim();
  const body=document.getElementById('canned-body-input').value.trim();
  if(!title||!body)return;
  try{
    await API.addCannedResponse(title,body);
    document.getElementById('canned-title-input').value='';
    document.getElementById('canned-body-input').value='';
    loadAdminCannedResponses();
  }catch(e){alert(e.message);}
}

// ── Statistiques d'usage (entries-stats + events-stats) ────

async function loadAdminUsageStats(){
  document.getElementById('admin-usage-period-filters')?.querySelectorAll('.admin-support-filter').forEach(btn=>{
    if(!btn.dataset.wired){
      btn.dataset.wired='1';
      btn.addEventListener('click',()=>{
        adminUsagePeriod=btn.dataset.period;
        document.querySelectorAll('#admin-usage-period-filters .admin-support-filter').forEach(b=>b.classList.toggle('active',b===btn));
        loadAdminUsageStats();
      });
    }
  });
  const toggleBtn=document.getElementById('btn-toggle-exclude-users');
  if(toggleBtn&&!toggleBtn.dataset.wired){
    toggleBtn.dataset.wired='1';
    toggleBtn.addEventListener('click',()=>{
      const list=document.getElementById('admin-usage-exclude-list');
      const opening=list.style.display==='none';
      list.style.display=opening?'':'none';
      toggleBtn.textContent=opening?'Exclure des utilisateurs ▴':'Exclure des utilisateurs ▾';
    });
  }
  renderExcludeUsersList();

  const exclude=[...adminUsageExcluded];
  const [entriesStats,eventsStats]=await Promise.all([
    API.adminGetEntriesStats(adminUsagePeriod,exclude).catch(e=>({error:e.message})),
    API.adminGetEventsStats(adminUsagePeriod,exclude).catch(e=>({error:e.message})),
  ]);
  renderEntriesCharts(entriesStats);
  renderEventsCharts(eventsStats);
}

function renderExcludeUsersList(){
  const wrap=document.getElementById('admin-usage-exclude-list');
  if(!wrap)return;
  if(!adminUsersCache.length){wrap.innerHTML='<p style="color:var(--text3);font-size:12px;">Aucun utilisateur.</p>';return;}
  wrap.innerHTML=adminUsersCache.map(u=>`
    <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;">
      <input type="checkbox" data-exclude-uid="${u.id}" ${adminUsageExcluded.has(u.id)?'checked':''}/>
      ${esc(u.username||u.email)}
    </label>`).join('');
  wrap.querySelectorAll('[data-exclude-uid]').forEach(cb=>cb.addEventListener('change',e=>{
    const uid=e.target.dataset.excludeUid;
    if(e.target.checked)adminUsageExcluded.add(uid);else adminUsageExcluded.delete(uid);
    loadAdminUsageStats();
  }));
}

function renderEntriesCharts(stats){
  const container=document.getElementById('admin-entries-charts');
  if(!container)return;
  container.innerHTML='';
  if(stats.error){container.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(stats.error)}</p>`;return;}
  if(!stats.total){container.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucune entrée sur cette période.</p>';return;}
  const summary=document.createElement('p');
  summary.style.cssText='font-size:13px;color:var(--text2);margin-bottom:8px;';
  summary.textContent=`${stats.total} entrée${stats.total>1?'s':''} au total`;
  container.appendChild(summary);
  if(stats.timeline?.length){
    addChart(container,'Au fil du temps','line',stats.timeline.map(t=>t.date),stats.timeline.map(t=>t.count),['#7C6FE0']);
  }
  if(stats.perUser?.length){
    addChart(container,'Par utilisateur','bar',stats.perUser.map(u=>u.username),stats.perUser.map(u=>u.count),['#52C07A','#E0B84A','#7C6FE0','#E05252','#4AA8E0']);
  }
}

function renderEventsCharts(stats){
  const container=document.getElementById('admin-events-charts');
  if(!container)return;
  container.innerHTML='';
  if(stats.error){container.innerHTML=`<p style="color:var(--danger);font-size:13px;">Erreur : ${esc(stats.error)}</p>`;return;}
  if(!stats.total){container.innerHTML='<p style="color:var(--text3);font-size:13px;">Aucun événement enregistré sur cette période.</p>';return;}
  const EVENT_LABELS={roulette_spin:'Roulette',stats_view:'Graphiques',export_all:'Export complet',export_csv:'Export CSV',wiki_extract:'Extraction Wikipédia'};
  const summary=document.createElement('p');
  summary.style.cssText='font-size:13px;color:var(--text2);margin-bottom:8px;';
  summary.textContent=`${stats.total} événement${stats.total>1?'s':''} au total`;
  container.appendChild(summary);
  if(stats.perType?.length){
    addChart(container,'Par fonctionnalité','doughnut',stats.perType.map(t=>EVENT_LABELS[t.event_type]||t.event_type),stats.perType.map(t=>t.count),['#7C6FE0','#52C07A','#E0B84A','#E05252','#4AA8E0']);
  }
  if(stats.perUser?.length){
    addChart(container,'Par utilisateur','bar',stats.perUser.map(u=>u.username),stats.perUser.map(u=>u.count),['#52C07A','#E0B84A','#7C6FE0','#E05252','#4AA8E0']);
  }
}