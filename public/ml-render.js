// ml-render.js — Rendu principal, vues cartes et stats
'use strict';

function render(){renderTabs();renderStats();renderContent();}

function renderTabs(){
  const nav=document.getElementById('tabs-nav');
  nav.innerHTML=state.categories.map(cat=>`<button class="tab-btn ${cat.id===activeCatId?'active':''}" style="--tab-color:${cat.color}" data-id="${cat.id}"><span class="tab-icon">${cat.icon}</span>${esc(cat.name)}</button>`).join('');
  nav.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{activeCatId=btn.dataset.id;localStorage.setItem(userKey('ml_active_cat'),activeCatId);loadSortForCat(activeCatId);searchQuery='';filterFav=false;filterStatus='all';filterTag='';tableSelectMode=false;tableSelected.clear();render();}));
}

function renderStats(){
  const bar=document.getElementById('stats-bar'),cat=getActiveCat();
  const statsConfig=cat?getCatStatsConfig(cat):[];
  if(!cat||!statsConfig.length){bar.innerHTML='';bar.style.display='none';return;}
  bar.style.display='';
  const now=new Date();
  const computeStat=key=>{
    switch(key){
      case 'total':return{num:cat.entries.length,lbl:'Total',color:cat.color};
      case 'moyenne':{
        const withNote=cat.entries.filter(e=>e.note>0);
        const moy=withNote.length?(withNote.reduce((a,e)=>a+e.note,0)/withNote.length).toFixed(1).replace('.',','):'—';
        return{num:`${moy}${withNote.length?'★':''}`,lbl:'Moyenne',color:'#F0C040'};
      }
      case 'favoris':return{num:cat.entries.filter(e=>e.favorite).length,lbl:'Favoris',color:'#E09E52'};
      case 'a_voir':return{num:cat.entries.filter(isUnseen).length,lbl:'À voir',color:'#5B9BD5'};
      case 'vus':return{num:cat.entries.filter(e=>!isUnseen(e)).length,lbl:'Vus',color:'#52C07A'};
      case 'ce_mois':return{num:cat.entries.filter(e=>e._created&&new Date(e._created).getMonth()===now.getMonth()&&new Date(e._created).getFullYear()===now.getFullYear()).length,lbl:'Ce mois',color:'#52C07A'};
      case 'cette_annee':return{num:cat.entries.filter(e=>e._created&&new Date(e._created).getFullYear()===now.getFullYear()).length,lbl:'Cette année',color:'#52C07A'};
      default:return null;
    }
  };
  bar.innerHTML=statsConfig.map(key=>{
    const s=computeStat(key);if(!s)return'';
    return`<div class="stat-chip" style="--chip-color:${s.color}"><span class="stat-num">${s.num}</span><span class="stat-lbl">${s.lbl}</span></div>`;
  }).join('');
}

function renderContent(){
  const main=document.getElementById('main-content'),cat=getActiveCat();
  if(!cat){main.innerHTML=`<div class="empty-state"><span class="empty-icon">📂</span><h3>Aucune catégorie</h3><p>Crée ta première catégorie avec ⊕ ou consulte le tutoriel.</p></div>`;return;}

  let entries=[...cat.entries];
  if(searchQuery){const q=searchQuery.toLowerCase();entries=entries.filter(e=>cat.columns.some(col=>String(e[col.id]??'').toLowerCase().includes(q)));}
  if(filterFav)entries=entries.filter(e=>e.favorite);
  if(filterStatus==='unseen')entries=entries.filter(e=>isUnseen(e));
  if(filterStatus==='hide-unseen')entries=entries.filter(e=>!isUnseen(e));
  if(filterTag)entries=entries.filter(e=>(e.tags||[]).includes(filterTag));

  if(sortKey){
    const col=cat.columns.find(c=>c.id===sortKey);
    entries.sort((a,b)=>{
      let va=a[sortKey]??null,vb=b[sortKey]??null;
      if(col&&(col.type==='number'||col.type==='rating')){va=(va===null||va==='')?-Infinity:Number(va);vb=(vb===null||vb==='')?-Infinity:Number(vb);return sortDir==='asc'?va-vb:vb-va;}
      if(col&&col.type==='date'){va=va?parseDate(va):0;vb=vb?parseDate(vb):0;return sortDir==='asc'?va-vb:vb-va;}
      va=String(va??'');vb=String(vb??'');const cmp=va.localeCompare(vb,'fr',{numeric:true,sensitivity:'base'});return sortDir==='asc'?cmp:-cmp;
    });
  }else entries.sort((a,b)=>{if(a._order!==undefined&&b._order!==undefined)return a._order-b._order;return(b._created||0)-(a._created||0);});

  const nameCol=cat.columns.find(c=>c.required&&c.type==='text')||cat.columns[0];
  const sortOptions=cat.columns.map(c=>`<option value="${c.id}" ${sortKey===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  main.innerHTML=`
    <div id="save-indicator" class="save-indicator save-saved">✓ Sauvegardé</div>
    <div class="cat-actions-bar">
      <div class="view-toggle view-toggle-mode" id="view-toggle-mode">
        <button class="view-btn ${viewMode==='cards'?'active':''}" id="vb-cards" title="Cartes"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
        <button class="view-btn ${viewMode==='table'?'active':''}" id="vb-table" title="Tableur"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg></button>
        <button class="view-btn ${viewMode==='calendar'?'active':''}" id="vb-cal" title="Calendrier" ${!cat.columns.find(c=>c.type==='date')?'style="display:none;"':''}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
      </div>
      <button class="btn-more-filters" id="btn-more-filters" title="Plus d'options">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      </button>
    </div>
    <div class="secondary-controls" id="secondary-controls">
      ${viewMode==='cards'?`<div class="view-toggle view-toggle-layout" id="view-toggle-layout">
        <button class="view-btn ${cardLayout==='cards-list'?'active':''}" id="vb-list" title="Liste"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <button class="view-btn ${cardLayout==='cards-grid'?'active':''}" id="vb-grid" title="Grille"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
        <button class="view-btn ${cardLayout==='cards-compact'?'active':''}" id="vb-compact" title="Compact"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="17" width="18" height="4"/></svg></button>
      </div>`:''}
      <button class="btn-manage-cols" id="btn-manage-cols"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg> Colonnes</button>
      <button class="btn-help" data-help="colonnes">?</button>
      <button class="btn-export" id="btn-export-csv" title="Exporter en CSV">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        CSV
      </button>
      <select class="filter-btn" id="filter-tag" style="font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text2);padding:6px 10px;">
        <option value="">🏷 Tags</option>
        ${[...new Set(cat.entries.flatMap(e=>e.tags||[]))].sort().map(t=>`<option value="${esc(t)}" ${filterTag===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select>
      <button class="filter-btn" id="filter-reset" style="${filterFav||filterStatus!=='all'?'':'opacity:.4;pointer-events:none;'}">✕ Reset</button>
    </div>
    <div class="toolbar">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" class="search-input" id="search-input" placeholder="Rechercher… (N=nouvelle entrée, F=favoris)" value="${esc(searchQuery)}" />
      </div>
      <div class="sort-wrap">
        <select class="sort-select" id="sort-select"><option value="">Ordre manuel</option>${sortOptions}</select>
        <button class="sort-dir-btn" id="sort-dir-btn">${sortDir==='asc'?'↑':'↓'}</button>
      </div>
    </div>
    <div class="filter-bar">
      <button class="filter-btn ${filterFav?'active':''}" id="filter-fav">⭐ Favoris</button>
      <button class="filter-btn ${filterStatus==='unseen'?'active':''}" id="filter-unseen">👁 À voir</button>
      <button class="filter-btn ${filterStatus==='hide-unseen'?'active':''}" id="filter-hide-unseen">✓ Vus</button>
      <button class="btn-help" data-help="filtres" style="margin-left:auto;flex-shrink:0;">?</button>
    </div>
    <div id="view-container"></div>`;

  document.getElementById('btn-more-filters')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('secondary-controls').classList.toggle('secondary-controls-open');});

  // Debounce recherche
  document.getElementById('search-input').addEventListener('input',e=>{
    clearTimeout(searchDebounce);
    searchDebounce=setTimeout(()=>{
      const si=document.getElementById('search-input');
      searchQuery=si?si.value:'';
      const cat=getActiveCat();
      if(!cat)return;
      const nameCol=cat.columns.find(c=>c.required&&c.type==='text')||cat.columns[0];
      let entries=[...cat.entries];
      if(searchQuery){const q=searchQuery.toLowerCase();entries=entries.filter(e=>cat.columns.some(col=>String(e[col.id]??'').toLowerCase().includes(q)));}
      if(filterFav)entries=entries.filter(e=>e.favorite);
      if(filterStatus==='unseen')entries=entries.filter(e=>isUnseen(e));
      if(filterStatus==='hide-unseen')entries=entries.filter(e=>!isUnseen(e));
  if(filterTag)entries=entries.filter(e=>(e.tags||[]).includes(filterTag));
      if(sortKey){const col=cat.columns.find(c=>c.id===sortKey);entries.sort((a,b)=>{let va=a[sortKey]??null,vb=b[sortKey]??null;if(col&&(col.type==='number'||col.type==='rating')){va=(va===null||va==='')?-Infinity:Number(va);vb=(vb===null||vb==='')?-Infinity:Number(vb);return sortDir==='asc'?va-vb:vb-va;}if(col&&col.type==='date'){va=va?parseDate(va):0;vb=vb?parseDate(vb):0;return sortDir==='asc'?va-vb:vb-va;}va=String(va??'');vb=String(vb??'');const cmp=va.localeCompare(vb,'fr',{numeric:true,sensitivity:'base'});return sortDir==='asc'?cmp:-cmp;});}
      else entries.sort((a,b)=>{if(a._order!==undefined&&b._order!==undefined)return a._order-b._order;return(b._created||0)-(a._created||0);});
      if(viewMode==='table')renderTableView(cat,entries,nameCol);
      else renderCardsView(cat,entries,nameCol);
      renderStats();
      // Restaurer le focus après le render
      const siAfter=document.getElementById('search-input');
      if(siAfter){const pos=siAfter.value.length;siAfter.focus();try{siAfter.setSelectionRange(pos,pos);}catch{}}
    },180);
  });
  document.getElementById('sort-select').addEventListener('change',e=>{sortKey=e.target.value;saveSortForCat(activeCatId);renderContent();});
  document.getElementById('sort-dir-btn').addEventListener('click',()=>{sortDir=sortDir==='asc'?'desc':'asc';saveSortForCat(activeCatId);renderContent();});
  document.getElementById('btn-manage-cols').addEventListener('click',openColumnsModal);
  document.getElementById('btn-export-csv').addEventListener('click',exportCSV);
  document.getElementById('vb-cards').addEventListener('click',()=>{viewMode='cards';tableSelectMode=false;tableSelected.clear();renderContent();});
  document.getElementById('vb-table').addEventListener('click',()=>{viewMode='table';renderContent();});
  document.getElementById('vb-cal')?.addEventListener('click',()=>{viewMode='calendar';renderContent();});
  document.getElementById('vb-list')?.addEventListener('click',()=>{cardLayout='cards-list';renderContent();});
  document.getElementById('vb-grid')?.addEventListener('click',()=>{cardLayout='cards-grid';renderContent();});
  document.getElementById('vb-compact')?.addEventListener('click',()=>{cardLayout='cards-compact';renderContent();});
  document.getElementById('filter-fav').addEventListener('click',()=>{filterFav=!filterFav;renderContent();});
  document.getElementById('filter-unseen').addEventListener('click',()=>{filterStatus=filterStatus==='unseen'?'all':'unseen';renderContent();});
  document.getElementById('filter-hide-unseen').addEventListener('click',()=>{filterStatus=filterStatus==='hide-unseen'?'all':'hide-unseen';renderContent();});
  document.getElementById('filter-reset').addEventListener('click',()=>{filterFav=false;filterStatus='all';filterTag='';renderContent();});
  document.getElementById('filter-tag').addEventListener('change',e=>{filterTag=e.target.value;renderContent();});

  if(viewMode==='table')renderTableView(cat,entries,nameCol);
  else if(viewMode==='calendar')renderCalendarView(cat,entries);
  else renderCardsView(cat,entries,nameCol);
}

function renderCardsView(cat,entries,nameCol){
  const container=document.getElementById('view-container');
  const visibleCols=cat.columns.filter(c=>!c.required);
  const isCompact=cardLayout==='cards-compact',isGrid=cardLayout==='cards-grid';
  const listClass=isGrid?'entries-grid':isCompact?'entries-compact':'entries-list';

  container.innerHTML=`<div class="${listClass}" id="entries-list">
    ${entries.length===0
      ?`<div class="empty-state"><span class="empty-icon">${cat.icon}</span><h3>${searchQuery||filterFav||filterStatus!=='all'?'Aucun résultat':'Aucune entrée'}</h3><p>${searchQuery?'Essaie un autre terme.':filterFav?'Aucun favori.':'Appuie sur + pour ajouter.'}</p></div>`
      :entries.map((entry,idx)=>{
        const name=entry[nameCol?.id]||'(sans titre)',isFav=!!entry.favorite;
        let progressBar='';
        const sucObt=Number(entry.succes||0),sucTot=Number(entry.succes_tot||0);
        if(sucTot>0){const pct=Math.min(100,Math.round((sucObt/sucTot)*100));const trophy=pct>=100?' 🏆':'';progressBar=`<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${pct}%;${pct>=100?'background:var(--success);':''}"></div></div><span class="progress-lbl" style="font-size:13px;font-weight:600;">${sucObt}/${sucTot}${trophy}</span></div>`;}

        const fields=isCompact?'':visibleCols.map(col=>{
          const val=entry[col.id];
          if(val===null||val===undefined||val==='')return'';
          if(col.type==='rating'){const n=Number(val);return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-rating field-clickable" data-col="${col.id}" data-entry="${entry.id}" style="font-size:18px;">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span></div>`;}
          if(col.type==='textarea')return`<div class="entry-field entry-field-full"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val entry-text-preview field-clickable" data-col="${col.id}" data-entry="${entry.id}">${esc(val)}</span></div>`;
          const display=col.type==='date'?formatDate(val):esc(String(val));
          return`<div class="entry-field"><span class="entry-field-lbl">${esc(col.name)}</span><span class="entry-field-val field-clickable" data-col="${col.id}" data-entry="${entry.id}">${display}</span></div>`;
        }).filter(Boolean).join('');

        const draggable=!sortKey&&cardLayout==='cards-list';
        const tagsHtml=entry.tags?.length?`<div class="entry-tags">${entry.tags.map(t=>`<span class="entry-tag">${esc(t)}</span>`).join('')}</div>`:'';
        return`<div class="entry-card${draggable?' is-draggable':''}${isCompact?' entry-compact':''}" data-entry-id="${entry.id}" style="--card-accent:${cat.color};animation-delay:${Math.min(idx*.02,.3)}s" ${draggable?'draggable="true"':''}>
          <div class="entry-card-header">
            <div class="entry-card-name field-clickable" data-col="${nameCol?.id}" data-entry="${entry.id}">${esc(name)}</div>
            <button class="fav-btn ${isFav?'active':''}" data-entry="${entry.id}" title="${isFav?'Retirer des favoris':'Ajouter aux favoris'}">${isFav?'⭐':'☆'}</button>
            ${draggable?'<div class="drag-handle" title="Réordonner">⠿</div>':''}
          </div>
          ${progressBar}
          ${tagsHtml}
          <div class="entry-fields">${fields}</div>
        </div>`;
      }).join('')}
  </div>`;

  container.querySelectorAll('.fav-btn').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const entry=getActiveCat().entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;entry.favorite=!entry.favorite;scheduleSave();renderContent();renderStats();}));
  container.querySelectorAll('.field-clickable').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();openInlinePopup(el.dataset.entry,el.dataset.col,el);}));
  container.querySelectorAll('.entry-card').forEach(card=>card.addEventListener('click',e=>{if(!e.target.closest('.field-clickable')&&!e.target.closest('.drag-handle')&&!e.target.closest('.fav-btn'))openEntryModal(card.dataset.entryId);}));
  if(!sortKey&&cardLayout==='cards-list')initEntryDrag(cat);
}


// ── VUE CALENDRIER ────────────────────────────────────────
function renderCalendarView(cat, entries){
  const container=document.getElementById('view-container');
  const dateCols=cat.columns.filter(c=>c.type==='date');
  if(!dateCols.length){
    container.innerHTML='<div class="empty-state"><span class="empty-icon">📅</span><h3>Aucune colonne date</h3><p>Ajoute une colonne de type Date pour utiliser la vue calendrier.</p></div>';
    return;
  }
  let calDateColId=loadCalColForCat(cat.id);
  if(!dateCols.find(c=>c.id===calDateColId))calDateColId=dateCols[0].id;
  const dateCol=dateCols.find(c=>c.id===calDateColId);
  const nameCol=cat.columns.find(c=>c.required&&c.type==='text')||cat.columns[0];

  // Mois courant
  const now=new Date();
  let calYear=parseInt(container.dataset.calYear)||now.getFullYear();
  let calMonth=parseInt(container.dataset.calMonth);
  if(isNaN(calMonth))calMonth=now.getMonth();

  const firstDay=new Date(calYear,calMonth,1);
  const lastDay=new Date(calYear,calMonth+1,0);
  const startDow=(firstDay.getDay()+6)%7; // Lundi=0

  // Grouper entrées par date
  const byDate={};
  entries.forEach(e=>{
    const d=e[dateCol.id];
    if(!d)return;
    const key=toInputDate(d)||d.slice(0,10);
    if(!byDate[key])byDate[key]=[];
    byDate[key].push(e);
  });

  const monthNames=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const days=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  let cells='';
  // Cases vides avant le 1er
  for(let i=0;i<startDow;i++) cells+=`<div class="cal-cell cal-empty"></div>`;
  // Cases du mois
  for(let d=1;d<=lastDay.getDate();d++){
    const key=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEntries=byDate[key]||[];
    const isToday=key===todayStr();
    const dayContent=dayEntries.length>2
      ?`<div class="cal-dots">${dayEntries.map(e=>`<span class="cal-dot" data-entry="${e.id}" title="${esc(e[nameCol?.id]||'?')}" style="--card-accent:${cat.color};"></span>`).join('')}</div>`
      :dayEntries.map(e=>`<div class="cal-entry" data-entry="${e.id}" style="--card-accent:${cat.color};">${esc(e[nameCol?.id]||'?')}</div>`).join('');
    cells+=`<div class="cal-cell ${isToday?'cal-today':''}" data-date="${key}">
      <div class="cal-day-num">${d}</div>
      ${dayContent}
    </div>`;
  }

  // Dates non reconnues (rétrocompat + correction assistée)
  const broken=entries.filter(e=>{const v=e[dateCol.id];return v&&!toInputDate(v);});
  const hideBanner=localStorage.getItem(userKey('ml_hide_broken_banner'))==='true';
  const otherCols=cat.columns.filter(c=>c.id!==dateCol.id&&c.id!==nameCol?.id);
  const brokenRows=broken.map(e=>{
    const raw=e[dateCol.id];
    const guess=guessDate(raw);
    const expanded=calBrokenExpanded.has(e.id);
    const otherFields=expanded?otherCols.map(c=>{
      const v=e[c.id];const disp=(v===null||v===undefined||v==='')?'—':(c.type==='date'?formatDate(v):String(v));
      return`<div class="cal-broken-field"><span>${esc(c.name)}</span><span>${esc(disp)}</span></div>`;
    }).join(''):'';
    return`<div class="cal-broken-row" data-entry="${e.id}">
      <div class="cal-broken-row-head"><strong>${esc(e[nameCol?.id]||'?')}</strong><span class="cal-broken-raw">"${esc(raw)}"</span></div>
      <div class="cal-broken-actions">
        ${guess?`<span class="cal-broken-guess">Suggestion : ${esc(formatDate(guess))}</span><button class="btn btn-sm cal-broken-accept" data-entry="${e.id}" data-guess="${guess}">✓ Utiliser</button>`:'<span class="cal-broken-guess cal-broken-noguess">Aucune suggestion trouvée</span>'}
        <input type="date" class="cal-broken-manual" data-entry="${e.id}" value="${guess||''}"/>
        <button class="btn btn-sm btn-ghost cal-broken-save" data-entry="${e.id}">Enregistrer</button>
        <button class="cal-broken-toggle" data-entry="${e.id}">${expanded?'▴ masquer les données':'▾ voir toutes les données'}</button>
      </div>
      ${otherFields?`<div class="cal-broken-fields">${otherFields}</div>`:''}
    </div>`;
  }).join('');
  const bannerInner=broken.length>0
    ?`<button class="cal-broken-toggle-btn" id="cal-broken-toggle-btn">⚠️ ${broken.length} date${broken.length>1?'s':''} à valider</button>`
    :`<button class="cal-broken-toggle-btn cal-broken-toggle-btn-empty" id="cal-broken-toggle-btn">Toutes les dates sont valides</button>`;
  const bannerHTML=hideBanner
    ?`<div class="cal-broken-mini-wrap"><button class="filter-btn ${broken.length>0?'active':''}" id="cal-broken-toggle-btn">📅 Dates</button><button class="btn-help" data-help="cal_broken_banner" title="Aide">?</button></div>`
    :`<div class="cal-broken-banner ${broken.length===0?'cal-broken-banner-empty':''}">${bannerInner}<button class="btn-help" data-help="cal_broken_banner" title="Aide">?</button></div>`;
  const panelHTML=`<div class="cal-broken-panel ${calBrokenOpen?'':'cal-broken-panel-hidden'}" id="cal-broken-panel">${broken.length>0?brokenRows:'<p class="cal-broken-empty-msg">Aucune date à corriger 🎉</p>'}</div>`;

  const colSelectorHTML=dateCols.length>1?`<div class="cal-col-select-row">
    <span class="cal-col-select-label">Date affichée</span>
    <select id="cal-col-select">${dateCols.map(c=>`<option value="${c.id}" ${c.id===calDateColId?'selected':''}>${esc(c.name||'Date')}</option>`).join('')}</select>
  </div>`:'';

  container.dataset.calYear=calYear;
  container.dataset.calMonth=calMonth;
  container.innerHTML=`
    ${bannerHTML}
    ${panelHTML}
    ${colSelectorHTML}
    <div class="cal-nav">
      <button class="btn btn-ghost btn-sm" id="cal-prev">◀</button>
      <span style="font-weight:600;font-size:15px;">${monthNames[calMonth]} ${calYear}</span>
      <button class="btn btn-ghost btn-sm" id="cal-next">▶</button>
    </div>
    <div class="cal-grid">
      ${days.map(d=>`<div class="cal-header-cell">${d}</div>`).join('')}
      ${cells}
    </div>`;

  container.querySelector('#cal-col-select')?.addEventListener('change',e=>{
    saveCalColForCat(cat.id,e.target.value);
    renderCalendarView(cat,entries);
  });

  container.querySelector('#cal-prev').addEventListener('click',()=>{
    if(calMonth===0){calMonth=11;calYear--;}else calMonth--;
    container.dataset.calYear=calYear;container.dataset.calMonth=calMonth;
    renderCalendarView(cat,entries);
  });
  container.querySelector('#cal-next').addEventListener('click',()=>{
    if(calMonth===11){calMonth=0;calYear++;}else calMonth++;
    container.dataset.calYear=calYear;container.dataset.calMonth=calMonth;
    renderCalendarView(cat,entries);
  });
  container.querySelectorAll('.cal-entry,.cal-dot').forEach(el=>el.addEventListener('click',e=>{
    e.stopPropagation();openEntryModal(el.dataset.entry);
  }));
  container.querySelectorAll('.cal-cell:not(.cal-empty)').forEach(cell=>cell.addEventListener('click',e=>{
    const dateVal=cell.dataset.date;
    openDayPopup(dateVal,byDate[dateVal]||[],nameCol,cell,dateCol.id);
  }));

  const toggleBtn=container.querySelector('#cal-broken-toggle-btn');
  if(toggleBtn)toggleBtn.addEventListener('click',()=>{calBrokenOpen=!calBrokenOpen;renderCalendarView(cat,entries);});
  container.querySelectorAll('.cal-broken-accept').forEach(btn=>btn.addEventListener('click',()=>{
    const entry=cat.entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;
    entry[dateCol.id]=btn.dataset.guess;scheduleSave();renderContent();
  }));
  container.querySelectorAll('.cal-broken-save').forEach(btn=>btn.addEventListener('click',()=>{
    const row=btn.closest('.cal-broken-row');const val=row.querySelector('.cal-broken-manual').value;
    if(!val)return;
    const entry=cat.entries.find(en=>en.id===btn.dataset.entry);if(!entry)return;
    entry[dateCol.id]=val;scheduleSave();renderContent();
  }));
  container.querySelectorAll('.cal-broken-toggle').forEach(btn=>btn.addEventListener('click',()=>{
    if(calBrokenExpanded.has(btn.dataset.entry))calBrokenExpanded.delete(btn.dataset.entry);else calBrokenExpanded.add(btn.dataset.entry);
    renderCalendarView(cat,entries);
  }));
}

function openDayPopup(dateVal,dayEntries,nameCol,anchor,dateColId){
  closeInlinePopup();
  const popup=document.createElement('div');
  popup.id='active-inline-popup';
  popup.className='day-popup';
  const rect=anchor.getBoundingClientRect();
  popup.style.cssText=`position:fixed;top:${Math.min(rect.bottom+6,window.innerHeight-260)}px;left:${Math.min(rect.left,window.innerWidth-260)}px;`;
  popup.innerHTML=`<div class="day-popup-title">${formatDate(dateVal)}</div>
    <div class="day-popup-list">${dayEntries.length?dayEntries.map(e=>`<button class="day-popup-item" data-entry="${e.id}">${esc(e[nameCol?.id]||'?')}</button>`).join(''):'<p class="day-popup-empty">Rien ce jour-là.</p>'}</div>
    <button class="btn btn-ghost btn-sm day-popup-add" id="day-popup-add">+ Ajouter un média à cette date</button>`;
  document.body.appendChild(popup);
  popup.querySelectorAll('.day-popup-item').forEach(btn=>btn.addEventListener('click',()=>{closeInlinePopup();openEntryModal(btn.dataset.entry);}));
  popup.querySelector('#day-popup-add').addEventListener('click',()=>{
    closeInlinePopup();
    openEntryModal();
    setTimeout(()=>{
      const dateInput=dateColId&&document.getElementById('field-'+dateColId);
      if(dateInput)dateInput.value=dateVal;
    },50);
  });
  setTimeout(()=>document.addEventListener('click',outsidePopup),10);
}
