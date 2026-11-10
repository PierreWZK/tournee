// Génère src/hero-data.ts pour le héro de la landing : contour de la France, contour de Rennes,
// bars de Rennes (OpenStreetMap) dans l'ordre du trajet le plus court, déjà projetés en coordonnées SVG.
// Lancer : node scripts/hero-data.ts
import { writeFileSync } from "node:fs";
import { solve, type Point } from "../src/route.ts";

const UA = { "User-Agent": "tournee-hero-data (projet du défi 30 jours)" };
// viewBox 0 0 600 600, commun aux deux vues ; cadre libre entre la pastille du haut et le bandeau du bas
const BOX = { x: 40, y: 64, w: 520, h: 440 };
const START: Point = { lat: 48.1101, lon: -1.6787 }; // place de la République

type Ring = [number, number][]; // [lon, lat]

async function outline(osmId: string, threshold: number): Promise<Ring[]> {
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${osmId}&format=geojson&polygon_geojson=1&polygon_threshold=${threshold}`;
  const geo = (await (await fetch(url, { headers: UA })).json()).features[0].geometry;
  const polys: Ring[][] = geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates;
  return polys.map((p) => p[0]); // anneaux extérieurs seulement
}

async function bars(): Promise<Point[]> {
  const q = `[out:json][timeout:25];area["ref:INSEE"="35238"]["boundary"="administrative"]->.a;(node["amenity"~"^(bar|pub)$"](area.a);way["amenity"~"^(bar|pub)$"](area.a););out center;`;
  const res = await fetch("https://overpass.openstreetmap.fr/api/interpreter", { method: "POST", headers: UA, body: new URLSearchParams({ data: q }) });
  const els: { lat?: number; lon?: number; center?: Point }[] = (await res.json()).elements;
  return els.map((e) => e.center ?? { lat: e.lat!, lon: e.lon! });
}

// Équirectangulaire corrigée par cos(lat moyenne), centrée dans BOX
function projector(rings: Ring[]) {
  const pts = rings.flat();
  const lat0 = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[0] * k), ys = pts.map((p) => -p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min(BOX.w / (x1 - x0), BOX.h / (y1 - y0));
  const ox = BOX.x + (BOX.w - (x1 - x0) * s) / 2, oy = BOX.y + (BOX.h - (y1 - y0) * s) / 2;
  return (lon: number, lat: number): [number, number] => [
    +(ox + (lon * k - x0) * s).toFixed(1),
    +(oy + (-lat - y0) * s).toFixed(1),
  ];
}

const path = (rings: Ring[], p: ReturnType<typeof projector>) =>
  rings.map((r) => "M" + r.map(([lon, lat]) => p(lon, lat).join(",")).join("L") + "Z").join("");

const france = (await outline("R1403916", 0.03)).filter((r) => r.length > 10); // métropole + Corse
const rennes = await outline("R54517", 0.0005);
const pf = projector(france), pr = projector(rennes);

const { order, length } = solve(START, await bars(), 8000);
let acc = 0, prev = pr(START.lon, START.lat);
const cum = order.map((b) => {
  const p = pr(b.lon, b.lat);
  acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
  prev = p;
  return acc;
});

const out = `// Généré par scripts/hero-data.ts. Données © contributeurs OpenStreetMap (ODbL).
export const FRANCE_D = ${JSON.stringify(path(france, pf))};
export const RENNES_IN_FRANCE: [number, number] = ${JSON.stringify(pf(START.lon, START.lat))};
export const RENNES_D = ${JSON.stringify(path(rennes, pr))};
export const START: [number, number] = ${JSON.stringify(pr(START.lon, START.lat))};
// Bars dans l'ordre du trajet, et part du tracé SVG parcourue à l'arrivée sur chacun
export const BARS: [number, number][] = ${JSON.stringify(order.map((b) => pr(b.lon, b.lat)))};
export const REACHED: number[] = ${JSON.stringify(cum.map((c) => +(c / acc).toFixed(4)))};
export const KM = ${length.toFixed(1)};
`;
writeFileSync(new URL("../src/hero-data.ts", import.meta.url), out);
console.log(`${order.length} bars, ${length.toFixed(1)} km`);
