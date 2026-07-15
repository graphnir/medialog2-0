// api/cron-purge-deletions.js — purge définitive des comptes dont le délai
// de grâce (7 jours) est écoulé. Déclenché quotidiennement par Vercel Cron
// (voir vercel.json). Authentification : Vercel envoie automatiquement
// `Authorization: Bearer $CRON_SECRET` sur les requêtes cron dès que la
// variable d'env CRON_SECRET est définie sur le projet.
const { supabaseAdmin, respond, handler, purgeUserData } = require('./_supabase');

module.exports = handler(async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return respond(res, 401, { error: 'Unauthorized' });
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .not('deletion_scheduled_for', 'is', null)
    .lte('deletion_scheduled_for', nowIso);
  if (error) throw error;

  let purged = 0;
  const failures = [];
  for (const row of (due || [])) {
    try {
      await purgeUserData(row.id);
      purged++;
    } catch (e) {
      console.error(`[cron-purge-deletions] échec pour ${row.id}:`, e.message);
      failures.push(row.id);
    }
  }

  return respond(res, 200, { checked: due?.length || 0, purged, failures });
});
