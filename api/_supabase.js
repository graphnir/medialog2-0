// api/_supabase.js — client Supabase partagé côté serveur
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY   = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error('Variables Supabase manquantes (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)');
}

// Client avec la clé service (admin, bypass RLS) — uniquement côté serveur
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Client avec la clé anon — pour vérifier le token JWT d'un utilisateur
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Vérifie le Bearer token de la requête et retourne l'utilisateur Supabase
async function requireAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Non authentifié'); err.status = 401; throw err;
  }
  const token = header.slice(7);
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) {
    const err = new Error('Token invalide ou expiré'); err.status = 401; throw err;
  }
  return user;
}

// Vérifie que l'utilisateur est admin (via user_metadata)
async function requireAdmin(req) {
  const user = await requireAuth(req);
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    const err = new Error('Accès réservé aux admins'); err.status = 403; throw err;
  }
  return user;
}

// Helper pour répondre proprement
function respond(res, status, data) {
  res.status(status).json(data);
}

// Wrapper qui gère les erreurs communes
function handler(fn) {
  return async (req, res) => {
    // CORS pour Vercel dev
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(200).end();
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`[API Error] ${err.message}`, err.stack || '');
      // err.status défini = erreur "attendue" (validation, 403, 404…),
      // le message est sûr à renvoyer tel quel. Sans .status, c'est une
      // exception non prévue (bug, erreur DB brute…) — ne jamais renvoyer
      // err.message au client dans ce cas, ça peut exposer des détails
      // internes (structure de schéma, erreurs Postgres, etc.). Le détail
      // reste dans les logs serveur (console.error ci-dessus) uniquement.
      const status = err.status || 500;
      const message = err.status ? err.message : 'Erreur serveur';
      respond(res, status, { error: message });
    }
  };
}

// Suppression de compte exhaustive et centralisée : UNE seule fonction,
// utilisée à la fois par l'admin (suppression immédiate) et par la tâche
// planifiée (purge après le délai de grâce). Suppressions explicites table
// par table plutôt que de dépendre de cascades FK non vérifiées — voir
// audit du 12/07 (la suppression n'existait auparavant que côté Auth, sans
// toucher aucune autre table). Ordre : dépendants d'abord, profiles et le
// compte Auth en dernier.
async function purgeUserData(userId) {
  // contact_tickets → contact_ticket_messages cascade automatiquement
  // (FK connue, définie dans schema-futur.sql avec on delete cascade).
  await supabaseAdmin.from('contact_tickets').delete().eq('user_id', userId);
  await supabaseAdmin.from('usage_events').delete().eq('user_id', userId);
  await supabaseAdmin.from('user_badges').delete().eq('user_id', userId);
  await supabaseAdmin.from('user_data').delete().eq('user_id', userId);
  await supabaseAdmin.from('profiles').delete().eq('id', userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
}

module.exports = { supabaseAdmin, supabaseAnon, requireAuth, requireAdmin, respond, handler, purgeUserData };
