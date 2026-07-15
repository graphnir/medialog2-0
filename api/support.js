// api/support.js — tickets de support (fil de discussion utilisateur ↔ admin)
const { supabaseAdmin, requireAuth, requireAdmin, respond, handler } = require('./_supabase');

const STATUSES = ['nouveau', 'en_cours', 'traite'];
const sortByCreatedAsc = (a, b) => new Date(a.created_at) - new Date(b.created_at);

module.exports = handler(async (req, res) => {
  const { action } = req.query;

  // ── Côté utilisateur ────────────────────────────────────

  if (req.method === 'GET' && action === 'my-tickets') {
    const user = await requireAuth(req);
    const { data, error } = await supabaseAdmin
      .from('contact_tickets')
      .select('*, contact_ticket_messages(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const tickets = (data || []).map(t => ({
      ...t,
      contact_ticket_messages: (t.contact_ticket_messages || []).sort(sortByCreatedAsc),
    }));
    return respond(res, 200, tickets);
  }

  if (req.method === 'POST' && action === 'new-ticket') {
    const user = await requireAuth(req);
    const { subject, message, contact_method } = req.body;
    if (!subject?.trim() || !message?.trim()) return respond(res, 400, { error: 'Sujet et message obligatoires' });
    const { data: ticket, error } = await supabaseAdmin.from('contact_tickets')
      .insert({
        user_id: user.id,
        subject: subject.trim().slice(0, 200),
        contact_method: contact_method?.trim().slice(0, 200) || null,
        status: 'nouveau',
      }).select().single();
    if (error) throw error;
    const { error: msgErr } = await supabaseAdmin.from('contact_ticket_messages')
      .insert({ ticket_id: ticket.id, sender_type: 'user', body: message.trim().slice(0, 5000) });
    if (msgErr) throw msgErr;
    return respond(res, 201, ticket);
  }

  if (req.method === 'POST' && action === 'reply') {
    const user = await requireAuth(req);
    const { ticket_id, message } = req.body;
    if (!ticket_id || !message?.trim()) return respond(res, 400, { error: 'Message vide' });
    const { data: ticket } = await supabaseAdmin.from('contact_tickets').select('id,user_id,status').eq('id', ticket_id).single();
    if (!ticket || ticket.user_id !== user.id) return respond(res, 403, { error: 'Ticket introuvable' });
    const { error } = await supabaseAdmin.from('contact_ticket_messages')
      .insert({ ticket_id, sender_type: 'user', body: message.trim().slice(0, 5000) });
    if (error) throw error;
    // Une relance sur un ticket traité le rouvre automatiquement
    const newStatus = ticket.status === 'traite' ? 'en_cours' : ticket.status;
    await supabaseAdmin.from('contact_tickets').update({ updated_at: new Date().toISOString(), status: newStatus }).eq('id', ticket_id);
    return respond(res, 200, { ok: true });
  }

  // ── Côté admin ──────────────────────────────────────────

  if (req.method === 'GET' && action === 'admin-tickets') {
    await requireAdmin(req);
    const status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const perPage = 20;
    let q = supabaseAdmin.from('contact_tickets')
      .select('*, profiles(username,email), contact_ticket_messages(body,created_at,sender_type)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);
    if (status && STATUSES.includes(status)) q = q.eq('status', status);
    const { data, error, count } = await q;
    if (error) throw error;
    const tickets = (data || []).map(t => {
      const msgs = (t.contact_ticket_messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const { contact_ticket_messages, ...rest } = t;
      return { ...rest, last_message: msgs[0] || null, message_count: msgs.length };
    });
    return respond(res, 200, { tickets, total: count, page, perPage });
  }

  if (req.method === 'GET' && action === 'admin-ticket') {
    await requireAdmin(req);
    const { id } = req.query;
    if (!id) return respond(res, 400, { error: 'id manquant' });
    const { data, error } = await supabaseAdmin.from('contact_tickets')
      .select('*, profiles(username,email), contact_ticket_messages(*)')
      .eq('id', id).single();
    if (error) throw error;
    data.contact_ticket_messages = (data.contact_ticket_messages || []).sort(sortByCreatedAsc);
    return respond(res, 200, data);
  }

  if (req.method === 'POST' && action === 'admin-reply') {
    await requireAdmin(req);
    const { ticket_id, message, status } = req.body;
    if (!ticket_id || !message?.trim()) return respond(res, 400, { error: 'Message vide' });
    const { error } = await supabaseAdmin.from('contact_ticket_messages')
      .insert({ ticket_id, sender_type: 'admin', body: message.trim().slice(0, 5000) });
    if (error) throw error;
    const newStatus = STATUSES.includes(status) ? status : 'en_cours';
    await supabaseAdmin.from('contact_tickets').update({ updated_at: new Date().toISOString(), status: newStatus }).eq('id', ticket_id);
    return respond(res, 200, { ok: true });
  }

  if (req.method === 'PUT' && action === 'status') {
    await requireAdmin(req);
    const { ticket_id, status } = req.body;
    if (!ticket_id || !STATUSES.includes(status)) return respond(res, 400, { error: 'Paramètres invalides' });
    const { error } = await supabaseAdmin.from('contact_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticket_id);
    if (error) throw error;
    return respond(res, 200, { ok: true });
  }

  // ── Réponses préfaites (admin) ───────────────────────────

  if (req.method === 'GET' && action === 'canned-responses') {
    await requireAdmin(req);
    const { data, error } = await supabaseAdmin.from('canned_responses').select('*').order('created_at');
    if (error) throw error;
    return respond(res, 200, data || []);
  }

  if (req.method === 'POST' && action === 'canned-responses') {
    await requireAdmin(req);
    const { title, body } = req.body;
    if (!title?.trim() || !body?.trim()) return respond(res, 400, { error: 'Titre et corps obligatoires' });
    const { data, error } = await supabaseAdmin.from('canned_responses')
      .insert({ title: title.trim().slice(0, 100), body: body.trim().slice(0, 3000) }).select().single();
    if (error) throw error;
    return respond(res, 200, data);
  }

  if (req.method === 'DELETE' && action === 'canned-responses') {
    await requireAdmin(req);
    const { id } = req.body;
    if (!id) return respond(res, 400, { error: 'id manquant' });
    const { error } = await supabaseAdmin.from('canned_responses').delete().eq('id', id);
    if (error) throw error;
    return respond(res, 200, { ok: true });
  }

  respond(res, 405, { error: 'Méthode non autorisée' });
});
