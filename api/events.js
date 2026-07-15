// api/events.js — journalisation d'événements d'usage (base pour stats admin + badges futurs)
const { supabaseAdmin, requireAuth, respond, handler } = require('./_supabase');

// Liste blanche stricte : on ne veut PAS un journal exhaustif de chaque clic
// (proportionnalité RGPD), seulement des types d'événements génériques et
// utiles pour "qu'est-ce qui est utilisé". Ajouter ici pour instrumenter une
// nouvelle fonctionnalité.
const ALLOWED_EVENTS = [
  'roulette_spin',
  'stats_view',
  'export_all',
  'export_csv',
  'wiki_extract',
];

module.exports = handler(async (req, res) => {
  if (req.method === 'POST') {
    const user = await requireAuth(req);
    const { event_type } = req.body;
    if (!ALLOWED_EVENTS.includes(event_type)) return respond(res, 400, { error: 'event_type invalide' });
    const { error } = await supabaseAdmin.from('usage_events').insert({ user_id: user.id, event_type });
    if (error) throw error;
    return respond(res, 200, { ok: true });
  }
  respond(res, 405, { error: 'Méthode non autorisée' });
});
