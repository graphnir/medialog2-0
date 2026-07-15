# Suivi de chantier — MediaLog 2.0

**À lire en premier à chaque reprise de session, avant d'écrire du code.**

## Contexte
Refonte visuelle + structurelle de MediaLog, construite dans un repo entièrement
séparé de l'ancien site (pas de risque pour la prod). Approche : coquille visuelle
+ noyau fonctionnel d'abord, reste des fonctions rebranché ensuite par ordre
d'importance, testé à chaque étape sur un environnement staging séparé (Vercel +
Supabase dédiés, mise en place encore à faire côté utilisateur).

Décisions d'architecture issues de l'audit complet (voir NOTES.md pour le détail) :
5 familles de fonctions (identité, aide/découverte, vue&gestion, données de
catégorie, découverte/plaisir), header à deux niveaux desktop / header réduit +
barre basse mobile, principe de taille selon le type de donnée, repli automatique
du contenu trop long, distinction desktop (survol) / mobile (tap large).

## Périmètre de la session de construction 1 (noyau fonctionnel)

Objectif : un site utilisable de bout en bout sur les fonctions cœur, tout le
reste présent visuellement mais inerte (icône sans comportement).

### Fait
- [x] Structure de dossiers créée (`public/`, `api/`)
- [x] PROGRESS.md, NOTES.md créés
- [x] Backend copié tel quel (`api/*.js`)
- [x] Fichiers de logique/modales copiés tels quels : `api.js`, `ml-wiki.js`,
      `ml-roulette.js`, `ml-charts.js`, `ml-share.js`, `supabase.js`,
      `ml-misc.js`, `ml-columns.js`, `ml-entry.js`, `ml-admin.js`, `ml-table.js`
      (copiés pour garantir un boot fonctionnel complet — leur présentation
      visuelle n'a pas encore été retravaillée selon l'audit, seule la logique
      compte pour l'instant)
- [x] `ml-core.js` copié — vérifié : aucune référence aux IDs supprimés du header
- [x] `index.html` — nouvelle structure page-app complète (voir détail
      précédent). Modales existantes (entrée, catégorie, colonnes, import,
      partage, compte, admin, roulette, tutoriel, stats, news, présets)
      conservées inchangées à cette étape.
- [x] `style.css` — nouvelles règles de mise en page ajoutées (header 2
      niveaux, ligne catégories, footer, barre basse mobile, menu
      fonctionnalités, overlay recherche). Bascule à 600px.
- [x] `ml-app.js` reconstruit : câblage complet du nouveau header/barre basse
      (menu Fonctionnalités mobile, ouverture recherche globale desktop/mobile,
      Gestion des catégories provisoire), tous les câblages de modales
      existantes conservés tels quels.
- [x] `ml-render.js` copié + `renderStats()` adapté : stats codées en dur par
      catégorie (jeux/films/mangas) retirées, remplacées par un flag
      `cat.showStats` générique (Total/Moyenne/Favoris seulement, masquable).
- [x] `ml-columns.js` : case "Afficher la barre de statistiques" ajoutée à la
      création d'une catégorie (`cat-show-stats`), lue par `saveCategory()`.
      **Limite actuelle** : réglable seulement à la création, pas d'édition
      a posteriori tant que la vraie modale de Gestion des catégories
      n'existe pas — suffisant pour tester "avec et sans stats" comme demandé
      (créer une catégorie de chaque type).
- [x] Vérification finale : `node --check` OK sur tous les fichiers JS,
      aucune référence résiduelle à btn-import/btn-export-all/btn-add-category,
      balises HTML équilibrées.

- [x] **Modale Colonnes** : grille par type appliquée — `#cols-list` en grille
      2 colonnes sur desktop (≥600px, retour liste simple sur mobile), types
      compacts (nombre/date/note) en 1 cellule, types porteurs de contenu
      (texte/texte long/liste, ou toute colonne avec condition `showIf`) en
      pleine largeur via `.col-block-wide`. Restructuration en `.col-block`
      englobant (ligne + options + condition ensemble) pour que le tout se
      déplace comme un seul bloc dans la grille. Drag & drop, édition inline,
      mode Wikipedia : tous vérifiés intacts (opèrent sur `data-ci`, inchangé).

### À faire — PROCHAINE ÉTAPE IMMÉDIATE
- [x] **Barre de filtres/tri** : réorganisée selon l'audit — "Affichage"
      (Cartes/Tableur/Calendrier) devient l'unique source de vérité pour
      l'état actif (corrige le bug historique des boutons actifs en double,
      voir NOTES.md) ; "Présentation" (liste/grille/compact) n'est même plus
      rendue quand `viewMode!=='cards'` ; Colonnes/CSV/Présentation/Tags/Reset
      regroupés dans `#secondary-controls`, replié derrière un bouton
      entonnoir sur mobile (`.btn-more-filters`, <600px), toujours visible en
      ligne sur desktop. Favoris/À voir/Vus restent toujours visibles sur les
      deux plateformes. Rapprochement visuel léger toolbar/filter-bar
      (padding réduit, pas de fusion physique).
- [x] **Bug corrigé (hors périmètre visuel, trouvé en cours de route)** :
      impossible de retirer un tag déjà présent sur une entrée — les pills
      initiales étaient injectées directement en HTML sans jamais recevoir
      l'écouteur de suppression (seule `renderTagPills()`, appelée après un
      ajout, câblait ce bouton). Fix dans `ml-entry.js` : tout tag, existant
      ou ajouté, passe désormais par le même chemin (`renderTagPills()`
      appelée une fois à l'ouverture). **Ce bug existe aussi dans le repo de
      prod (`graphnir/medialog`), pas seulement ici** — à corriger là-bas
      séparément si besoin, la modification n'a été faite que dans
      `medialog2-0/public/ml-entry.js`.
- [x] **Modale Entrée** : grille 2 colonnes desktop (`.entry-grid`) — colonne
      principale (champs, tags) + colonne latérale (bandeau Wikipedia).
      Sur mobile, une seule colonne, Wikipedia apparaît naturellement en bas
      (ordre du DOM), conforme à l'audit. Grille réduite à 1 colonne
      (`.entry-grid-single`) si Wikipedia désactivé pour la catégorie, pour
      ne pas réserver un espace vide inutile.
      **Limite connue, non traitée cette session** : l'aperçu/résultats de
      recherche Wikipedia (`triggerWikiSearch`, dans `ml-wiki.js`) restent
      affichés en popup flottant sur `document.body`, pas encore intégrés
      dans la colonne latérale elle-même — ce serait la suite logique mais
      demande de retravailler le rendu du preview dans `ml-wiki.js`, pas
      juste `ml-entry.js`. L'alerte de doublon (`#dup-warn`) reste en ligne
      sous le champ titre, pas déplacée non plus (fonctionne, juste pas
      repositionnée).
- [x] **Aperçu en direct des 3 formats (liste/grille/compact) dans la modale
      Colonnes** : nouveau bloc `#cols-preview-wrap` avec onglets réutilisant
      `.view-toggle`/`.view-btn`, rendu miniature dédié (`renderColsPreview()`
      dans `ml-columns.js`, classes CSS `.cp-*` indépendantes du viewport pour
      rester correctes en largeur de modale). 2 entrées factices, un champ par
      colonne selon son type (rating en étoiles, date formatée, select avec
      les vraies options, textarea tronqué). Synchronisé automatiquement à
      chaque appel de `renderColsList()` (ajout/suppression/glisser-déposer/
      changement de type/condition) + mise à jour dédiée sur la saisie du nom
      de colonne (sans re-render de la liste, pour ne pas perdre le focus).
- [x] **Calendrier : gestion de plusieurs colonnes Date** : `renderCalendarView`
      détecte désormais toutes les colonnes `type==='date'` de la catégorie
      (avant : seule la première était utilisée, sans avertissement). Un
      sélecteur (`.cal-col-select-row`) n'apparaît que s'il y en a plusieurs
      ; choix mémorisé par catégorie (`loadCalColForCat`/`saveCalColForCat`
      dans `ml-core.js`, même pattern que `loadSortForCat`). Bug corrigé au
      passage : le bouton "+ Ajouter un média à cette date" de la popup de
      jour (`openDayPopup`) prenait toujours la première colonne date au lieu
      de celle affichée dans le calendrier.
- [ ] **Vue Cartes/Tableur/Calendrier** : fonctionnelles telles qu'héritées de
      l'ancien code — le repli automatique du contenu long, les tailles par
      type, le survol desktop (actions révélées), etc. de l'audit ne sont pas
      encore appliqués.
- [ ] **Barre de filtres/tri** : toujours dans son ancienne disposition
      (pas de panneau replié mobile, pas de rapprochement visuel tri/filtres) —
      fonctionnelle mais pas conforme à l'audit visuel.
- [ ] **Vraie modale "Gestion des catégories"** (nom/icône/ordre/stats
      modifiables après création, suppression) — actuellement un simple
      raccourci vers la création.
- [ ] **Recherche globale** : UI présente (bouton/overlay ouvrent/ferment),
      mais aucune logique de recherche cross-catégories implémentée encore
      (volontairement hors périmètre du noyau de cette session).
- [ ] Icônes inertes restant à poser : Badges, Tour guidé, Import/Export
      (vers Mon compte), Support, boîte à outils.

- [x] **Vue Cartes** : bouton favori révélé au survol sur desktop uniquement
      (`@media(hover:hover)`, jamais sur tactile puisqu'il n'y a pas de
      survol — principe NOTES.md) ; les favoris déjà actifs restent visibles
      en permanence pour ne jamais perdre l'information d'un coup d'œil.
      Le repli automatique du contenu long (textes longs) était déjà présent
      nativement (`.entry-text-preview`, 3 lignes puis troncature) — vérifié
      que le clic dessus ouvre bien le popup d'édition complet
      (`.field-clickable`), donc le principe "dépliage à la demande" était
      déjà respecté sans modification nécessaire.
      **Non traité cette session** : vue Tableur/Calendrier (tailles de
      colonnes par type, points survolables du calendrier) — reste dans
      son état hérité, fonctionnel mais pas encore conforme à l'audit.
- [x] **Vue Tableur** : largeur de colonne selon le type (`colWidth()` dans
      `ml-table.js`) — compacte pour nombre/date/note (90-110px), plus large
      pour texte/texte long/liste (220px), appliquée à l'en-tête et aux
      cellules (y compris la ligne d'ajout).
- [x] **Vue Calendrier** : au-delà de 2 entrées le même jour, affichage de
      points au lieu des titres en clair (`.cal-dots`/`.cal-dot`, infobulle
      native au survol desktop, cliquables individuellement pour ouvrir
      l'entrée). Sur tactile (`@media(hover:none)`), les points deviennent
      un indicateur de quantité pur (`pointer-events:none`) — le clic
      retombe sur la case entière, cohérent avec NOTES.md (cible fine
      desktop / cible large tactile).
      **Nouvelle fonctionnalité implémentée en passant** (c'était une
      demande en attente depuis le tout début du projet, jamais construite) :
      cliquer sur une case du calendrier n'ouvre plus directement une
      création d'entrée — ça affiche désormais un petit popup listant les
      entrées du jour + un bouton "+ Ajouter un média à cette date"
      (`openDayPopup()` dans `ml-render.js`, réutilise le mécanisme de
      fermeture au clic extérieur déjà existant pour les popups inline).
- [x] **Modale "Gestion des catégories"** (vraie version, plus un stub) :
      nouvelle modale `modal-manage-categories` listant toutes les
      catégories — nom et icône éditables inline (sauvegarde au `change`),
      case "Stats" par catégorie (relié au `cat.showStats` déjà en place),
      suppression par catégorie (`deleteCategory(catId)` généralisée, avant
      limitée à la catégorie active), réordonnancement par glisser-déposer
      (réutilise les classes `.col-dragging`/`.col-drag-over`/
      `.col-drag-handle` déjà stylées pour les colonnes). Bouton
      "+ Nouvelle catégorie" en bas, ouvre la modale de création existante.
      `btn-manage-categories` pointe maintenant vers cette vraie modale au
      lieu du stub provisoire.

**Ceci complète le périmètre du noyau fonctionnel prévu pour cette phase de
construction (voir liste initiale plus haut) — reste seulement le
raffinement visuel de ce qui a été listé comme "hérité, fonctionnel mais pas
encore conforme à l'audit" si on veut aller plus loin, sinon cette étape de
construction peut être considérée terminée.**

### Mise en place staging — config dynamique implémentée
- [x] **`api/config.js`** : expose désormais `supabaseUrl`/`supabaseAnonKey`
      (lus depuis `process.env.SUPABASE_URL`/`SUPABASE_ANON_KEY`, déjà
      utilisés côté serveur dans `_supabase.js`) en plus de la config du site.
- [x] **`index.html`** : **les vraies clés de production étaient encore en
      dur dans le fichier copié depuis l'ancien repo** (pas de simples
      placeholders `__SUPABASE_URL__` — la vraie URL et la vraie clé anonyme
      du projet Supabase de prod). Retirées. Remplacé par un chargement
      asynchrone : `fetch('/api/config')` au boot, puis injection séquentielle
      des scripts applicatifs (`api.js` → ... → `ml-app.js`) une fois
      `window.ENV_SUPABASE_URL`/`ENV_SUPABASE_ANON_KEY` posés. `supabase.js`
      (SDK), JSZip et Chart.js restent chargés immédiatement en parallèle
      (aucune dépendance à la config).
      **Conséquence pratique** : il n'y a plus jamais de remplacement manuel
      à faire avant un push, ni pour la prod ni pour le staging — seules les
      variables d'environnement Vercel du projet changent selon la branche.

### Comment tester en l'état actuel
Le site devrait booter et fonctionner de bout en bout (login, catégories,
colonnes, entrées, recherche/tri/favoris, cartes/tableur/calendrier,
thème, partage, admin) avec la nouvelle structure de header/footer/mobile
par-dessus — mais l'intérieur de chaque zone non listée comme "fait" ci-dessus
reste visuellement celui de l'ancien site, pas encore mis à jour selon l'audit.



### Inerte pour cette session (icône/bouton présent, sans comportement)
Roulette, Musée (+ porte cachée), Badges, Tutoriel/tour guidé, Import/Export,
Support, Admin, Présets, panneau replié (Présentation/Tags/Reset), boîte à outils

## Règle anti-coupure
Ne jamais laisser un fichier à moitié écrit entre deux sessions — finir le
fichier en cours avant de s'arrêter, même si ça laisse de la marge inutilisée.
Mettre à jour les cases ci-dessus à chaque fichier terminé.

## Mise en place externe (à faire par l'utilisateur, pas bloquant pour coder)
- [ ] Nouveau repo GitHub séparé (ex: graphnir/medialog2-0)
- [ ] Nouveau projet Vercel pointant sur ce repo
- [ ] Nouveau projet Supabase (staging), données de test (les vraies données
      de l'utilisateur, pas de données fictives à générer)
- [ ] Config Supabase servie via variables d'environnement Vercel + api/config.js
      (au lieu des placeholders en dur __SUPABASE_URL__/__SUPABASE_ANON_KEY__)
