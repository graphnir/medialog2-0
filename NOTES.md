# Notes techniques — MediaLog

Principes et pièges identifiés au fil des sessions, à consulter avant de
considérer une fonctionnalité "terminée".

## Pièges de code déjà rencontrés

- **Groupes de boutons à état actif exclusif** : calculer la classe "active"
  à partir d'une seule source de vérité, jamais de deux variables d'état
  séparées (ex: `viewMode` et `cardLayout` traités indépendamment causait un
  bug où deux boutons de vue différents s'affichaient actifs simultanément).
  Un contrôle "Présentation" (liste/grille/compact) ne doit même pas être
  affiché quand `viewMode` n'est pas "cartes" — pas juste désactivé visuellement.
- **Listeners de fermeture (popups d'aide, popups inline)** : les attacher en
  phase de **capture** sur `document`, pas en bulle — sinon les
  `e.stopPropagation()` disséminés dans l'app (cellules de tableur, boutons de
  favoris) empêchent la fermeture au clic extérieur.
- **Après un login frais**, ne jamais utiliser l'objet Supabase brut
  (`data.user` de `signInWithPassword`) comme profil utilisateur — il n'a pas
  les champs applicatifs (`username`, `role`, etc.). Toujours repasser par
  l'équivalent de `API.me()` qui interroge la table `profiles`.
- **localStorage partagé entre comptes** : toute préférence utilisateur stockée
  en `localStorage` doit être suffixée par l'id utilisateur (sauf le tout
  premier chargement du thème, qui doit rester lisible avant authentification
  pour éviter un flash visuel — utiliser un petit pointeur non-scopé type
  `ml_last_uid` pour précharger le bon thème par optimisme, corrigé une fois
  l'utilisateur confirmé).
- **Dates ambiguës (JJ/MM vs MM/JJ)** : une valeur hors plage (>12) lève
  l'ambiguïté et prime toujours sur le réglage utilisateur — ne jamais forcer
  l'interprétation choisie si elle produit une date invalide.
- **Catch silencieux** : ne jamais avaler une erreur sans au moins un
  `console.error` — un bug de boot a pris plusieurs échanges à diagnostiquer
  uniquement parce que l'erreur réelle n'était logée nulle part.
- **Listes éditables (ajout/suppression d'éléments type tags/chips)** :
  si les éléments initiaux sont injectés directement dans un template HTML
  statique, ils ne passent jamais par la fonction qui attache les écouteurs
  de suppression (celle-ci n'est en général appelée qu'après un ajout) —
  résultat : les éléments déjà présents à l'ouverture sont inertes, seuls
  ceux ajoutés dans la session peuvent être retirés. Toujours faire passer
  l'état initial par la même fonction de rendu que les ajouts ultérieurs,
  jamais un rendu statique séparé pour le premier affichage.

## Principes de conception transverses (issus de l'audit)

- **Cas extrêmes systématiques** : pour toute fonctionnalité listant des
  données (catégories, tags, colonnes, dates cassées, tickets support,
  événements d'usage), se demander explicitement "que se passe-t-il à 10x,
  100x, 1000x le volume attendu ?" avant de considérer la fonctionnalité finie.
  Prévoir recherche/pagination/défilement progressif dès la conception plutôt
  qu'après coup.
- **Rendu de listes à grande échelle** (cartes, tableur) : au-delà de quelques
  milliers d'entrées, le calcul JS (filtrage/tri) reste rapide, mais le rendu
  DOM complet (`innerHTML=` de tout d'un coup) devient le vrai goulot. Solution
  technique : virtualisation (ne monter dans le DOM que ce qui est visible à
  l'écran) — chantier à part, pas un ajustement CSS.
- **Taille selon le type de donnée, pas l'ordre d'ajout** : les types compacts
  (nombre, note, date) restent petits ; les types porteurs de contenu/logique
  (texte long, liste, colonne avec condition `showIf`) ont besoin de plus
  d'espace. S'applique à la modale Colonnes (grille par type) et à la modale
  Entrée (largeur de champ liée à son contenu, pas uniforme).
- **Contenu de longueur variable** : toujours une hauteur plafonnée avec
  dépliage à la demande ("... voir plus"), jamais une croissance libre qui
  déséquilibre une carte, une ligne de tableur ou une carte de colonne.
- **Desktop vs mobile, pas juste une question de taille** :
  - Desktop peut exploiter le **survol** (actions secondaires révélées au
    survol, aperçus enrichis, cibles fines comme des points individuels
    survolables sur le calendrier).
  - Mobile a besoin de **cibles larges au tap** (pas de sous-cible fine sur
    un élément déjà petit — ex: les points du calendrier restent un indicateur
    de quantité sur mobile, le tap ouvre toute la case du jour, pas un point
    précis).
  - Une modale "de travail" (durée d'engagement longue : Entrée, Colonnes,
    Mon compte) → plein écran mobile, flèche retour. Une modale "rapide"
    (confirmation, popup inline) → modale classique centrée, croix.
  - Cas particulier : la modale Entrée en cours de **création non enregistrée**
    garde la croix même si "de travail" — fermer équivaut à annuler la
    création. Une fois l'entrée existante/enregistrée, flèche.
- **Emplacement dans l'interface** : fonction commune et directe → bouton
  visible dans le header/barre courante. Donnée propre au compte ou à une
  catégorie précise → menu dédié (Mon compte / Gestion des catégories).
- **Aide contextuelle (`?`)** : reste localisée à côté de ce qu'elle explique,
  pas de centre d'aide unique — décision tranchée, ne pas revenir dessus.
- **Regroupement conceptuel ≠ regroupement physique** : deux blocs
  fonctionnellement liés (tri + filtres) peuvent être rapprochés visuellement
  (moins d'espacement, pas de séparateur net) sans être fusionnés sur une seule
  ligne si l'espace ne le permet pas (ex: la recherche a besoin de respirer).
- **Fréquence réelle d'usage, pas catégorie technique** : classer ce qui reste
  visible sans clic supplémentaire par fréquence d'usage réelle, pas par type
  de contrôle. Pour un tracker personnel, Favoris/À voir sont aussi fréquents
  que la recherche — ne pas les reléguer dans un panneau replié juste parce
  qu'ils sont techniquement apparentés à "l'affichage".

## Sécurité / légal (à ne pas oublier au moment de construire)

- Toute donnée stockée sur un utilisateur doit être **exposable à cet
  utilisateur** sans exception cachée (principe retenu pour usage_events,
  badges, tickets support — pas de "profil fantôme").
- Suppression de compte : délai de grâce (statut `pending_deletion` + date),
  export des données proposé avant confirmation, purge réelle de **toutes**
  les tables concernées après le délai (à centraliser dans une fonction unique
  plutôt que dispersée).
- Images communautaires (musée) : recommander des sources fiables
  (Wikimedia Commons notamment) sans bloquer les autres, badge visuel
  d'aide à la décision pour l'admin en modération, jamais de filtrage
  automatique strict.
- Contributions de données brutes (titre/année/type) : pas de souci légal
  (faits non protégeables). Texte rédigé ou image : vigilance réelle, cadre
  de modération nécessaire.
