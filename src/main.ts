import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { CATEGORIES, MIN_LOAD_ZOOM, MAX_PLACES, loadPlaces, type Category, type CategoryInfo, type Place, type Result } from "./places";
import { REGIONS, type Bounds, type Zone, intersect, resolveRegion, searchZones } from "./zones";
import { MAX_ROUTE, solve } from "./route";

// Vue d'ensemble de la France métropolitaine
const FRANCE: L.LatLngBoundsExpression = [
  [41.2, -5.5],
  [51.2, 9.8],
];

export const map = L.map("map", { zoomControl: false, minZoom: 5, maxZoom: 18 });

// Cadre une zone dans la partie de la carte non couverte par le panneau (bas sur mobile, gauche sur desktop)
const panel = document.getElementById("panel")!;
const mobile = () => window.matchMedia("(max-width: 767px)").matches;
function fitPadded(bounds: L.LatLngBoundsExpression) {
  map.fitBounds(bounds, mobile()
    ? { paddingBottomRight: [0, panel.offsetHeight] }
    : { paddingTopLeft: [panel.offsetWidth + 32, 0] });
}
fitPadded(FRANCE);

L.control.zoom({ position: "topright" }).addTo(map);

// Tuiles OSM (CARTO exige maintenant une clé) ; le thème sombre vient du filtre CSS .leaflet-tile-pane
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// ---- Zone ----

let zone: Zone | null = null;
const zoneSelect = document.getElementById("zone-select") as HTMLSelectElement;
const zoneForm = document.getElementById("zone-search") as HTMLFormElement;
const zoneQ = document.getElementById("zone-q") as HTMLInputElement;
const zoneResults = document.getElementById("zone-results") as HTMLUListElement;
const zoneStatus = document.getElementById("zone-status")!;

for (const name of ["Toute la France", ...REGIONS]) {
  const opt = document.createElement("option");
  opt.value = name === "Toute la France" ? "" : name;
  opt.textContent = name;
  zoneSelect.append(opt);
}

function setZone(z: Zone | null) {
  zone = z;
  zoneStatus.classList.remove("error");
  if (z) {
    zoneStatus.textContent = `Zone : ${z.name}`;
    fitPadded([[z.south, z.west], [z.north, z.east]]);
  } else {
    zoneStatus.textContent = "Toute la France";
    fitPadded(FRANCE);
  }
  // Le recentrage déclenche « moveend », qui relance le chargement des lieux
}

function zoneError(message: string) {
  zoneStatus.textContent = message;
  zoneStatus.classList.add("error");
}

zoneSelect.addEventListener("change", async () => {
  zoneResults.replaceChildren();
  if (!zoneSelect.value) return setZone(null);
  zoneStatus.textContent = "Recherche…";
  try {
    setZone(await resolveRegion(zoneSelect.value));
  } catch {
    zoneError("Région introuvable, réessaie dans un instant");
  }
});

zoneForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = zoneQ.value.trim();
  if (q.length < 2) return;
  zoneResults.replaceChildren();
  zoneStatus.textContent = "Recherche…";
  try {
    const hits = await searchZones(q);
    if (hits.length === 0) return zoneError(`Aucun résultat pour « ${q} »`);
    zoneStatus.textContent = "Choisis un résultat :";
    for (const h of hits) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = h.name;
      btn.addEventListener("click", () => {
        zoneSelect.value = "";
        zoneResults.replaceChildren();
        setZone(h);
      });
      li.append(btn);
      zoneResults.append(li);
    }
  } catch {
    zoneError("Recherche indisponible, réessaie dans un instant");
  }
});

// ---- Lieux ----

const statusEl = document.getElementById("status")!;
const layers = new Map<Category, L.LayerGroup>();
let loadController: AbortController | null = null;
const checks = new Map<Category, HTMLInputElement>();
// Lieux actuellement affichés par catégorie, et catégories dont la liste est tronquée (utilisés par le trajet)
const shown = new Map<Category, Place[]>();
const truncatedCats = new Set<Category>();

function setStatus(text: string, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function popupFor(p: Place): HTMLElement {
  const wrap = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = p.name;
  wrap.append(strong);
  if (p.address) {
    const addr = document.createElement("div");
    addr.textContent = p.address;
    wrap.append(addr);
  }
  return wrap;
}

function drawPlaces(cat: Category, places: Place[]) {
  const info = CATEGORIES.find((c) => c.id === cat)!;
  const group = layers.get(cat)!;
  group.clearLayers();
  for (const p of places) {
    L.circleMarker([p.lat, p.lon], {
      radius: 6,
      color: "#14110f",
      weight: 1.5,
      fillColor: info.color,
      fillOpacity: 0.95,
    })
      .bindPopup(popupFor(p))
      .addTo(group);
  }
}

// Vue visible, limitée à la zone choisie ; null si les deux ne se touchent pas
function queryBounds(): Bounds | null {
  const v = map.getBounds();
  const view = { south: v.getSouth(), west: v.getWest(), north: v.getNorth(), east: v.getEast() };
  return zone ? intersect(view, zone) : view;
}

// Dessine le résultat et renvoie le texte de statut
function showResult(cats: CategoryInfo[], result: Result): string {
  let truncated = false;
  const parts = cats.map((cat) => {
    const r = result.get(cat.id)!;
    drawPlaces(cat.id, r.places);
    shown.set(cat.id, r.places);
    if (r.truncated) truncatedCats.add(cat.id);
    else truncatedCats.delete(cat.id);
    truncated ||= r.truncated;
    return `${cat.label} ${r.places.length}`;
  });
  return parts.join(" · ") + (truncated ? ` (${MAX_PLACES} max par catégorie, zoome pour voir le reste)` : "");
}

async function load(cats: CategoryInfo[]) {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;

  const b = queryBounds();
  if (!b) return;
  try {
    const result = await loadPlaces(cats, b, controller.signal, (partial) => {
      if (!controller.signal.aborted) setStatus(`Chargement… ${showResult(cats, partial)}`);
    });
    if (!controller.signal.aborted) setStatus(showResult(cats, result));
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    setStatus("Service indisponible, réessaie dans un instant", true);
  }
}

function refresh() {
  const enabled = CATEGORIES.filter((c) => checks.get(c.id)?.checked);
  if (enabled.length === 0) {
    setStatus("Coche une catégorie pour afficher les lieux.");
    return;
  }
  if (map.getZoom() < MIN_LOAD_ZOOM) {
    setStatus("Zoome sur une ville pour charger les lieux.");
    return;
  }
  if (!queryBounds()) {
    setStatus("La vue ne touche pas la zone choisie : recentre la carte.", true);
    return;
  }
  setStatus("Chargement…");
  load(enabled);
}

let moveTimer: number | undefined;
map.on("moveend", () => {
  window.clearTimeout(moveTimer);
  moveTimer = window.setTimeout(refresh, 400);
});

for (const cat of CATEGORIES) {
  const group = L.layerGroup();
  layers.set(cat.id, group);
  const input = document.getElementById(`cat-${cat.id}`) as HTMLInputElement;
  checks.set(cat.id, input);
  input.addEventListener("change", () => {
    if (input.checked) {
      group.addTo(map);
    } else {
      loadController?.abort();
      group.removeFrom(map);
      group.clearLayers();
      shown.delete(cat.id);
      truncatedCats.delete(cat.id);
    }
    refresh();
  });
}

setStatus("Coche une catégorie pour afficher les lieux.");

// ---- Trajet ----

const startBtn = document.getElementById("route-start") as HTMLButtonElement;
const goBtn = document.getElementById("route-go") as HTMLButtonElement;
const clearBtn = document.getElementById("route-clear") as HTMLButtonElement;
const routeStatus = document.getElementById("route-status")!;
const ROUTE_HINT = "Fixe un départ sur la carte, puis calcule le trajet le plus court.";

let start: L.LatLng | null = null;
let picking = false;
let startMarker: L.CircleMarker | null = null;
let routeLine: L.Polyline | null = null;

function setRouteStatus(text: string, isError = false) {
  routeStatus.textContent = text;
  routeStatus.classList.toggle("error", isError);
}

function setPicking(on: boolean) {
  picking = on;
  startBtn.classList.toggle("active", on);
  map.getContainer().classList.toggle("picking", on);
  if (on) setRouteStatus("Clique sur la carte pour fixer le départ.");
}

startBtn.addEventListener("click", () => setPicking(!picking));

map.on("click", (e: L.LeafletMouseEvent) => {
  if (!picking) return;
  start = e.latlng;
  startMarker?.remove();
  startMarker = L.circleMarker(start, { radius: 9, color: "#f5a524", weight: 3, fillColor: "#f3ead9", fillOpacity: 1 }).addTo(map);
  setPicking(false);
  goBtn.disabled = false;
  setRouteStatus("Départ fixé. Calcule le trajet.");
});

goBtn.addEventListener("click", () => {
  if (!start) return;
  const places = CATEGORIES.flatMap((c) => (checks.get(c.id)?.checked ? shown.get(c.id) ?? [] : []));
  if (places.length === 0) return setRouteStatus("Aucun lieu affiché : coche une catégorie et zoome.", true);
  if (places.length > MAX_ROUTE) {
    return setRouteStatus(`Trop de lieux (${places.length}, maximum ${MAX_ROUTE}) : réduis la zone ou décoche une catégorie.`, true);
  }
  const { order, length } = solve({ lat: start.lat, lon: start.lng }, places);
  routeLine?.remove();
  routeLine = L.polyline([start, ...order.map((p) => [p.lat, p.lon] as L.LatLngTuple)], {
    color: "#f5a524",
    weight: 3,
    opacity: 0.9,
    dashArray: "6 6",
  }).addTo(map);
  const km = length.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const partial = [...truncatedCats].some((c) => checks.get(c)?.checked) ? " Liste incomplète : zoome pour tout inclure." : "";
  setRouteStatus(`${order.length} lieux · ${km} km à vol d'oiseau.${partial}`);
});

clearBtn.addEventListener("click", () => {
  setPicking(false);
  routeLine?.remove();
  startMarker?.remove();
  routeLine = startMarker = null;
  start = null;
  goBtn.disabled = true;
  setRouteStatus(ROUTE_HINT);
});
