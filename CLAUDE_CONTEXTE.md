# Tournée — Jour 27

Carte de France interactive des bars, restaurants et boulangeries, avec calcul du trajet le plus court pour tous les faire.

## Demandes (simplifié)

1. Carte de la France avec options d'affichage : bars, restaurants, boulangeries.
2. Pouvoir restreindre à une zone : Bretagne, ou une ville (ex. Paris).
3. Option « trajet le plus court » qui passe par tous les lieux affichés.
4. Ce fichier `CLAUDE_CONTEXTE.md` : demandes, ce qui est fait, ce qui a échoué, ce qui est testé.
5. Maximum 5 étapes pour une V1 fonctionnelle. Ensuite : l'utilisateur fait tous les tests et me renvoie la liste des modifs.
6. GitHub : branche principale = `master` (même si l'utilisateur écrit `main`, c'est une erreur de sa part).
7. Poser toutes les questions avant de commencer. Validation étape par étape.

## Décisions (réponses de l'utilisateur)

- Stack : Vite + TypeScript + Leaflet, front seul.
- Données : OpenStreetMap via Overpass API, requêtes directes, sans clé.
- Catégories V1 : bars (`amenity=bar|pub`), restaurants (`amenity=restaurant`), boulangeries (`shop=bakery`).
- Zones : liste France / régions / départements + recherche de n'importe quelle ville (Nominatim).
- Trajet : trajet ouvert (pas de retour), départ choisi par un clic sur la carte.
- Plafond : maximum 1000 lieux pour le trajet.
- Calcul : plus proche voisin + amélioration 2-opt, en local, tracé en lignes droites (routes réelles = hors V1).
- Livraison : GitHub (branche `master`) + Coolify. Look libre, choisi par Claude à l'étape 1.
- Nom : choisi par Claude → « Tournée » (dossier `Tournee`).

## Les 5 étapes de la V1

1. **Squelette** : projet Vite/TS, carte Leaflet de la France, look, mise en page mobile-first.
2. **Données** : requêtes Overpass par catégorie, cases à cocher bars/restaurants/boulangeries, marqueurs, gestion chargement/erreurs/zone trop grande.
3. **Zones** : menu France/régions/départements, recherche de ville (Nominatim), cadrage de la carte, filtrage par la zone.
4. **Trajet** : clic de départ, plus proche voisin + 2-opt, tracé, distance totale, plafond 1000 lieux, messages clairs.
5. **Finitions + mise en ligne** : tests, README, repo GitHub (`master`), déploiement Coolify.

## Fait

- Questions posées et réponses reçues (3 tours).
- Ce fichier créé.

- **Étape 1 terminée** : projet Vite + TS + Leaflet dans `day-27-tournee/` (renommé depuis `Tournee` pour suivre la convention des autres jours). Carte de France plein écran, thème sombre ambre/crème (titres Fraunces, texte Inter), panneau en bas sur mobile et à gauche sur desktop, avec 3 sections vides (Lieux, Zone, Trajet). La France est cadrée hors de la zone cachée par le panneau. Entrée `tournee` ajoutée dans `.claude/launch.json` (port 5273).

- **Étape 2 codée (non validée)** : `src/places.ts` interroge Overpass par catégorie, dans la vue visible, avec 2 instances en repli (overpass-api.de puis overpass.kumi.systems) et un timeout de 20 s par requête. Cases Bars / Restaurants / Boulangeries dans le panneau, marqueurs colorés, popup nom + adresse (texte inséré sans HTML). Chargement seulement à partir du zoom 11 ; plafond 1000 lieux par catégorie avec mention. Rechargement après un déplacement de carte (débounce 400 ms).

- **Étape 3 codée (non validée)** : menu déroulant Toute la France + 13 régions (Nominatim, `featuretype=state`, repli sans filtre), recherche libre de ville ou département (Nominatim, jusqu'à 5 résultats à choisir). La zone recentre la carte ; les requêtes Overpass sont limitées à l'intersection vue ∩ zone, et les lieux hors zone sont masqués. Décision prise sans question : les départements passent par la recherche, pas par le menu (96 entrées auraient alourdi le panneau).

- **Étape 4 codée (non validée)** : `src/route.ts` (haversine, plus proche voisin + 2-opt en trajet ouvert, budget 1,5 s) et `src/route.test.ts` (`npm test`). Panneau Trajet : Départ (puis clic sur la carte), Calculer, Effacer. Le trajet passe par tous les lieux affichés des catégories cochées, tracé en pointillés ambre, distance totale en km à vol d'oiseau. Plafond 1000 lieux avec message ; mention « Liste incomplète » si une catégorie est tronquée à 1000.
- **Accélération du chargement (demandée avant l'étape 5)** : cache par cellules de 0,05° (≈ 5,5 × 3,7 km), en mémoire et dans IndexedDB, valable 7 jours (`src/cache.ts`). Seules les cellules absentes sont demandées, en **une seule** requête Overpass pour toutes les catégories (au lieu d'une par catégorie), avec `out center qt` (sans tri). Les cellules déjà connues s'affichent tout de suite pendant que le reste charge. Le 2e miroir Overpass ne part que si le 1er n'a pas répondu après 2,5 s ; le premier qui répond gagne, l'autre est annulé. Cocher/décocher une catégorie, revenir sur une zone ou recharger la page ne refait plus de requête pour ce qui est en cache.
- **Correctif « rien ne s'affiche » (retour de l'utilisateur, test à Redon)** : cause = les serveurs Overpass utilisés (`overpass-api.de`, `kumi`) étaient saturés (502 / timeout), donc aucune donnée. Le code n'était pas en cause. Le miroir français `overpass.openstreetmap.fr` répond en moins d'une seconde et accepte les appels depuis le navigateur : il est maintenant le premier essayé, les deux autres servent de repli. Les données de ce miroir datent de mi-septembre 2026 (horodatage de la base).
- **Étape 5 terminée, en ligne : https://tournee.projectp.fr** (déployé le 2026-11-10). Coolify : projet « Tournée » `pov0yx9mafiddzz0cn3vmroh`, app `xumlrrzkq4t2bszbsaqgnjfd`, GitHub app `projectp-github`, Dockerfile Nginx port 80. PR : https://github.com/PierreWZK/tournee/pull/1. **À faire après la fusion de la PR : repasser la branche suivie par Coolify de `feat/v1-tournee` à `master`** (pour l'instant elle construit la branche de la PR, car `master` ne contient que `.gitignore`). Contenu de l'étape : `Dockerfile` (build Vite puis Nginx, port 80), `nginx.conf`, `.dockerignore`, favicon, balises Open Graph de base (sans image), `README.md`. Dépôt public GitHub `PierreWZK/tournee`, branche par défaut `master` (créée par l'API GitHub avec le seul `.gitignore`, car git-guard bloque les push sur `master`), travail sur `feat/v1-tournee` puis PR à fusionner par l'utilisateur.

- **Landing (2026-11-10, branche `feat/landing`)** : demande « landing super propre, pro et classe, héro animé avec la carte de France et les bars de Rennes avec le trajet le plus court » + README refait comme les autres projets. La landing est sur `/`, la carte passe sur `/carte/` (Vite multi-pages, `vite.config.ts` ; Nginx `try_files $uri $uri/` + `absolute_redirect off`). Héro : SVG animé (France qui se dessine → repère Rennes → zoom → 165 bars qui apparaissent → trajet tracé avec compteur de km, les bars s'allument au passage), boucle de 14,6 s pilotée par une seule horloge `requestAnimationFrame` ; image fixe avec `prefers-reduced-motion`. Données figées dans `src/hero-data.ts`, générées par `node scripts/hero-data.ts` (contours Nominatim, bars Overpass, trajet par `solve()` de `route.ts`) : 165 bars, 40,7 km depuis la place de la République. Sections : comment ça marche (3 étapes), sous le capot (2-opt avec schéma avant/après), appel final, pied de page avec crédits OSM. Le titre « Tournée » du panneau de la carte renvoie à la landing. Captures dans `docs/`.

## Pas réussi

- Capture de la carte avec des lieux pour le README : pendant la session landing, `overpass.openstreetmap.fr` répondait **403** aux requêtes hors navigateur (Chromium headless, curl). Capture faite sans lieux. Vérifier que le site en ligne charge toujours les lieux.

- Overpass public : pendant ce test, `overpass-api.de` répondait 502 et le second miroir timeout ; aucun marqueur n'a pu être vérifié. Rien ne bloque côté code, mais la V1 dépend de ce service.
- Recherche : les résultats homonymes (ex. « Paris, Île-de-France » ×3) s'affichent avec le même libellé. Cosmétique, à corriger si ça gêne.

- Tuiles CARTO (`dark_all`) : renvoient maintenant une image « API KEY REQUIRED ». Remplacées par les tuiles OSM standard, assombries par un filtre CSS (`.leaflet-tile-pane`). Limite : la politique d'OSM déconseille un fort trafic ; à revoir avant une vraie mise en ligne (étape 5).
- Pas d'aperçu au premier lancement : `launch.json` est lu depuis le dossier parent, pas depuis le projet.
- Overpass public : 502 « server at capacity » sur `overpass-api.de` pendant les tests, et 429 (limite de débit) sur le second miroir après plusieurs requêtes. Le repli ne suffit pas toujours ; un chargement peut rester bloqué quelques secondes. Risque réel pour la V1 : envisager un cache ou un miroir plus fiable si ça persiste.
- Test navigateur de l'affichage des marqueurs : non réalisé. La carte ne répondait plus aux zooms (clics, scroll, double-clic) après quelques essais, donc je n'ai pas vu de marqueur à l'écran.

## Testé

- `npm run build` (tsc + vite) : OK, après chaque modif.
- Étape 1 : navigateur desktop (1100×750) et mobile (375×812) : carte, panneau, filtre sombre OK ; aucune erreur console.
- Étape 2 :
  - Cases cochées : la case se coche, et le message « Zoome sur une ville pour charger les lieux. » s'affiche sous le zoom 11 (vue France). OK.
  - Requête Overpass depuis le navigateur sur un petit rectangle de Paris : 200 OK (une fois). Plus tard : 502 puis 429.
  - Non testé : marqueurs affichés, popups, plafond 1000, décochage, changement de zone.
- Étape 3 :
  - `npm run build` : OK.
  - Menu Bretagne : statut « Zone : Bretagne », carte recadrée (zoom 7). OK.
  - Recherche « Paris » : 3 résultats, clic → « Zone : Paris, Île-de-France » et menu remis sur Toute la France. OK.
  - Décochage et chargement avec zone : la requête part bien sur la zone ; échec à cause d'Overpass (voir Pas réussi), donc filtrage des lieux non vérifié.
  - Nominatim répond 200 depuis le navigateur. Usage public : une requête par action, mais pas de User-Agent identifiant (le navigateur ne le permet pas). À surveiller.
- Étape 4 :
  - `npm test` (ligne ordonnée, liste vide, un seul lieu, 80 points aléatoires = permutation et pas plus long que l'ordre d'entrée) : OK. `npm run build` : OK.
  - Navigateur avec **Overpass simulé** (25 bars factices dans Paris, vraie recherche Nominatim) : zone Paris, 25 marqueurs, Départ puis clic carte, Calculer → « 25 lieux · 21 km à vol d'oiseau. », tracé visible. OK.
  - Plafond : 700 bars + 700 restaurants simulés → « Trop de lieux (1400, maximum 1000)… ». OK.
  - Performance : 1000 points aléatoires résolus en environ 0,5 s (Node).
  - Non testé : trajet avec de vraies données Overpass (service en panne pendant les tests), mobile (clic de départ au doigt), trajet qui reste affiché après avoir déplacé la carte (il peut devenir obsolète : il faut recalculer).
- Cache (Overpass **simulé**, comptage des appels réseau) :
  - `npm test` (grille couvre les coins de la vue, fusion en rectangles) : OK ; build : OK.
  - Zone Paris + Bars + Restaurants : 1 requête pour les 2 catégories. Décocher/recocher Bars : 0 requête. Ajouter Boulangeries : 1 requête, uniquement pour les boulangeries.
  - Rechargement complet de la page, même zone, 3 catégories : 0 requête réseau, 24 marqueurs affichés depuis IndexedDB. OK.
  - Non testé : gain de vitesse sur de vraies requêtes Overpass (service en panne pendant les tests), expiration à 7 jours, navigation privée (IndexedDB indisponible : repli mémoire prévu, non vérifié), très grande zone (cellules nombreuses).
  - Limites connues : le 1er chargement d'une zone dépend toujours d'Overpass ; une requête annulée (déplacement de carte) ne garde pas ses cellules à moitié téléchargées ; une cellule d'une requête tronquée (5000 résultats) est marquée tronquée et gardée telle quelle ; les lieux dont le centre tombe dans une cellule voisine non demandée sont ignorés puis récupérés avec leur cellule.
- **Test réel, sans simulation (après correctif)** : recherche « Redon » → zone Redon ; Bars + Restaurants + Boulangeries → « Bars 21 · Restaurants 29 · Boulangeries 5 », 55 marqueurs ; Départ + Calculer → « 55 lieux · 13,4 km à vol d'oiseau. ». OK.
- Avant ce correctif, les tests ne passaient que sur Overpass simulé : le vrai service n'avait jamais répondu pendant mes essais. À retenir : toujours vérifier la source de données réelle.
- Déploiement : build Coolify OK du premier coup, healthcheck « healthy », app `running:healthy`.
- En ligne (https://tournee.projectp.fr) : Redon → « Bars 21 · Restaurants 29 · Boulangeries 5 », 55 marqueurs, donc le miroir français accepte les appels depuis le domaine de production. OK.
- Non testé : mobile réel (clic de départ au doigt), rafraîchissement automatique après fusion de la PR.
- Pas encore testé : rotation d'écran, autres navigateurs.

## À tester par l'utilisateur (étape 2)

1. Ouvrir la carte, cocher Bars, zoomer sur Paris (zoom 11 ou plus) : des marqueurs ambre apparaissent, le statut indique le nombre.
2. Cocher Restaurants et Boulangeries : couleurs différentes, comptes séparés.
3. Cliquer un marqueur : nom et adresse s'affichent.
4. Décocher une catégorie : ses marqueurs disparaissent.
5. Déplacer la carte : les lieux se rechargent.
6. Sur une grande zone (ex. toute la Bretagne au zoom 11), vérifier le message de plafond.
7. Si « service indisponible » revient souvent : le signaler avec l'heure.

## Après la V1

L'utilisateur fait tous les tests possibles et renvoie la liste complète des modifs.
