import React from "react";

interface DxfBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
}

interface DxfData {
  fileName: string;
  entities: any[];
  bounds: DxfBounds;
  candidates: {
    id: string;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    width: number;
    height: number;
    points: { x: number; y: number }[];
  }[];
}

interface DxfSvgRendererProps {
  dxfData: DxfData;
  hoveredCandidateId: string | null;
  onCandidateClick?: (candidate: any) => void;
  activePanelIds: Set<string>;
  isDarkTheme?: boolean;
}

export const DxfSvgRenderer: React.FC<DxfSvgRendererProps> = ({
  dxfData,
  hoveredCandidateId,
  onCandidateClick,
  activePanelIds,
  isDarkTheme = false,
}) => {
  const { bounds, entities } = dxfData;

  const boundsWidth = bounds && typeof bounds.width === "number" && !isNaN(bounds.width) && bounds.width > 0 ? bounds.width : 1000;
  const boundsHeight = bounds && typeof bounds.height === "number" && !isNaN(bounds.height) && bounds.height > 0 ? bounds.height : 1000;
  const xMin = bounds && typeof bounds.xMin === "number" && !isNaN(bounds.xMin) ? bounds.xMin : 0;
  const yMax = bounds && typeof bounds.yMax === "number" && !isNaN(bounds.yMax) ? bounds.yMax : 0;

  const mapX = (x: number) => {
    const val = (typeof x === "number" && !isNaN(x) ? x : 0) - xMin;
    return isNaN(val) || !isFinite(val) ? 0 : val;
  };
  const mapY = (y: number) => {
    const val = yMax - (typeof y === "number" && !isNaN(y) ? y : 0);
    return isNaN(val) || !isFinite(val) ? 0 : val;
  };

  // Ultra-thin crisp hairline stroke width for CAD lines (0.5px screen width via vectorEffect)
  const strokeWidth = 0.5;
  const candidateStrokeWidth = 1.0;

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const cx = typeof centerX === "number" && !isNaN(centerX) ? centerX : 0;
    const cy = typeof centerY === "number" && !isNaN(centerY) ? centerY : 0;
    const r = typeof radius === "number" && !isNaN(radius) ? radius : 0;
    const deg = typeof angleInDegrees === "number" && !isNaN(angleInDegrees) ? angleInDegrees : 0;
    const angleInRadians = (deg * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const getArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);

    let diff = endAngle - startAngle;
    if (isNaN(diff)) diff = 0;
    if (diff < 0) diff += 360;
    const largeArcFlag = diff > 180 ? 1 : 0;
    const sweepFlag = 1; // CW because Y is flipped

    const safeR = typeof r === "number" && !isNaN(r) ? r : 0;

    return `M ${mapX(start.x)} ${mapY(start.y)} A ${safeR} ${safeR} 0 ${largeArcFlag} ${sweepFlag} ${mapX(end.x)} ${mapY(end.y)}`;
  };

  const gridW = boundsWidth / 50 || 20;
  const gridH = boundsHeight / 30 || 20;

  return (
    <svg
      id="dxf-svg-drawing"
      viewBox={`0 0 ${boundsWidth} ${boundsHeight}`}
      className="w-full h-full select-none"
      style={{ display: "block" }}
    >
      {/* Background Grid */}
      <defs>
        <pattern id="dxf-grid" width={gridW} height={gridH} patternUnits="userSpaceOnUse">
          <rect width={gridW} height={gridH} fill="none" />
          <path
            d={`M ${gridW} 0 L 0 0 0 ${gridH}`}
            fill="none"
            stroke={isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"}
            strokeWidth={0.5}
          />
        </pattern>
      </defs>
      <rect width={boundsWidth} height={boundsHeight} fill="url(#dxf-grid)" />

      {/* Render Native CAD Entities */}
      {entities.map((entity, index) => {
        try {
          if (entity.type === "LINE" && entity.vertices && entity.vertices.length >= 2) {
            const v0 = entity.vertices[0] || { x: 0, y: 0 };
            const v1 = entity.vertices[1] || { x: 0, y: 0 };
            return (
              <line
                key={`line-${index}`}
                x1={mapX(v0.x)}
                y1={mapY(v0.y)}
                x2={mapX(v1.x)}
                y2={mapY(v1.y)}
                stroke={isDarkTheme ? "#526071" : "#4F5D75"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={0.7}
              />
            );
          }

          if ((entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") && entity.vertices && entity.vertices.length > 1) {
            const points = entity.vertices
              .map((v: any) => {
                const vx = v && typeof v.x === "number" && !isNaN(v.x) ? v.x : 0;
                const vy = v && typeof v.y === "number" && !isNaN(v.y) ? v.y : 0;
                return `${mapX(vx)},${mapY(vy)}`;
              })
              .join(" ");
            const isShapeClosed = entity.shape === true;
            return (
              <polygon
                key={`polyline-${index}`}
                points={points}
                fill="none"
                stroke={isDarkTheme ? "#38BDF8" : "#1D2A44"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity={isShapeClosed ? 0.85 : 0.6}
              />
            );
          }

          if (entity.type === "CIRCLE") {
            const cx = entity.center?.x ?? 0;
            const cy = entity.center?.y ?? 0;
            const r = entity.radius ?? 0;
            const safeR = typeof r === "number" && !isNaN(r) ? r : 0;
            return (
              <circle
                key={`circle-${index}`}
                cx={mapX(cx)}
                cy={mapY(cy)}
                r={safeR}
                fill="none"
                stroke={isDarkTheme ? "#475569" : "#4F5D75"}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
                opacity={0.65}
              />
            );
          }

          if (entity.type === "ARC") {
            const cx = entity.center?.x ?? 0;
            const cy = entity.center?.y ?? 0;
            const r = entity.radius ?? 0;
            const startAngle = entity.startAngle ?? 0;
            const endAngle = entity.endAngle ?? 0;
            const d = getArcPath(cx, cy, r, startAngle, endAngle);
            return (
              <path
                key={`arc-${index}`}
                d={d}
                fill="none"
                stroke={isDarkTheme ? "#475569" : "#4F5D75"}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
                opacity={0.65}
              />
            );
          }

          if ((entity.type === "TEXT" || entity.type === "MTEXT") && entity.text) {
            const x = entity.position?.x ?? 0;
            const y = entity.position?.y ?? 0;
            const textHeight = entity.height ?? (boundsHeight * 0.015);
            const safeTH = typeof textHeight === "number" && !isNaN(textHeight) ? textHeight : 12;
            return (
              <text
                key={`text-${index}`}
                x={mapX(x)}
                y={mapY(y)}
                fontSize={safeTH}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="500"
                fill={isDarkTheme ? "#94A3B8" : "#4A5568"}
                opacity={0.5}
                textAnchor="start"
              >
                {entity.text}
              </text>
            );
          }
        } catch (err) {
          // Gracefully continue if single entity fails to draw
        }
        return null;
      })}

      {/* Highlight Detected Candidates */}
      {dxfData.candidates.map((cand) => {
        const isHovered = hoveredCandidateId === cand.id;
        const isActive = activePanelIds.has(cand.id);

        const safeXMin = typeof cand.xMin === "number" && !isNaN(cand.xMin) ? cand.xMin : 0;
        const safeYMax = typeof cand.yMax === "number" && !isNaN(cand.yMax) ? cand.yMax : 0;
        const safeW = typeof cand.width === "number" && !isNaN(cand.width) ? cand.width : 0;
        const safeH = typeof cand.height === "number" && !isNaN(cand.height) ? cand.height : 0;

        return (
          <g key={`cand-group-${cand.id}`} className="cursor-pointer">
            {/* Clickable fill overlay */}
            <rect
              x={mapX(safeXMin)}
              y={mapY(safeYMax)}
              width={safeW}
              height={safeH}
              fill={
                isActive
                  ? isDarkTheme
                    ? "rgba(16, 185, 129, 0.2)"
                    : "rgba(36, 179, 113, 0.15)"
                  : isHovered
                  ? isDarkTheme
                    ? "rgba(56, 189, 248, 0.15)"
                    : "rgba(0, 82, 204, 0.1)"
                  : "rgba(0, 82, 204, 0.01)"
              }
              stroke={
                isActive
                  ? isDarkTheme
                    ? "#10B981"
                    : "#24B371"
                  : isHovered
                  ? isDarkTheme
                    ? "#38BDF8"
                    : "#0052CC"
                  : isDarkTheme
                  ? "rgba(148, 163, 184, 0.45)"
                  : "rgba(0, 82, 204, 0.25)"
              }
              strokeWidth={isHovered || isActive ? candidateStrokeWidth : strokeWidth}
              strokeDasharray={isActive ? "none" : "4 4"}
              vectorEffect="non-scaling-stroke"
              onClick={() => onCandidateClick?.(cand)}
            />
          </g>
        );
      })}
    </svg>
  );
};
