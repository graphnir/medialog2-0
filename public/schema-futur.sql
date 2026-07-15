-- Schéma préparatoire pour badges et suivi d'usage
-- Aucune fonctionnalité ne les utilise encore, juste la structure.

-- Événements d'usage (base pour stats admin ET pour déclencher des badges)
create table if not exists usage_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  event_type text not null,
  created_at timestamptz default now()
);
create index if not exists idx_usage_events_user on usage_events(user_id);
create index if not exists idx_usage_events_type on usage_events(event_type);

-- Définition des badges (gérée en admin plus tard)
create table if not exists badges (
  id text primary key,
  label text not null,
  description text,
  icon text,
  hidden boolean default false,
  created_at timestamptz default now()
);

-- Badges obtenus par utilisateur
create table if not exists user_badges (
  user_id uuid references profiles(id) on delete cascade,
  badge_id text references badges(id) on delete cascade,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);

alter table usage_events enable row level security;
create policy "usage_events_own" on usage_events for select using (auth.uid() = user_id);

alter table badges enable row level security;
create policy "badges_select_public" on badges for select using (true);

alter table user_badges enable row level security;
create policy "user_badges_own" on user_badges for select using (auth.uid() = user_id);

-- Blacklist Wikipédia : termes redondants retirés des titres/données extraites
create table if not exists wiki_blacklist_terms (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('exact','regex')),
  pattern text not null,
  created_at timestamptz default now()
);
create index if not exists idx_wiki_blacklist_type on wiki_blacklist_terms(type);

-- Seed : migration des suffixes de désambiguïsation auparavant codés en dur
-- dans ml-wiki.js (WIKI_DISAMBIG_SUFFIXES). Idempotent (ON CONFLICT DO NOTHING
-- nécessiterait une contrainte unique ; on vérifie l'absence via NOT EXISTS).
insert into wiki_blacklist_terms (type, pattern)
select 'exact', v from (values
  ('film'),('films'),('série'),('séries'),('série télévisée'),
  ('jeu vidéo'),('jeux vidéo'),('manga'),('roman'),('album'),
  ('bande dessinée'),('bd'),('comics'),('musique'),('movie'),
  ('movies'),('film series'),('TV series'),('television series'),
  ('video game'),('anime'),('OVA'),('ONA'),('light novel')
) as seed(v)
where not exists (select 1 from wiki_blacklist_terms where type='exact' and pattern=seed.v);

alter table wiki_blacklist_terms enable row level security;
create policy "wiki_blacklist_admin_only" on wiki_blacklist_terms for all using (false);
-- Aucun accès direct client (RLS bloque tout) : uniquement lu/écrit via
-- l'API serveur avec la clé service (supabaseAdmin, bypass RLS).

-- Support (tickets) : fil de discussion utilisateur ↔ admin, "comme un
-- forum" — pas de chat temps réel. Un ticket = un sujet + un fil de messages
-- (l'utilisateur peut relancer après une réponse admin).
create table if not exists contact_tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  subject text not null,
  contact_method text,
  status text not null default 'nouveau' check (status in ('nouveau','en_cours','traite')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_contact_tickets_user on contact_tickets(user_id);
create index if not exists idx_contact_tickets_status on contact_tickets(status);

create table if not exists contact_ticket_messages (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references contact_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','admin')),
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_contact_ticket_messages_ticket on contact_ticket_messages(ticket_id);

-- Réponses préfaites (admin) : insérées dans le champ de réponse pour
-- modification avant envoi — jamais envoyées automatiquement telles quelles.
create table if not exists canned_responses (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

alter table contact_tickets enable row level security;
create policy "contact_tickets_admin_only" on contact_tickets for all using (false);
alter table contact_ticket_messages enable row level security;
create policy "contact_ticket_messages_admin_only" on contact_ticket_messages for all using (false);
alter table canned_responses enable row level security;
create policy "canned_responses_admin_only" on canned_responses for all using (false);
-- Comme wiki_blacklist_terms : RLS bloque tout accès direct, tout passe par
-- l'API serveur (supabaseAdmin) qui vérifie elle-même que l'utilisateur ne
-- lit/écrit que ses propres tickets (voir api/support.js).

-- Suppression de compte avec délai de grâce (1 semaine). NULL = pas de
-- suppression en attente. Si renseigné : date à partir de laquelle la tâche
-- planifiée (api/cron-purge-deletions.js) peut purger définitivement.
alter table profiles add column if not exists deletion_scheduled_for timestamptz;
create index if not exists idx_profiles_deletion_scheduled on profiles(deletion_scheduled_for) where deletion_scheduled_for is not null;
