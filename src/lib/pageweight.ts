/* PSYCH0 — page weight + carbon estimate for low-power mode and the colophon.
 * Numbers come from the Performance API (real bytes this page moved); the CO₂
 * figure uses the Sustainable Web Design model (~0.81 kWh/GB, ~442 g/kWh grid
 * ≈ 0.34 mg CO₂e per KB). Rough by nature — labeled as an estimate everywhere. */

export const CO2_PER_KB = 0.34; // mg CO₂e per KB transferred

export function pageWeightKB(): number {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return 0;
  let bytes = 0;
  type PerfRes = PerformanceResourceTiming & { transferSize?: number; encodedBodySize?: number };
  const nav = performance.getEntriesByType('navigation')[0] as (PerformanceNavigationTiming & { transferSize?: number }) | undefined;
  if (nav?.transferSize) bytes += nav.transferSize;
  else if (nav) bytes += nav.encodedBodySize || 0;
  for (const r of performance.getEntriesByType('resource') as PerfRes[]) {
    bytes += r.transferSize || r.encodedBodySize || 0;
  }
  return Math.round(bytes / 1024);
}

export function pageCarbonMg(kb: number): number {
  return kb * CO2_PER_KB;
}

export function fmtWeight(kb: number): string {
  return kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb + ' KB';
}
