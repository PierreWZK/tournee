export interface Point {
  lat: number;
  lon: number;
}

export const MAX_ROUTE = 1000;

const EARTH_KM = 6371.0088;

// Distance à vol d'oiseau en km
export function haversine(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversine(path[i - 1], path[i]);
  return total;
}

// Trajet ouvert : part de `start`, passe une fois par chaque lieu, finit où il veut.
// shortcut: plus proche voisin + 2-opt, environ 5 % au-dessus de l'optimum ; passer à Or-opt si ce n'est pas assez.
export function solve<T extends Point>(start: Point, places: T[], budgetMs = 1500): { order: T[]; length: number } {
  const rest = places.slice();
  const order: T[] = [];
  let cur: Point = start;
  while (rest.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = haversine(cur, rest[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    cur = rest[best];
    order.push(rest.splice(best, 1)[0]);
  }

  // 2-opt : a[0] = départ fixe, a[1..n] = lieux ; on inverse a[i..j] tant que ça raccourcit
  const a: Point[] = [start, ...order];
  const n = order.length;
  const deadline = Date.now() + budgetMs;
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    for (let i = 1; i < n; i++) {
      if (Date.now() > deadline) break;
      for (let j = i + 1; j <= n; j++) {
        const before = haversine(a[i - 1], a[i]) + (j < n ? haversine(a[j], a[j + 1]) : 0);
        const after = haversine(a[i - 1], a[j]) + (j < n ? haversine(a[i], a[j + 1]) : 0);
        if (after < before - 1e-9) {
          for (let l = i, r = j; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
          improved = true;
        }
      }
    }
  }

  return { order: a.slice(1) as T[], length: pathLength(a) };
}
