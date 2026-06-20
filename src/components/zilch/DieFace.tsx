import type { CSSProperties } from 'react';

const PIP_LAYOUT: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 28],
    [72, 28],
    [28, 50],
    [72, 50],
    [28, 72],
    [72, 72],
  ],
};

interface DieFaceProps {
  value: number;
  rolling?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function DieFace({ value, rolling = false, className = '', style }: DieFaceProps) {
  const faceValue = rolling ? 0 : Math.min(6, Math.max(1, value));
  const pips = faceValue > 0 ? PIP_LAYOUT[faceValue] ?? PIP_LAYOUT[1] : [];

  return (
    <span className={`zilch-die-face${className ? ` ${className}` : ''}`} style={style}>
      <span className="zilch-die-face__cube" aria-hidden="true">
        {rolling ? (
          <span className="zilch-die-face__rolling-mark">?</span>
        ) : (
          pips.map(([x, y], index) => (
            <span
              key={`${faceValue}-${index}`}
              className="zilch-die-face__pip"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))
        )}
      </span>
      <span className="visually-hidden">{rolling ? 'Rolling' : `Die ${faceValue}`}</span>
    </span>
  );
}
