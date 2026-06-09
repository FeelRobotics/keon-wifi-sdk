import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { positionToDisplayLevel, displayLevelToSvgY, calcAnimationUnitsPerMs } from '@/lib/position';

// SVG layout constants
const SVG_W = 200;
const SVG_H = 320;
const WALL_X_LEFT = 20;
const WALL_X_RIGHT = 180;
const INNER_X_LEFT = 28;
const INNER_X_RIGHT = 172;
const TOP_Y = 25;
const BOTTOM_Y = 285;
const CORNER_R = 20;

/**
 * Left panel — U-shaped vessel SVG with an animated liquid level line.
 * The horizontal line tracks the device's piston position in real time.
 * 0% position sits at 15% of vessel height (DISPLAY_LEVEL_MIN = 15).
 */
export function VesselView() {
  const position = useAppStore((s) => s.position);
  const animationParams = useAppStore((s) => s.animationParams);
  const socketStatus = useAppStore((s) => s.socketStatus);

  // RAF-driven oscillation for MOVEMENT_BETWEEN commands.
  // At speed=100, the line traverses 0 → 100 in 186 ms (FULL_STROKE_MS_AT_MAX_SPEED).
  // Lower speeds scale linearly.
  useEffect(() => {
    if (!animationParams) return;

    let rafId = 0;
    let lastTime = performance.now();

    // Choose initial direction so the line moves toward the further bound.
    const initial = useAppStore.getState().position;
    let dir: 1 | -1 = initial >= animationParams.max ? -1 : 1;

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      const params = useAppStore.getState().animationParams;
      if (!params) return;

      const { min, max, speed } = params;
      const unitsPerMs = calcAnimationUnitsPerMs(speed);
      const delta = unitsPerMs * dt;

      const current = useAppStore.getState().position;
      let next = current + dir * delta;

      if (next >= max) {
        next = max;
        dir = -1;
      } else if (next <= min) {
        next = min;
        dir = 1;
      }

      useAppStore.getState().setPosition(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animationParams]);

  const displayLevel = positionToDisplayLevel(position);
  const liquidY = displayLevelToSvgY(displayLevel, TOP_Y, BOTTOM_Y);

  // Vessel outline path (U-shape with rounded bottom corners)
  const vesselPath = [
    `M ${WALL_X_LEFT} ${TOP_Y}`,
    `L ${WALL_X_LEFT} ${BOTTOM_Y - CORNER_R}`,
    `Q ${WALL_X_LEFT} ${BOTTOM_Y} ${WALL_X_LEFT + CORNER_R} ${BOTTOM_Y}`,
    `L ${WALL_X_RIGHT - CORNER_R} ${BOTTOM_Y}`,
    `Q ${WALL_X_RIGHT} ${BOTTOM_Y} ${WALL_X_RIGHT} ${BOTTOM_Y - CORNER_R}`,
    `L ${WALL_X_RIGHT} ${TOP_Y}`,
  ].join(' ');

  // Clip path for inner fill area (same shape, inset by wall width)
  const innerPath = [
    `M ${INNER_X_LEFT} ${TOP_Y}`,
    `L ${INNER_X_LEFT} ${BOTTOM_Y - CORNER_R}`,
    `Q ${INNER_X_LEFT} ${BOTTOM_Y - 2} ${INNER_X_LEFT + CORNER_R - 6} ${BOTTOM_Y - 2}`,
    `L ${INNER_X_RIGHT - CORNER_R + 6} ${BOTTOM_Y - 2}`,
    `Q ${INNER_X_RIGHT} ${BOTTOM_Y - 2} ${INNER_X_RIGHT} ${BOTTOM_Y - CORNER_R}`,
    `L ${INNER_X_RIGHT} ${TOP_Y}`,
    'Z',
  ].join(' ');

  const statusColor: Record<string, string> = {
    connected: '#22c55e',
    connecting: '#f59e0b',
    error: '#ef4444',
    disconnected: '#6b7280',
  };
  const dotColor = statusColor[socketStatus] ?? '#6b7280';

  return (
    <div className="vessel-view">
      <h2 className="panel-title">Device Visualization</h2>

      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        aria-label={`Keon piston position ${Math.round(position)}%`}
        className="vessel-svg"
      >
        <defs>
          <clipPath id="vessel-inner-clip">
            <path d={innerPath} />
          </clipPath>
        </defs>

        {/* Liquid fill — clipped to vessel interior */}
        <rect
          x={INNER_X_LEFT}
          y={liquidY}
          width={INNER_X_RIGHT - INNER_X_LEFT}
          height={BOTTOM_Y - liquidY}
          fill="#3b82f6"
          opacity={0.55}
          clipPath="url(#vessel-inner-clip)"
          style={{ transition: 'y 16ms linear, height 16ms linear' }}
        />

        {/* Level line */}
        <line
          x1={INNER_X_LEFT}
          y1={liquidY}
          x2={INNER_X_RIGHT}
          y2={liquidY}
          stroke="#1d4ed8"
          strokeWidth={2.5}
          style={{ transition: 'y1 16ms linear, y2 16ms linear' }}
        />

        {/* Vessel outline */}
        <path
          d={vesselPath}
          fill="none"
          stroke="#374151"
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* Position label above line */}
        <text
          x={SVG_W / 2}
          y={Math.max(TOP_Y + 14, liquidY - 6)}
          textAnchor="middle"
          fill="#1d4ed8"
          fontSize={13}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {Math.round(position)}%
        </text>

        {/* 0% floor indicator dashed line at 15% display level */}
        {(() => {
          const floorY = displayLevelToSvgY(15, TOP_Y, BOTTOM_Y);
          return (
            <line
              x1={INNER_X_LEFT}
              y1={floorY}
              x2={INNER_X_RIGHT}
              y2={floorY}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })()}
      </svg>

      <div className="vessel-meta">
        <span className="vessel-position-label">Position: {Math.round(position)}%</span>
        <span className="status-dot" style={{ color: dotColor }}>
          ● {socketStatus}
        </span>
      </div>
    </div>
  );
}
