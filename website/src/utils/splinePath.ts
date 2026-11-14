import type { SplinePointData } from '../data/websiteContent';

export interface PlottedPoint {
  x: number;
  y: number;
  label: string;
  value: number;
  weight?: number;
  reps?: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildSplineGeometry(
  data: readonly SplinePointData[],
  width: number,
  height: number,
  padding = { top: 14, right: 14, bottom: 20, left: 14 }
): {
  points: PlottedPoint[];
  linePath: string;
  areaPath: string;
} {
  if (data.length === 0) {
    return { points: [], linePath: '', areaPath: '' };
  }

  const values = data.map((d) => d.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (minVal === maxVal) {
    minVal -= 1;
    maxVal += 1;
  }

  const pad = (maxVal - minVal) * 0.18;
  const min = minVal - pad;
  const max = maxVal + pad;
  const span = max - min || 1;

  const plotW = Math.max(10, width - padding.left - padding.right);
  const plotH = Math.max(10, height - padding.top - padding.bottom);
  const count = data.length;

  const points: PlottedPoint[] = data.map((item, idx) => {
    const x =
      count === 1
        ? padding.left + plotW / 2
        : padding.left + (idx / (count - 1)) * plotW;
    const norm = (item.value - min) / span;
    const y = padding.top + plotH * (1 - norm);
    return {
      x: round1(x),
      y: round1(y),
      label: item.label,
      value: item.value,
      weight: item.weight,
      reps: item.reps,
    };
  });

  if (points.length === 1) {
    const p = points[0];
    const linePath = `M ${p.x} ${p.y}`;
    return { points, linePath, areaPath: linePath };
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = round1(p1.x + (p2.x - p0.x) / 6);
    const cp1y = round1(p1.y + (p2.y - p0.y) / 6);
    const cp2x = round1(p2.x - (p3.x - p1.x) / 6);
    const cp2y = round1(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const baseLine = round1(padding.top + plotH + 8);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${d} L ${last.x} ${baseLine} L ${first.x} ${baseLine} Z`;

  return { points, linePath: d, areaPath };
}
