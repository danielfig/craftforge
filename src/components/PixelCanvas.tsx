import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLOR_PALETTES, ITEM_TEMPLATES, ItemTemplate } from '../assets/templates';
import { renderPixelsToDataUrl } from '../assets/textures';
import { playSound } from '../utils/sounds';

export type DrawTool = 'pencil' | 'eraser' | 'fill' | 'eyedropper';

export interface PixelCanvasProps {
  pixels: string[];
  onChange: (nextPixels: string[]) => void;
  onTemplateSelect?: (template: ItemTemplate) => void;
}

const GRID_SIZE = 16;
const TOTAL_PIXELS = GRID_SIZE * GRID_SIZE;
const MAX_HISTORY = 30;

function createBlankPixels(): string[] {
  return Array(TOTAL_PIXELS).fill('');
}

function normalizePixels(pixels: string[]): string[] {
  if (pixels.length === TOTAL_PIXELS) return pixels.slice();
  const out = createBlankPixels();
  for (let i = 0; i < Math.min(pixels.length, TOTAL_PIXELS); i++) {
    out[i] = pixels[i] || '';
  }
  return out;
}

function floodFill(
  source: string[],
  startX: number,
  startY: number,
  fillColor: string
): string[] {
  const targetIdx = startY * GRID_SIZE + startX;
  const targetColor = source[targetIdx] || '';
  if (targetColor === fillColor) return source;

  const next = source.slice();
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(TOTAL_PIXELS);
  visited[targetIdx] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const idx = cy * GRID_SIZE + cx;
    next[idx] = fillColor;

    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
      const nIdx = ny * GRID_SIZE + nx;
      if (visited[nIdx]) continue;
      if ((next[nIdx] || '') === targetColor) {
        visited[nIdx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  return next;
}

function getLinePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([cx, cy]);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({
  pixels,
  onChange,
  onTemplateSelect,
}) => {
  const [tool, setTool] = useState<DrawTool>('pencil');
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState<number>(0);
  const [activeColor, setActiveColor] = useState<string>(
    COLOR_PALETTES[0]?.colors[0] || '#4de8e8'
  );
  const [mirrorMode, setMirrorMode] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);

  // Undo/redo history stacks (up to 30 snapshots)
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const strokeChangedRef = useRef<boolean>(false);
  const preStrokeSnapshotRef = useRef<string[] | null>(null);
  const workingPixelsRef = useRef<string[]>(normalizePixels(pixels));
  const lastCellRef = useRef<[number, number] | null>(null);
  const lastSoundTimeRef = useRef<number>(0);

  // Keep workingPixelsRef in sync when parent updates pixels (e.g. reset after sending)
  useEffect(() => {
    workingPixelsRef.current = normalizePixels(pixels);
  }, [pixels]);

  const pushUndo = useCallback((snapshot: string[]) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot.slice()];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setRedoStack([]);
  }, []);

  const playThrottledPaintSound = useCallback((kind: 'paint' | 'erase') => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 75) {
      lastSoundTimeRef.current = now;
      playSound(kind);
    }
  }, []);

  const getCellFromPointer = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      if (relX < 0 || relX >= 1 || relY < 0 || relY >= 1) return null;
      const x = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(relX * GRID_SIZE)));
      const y = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(relY * GRID_SIZE)));
      return [x, y];
    },
    []
  );

  const applyDrawAtCells = useCallback(
    (cells: [number, number][], drawTool: 'pencil' | 'eraser') => {
      const color = drawTool === 'eraser' ? '' : activeColor;
      const current = workingPixelsRef.current;
      let changed = false;
      let next = current;

      for (const [x, y] of cells) {
        const idx = y * GRID_SIZE + x;
        if ((next[idx] || '') !== color) {
          if (!changed) {
            next = current.slice();
            changed = true;
          }
          next[idx] = color;
        }
        if (mirrorMode) {
          const mx = GRID_SIZE - 1 - x;
          const mIdx = y * GRID_SIZE + mx;
          if ((next[mIdx] || '') !== color) {
            if (!changed) {
              next = current.slice();
              changed = true;
            }
            next[mIdx] = color;
          }
        }
      }

      if (changed) {
        workingPixelsRef.current = next;
        strokeChangedRef.current = true;
        onChange(next);
        playThrottledPaintSound(drawTool === 'eraser' ? 'erase' : 'paint');
      }
    },
    [activeColor, mirrorMode, onChange, playThrottledPaintSound]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const cell = getCellFromPointer(e.clientX, e.clientY);
      if (!cell) return;
      const [x, y] = cell;
      setHoverCell(cell);

      if (tool === 'eyedropper') {
        const picked = workingPixelsRef.current[y * GRID_SIZE + x] || '';
        if (picked) {
          setActiveColor(picked);
          setTool('pencil');
          playSound('click');
        } else {
          setTool('eraser');
          playSound('click');
        }
        return;
      }

      if (tool === 'fill') {
        const before = workingPixelsRef.current.slice();
        let filled = floodFill(before, x, y, activeColor);
        if (mirrorMode) {
          const mx = GRID_SIZE - 1 - x;
          filled = floodFill(filled, mx, y, activeColor);
        }
        const didChange = filled.some((v, i) => v !== before[i]);
        if (didChange) {
          pushUndo(before);
          workingPixelsRef.current = filled;
          onChange(filled);
          playSound('paint');
        }
        return;
      }

      // Pencil or Eraser stroke
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      isDrawingRef.current = true;
      strokeChangedRef.current = false;
      preStrokeSnapshotRef.current = workingPixelsRef.current.slice();
      lastCellRef.current = cell;

      applyDrawAtCells([cell], tool);
    },
    [activeColor, applyDrawAtCells, getCellFromPointer, mirrorMode, onChange, pushUndo, tool]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const cell = getCellFromPointer(e.clientX, e.clientY);
      setHoverCell(cell);

      if (!isDrawingRef.current || !cell) return;
      if (tool !== 'pencil' && tool !== 'eraser') return;

      const prev = lastCellRef.current;
      const points = prev ? getLinePoints(prev[0], prev[1], cell[0], cell[1]) : [cell];
      lastCellRef.current = cell;
      applyDrawAtCells(points, tool);
    },
    [applyDrawAtCells, getCellFromPointer, tool]
  );

  const finishStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastCellRef.current = null;
    if (strokeChangedRef.current && preStrokeSnapshotRef.current) {
      pushUndo(preStrokeSnapshotRef.current);
    }
    preStrokeSnapshotRef.current = null;
    strokeChangedRef.current = false;
  }, [pushUndo]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const current = workingPixelsRef.current.slice();
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => {
      const next = [...prev, current];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    workingPixelsRef.current = previous.slice();
    onChange(previous.slice());
    playSound('click');
  }, [onChange, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    const current = workingPixelsRef.current.slice();
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => {
      const next = [...prev, current];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    workingPixelsRef.current = nextState.slice();
    onChange(nextState.slice());
    playSound('click');
  }, [onChange, redoStack]);

  const handleClear = useCallback(() => {
    const current = workingPixelsRef.current;
    const hasAnyPixel = current.some((p) => p !== '');
    if (!hasAnyPixel) return;
    pushUndo(current.slice());
    const blank = createBlankPixels();
    workingPixelsRef.current = blank;
    onChange(blank);
    playSound('erase');
  }, [onChange, pushUndo]);

  const handleLoadTemplate = useCallback(
    (template: ItemTemplate) => {
      pushUndo(workingPixelsRef.current.slice());
      const next = normalizePixels(template.pixels);
      workingPixelsRef.current = next;
      onChange(next);
      playSound('click');
      onTemplateSelect?.(template);
    },
    [onChange, onTemplateSelect, pushUndo]
  );

  // Pre-render template thumbnails once
  const templatePreviews = useMemo(() => {
    return ITEM_TEMPLATES.map((tpl) => ({
      template: tpl,
      dataUrl: renderPixelsToDataUrl(tpl.pixels, 3),
    }));
  }, []);

  const hasBlankTemplate = useMemo(
    () => ITEM_TEMPLATES.some((t) => t.id === 'blank' || t.pixels.every((p) => !p)),
    []
  );

  const currentPalette = COLOR_PALETTES[selectedPaletteIdx] || COLOR_PALETTES[0];
  const displayPixels = normalizePixels(pixels);

  const toolButtons: { id: DrawTool; icon: string; label: string }[] = [
    { id: 'pencil', icon: '✏️', label: 'Draw' },
    { id: 'eraser', icon: '🧽', label: 'Erase' },
    { id: 'fill', icon: '🪣', label: 'Fill' },
    { id: 'eyedropper', icon: '💧', label: 'Pick' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Scoped responsive rules for Pixel Tablet (1280x800 landscape & 800x1280 portrait) */}
      <style>{`
        .cf-canvas-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: start;
        }
        .cf-tool-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }
        .cf-action-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }
        .cf-swatch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
          gap: 6px;
        }
        .cf-canvas-frame {
          width: 100%;
          max-width: 448px;
          aspect-ratio: 1 / 1;
        }
        @media (min-width: 900px) {
          .cf-canvas-main {
            grid-template-columns: minmax(0, 1fr) 232px;
            gap: 10px;
            align-items: stretch;
          }
          .cf-tool-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .cf-action-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .cf-swatch-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .cf-canvas-frame {
            max-width: 432px;
          }
        }
      `}</style>

      {/* Main Canvas + Docked Tool & Palette Rail */}
      <div className="cf-canvas-main">
        {/* 16x16 Interactive Pixel Canvas */}
        <div
          className="mc-panel-dark"
          style={{
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <div
            className="cf-canvas-frame"
            style={{
              position: 'relative',
              border: '4px solid #212121',
              boxShadow: 'inset 0 0 0 2px #555, 0 6px 16px rgba(0,0,0,0.45)',
              backgroundImage:
                'linear-gradient(45deg, #2b2b33 25%, transparent 25%), linear-gradient(-45deg, #2b2b33 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2b2b33 75%), linear-gradient(-45deg, transparent 75%, #2b2b33 75%)',
              backgroundSize: '26px 26px',
              backgroundPosition: '0 0, 0 13px, 13px -13px, -13px 0px',
              backgroundColor: '#222229',
            }}
          >
            <div
              ref={gridRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={() => setHoverCell(null)}
              role="application"
              aria-label="16 by 16 pixel art canvas"
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor:
                  tool === 'eraser'
                    ? 'cell'
                    : tool === 'eyedropper'
                    ? 'copy'
                    : 'crosshair',
                position: 'relative',
              }}
            >
              {displayPixels.map((color, idx) => {
                const x = idx % GRID_SIZE;
                const y = Math.floor(idx / GRID_SIZE);
                const isHovered =
                  hoverCell !== null &&
                  ((hoverCell[0] === x && hoverCell[1] === y) ||
                    (mirrorMode &&
                      GRID_SIZE - 1 - hoverCell[0] === x &&
                      hoverCell[1] === y));

                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: color || 'transparent',
                      boxSizing: 'border-box',
                      borderRight: showGrid ? '1px solid rgba(255,255,255,0.12)' : 'none',
                      borderBottom: showGrid ? '1px solid rgba(255,255,255,0.12)' : 'none',
                      outline: isHovered ? '2px solid rgba(255,255,255,0.85)' : 'none',
                      outlineOffset: '-2px',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}

              {/* Vertical symmetry axis guide when Mirror Mode is ON */}
              {mirrorMode && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: '2px',
                    transform: 'translateX(-1px)',
                    background:
                      'repeating-linear-gradient(to bottom, #d580ff 0 6px, transparent 6px 12px)',
                    pointerEvents: 'none',
                    boxShadow: '0 0 6px rgba(180, 70, 255, 0.8)',
                  }}
                />
              )}
            </div>
          </div>

          {/* Status hint strip */}
          <div
            style={{
              width: '100%',
              maxWidth: '448px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: '#c8c8d8',
              padding: '0 2px',
            }}
          >
            <span>
              Tool:{' '}
              <strong style={{ color: '#ffdd57', textTransform: 'capitalize' }}>
                {tool}
              </strong>
              {mirrorMode ? ' · 🪞 Mirror' : ''}
            </span>
            <span>
              {hoverCell ? `(${hoverCell[0] + 1}, ${hoverCell[1] + 1})` : '16×16 Grid'}
            </span>
          </div>
        </div>

        {/* Docked Tool & Palette Rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Drawing Tools & History */}
          <div
            className="mc-panel-dark"
            style={{
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div className="cf-tool-grid">
              {toolButtons.map((tb) => {
                const isActive = tool === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => {
                      setTool(tb.id);
                      playSound('click');
                    }}
                    className={`mc-btn ${isActive ? 'mc-btn-gold' : ''}`}
                    style={{
                      minHeight: '44px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      outline: isActive ? '2px solid #fff' : 'none',
                    }}
                    aria-pressed={isActive}
                    title={tb.label}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{tb.icon}</span>
                    <span>{tb.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="cf-action-grid">
              <button
                type="button"
                onClick={() => {
                  setMirrorMode((m) => !m);
                  playSound('click');
                }}
                className={`mc-btn ${mirrorMode ? 'mc-btn-purple' : ''}`}
                style={{
                  minHeight: '44px',
                  padding: '4px 6px',
                  fontSize: '11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                aria-pressed={mirrorMode}
                title="Horizontal Mirror Mode"
              >
                <span>🪞</span>
                <span>{mirrorMode ? 'Mirror' : 'Mirror'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowGrid((g) => !g);
                  playSound('click');
                }}
                className={`mc-btn ${showGrid ? 'mc-btn-green' : ''}`}
                style={{
                  minHeight: '44px',
                  padding: '4px 6px',
                  fontSize: '11px',
                }}
                aria-pressed={showGrid}
                title="Toggle 16x16 grid lines"
              >
                # Grid
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="mc-btn"
                style={{
                  minHeight: '44px',
                  padding: '4px 6px',
                  fontSize: '11px',
                  opacity: undoStack.length === 0 ? 0.45 : 1,
                }}
                title={`Undo (${undoStack.length})`}
              >
                ↩ Undo
              </button>

              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="mc-btn"
                style={{
                  minHeight: '44px',
                  padding: '4px 6px',
                  fontSize: '11px',
                  opacity: redoStack.length === 0 ? 0.45 : 1,
                }}
                title={`Redo (${redoStack.length})`}
              >
                ↪ Redo
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="mc-btn mc-btn-red"
                style={{
                  minHeight: '44px',
                  padding: '4px 6px',
                  fontSize: '11px',
                  gridColumn: '1 / -1',
                }}
                title="Clear Canvas"
              >
                🗑️ Clear Canvas
              </button>
            </div>
          </div>

          {/* Color Palettes + Custom Color Picker */}
          <div
            className="mc-panel-dark"
            style={{
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f4' }}>
                🎨 COLORS
              </span>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: '#1c1c24',
                  padding: '3px 6px',
                  border: '2px solid #555',
                }}
                title="Pick any custom color"
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: activeColor,
                    border: '2px solid #fff',
                    display: 'inline-block',
                  }}
                />
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => {
                    setActiveColor(e.target.value);
                    if (tool === 'eraser' || tool === 'eyedropper') {
                      setTool('pencil');
                    }
                  }}
                  style={{
                    width: '24px',
                    height: '22px',
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  aria-label="Custom color picker"
                />
              </label>
            </div>

            {/* Palette Switcher Dropdown + Prev/Next for compact tablet ergonomics */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select
                value={selectedPaletteIdx}
                onChange={(e) => {
                  setSelectedPaletteIdx(Number(e.target.value));
                  playSound('click');
                }}
                className="mc-input"
                aria-label="Choose Minecraft color palette"
                style={{
                  flex: 1,
                  minHeight: '36px',
                  fontSize: '12px',
                  padding: '4px 6px',
                }}
              >
                {COLOR_PALETTES.map((palette, idx) => (
                  <option key={palette.name} value={idx}>
                    {palette.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swatches for Selected Palette */}
            <div className="cf-swatch-grid">
              {currentPalette?.colors.map((hex) => {
                const isSelected =
                  activeColor.toLowerCase() === hex.toLowerCase() && tool !== 'eraser';
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      setActiveColor(hex);
                      if (tool === 'eraser' || tool === 'eyedropper') {
                        setTool('pencil');
                      }
                      playSound('click');
                    }}
                    aria-label={`Select color ${hex}`}
                    title={hex}
                    style={{
                      height: '38px',
                      minHeight: '38px',
                      backgroundColor: hex,
                      border: isSelected ? '3px solid #ffffff' : '2px solid #1a1a1a',
                      boxShadow: isSelected
                        ? '0 0 0 2px #ffca28, inset 0 0 0 2px #1a1a1a'
                        : 'inset 2px 2px 0 rgba(255,255,255,0.28), inset -2px -2px 0 rgba(0,0,0,0.35)',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.06)' : 'none',
                      transition: 'transform 0.08s ease',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Template Quick-Loader Strip (Full width under canvas + rail) */}
      <div
        className="mc-panel-dark"
        style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f4', letterSpacing: '0.5px' }}>
          🧱 STARTER TEMPLATES (TAP TO LOAD)
        </div>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {!hasBlankTemplate && (
            <button
              type="button"
              onClick={handleClear}
              className="mc-slot"
              style={{
                minWidth: '72px',
                padding: '5px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Start from a blank canvas"
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  background: 'rgba(0,0,0,0.22)',
                  border: '1px dashed #666',
                }}
              >
                ✨
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: '#fff',
                  textShadow: '1px 1px 0 #000',
                  textAlign: 'center',
                  lineHeight: 1.15,
                }}
              >
                Blank
              </span>
            </button>
          )}

          {templatePreviews.map(({ template, dataUrl }) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleLoadTemplate(template)}
              className="mc-slot"
              style={{
                minWidth: '74px',
                padding: '5px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={`Load ${template.name}`}
            >
              <img
                src={dataUrl}
                alt={template.name}
                className="mc-pixelated"
                style={{
                  width: '40px',
                  height: '40px',
                  objectFit: 'contain',
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: '#fff',
                  textShadow: '1px 1px 0 #000',
                  textAlign: 'center',
                  lineHeight: 1.15,
                  maxWidth: '68px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {template.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PixelCanvas;
