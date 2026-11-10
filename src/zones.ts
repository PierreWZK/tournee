export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Zone extends Bounds {
  name: string;
}

// Les 13 régions (métropole + Corse), telles que dans le menu
export const REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
];

// Nominatim (OSM) : la recherche de villes et de régions. Usage public : une requête par action, pas en boucle.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

interface NominatimHit {
  display_name: string;
  boundingbox: [string, string, string, string];
}

async function nominatim(params: Record<string, string>): Promise<Zone[]> {
  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    format: "jsonv2",
    countrycodes: "fr",
    limit: "5",
    "accept-language": "fr",
    ...params,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  // boundingbox Nominatim : [sud, nord, ouest, est]
  return hits.map((h) => {
    const [south, north, west, east] = h.boundingbox.map(Number);
    return { name: h.display_name.split(",").slice(0, 2).join(",").trim(), south, north, west, east };
  });
}

export function searchZones(q: string): Promise<Zone[]> {
  return nominatim({ q });
}

const regionCache = new Map<string, Zone>();

export async function resolveRegion(name: string): Promise<Zone> {
  const cached = regionCache.get(name);
  if (cached) return cached;
  // featuretype=state : niveau « région » ; repli sans filtre si Nominatim ne le reconnaît pas
  let [hit] = await nominatim({ q: name, featuretype: "state" });
  if (!hit) [hit] = await nominatim({ q: `${name}, France` });
  if (!hit) throw new Error(`Région introuvable : ${name}`);
  const zone = { ...hit, name };
  regionCache.set(name, zone);
  return zone;
}

// Partie commune entre la vue et la zone, ou null si elles ne se touchent pas
export function intersect(view: Bounds, zone: Zone): Bounds | null {
  const south = Math.max(view.south, zone.south);
  const north = Math.min(view.north, zone.north);
  const west = Math.max(view.west, zone.west);
  const east = Math.min(view.east, zone.east);
  return south < north && west < east ? { south, north, west, east } : null;
}
