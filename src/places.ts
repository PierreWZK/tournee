import { getCells, putCells, type Entry } from "./cache.ts";
import type { Bounds } from "./zones.ts";

export type Category = "bar" | "restaurant" | "bakery";

export interface CategoryInfo {
  id: Category;
  label: string;
  color: string;
  // Filtre Overpass (OSM) pour la catégorie, et le même test côté client pour classer les résultats
  filter: string;
  test: (tags: Record<string, string>) => boolean;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "bar", label: "Bars", color: "#f5a524", filter: '["amenity"~"^(bar|pub)$"]', test: (t) => t.amenity === "bar" || t.amenity === "pub" },
  { id: "restaurant", label: "Restaurants", color: "#e0634a", filter: '["amenity"="restaurant"]', test: (t) => t.amenity === "restaurant" },
  { id: "bakery", label: "Boulangeries", color: "#f3ead9", filter: '["shop"="bakery"]', test: (t) => t.shop === "bakery" },
];

export interface Place {
  id: number;
  cat: Category;
  name: string;
  lat: number;
  lon: number;
  address: string;
}

// Au-delà, Overpass est trop lent pour un usage public : on ne charge rien
export const MIN_LOAD_ZOOM = 11;
export const MAX_PLACES = 1000;

// Grille de cache : 0,05° ≈ 5,5 km × 3,7 km en France. Seules les cellules absentes du cache sont demandées.
const CELL = 0.05;
const REQUEST_LIMIT = 5000;
// Le 2e miroir ne part que si le 1er n'a pas répondu après ce délai (évite de doubler la charge pour rien)
const HEDGE_MS = 2500;
// Miroir français d'abord (rapide et fiable en test), les serveurs d'overpass-api.de et kumi sont souvent saturés (502)
const ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface Cell {
  ix: number;
  iy: number;
}

export function cellsFor(b: Bounds): Cell[] {
  const out: Cell[] = [];
  for (let iy = Math.floor(b.south / CELL); iy <= Math.floor(b.north / CELL); iy++) {
    for (let ix = Math.floor(b.west / CELL); ix <= Math.floor(b.east / CELL); ix++) out.push({ ix, iy });
  }
  return out;
}

// Regroupe les cellules voisines d'une même ligne en rectangles : moins d'instructions dans la requête
export function rects(cells: Cell[]): Bounds[] {
  const sorted = [...cells].sort((a, b) => a.iy - b.iy || a.ix - b.ix);
  const out: Bounds[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].iy === sorted[i].iy && sorted[j + 1].ix === sorted[j].ix + 1) j++;
    const iy = sorted[i].iy;
    out.push({ south: iy * CELL, north: (iy + 1) * CELL, west: sorted[i].ix * CELL, east: (sorted[j].ix + 1) * CELL });
    i = j + 1;
  }
  return out;
}

const cellKey = (cat: Category, c: Cell) => `v1:${cat}:${c.ix}:${c.iy}`;

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function queryOverpass(query: string, signal: AbortSignal): Promise<{ elements: OverpassElement[] }> {
  const controllers = ENDPOINTS.map(() => new AbortController());
  const stopAll = () => controllers.forEach((c) => c.abort());
  signal.addEventListener("abort", stopAll, { once: true });

  const attempts = ENDPOINTS.map(async (endpoint, i) => {
    if (i > 0) await new Promise((r) => setTimeout(r, HEDGE_MS * i));
    const own = controllers[i].signal;
    if (own.aborted) throw new DOMException("aborted", "AbortError");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.any([own, AbortSignal.timeout(28000)]),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    return (await res.json()) as { elements: OverpassElement[] };
  });

  try {
    return await Promise.any(attempts);
  } catch {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    throw new Error("Overpass indisponible");
  } finally {
    stopAll();
    signal.removeEventListener("abort", stopAll);
  }
}

export type Result = Map<Category, { places: Place[]; truncated: boolean }>;

// Lieux des catégories demandées dans `b`. Le cache est lu d'abord ; `onPartial` reçoit ce qu'on a déjà
// pendant que les cellules manquantes sont téléchargées en une seule requête.
export async function loadPlaces(
  cats: CategoryInfo[],
  b: Bounds,
  signal: AbortSignal,
  onPartial?: (r: Result) => void,
): Promise<Result> {
  const cells = cellsFor(b);
  const cached = await getCells(cats.flatMap((c) => cells.map((cell) => cellKey(c.id, cell))));

  const assemble = (): Result => {
    const result: Result = new Map();
    for (const cat of cats) {
      const places: Place[] = [];
      let truncated = false;
      for (const cell of cells) {
        const e = cached.get(cellKey(cat.id, cell));
        if (!e) continue;
        truncated ||= e.truncated;
        for (const p of e.places) {
          if (p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east) places.push(p);
        }
      }
      if (places.length > MAX_PLACES) {
        truncated = true;
        places.length = MAX_PLACES;
      }
      result.set(cat.id, { places, truncated });
    }
    return result;
  };

  const missing = new Map<CategoryInfo, Cell[]>();
  for (const cat of cats) {
    const todo = cells.filter((cell) => !cached.has(cellKey(cat.id, cell)));
    if (todo.length) missing.set(cat, todo);
  }
  if (missing.size === 0) return assemble();
  if (cached.size > 0) onPartial?.(assemble());

  const f = (n: number) => n.toFixed(4);
  const statements = [...missing].flatMap(([cat, todo]) =>
    rects(todo).map((r) => `nwr${cat.filter}(${f(r.south)},${f(r.west)},${f(r.north)},${f(r.east)});`),
  );
  const query = `[out:json][timeout:25];(${statements.join("")});out center qt ${REQUEST_LIMIT};`;
  const json = await queryOverpass(query, signal);
  const truncated = json.elements.length >= REQUEST_LIMIT;

  // Une cellule demandée reçoit les lieux dont le centre y tombe ; les autres sont ignorés (ils viendront avec leur cellule)
  const buckets = new Map<string, Place[]>();
  for (const [cat, todo] of missing) for (const cell of todo) buckets.set(cellKey(cat.id, cell), []);
  const asked = [...missing.keys()];

  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const t = el.tags ?? {};
    const cat = asked.find((c) => c.test(t));
    if (!cat) continue;
    const bucket = buckets.get(cellKey(cat.id, { ix: Math.floor(lon / CELL), iy: Math.floor(lat / CELL) }));
    if (!bucket) continue;
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    bucket.push({
      id: el.id,
      cat: cat.id,
      name: t.name ?? cat.label.slice(0, -1) + " sans nom",
      lat,
      lon,
      address: [street, t["addr:postcode"], t["addr:city"]].filter(Boolean).join(", "),
    });
  }

  const entries: [string, Entry][] = [...buckets].map(([k, places]) => [k, { t: Date.now(), truncated, places }]);
  await putCells(entries);
  for (const [k, e] of entries) cached.set(k, e);
  return assemble();
}
