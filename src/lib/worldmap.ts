/* PSYCH0 — guestbook pixel map. A 60×15 hand-tuned pixel world (not a survey
 * map — a pixel map). Rows are run-length land bands, roughly equirectangular:
 * col = (lon + 180) / 6, row = (85 − lat) / 10. Pins are "col,row" strings. */

export const MAP_W = 60;
export const MAP_H = 15;

/* land runs per row: [startCol, endCol] inclusive */
const ROWS: [number, number][][] = [
  [[25, 27]],                                                            // r0  arctic
  [[2, 4], [6, 20], [24, 27], [31, 34], [37, 55]],                       // r1  ~75N
  [[2, 3], [5, 21], [24, 26], [29, 37], [37, 57]],                       // r2
  [[4, 21], [30, 38], [38, 58]],                                         // r3  ~55N
  [[5, 20], [30, 54]],                                                   // r4  ~45N
  [[7, 18], [27, 36], [38, 53]],                                         // r5  ~35N
  [[9, 16], [27, 36], [42, 51]],                                         // r6  ~25N
  [[11, 15], [28, 35], [43, 50]],                                        // r7  ~15N
  [[15, 19], [29, 34], [45, 52]],                                        // r8  ~5N
  [[16, 21], [30, 34], [46, 51], [53, 54]],                              // r9  ~5S
  [[16, 21], [30, 34], [38, 38], [50, 54]],                              // r10 ~15S
  [[17, 20], [31, 33], [38, 38], [49, 55]],                              // r11 ~25S
  [[17, 19], [32, 33], [50, 54], [57, 57]],                              // r12 ~35S
  [[17, 18], [56, 56]],                                                  // r13 ~45S
  [],                                                                    // r14 ~55S
];

export function isLand(c: number, r: number): boolean {
  if (c < 0 || c >= MAP_W || r < 0 || r >= MAP_H) return false;
  return ROWS[r].some(([a, b]) => c >= a && c <= b);
}

/** the map as text rows — '#' land, '·' sea (used by the canvas painter) */
export function mapRows(): string[] {
  const out: string[] = [];
  for (let r = 0; r < MAP_H; r++) {
    let line = '';
    for (let c = 0; c < MAP_W; c++) line += isLand(c, r) ? '#' : '·';
    out.push(line);
  }
  return out;
}

export function parseLoc(loc: string): { c: number; r: number } | null {
  const m = /^(\d{1,2}),(\d{1,2})$/.exec(String(loc || ''));
  if (!m) return null;
  const c = parseInt(m[1], 10), r = parseInt(m[2], 10);
  if (c >= MAP_W || r >= MAP_H) return null;
  return { c, r };
}

export function locLabel(loc: string): string {
  const p = parseLoc(loc);
  if (!p) return '';
  const lon = Math.round(p.c * 6 - 180);
  const lat = Math.round(85 - p.r * 10);
  const ns = lat >= 0 ? lat + '°N' : (-lat) + '°S';
  const ew = lon >= 0 ? lon + '°E' : (-lon) + '°W';
  return ns + ' ' + ew;
}
