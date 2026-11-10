// Lancer : npm test
import { cellsFor, rects, type Cell } from "./places.ts";

const check = (ok: boolean, msg: string) => {
  if (!ok) throw new Error("ÉCHEC : " + msg);
};

// Les cellules d'une vue couvrent tous ses coins
const view = { south: 48.8412, west: 2.3011, north: 48.8789, east: 2.3702 };
const rs = rects(cellsFor(view));
const covered = (lat: number, lon: number) => rs.some((r) => lat >= r.south - 1e-9 && lat <= r.north + 1e-9 && lon >= r.west - 1e-9 && lon <= r.east + 1e-9);
check([[view.south, view.west], [view.south, view.east], [view.north, view.west], [view.north, view.east]].every(([a, o]) => covered(a, o)), "coins couverts");

// Fusion en rectangles : 3 cellules de suite + 1 isolée sur une ligne, 1 sur la ligne suivante = 3 rectangles
const cells: Cell[] = [{ ix: 3, iy: 1 }, { ix: 1, iy: 1 }, { ix: 2, iy: 1 }, { ix: 5, iy: 1 }, { ix: 1, iy: 2 }];
const merged = rects(cells);
check(merged.length === 3, "3 rectangles");
check(Math.abs(merged[0].east - merged[0].west - 0.15) < 1e-9, "premier rectangle = 3 cellules");

check(rects([]).length === 0, "aucune cellule");

console.log("places : OK");
