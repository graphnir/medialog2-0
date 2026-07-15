# Reprise chantier MediaLog 2.0

Projet : refonte de MediaLog, construite dans un repo **séparé** de la prod
(`medialog2-0`, pas `graphnir/medialog`). Staging déployé et fonctionnel
(Vercel + Supabase dédiés). Contexte complet dans `PROGRESS.md` et
`NOTES.md` à la racine du projet — les lire en premier si présents dans
l'environnement de travail.

## Consignes d'économie de tokens (important)
- Ne jamais lire un fichier entier si un `grep` ciblé suffit à localiser ce
  qu'il faut modifier.
- Utiliser `view` avec une plage de lignes précise, pas le fichier complet.
- Vérifier la syntaxe (`node --check`) après chaque fichier modifié, mais
  ne pas re-vérifier plusieurs fois la même chose.
- Un fichier à la fois, `node --check` entre chaque, mise à jour de
  `PROGRESS.md` au fur et à mesure (pas à la toute fin).
- Pour toute tâche à plusieurs étapes : poser une checklist dans
  `PROGRESS.md` avant de commencer, cocher au fur et à mesure — ça permet
  de reprendre sans relire toute la conversation en cas d'interruption.
- Se limiter à ce qui est demandé ; si une piste annexe semble utile,
  la proposer plutôt que l'exécuter directement.

## Déploiement (staging)
```bash
git add .
git commit -m "description"
git push origin main
```
Pas de `--force`, pas de remplacement de placeholders — la config Supabase
(`SUPABASE_URL`/`SUPABASE_ANON_KEY`) est servie dynamiquement via
`api/config.js` + variables d'environnement Vercel.

## Fait récemment (voir PROGRESS.md pour le détail complet)
- Structure complète : header 2 niveaux desktop / réduit + barre basse
  mobile, ligne catégories + Gestion des catégories (couleur, stats
  précises, présets), footer, Mon compte en page scrollable (thème inclus,
  lu/écrit en base), vues Cartes/Tableur/Calendrier adaptées, modales
  Entrée/Colonnes élargies (grille 2 colonnes Colonnes, 1 colonne Entrée
  depuis la refonte Wikipédia).
- Chantier Wikipédia complet : toggle affichage/activation séparés,
  remplissage automatique des champs (avec retour possible à l'ancienne
  valeur), bouton repositionné, présets pré-configurés par type de média.
- Plusieurs bugs corrigés : tags impossibles à retirer, boutons de vue
  actifs en double, historique qui ne se fermait pas, IDs dupliqués
  (Roulette/Stats/Actualités — **bug aussi présent dans le repo de prod,
  pas encore corrigé là-bas**), lenteur de chargement (scripts chargés en
  série au lieu du parallèle).
- Schéma DB préparatoire posé (`usage_events`, `badges`, `user_badges`) —
  structure seule, aucune fonctionnalité ne les utilise encore.

## Reste à faire, dans l'ordre de priorité proposé
~~1. Aperçu en direct des 3 formats (liste/grille/compact) dans la modale
   Colonnes~~ — fait (détail dans `PROGRESS.md`).
~~2. Calendrier + plusieurs colonnes Date~~ — fait, sélecteur ajouté si
   plusieurs colonnes Date existent, choix persistant par catégorie (détail
   dans `PROGRESS.md`).
1. **Refonte de la page admin** — dédiée, plein écran, navigation entre
   sections (config site, news, tutoriel, aide, blacklist Wikipédia à
   construire). Devrait aussi résoudre l'accès peu visible à l'édition du
   tutoriel existant (déjà fonctionnelle dans le code, juste mal exposée
   dans l'ancienne modale étroite).
2. **Badges** puis **Support** (tickets) — s'appuient sur le schéma déjà
   préparé et sur la nouvelle page admin.
3. **Roulette** — conception dédiée jamais faite (design/animation "à
   part", pas juste un bouton).
4. **Musée** (+ porte cachée, contribution communautaire d'images) — en
   dernier, s'appuie sur Roulette pour la famille visuelle "découverte/
   plaisir".
~~5. Nettoyage mineur en attente : `openWikiPreview()` dans `ml-wiki.js` est
   devenue du code mort (plus jamais appelée) depuis le remplissage auto —
   à supprimer un jour si l'occasion se présente.~~ — fait, fonction
   supprimée (aucune référence, ni directe ni dynamique, ne restait).
~~6. **Audit du dossier `api/`~~ — fait. Trouvaille principale : un vrai
   SSRF dans `api/wikipedia.js` (le paramètre `lang` de la query string
   était injecté tel quel dans une URL fetchée côté serveur, sans jamais
   être validé contre la whitelist `LANGS` pourtant déjà définie — corrigé
   via `safeLang()`). Autres corrections : cap sur le nombre de champs
   demandés (`extract`, anti-DoS léger), messages d'erreur 500 masqués
   côté client pour les exceptions non prévues (`_supabase.js`), limites
   de longueur ajoutées sur `avatar_url`/`username` (`me.js`) et
   `title`/`content`/`image_url` (`news.js`), whitelist des ids de textes
   d'aide (`admin.js`, mineur).

7. **Audit sécurité du front (`public/`)** — fait en complément de l'audit
   `api/`. Corrigé en défense en profondeur : `renderMd()` (actualités,
   textes d'aide) construisait du HTML depuis du texte non échappé —
   contenu 100% admin aujourd'hui donc pas exploitable en pratique, mais
   corrigé au cas où (compte admin compromis, réutilisation future) ;
   `esc()` n'échappait pas les apostrophes. Vérifié propre par ailleurs :
   tickets support (esc() partout), extraits Wikipédia (doublement
   protégés serveur+client), pas d'eval/Function/document.write,
   localStorage sans données sensibles custom. Recommandation en attente :
   pas de CSP — nécessiterait de sortir les innombrables `style="..."`
   inline du code, chantier à part si voulu un jour.

8. Recommandations en attente issues des deux audits, pas de simples fix
   de code (décision d'infra à prendre) : rate limiting absent sur toute
   l'API ; en-tête CORS `Allow-Credentials` actuellement sans effet (pas
   de `Allow-Origin` correspondant, à clarifier ou nettoyer).

9. **Suppression de compte avec délai de grâce (7 jours)** — fait.
   Suppression désormais **centralisée** dans une seule fonction
   (`purgeUserData()` dans `api/_supabase.js`), utilisée à la fois par
   l'admin (suppression immédiate, sans délai) et par la tâche planifiée.
   Couvre explicitement toutes les tables (`contact_tickets` — dont les
   messages cascadent automatiquement —, `usage_events`, `user_badges`,
   `user_data`, `profiles`, puis le compte Auth), sans dépendre de
   cascades FK non vérifiées. Nouvelle colonne `profiles.deletion_scheduled_for`.
   Nouveau fichier `api/cron-purge-deletions.js`, déclenché quotidiennement
   par Vercel Cron (`vercel.json`, secret `CRON_SECRET` à définir dans les
   variables d'env Vercel — Vercel l'envoie automatiquement en
   `Authorization: Bearer` sur les requêtes cron).
   **Décision de conception à valider** : le document parlait d'un compte
   "immédiatement inaccessible" — un vrai bannissement Auth aurait empêché
   l'utilisateur de se reconnecter pour annuler (pas d'infra email custom
   pour un lien d'annulation externe). À la place : blocage **côté
   application** — le compte reste connectable, mais un écran dédié
   (`page-deletion`) remplace tout le site tant que la suppression est en
   attente, avec bouton Annuler + téléchargement des données (réutilise
   l'export existant) directement dessus. Nouveau garde-fou ajouté au
   passage : `initApp()` n'avait aucune protection contre un double appel
   (risque de double-binding de tous les listeners si la page de
   suppression menait à un second `initApp()` en cours de session).

10. **Pages légales (Mentions légales + Confidentialité)** — fait,
    contenu éditable côté admin. Réutilise entièrement l'infrastructure
    `site_config` existante (déjà publique via `/api/config`, déjà
    éditable dans l'onglet Apparence) plutôt qu'un nouveau système :
    juste deux nouvelles clés (`legal_mentions`, `privacy_policy`), avec
    un plafond de longueur séparé (20 000 car., contre 300 pour les
    champs courts comme le nom du site). Consultation via une modale
    (`modal-legal`) déclenchée par les liens du pied de page, contenu
    rendu avec `renderMd()` (markdown basique, déjà sécurisé contre
    l'injection HTML). Rédaction du texte lui-même = à faire par toi
    (juridique), la structure technique est prête. Non traité (pas
    demandé) : ces liens ne sont visibles que depuis l'app connectée
    (le pied de page vit dans `page-app`), pas depuis l'écran de
    connexion — à corriger un jour si l'info doit être visible avant
    toute création de compte.

## ⚠️ Instructions du projet à mettre à jour
Si ce projet Claude a des instructions personnalisées basées sur l'ancien
repo (`graphnir/medialog`, branche `main` de prod, remplacement de
placeholders `__SUPABASE_URL__`, push `--force`), **elles ne s'appliquent
plus à ce chantier** et vont semer la confusion si elles restent telles
quelles (c'est déjà arrivé plusieurs fois dans la conversation précédente).
Remplacez-les par les infos de ce document : repo `medialog2-0`, déploiement
sans `--force` ni placeholders, config via variables d'environnement.
