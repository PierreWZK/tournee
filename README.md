# Tournée

Jour 27 du défi 30 jours, 30 projets. Carte de France des bars, restaurants et boulangeries, avec le trajet le plus court pour tous les faire.

- Choix des catégories (bars, restaurants, boulangeries) et d'une zone : toute la France, une région, ou n'importe quelle ville ou département via la recherche.
- Trajet ouvert : clic sur la carte pour fixer le départ, puis calcul (plus proche voisin + 2-opt) à vol d'oiseau, 1000 lieux maximum.
- Les lieux sont chargés à partir du zoom 11 et gardés en cache dans le navigateur (7 jours).

## Lancer

```bash
npm install
npm run dev
npm test
npm run build
```

## Données et limites

- Lieux : OpenStreetMap via l'API Overpass publique (sans clé, parfois saturée : un message « service indisponible » s'affiche alors).
- Recherche de zones : Nominatim. Fond de carte : tuiles OpenStreetMap standard, assombries par un filtre CSS. Ces services publics ne conviennent pas à un fort trafic.
- Le trajet est en lignes droites, pas sur les routes.

## Déploiement

`Dockerfile` : build Vite puis Nginx (port 80), prévu pour Coolify. Détail du projet, des décisions et des tests dans `CLAUDE_CONTEXTE.md`.
