export interface Coordinates {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

/**
 * Clamps coordinates strictly within viewport boundaries, accounting for widget size and padding margin.
 */
export function clampCoordinates(
  pos: Coordinates,
  viewport: ViewportSize,
  widget: WidgetSize,
  margin: number = 12
): Coordinates {
  const minX = margin;
  const maxX = Math.max(margin, viewport.width - widget.width - margin);
  const minY = margin;
  const maxY = Math.max(margin, viewport.height - widget.height - margin);

  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

/**
 * Distinguishes intentional drag motion from pointer clicks/jitters using distance threshold.
 */
export function isDragMovement(
  start: Coordinates,
  current: Coordinates,
  threshold: number = 6
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return Math.hypot(dx, dy) >= threshold;
}
