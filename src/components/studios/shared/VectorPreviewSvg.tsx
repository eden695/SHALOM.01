import React from 'react';
import { getSvgVectorDef, StudioVectorElementKind } from '../../../services/studios/svgVectors';

interface VectorPreviewSvgProps {
  kind: StudioVectorElementKind | string;
  primaryColor?: string;
  secondaryColor?: string;
  strokeColor?: string;
  className?: string;
}

export const VectorPreviewSvg: React.FC<VectorPreviewSvgProps> = ({
  kind,
  primaryColor,
  secondaryColor,
  strokeColor,
  className = 'w-8 h-8',
}) => {
  const def = getSvgVectorDef(kind);
  const fillPrimary = primaryColor || def.defaultPrimary;
  const fillSecondary = secondaryColor || def.defaultSecondary;
  const stroke = strokeColor || fillSecondary || fillPrimary;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      {def.paths.map((p, idx) => {
        if (p.role === 'stroke') {
          return (
            <path
              key={idx}
              d={p.d}
              fill="none"
              stroke={kind === 'line' ? fillPrimary : stroke}
              strokeWidth={p.strokeWidth ?? 3}
              strokeLinecap={p.lineCap || 'round'}
              strokeLinejoin={p.lineJoin || 'round'}
              opacity={p.opacity}
            />
          );
        }
        return (
          <path
            key={idx}
            d={p.d}
            fill={p.role === 'primary' ? fillPrimary : fillSecondary}
            fillRule={p.fillRule}
            opacity={p.opacity}
          />
        );
      })}
    </svg>
  );
};
