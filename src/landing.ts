import "./landing.css";
import { BARS, FRANCE_D, KM, REACHED, RENNES_D, RENNES_IN_FRANCE, START } from "./hero-data";

// Héro animé : la France se dessine, zoom sur Rennes, les bars apparaissent, le trajet le plus court les relie.
const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("hero-svg") as unknown as SVGSVGElement;
const stageEl = document.getElementById("hero-stage")!;
const kmEl = document.getElementById("hero-km")!;
const fmtKm = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

document.querySelector('[data-fact="bars"]')!.textContent = String(BARS.length);
document.querySelector('[data-fact="km"]')!.textContent = fmtKm(KM);

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element = svg) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}

// Zoom : la France grossit autour de Rennes et amène Rennes sur le départ de la vue détaillée
const ZOOM = 80;
const [rx, ry] = RENNES_IN_FRANCE;
const [sx, sy] = START;
svg.style.setProperty("--fr-origin", `${rx}px ${ry}px`);
svg.style.setProperty("--fr-zoom", `translate(${sx - rx}px, ${sy - ry}px) scale(${ZOOM})`);
svg.style.setProperty("--rn-origin", `${sx}px ${sy}px`);
svg.style.setProperty("--rn-from", `translate(${rx - sx}px, ${ry - sy}px) scale(${1 / ZOOM})`);

const defs = el("defs", {});
defs.innerHTML = `
  <pattern id="hero-grid" width="30" height="30" patternUnits="userSpaceOnUse">
    <path d="M30 0H0V30" fill="none" stroke="currentColor" stroke-width="0.5"/>
  </pattern>
  <radialGradient id="hero-glow"><stop offset="0" stop-color="#f5a524" stop-opacity="0.9"/><stop offset="1" stop-color="#f5a524" stop-opacity="0"/></radialGradient>`;
el("rect", { class: "grid", width: 600, height: 600, fill: "url(#hero-grid)" });

const fr = el("g", { class: "lv-france" });
el("path", { class: "fr-outline", d: FRANCE_D, pathLength: 1 }, fr);
el("circle", { class: "fr-ping", cx: rx, cy: ry, r: 6 }, fr);
el("circle", { class: "fr-pin", cx: rx, cy: ry, r: 4 }, fr);
el("text", { class: "fr-label", x: rx + 12, y: ry + 4 }, fr).textContent = "Rennes";

const rn = el("g", { class: "lv-rennes" });
el("path", { class: "rn-outline", d: RENNES_D }, rn);
const route = el("path", { class: "rn-route", d: "M" + [START, ...BARS].map((p) => p.join(",")).join("L"), pathLength: 1 }, rn);
const barsG = el("g", { class: "rn-bars" }, rn);
const dots = BARS.map(([x, y], i) => {
  const c = el("circle", { cx: x, cy: y, r: 2.7 }, barsG);
  c.style.setProperty("--i", String(i));
  return c;
});
el("circle", { class: "rn-start", cx: sx, cy: sy, r: 6 }, rn);
const glow = el("circle", { class: "rn-glow", r: 16, fill: "url(#hero-glow)" }, rn);
const head = el("circle", { class: "rn-head", r: 4.5 }, rn);

// ---- Chronologie (ms) ----
const T = { pin: 1800, zoom: 2900, bars: 4400, route: 6300, routeEnd: 11300, fade: 13600, loop: 14600 };
const STAGES = ["pin", "zoom", "bars", "route", "fade"] as const;
const LABELS: Record<string, string> = {
  start: "France",
  zoom: "Rennes",
  bars: `Rennes · ${BARS.length} bars`,
  route: "Trajet le plus court",
};
const routeLen = route.getTotalLength();
const ease = (p: number) => 0.5 - Math.cos(Math.PI * p) / 2;
let reached = 0;

function setLabel(key: string) {
  if (LABELS[key]) stageEl.textContent = LABELS[key];
}

function drawRoute(p: number) {
  route.style.strokeDashoffset = String(1 - p);
  const pt = route.getPointAtLength(p * routeLen);
  for (const c of [head, glow]) {
    c.setAttribute("cx", String(pt.x));
    c.setAttribute("cy", String(pt.y));
  }
  while (reached < dots.length && REACHED[reached] <= p + 1e-6) dots[reached++].classList.add("on");
  kmEl.textContent = p > 0 ? fmtKm(p * KM) : "";
}

function reset() {
  svg.classList.add("snap"); // pas de transition pendant la remise à zéro
  svg.classList.remove(...STAGES, "start");
  dots.forEach((d) => d.classList.remove("on"));
  reached = 0;
  drawRoute(0);
  setLabel("start");
  void svg.getBoundingClientRect();
  svg.classList.remove("snap");
}

if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Image fixe : état final
  svg.classList.add("snap", "start", "pin", "zoom", "bars", "route");
  drawRoute(1);
  setLabel("route");
} else {
  let t = 0;
  let last = performance.now();
  reset();
  requestAnimationFrame(() => svg.classList.add("start"));
  const tick = (now: number) => {
    const prev = t;
    t += Math.min(now - last, 100); // onglet caché : on reprend où on en était
    last = now;
    for (const s of STAGES) {
      if (prev < T[s] && t >= T[s]) {
        svg.classList.add(s);
        setLabel(s);
      }
    }
    if (t >= T.route && prev < T.routeEnd) drawRoute(ease(Math.min(1, (t - T.route) / (T.routeEnd - T.route))));
    if (t >= T.loop) {
      t = 0;
      reset();
      requestAnimationFrame(() => svg.classList.add("start"));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
