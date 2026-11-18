// Shared 2D Canvas Geometry, Multi-Axis Smart Snapping, Group Bounds & Zoom/Pan Transforms

export interface RectBounds {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotationDeg?: number;
}

export interface SnapGuideLine {
  axis: 'x' | 'y';
  pos: number;
  kind: 'center' | 'edge' | 'margin' | 'layer' | 'third';
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuideLine[];
}

/**
 * Axis-aligned bounding box of a centered rectangle rotated by rotationDeg
 */
export function getRotatedAabb(b: RectBounds): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
} {
  const rad = ((b.rotationDeg || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const effW = b.w * cos + b.h * sin;
  const effH = b.w * sin + b.h * cos;
  return {
    left: b.cx - effW / 2,
    right: b.cx + effW / 2,
    top: b.cy - effH / 2,
    bottom: b.cy + effH / 2,
    cx: b.cx,
    cy: b.cy,
    width: effW,
    height: effH,
  };
}

/**
 * Computes combined AABB for a multi-selection or group
 */
export function getCombinedBounds(items: RectBounds[]): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
} | null {
  if (items.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    const aabb = getRotatedAabb(item);
    minX = Math.min(minX, aabb.left);
    minY = Math.min(minY, aabb.top);
    maxX = Math.max(maxX, aabb.right);
    maxY = Math.max(maxY, aabb.bottom);
  }
  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/**
 * Multi-axis Smart Snapping: snaps moving selection bounds against:
 * 1) Canvas center (w/2, h/2)
 * 2) Canvas edges (0, w, h) & safe margins (5%)
 * 3) Rule of thirds (w/3, 2w/3, h/3, 2h/3)
 * 4) All other visible unlocked layers' edges (left/right/top/bottom) and centers (cx/cy)
 */
export function computeSmartSnap(
  movingBounds: RectBounds,
  otherLayers: RectBounds[],
  canvasW: number,
  canvasH: number,
  zoom = 1
): SnapResult {
  const threshold = Math.max(4, Math.min(18, 9 / Math.max(0.25, zoom)));
  const moving = getRotatedAabb(movingBounds);

  const xTargets: Array<{ pos: number; kind: SnapGuideLine['kind'] }> = [
    { pos: canvasW / 2, kind: 'center' },
    { pos: Math.round(canvasW * 0.05), kind: 'margin' },
    { pos: Math.round(canvasW * 0.95), kind: 'margin' },
    { pos: Math.round(canvasW / 3), kind: 'third' },
    { pos: Math.round((canvasW * 2) / 3), kind: 'third' },
    { pos: 0, kind: 'edge' },
    { pos: canvasW, kind: 'edge' },
  ];

  const yTargets: Array<{ pos: number; kind: SnapGuideLine['kind'] }> = [
    { pos: canvasH / 2, kind: 'center' },
    { pos: Math.round(canvasH * 0.05), kind: 'margin' },
    { pos: Math.round(canvasH * 0.95), kind: 'margin' },
    { pos: Math.round(canvasH / 3), kind: 'third' },
    { pos: Math.round((canvasH * 2) / 3), kind: 'third' },
    { pos: 0, kind: 'edge' },
    { pos: canvasH, kind: 'edge' },
  ];

  for (const other of otherLayers) {
    if (other.id === movingBounds.id) continue;
    const ob = getRotatedAabb(other);
    xTargets.push({ pos: ob.cx, kind: 'layer' });
    xTargets.push({ pos: ob.left, kind: 'layer' });
    xTargets.push({ pos: ob.right, kind: 'layer' });

    yTargets.push({ pos: ob.cy, kind: 'layer' });
    yTargets.push({ pos: ob.top, kind: 'layer' });
    yTargets.push({ pos: ob.bottom, kind: 'layer' });
  }

  let bestDx = 0;
  let bestXDist = threshold;
  let bestXGuide: SnapGuideLine | null = null;

  const movingXAnchors = [moving.cx, moving.left, moving.right];
  for (const anchorX of movingXAnchors) {
    for (const target of xTargets) {
      const diff = target.pos - anchorX;
      const dist = Math.abs(diff);
      if (dist < bestXDist) {
        bestXDist = dist;
        bestDx = diff;
        bestXGuide = { axis: 'x', pos: target.pos, kind: target.kind };
      }
    }
  }

  let bestDy = 0;
  let bestYDist = threshold;
  let bestYGuide: SnapGuideLine | null = null;

  const movingYAnchors = [moving.cy, moving.top, moving.bottom];
  for (const anchorY of movingYAnchors) {
    for (const target of yTargets) {
      const diff = target.pos - anchorY;
      const dist = Math.abs(diff);
      if (dist < bestYDist) {
        bestYDist = dist;
        bestDy = diff;
        bestYGuide = { axis: 'y', pos: target.pos, kind: target.kind };
      }
    }
  }

  const guides: SnapGuideLine[] = [];
  if (bestXGuide) guides.push(bestXGuide);
  if (bestYGuide) guides.push(bestYGuide);

  return { dx: bestDx, dy: bestDy, guides };
}

export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: canvasW / 2, y: canvasH / 2 };
  const scaleX = canvasW / rect.width;
  const scaleY = canvasH / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export function generateGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
