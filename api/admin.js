// api/admin.js
const { supabaseAdmin, requireAdmin, respond, handler, purgeUserData } = require('./_supabase');

module.exports = handler(async (req, res) => {
  const adminUser = await requireAdmin(req);
  const action = req.query?.action || '';

  if (req.method === 'GET' && action === 'stats') {
    const { count: total }  = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true});
    const { count: admins } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).eq('role','admin');
    const { count: shared } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).eq('share_enabled',true);
    const weekAgo = new Date(Date.now()-7*24*60*60*1000).toISOString();
    const { count: recent } = await supabaseAdmin.from('profiles').select('*',{count:'exact',head:true}).gte('created_at',weekAgo);
    return respond(res,200,{total_users:total,admins,sharing_enabled:shared,new_last_7_days:recent});
  }

  // ── Palier facile : entrées ajoutées, calculées rétroactivement depuis
  // le champ _created de chaque entrée dans user_data.categories (pas de
  // nouvelle table nécessaire). ─────────────────────────────────────────
  if (req.method === 'GET' && action === 'entries-stats') {
    const period = req.query.period || 'all'; // 'all' | 'month' | 'year'
    const exclude = (req.query.exclude || '').split(',').filter(Boolean);
    // Deux requêtes séparées + jointure en JS plutôt qu'un embed PostgREST
    // (user_data → profiles) qui n'est pas garanti configuré comme telle
    // relation FK exploitable par PostgREST.
    const [{ data: rows, error }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('user_data').select('user_id, categories'),
      supabaseAdmin.from('profiles').select('id, username'),
    ]);
    if (error) throw error;
    const usernameOf = Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));

    const now = new Date();
    const cutoff = period==='month' ? new Date(now.getFullYear(),now.getMonth(),1)
                 : period==='year'  ? new Date(now.getFullYear(),0,1)
                 : null;

    const byUser = {};
    const byDay = {};
    let total = 0;
    for (const row of (rows||[])) {
      if (exclude.includes(row.user_id)) continue;
      const username = usernameOf[row.user_id] || '(supprimé)';
      const cats = Array.isArray(row.categories) ? row.categories : [];
      for (const cat of cats) {
        for (const entry of (cat.entries||[])) {
          if (!entry._created) continue;
          const d = new Date(entry._created);
          if (cutoff && d < cutoff) continue;
          total++;
          byUser[username] = (byUser[username]||0)+1;
          const dayKey = d.toISOString().slice(0,10);
          byDay[dayKey] = (byDay[dayKey]||0)+1;
        }
      }
    }
    const timeline = Object.entries(byDay).sort(([a],[b])=>a<b?-1:1).map(([date,count])=>({date,count}));
    const perUser = Object.entries(byUser).sort(([,a],[,b])=>b-a).map(([username,count])=>({username,count}));
    return respond(res,200,{total,timeline,perUser});
  }

  // ── Palier lourd : usage_events (quelles fonctionnalités sont utilisées) ─
  if (req.method === 'GET' && action === 'events-stats') {
    const period = req.query.period || 'all';
    const exclude = (req.query.exclude || '').split(',').filter(Boolean);
    const now = new Date();
    const cutoff = period==='month' ? new Date(now.getFullYear(),now.getMonth(),1).toISOString()
                 : period==='year'  ? new Date(now.getFullYear(),0,1).toISOString()
                 : null;

    let q = supabaseAdmin.from('usage_events').select('event_type, user_id, created_at');
    if (cutoff) q = q.gte('created_at', cutoff);
    const [{ data: rows, error }, { data: profiles }] = await Promise.all([
      q,
      supabaseAdmin.from('profiles').select('id, username'),
    ]);
    if (error) throw error;
    const usernameOf = Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));

    const byType = {}, byUser = {};
    let total = 0;
    for (const row of (rows||[])) {
      if (exclude.includes(row.user_id)) continue;
      total++;
      byType[row.event_type] = (byType[row.event_type]||0)+1;
      const username = usernameOf[row.user_id] || '(supprimé)';
      byUser[username] = (byUser[username]||0)+1;
    }
    const perType = Object.entries(byType).sort(([,a],[,b])=>b-a).map(([event_type,count])=>({event_type,count}));
    const perUser = Object.entries(byUser).sort(([,a],[,b])=>b-a).map(([username,count])=>({username,count}));
    return respond(res,200,{total,perType,perUser});
  }

  if (req.method === 'GET' && action === 'users') {
    const page=Math.max(1,parseInt(req.query.page)||1),limit=50,from=(page-1)*limit;
    const {data:users,error,count}=await supabaseAdmin.from('profiles')
      .select('id,username,email,role,share_enabled,created_at,last_login',{count:'exact'})
      .order('created_at',{ascending:false}).range(from,from+limit-1);
    if(error) throw error;
    return respond(res,200,{users:users||[],total:count,page,pages:Math.ceil(count/limit)});
  }

  if (req.method === 'GET' && action === 'config') {
    const {data}=await supabaseAdmin.from('site_config').select('key,value');
    return respond(res,200,Object.fromEntries((data||[]).map(r=>[r.key,r.value])));
  }

  if (req.method === 'PUT' && action === 'config') {
    const shortFields=['site_name','site_logo','site_subtitle','site_logo_url','staging_banner_enabled','staging_banner_text','staging_banner_link'];
    const longFields=['legal_mentions','privacy_policy']; // textes légaux : plafond bien plus généreux que les champs courts
    for (const key of shortFields) {
      if (req.body[key]!==undefined) {
        const val=String(req.body[key]).slice(0,300).trim();
        await supabaseAdmin.from('site_config').upsert({key,value:val},{onConflict:'key'});
      }
    }
    for (const key of longFields) {
      if (req.body[key]!==undefined) {
        const val=String(req.body[key]).slice(0,20000).trim();
        await supabaseAdmin.from('site_config').upsert({key,value:val},{onConflict:'key'});
      }
    }
    return respond(res,200,{ok:true});
  }

  if (req.method === 'DELETE' && action === 'delete-user') {
    const {user_id}=req.body;
    if(!user_id) return respond(res,400,{error:'user_id manquant'});
    if(user_id===adminUser.id) return respond(res,400,{error:'Impossible de supprimer son propre compte'});
    const {data:target}=await supabaseAdmin.from('profiles').select('role').eq('id',user_id).single();
    if(target?.role==='admin') return respond(res,403,{error:'Impossible de supprimer un admin'});
    await purgeUserData(user_id);
    return respond(res,200,{ok:true});
  }

  if (req.method === 'PUT' && action === 'set-role') {
    const {user_id,role}=req.body;
    if(!['user','admin'].includes(role)) return respond(res,400,{error:'Rôle invalide'});
    if(user_id===adminUser.id) return respond(res,400,{error:'Ne peut pas modifier son propre rôle'});
    await supabaseAdmin.from('profiles').update({role}).eq('id',user_id);
    return respond(res,200,{ok:true});
  }

  // ── Tutoriel ──────────────────────────────────────────────
  if (req.method === 'GET' && action === 'tutorial') {
    const {data}=await supabaseAdmin.from('tutorial_steps').select('*').order('position');
    return respond(res,200,data||[]);
  }
  if (req.method === 'PUT' && action === 'tutorial') {
    const {steps}=req.body;
    if(!Array.isArray(steps)) return respond(res,400,{error:'Format invalide'});
    await supabaseAdmin.from('tutorial_steps').delete().neq('id','00000000-0000-0000-0000-000000000000');
    if(steps.length>0) {
      const rows=steps.map((s,i)=>({title:String(s.title||'').slice(0,100),content:String(s.content||'').slice(0,500),icon:String(s.icon||'📌').slice(0,8),position:i}));
      await supabaseAdmin.from('tutorial_steps').insert(rows);
    }
    return respond(res,200,{ok:true});
  }

  // ── Help texts ────────────────────────────────────────────
  if (req.method === 'GET' && action === 'help-texts') {
    const {data}=await supabaseAdmin.from('help_texts').select('id,title,content');
    return respond(res,200,data||[]);
  }
  if (req.method === 'PUT' && action === 'help-texts') {
    const {id,title,content}=req.body;
    // Whitelist des data-help="..." existants dans le front. Léger, pas une
    // vraie faille (déjà admin-only), mais évite de créer silencieusement
    // des entrées orphelines. Si un nouveau bouton ? est ajouté au front,
    // ajouter son id ici aussi.
    const KNOWN_HELP_IDS=['cal_broken_banner','colonnes','filtres','graphiques','import','partage','roulette','wikipedia'];
    if(!id||!title||!content) return respond(res,400,{error:'Champs manquants'});
    if(!KNOWN_HELP_IDS.includes(id)) return respond(res,400,{error:'id inconnu (doit correspondre à un bouton ? existant)'});
    await supabaseAdmin.from('help_texts').upsert({id,title:String(title).slice(0,100),content:String(content).slice(0,1000)},{onConflict:'id'});
    return respond(res,200,{ok:true});
  }

  // ── Blacklist Wikipédia ───────────────────────────────────
  if (req.method === 'GET' && action === 'wiki-blacklist') {
    const {data,error}=await supabaseAdmin.from('wiki_blacklist_terms').select('id,type,pattern').order('created_at');
    if(error) throw error;
    return respond(res,200,data||[]);
  }
  if (req.method === 'POST' && action === 'wiki-blacklist') {
    const {type,pattern}=req.body;
    if(!['exact','regex'].includes(type)) return respond(res,400,{error:'Type invalide (exact ou regex attendu)'});
    const clean=String(pattern||'').trim().slice(0,200);
    if(!clean) return respond(res,400,{error:'Motif vide'});
    if(type==='regex'){
      try{ new RegExp(clean); }
      catch(e){ return respond(res,400,{error:'Regex invalide : '+e.message}); }
    }
    const {data,error}=await supabaseAdmin.from('wiki_blacklist_terms').insert({type,pattern:clean}).select('id,type,pattern').single();
    if(error) throw error;
    return respond(res,200,data);
  }
  if (req.method === 'DELETE' && action === 'wiki-blacklist') {
    const {id}=req.body;
    if(!id) return respond(res,400,{error:'id manquant'});
    const {error}=await supabaseAdmin.from('wiki_blacklist_terms').delete().eq('id',id);
    if(error) throw error;
    return respond(res,200,{ok:true});
  }

  respond(res,405,{error:'Méthode non autorisée'});
});
