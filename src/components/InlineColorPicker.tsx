import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface InlineColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

interface Hsv {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round(clamp(n + m, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string, fallbackHue = 180): Hsv {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { h: fallbackHue, s: 0.7, v: 0.9 };
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = fallbackHue;
  if (d !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / d) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / d + 2);
    } else {
      h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

export const InlineColorPicker: React.FC<InlineColorPickerProps> = ({ color, onChange }) => {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
  const hsvRef = useRef<Hsv>(hsv);
  hsvRef.current = hsv;

  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const draggingSvRef = useRef<boolean>(false);
  const draggingHueRef = useRef<boolean>(false);

  // Sync internal HSV if parent changes color externally (e.g. swatch click or eyedropper)
  useEffect(() => {
    const currentHex = hsvToHex(hsvRef.current.h, hsvRef.current.s, hsvRef.current.v).toLowerCase();
    if (currentHex !== color.toLowerCase()) {
      setHsv((prev) => hexToHsv(color, prev.h));
    }
  }, [color]);

  const updateSvFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const s = clamp((clientX - rect.left) / rect.width, 0, 1);
      const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      const next: Hsv = { h: hsvRef.current.h, s, v };
      hsvRef.current = next;
      setHsv(next);
      onChange(hsvToHex(next.h, next.s, next.v));
    },
    [onChange]
  );

  const updateHueFromPointer = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const h = ratio * 360;
      const next: Hsv = { h, s: hsvRef.current.s, v: hsvRef.current.v };
      hsvRef.current = next;
      setHsv(next);
      onChange(hsvToHex(next.h, next.s, next.v));
    },
    [onChange]
  );

  const handleSvPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture unavailable
    }
    draggingSvRef.current = true;
    updateSvFromPointer(e.clientX, e.clientY);
  };

  const handleSvPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSvRef.current) return;
    updateSvFromPointer(e.clientX, e.clientY);
  };

  const handleSvPointerUp = () => {
    draggingSvRef.current = false;
  };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture unavailable
    }
    draggingHueRef.current = true;
    updateHueFromPointer(e.clientX);
  };

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingHueRef.current) return;
    updateHueFromPointer(e.clientX);
  };

  const handleHuePointerUp = () => {
    draggingHueRef.current = false;
  };

  const pureHueColor = `hsl(${Math.round(hsv.h)}, 100%, 50%)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* 2D Saturation / Brightness Direct-Click Area */}
      <div
        ref={svRef}
        role="slider"
        aria-label="Pick shade and brightness"
        aria-valuetext={color}
        onPointerDown={handleSvPointerDown}
        onPointerMove={handleSvPointerMove}
        onPointerUp={handleSvPointerUp}
        onPointerCancel={handleSvPointerUp}
        style={{
          position: 'relative',
          width: '100%',
          height: '112px',
          backgroundColor: pureHueColor,
          backgroundImage:
            'linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #ffffff, rgba(255,255,255,0))',
          border: '2px solid #141414',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
          cursor: 'crosshair',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* Pixel-style Reticle */}
        <div
          style={{
            position: 'absolute',
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            width: '12px',
            height: '12px',
            transform: 'translate(-50%, -50%)',
            border: '2px solid #ffffff',
            boxShadow: '0 0 0 2px #000000',
            backgroundColor: color,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Rainbow Hue Bar */}
      <div
        ref={hueRef}
        role="slider"
        aria-label="Pick hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={handleHuePointerDown}
        onPointerMove={handleHuePointerMove}
        onPointerUp={handleHuePointerUp}
        onPointerCancel={handleHuePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          height: '22px',
          background:
            'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          border: '2px solid #141414',
          cursor: 'ew-resize',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(hsv.h / 360) * 100}%`,
            top: '-3px',
            bottom: '-3px',
            width: '8px',
            transform: 'translateX(-50%)',
            backgroundColor: '#ffffff',
            border: '2px solid #000000',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
};

export default InlineColorPicker;
