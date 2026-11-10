// Lancer : npm test
import { solve, haversine, pathLength } from "./route.ts";

const check = (ok: boolean, msg: string) => {
  if (!ok) throw new Error("ÉCHEC : " + msg);
};

// Points alignés, mélangés : le trajet doit les parcourir dans l'ordre
const line = [3, 1, 2, 0].map((lon) => ({ lat: 0, lon }));
const start = { lat: 0, lon: -1 };
const res = solve(start, line);
check(res.order.map((p) => p.lon).join() === "0,1,2,3", "ordre sur une ligne");
check(Math.abs(res.length - haversine(start, { lat: 0, lon: 3 })) < 1e-6, "longueur sur une ligne");

check(solve(start, []).order.length === 0, "liste vide");
check(solve(start, [{ lat: 1, lon: 1 }]).order.length === 1, "un seul lieu");

// 80 points pseudo-aléatoires : chacun visité une fois, jamais plus long que l'ordre d'entrée
let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pts = Array.from({ length: 80 }, (_, id) => ({ id, lat: 47 + rnd(), lon: -2 + rnd() }));
const r = solve({ lat: 47, lon: -2 }, pts);
check(new Set(r.order.map((p) => p.id)).size === 80 && r.order.length === 80, "chaque lieu une fois");
check(r.length <= pathLength([{ lat: 47, lon: -2 }, ...pts]) + 1e-6, "plus court que l'ordre d'entrée");

console.log("route : OK");
