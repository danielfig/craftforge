// Procedural 16x16 crisp Minecraft pixel-art textures & character avatars

/**
 * Renders a 256-length string[] (16x16) onto an offscreen canvas with
 * imageSmoothingEnabled = false and returns a crisp PNG data URL.
 */
export function renderPixelsToDataUrl(pixels: string[], scale = 4): string {
  if (typeof document === 'undefined') return '';
  const pxScale = Math.max(1, Math.floor(scale));
  const size = 16 * pxScale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const len = Math.min(256, pixels.length);
  for (let i = 0; i < len; i++) {
    const color = pixels[i];
    if (!color) continue;
    const x = (i % 16) * pxScale;
    const y = Math.floor(i / 16) * pxScale;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, pxScale, pxScale);
  }

  return canvas.toDataURL('image/png');
}

// Deterministic hash for authentic Minecraft-style per-pixel noise
function hash2d(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 37, 374761393) + Math.imul(y + 17, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function pick<T>(arr: readonly T[], x: number, y: number, seed: number): T {
  const idx = Math.floor(hash2d(x, y, seed) * arr.length) % arr.length;
  return arr[idx];
}

function buildTexture(fn: (x: number, y: number) => string, scale = 4): string {
  const pixels: string[] = new Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      pixels[y * 16 + x] = fn(x, y);
    }
  }
  return renderPixelsToDataUrl(pixels, scale);
}

function parseAvatarGrid(rows: string[], palette: Record<string, string>): string[] {
  const pixels: string[] = new Array(256).fill('');
  for (let y = 0; y < 16; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < 16; x++) {
      const ch = row[x] ?? '.';
      pixels[y * 16 + x] = palette[ch] ?? '';
    }
  }
  return pixels;
}

// ---------------------------------------------------------------------------
// Procedural 16x16 Minecraft Block Textures
// ---------------------------------------------------------------------------

const GRASS_GREENS = ['#5d9b37', '#6ab041', '#4e872c', '#74bd48', '#569132'] as const;
const DIRT_BROWNS = ['#866043', '#79553a', '#6d4c33', '#966c4a', '#5f422b'] as const;
const DIRT_SPECKS = ['#a87d56', '#4d3523', '#8f8f8f'] as const;
const OAK_SHADES = ['#b8945f', '#a98552', '#9c7847', '#c29f68', '#8f6c3e'] as const;
const COBBLE_SHADES = ['#7f7f7f', '#8d8d8d', '#6e6e6e', '#9a9a9a', '#616161'] as const;
const STONE_SHADES = ['#7d7d7d', '#868686', '#747474', '#8e8e8e'] as const;
const DEEPSLATE_SHADES = ['#3c3c44', '#464650', '#32323a', '#50505b', '#2b2b33'] as const;

function makeGrassTop(): string {
  return buildTexture((x, y) => {
    const r = hash2d(x, y, 11);
    if (r > 0.86) return '#82cc52';
    if (r < 0.14) return '#427324';
    return pick(GRASS_GREENS, x, y, 12);
  });
}

function makeDirt(): string {
  return buildTexture((x, y) => {
    const r = hash2d(x, y, 21);
    if (r > 0.92) return pick(DIRT_SPECKS, x, y, 22);
    return pick(DIRT_BROWNS, x, y, 23);
  });
}

function makeGrassSide(): string {
  // Classic Minecraft irregular grassy lip hanging over dirt
  const overhang = [3, 4, 5, 4, 3, 5, 6, 4, 3, 4, 5, 6, 4, 3, 5, 4];
  return buildTexture((x, y) => {
    const edge = overhang[x];
    if (y === 0) return pick(['#74bd48', '#82cc52', '#6ab041'], x, y, 31);
    if (y < edge) {
      if (y === edge - 1) return '#467a27'; // shadowed grass tip
      return pick(GRASS_GREENS, x, y, 32);
    }
    if (y === edge) return '#563c27'; // shadow cast on dirt below grass
    const r = hash2d(x, y, 33);
    if (r > 0.93) return pick(DIRT_SPECKS, x, y, 34);
    return pick(DIRT_BROWNS, x, y, 35);
  });
}

function makeOakPlanks(): string {
  return buildTexture((x, y) => {
    // 4 horizontal planks (rows 0-3, 4-7, 8-11, 12-15)
    const plankIdx = Math.floor(y / 4);
    const localY = y % 4;
    // Horizontal groove at bottom of each plank
    if (localY === 3) return '#6f512c';
    // Vertical seam staggered per plank
    const seamX = (plankIdx * 7 + 4) % 16;
    if (x === seamX) return '#755630';
    if (localY === 0) return '#c8a66e'; // top highlight bevel
    return pick(OAK_SHADES, x, y + plankIdx * 3, 41);
  });
}

function makeCobblestone(): string {
  // Classic blocky cobblestone mortar pattern
  const mortar = [
    '1111111111111111',
    '1000010000010001',
    '1000010000010001',
    '1000010000010001',
    '1111111100011111',
    '1001000111110001',
    '1001000001000001',
    '1001000001000001',
    '1111111001111111',
    '1000001111000101',
    '1000000100000101',
    '1000000100000101',
    '1111000111111111',
    '1001111100001001',
    '1000000100001001',
    '1000000100001001',
  ];
  return buildTexture((x, y) => {
    if (mortar[y][x] === '1') return '#4d4d4d';
    // Highlight pixel right below mortar
    if (y > 0 && mortar[y - 1][x] === '1') return '#a6a6a6';
    return pick(COBBLE_SHADES, x, y, 51);
  });
}

function makeStoneBrick(): string {
  return buildTexture((x, y) => {
    const isRowMortar = y === 0 || y === 8;
    const isColMortar = (y < 8 && x === 0) || (y >= 8 && x === 8);
    if (isRowMortar || isColMortar) return '#4b4b4b';
    // Top-left bevel highlight
    if (y === 1 || y === 9) return '#9b9b9b';
    if ((y < 8 && x === 1) || (y >= 8 && x === 9)) return '#929292';
    // Bottom-right shadow
    if (y === 7 || y === 15) return '#606060';
    // Occasional crack detail
    if ((x === 5 && y === 4) || (x === 6 && y === 5) || (x === 12 && y === 12)) {
      return '#595959';
    }
    return pick(STONE_SHADES, x, y, 61);
  });
}

function makeCraftingTop(): string {
  return buildTexture((x, y) => {
    // Dark oak outer frame
    if (x === 0 || x === 15 || y === 0 || y === 15) return '#5c3c1e';
    if (x === 1 || x === 14 || y === 1 || y === 14) return '#7c532b';
    // Inner 3x3 crafting grid lines
    const isGridLine = x === 5 || x === 10 || y === 5 || y === 10;
    if (isGridLine) return '#4d3017';
    // Warm maple/oak grid cells
    return pick(['#c4955c', '#b7884f', '#cf9f64', '#ad7e46'], x, y, 71);
  });
}

function makeChestFront(): string {
  return buildTexture((x, y) => {
    // Dark outline border
    if (x === 0 || x === 15 || y === 0 || y === 15) return '#3b2410';
    // Iron/dark wood trim frame
    if (x === 1 || x === 14 || y === 1 || y === 14) return '#593718';
    // Lid seam across row 5
    if (y === 5) return '#2f1c0c';
    // Iconic silver/gold chest latch in center (x: 6..9, y: 4..7)
    if (x >= 6 && x <= 9 && y >= 4 && y <= 7) {
      if (x === 6 || x === 9 || y === 4 || y === 7) return '#9c8332';
      if (y === 5) return '#f5e27a';
      return '#d9bc4a';
    }
    // Horizontal plank shading
    if (y === 2 || y === 6 || y === 10) return '#c28b42';
    if (y === 9 || y === 13) return '#8f6025';
    return pick(['#ad7833', '#b8823b', '#9e6c2b', '#a8732f'], x, y, 81);
  });
}

function makeDeepslate(): string {
  return buildTexture((x, y) => {
    // Subtle layered slate horizontal striations
    const band = (y % 4 === 0) ? -1 : (y % 4 === 2 ? 1 : 0);
    const r = hash2d(x, y, 91);
    if (band === -1 && r > 0.35) return '#272730';
    if (band === 1 && r > 0.55) return '#555563';
    return pick(DEEPSLATE_SHADES, x, y, 92);
  });
}

export const TEXTURES: {
  grassTop: string;
  grassSide: string;
  dirt: string;
  oakPlanks: string;
  cobblestone: string;
  stoneBrick: string;
  craftingTop: string;
  chestFront: string;
  deepslate: string;
} = {
  grassTop: makeGrassTop(),
  grassSide: makeGrassSide(),
  dirt: makeDirt(),
  oakPlanks: makeOakPlanks(),
  cobblestone: makeCobblestone(),
  stoneBrick: makeStoneBrick(),
  craftingTop: makeCraftingTop(),
  chestFront: makeChestFront(),
  deepslate: makeDeepslate(),
};

// ---------------------------------------------------------------------------
// 6 Charming 16x16 Minecraft-Style Character Head Portraits
// ---------------------------------------------------------------------------

const AVATAR_SPECS: {
  id: string;
  name: string;
  palette: Record<string, string>;
  rows: string[];
}[] = [
  {
    id: 'knight',
    name: 'Knight',
    palette: {
      '.': '#2c3e50',
      R: '#d93636',
      r: '#9e1f1f',
      H: '#dce6ee',
      M: '#9fb1bd',
      D: '#637480',
      K: '#1f262c',
      E: '#55f5ff',
      G: '#f5c542',
    },
    rows: [
      '......RRRR......',
      '.....RRrRRR.....',
      '...MMMMMMMMMM...',
      '..MHHHHHHHHHHM..',
      '..MHHGGGGGGHHM..',
      '..MHHHHHHHHHHM..',
      '..MMMMMMMMMMMM..',
      '..MDKKKKKKKKDM..',
      '..MDKKEKKKEKDM..',
      '..MDKKKKKKKKDM..',
      '..MDMMKGGKMMDM..',
      '..MDMMKKKKMMDM..',
      '..MDDMMMMMMMDM..',
      '...DDDDDDDDDD...',
      '....DDGGGGDD....',
      '................',
    ],
  },
  {
    id: 'explorer',
    name: 'Explorer',
    palette: {
      '.': '#3b5e36',
      H: '#5c3820',
      h: '#7a4b2b',
      B: '#e04f3e',
      G: '#ffd166',
      L: '#7be3f6',
      S: '#f2c199',
      s: '#d9a177',
      W: '#ffffff',
      E: '#2f6ea8',
      M: '#9e5d44',
    },
    rows: [
      '..HHHHHHHHHHHH..',
      '.HHhHHHHHHHHhHH.',
      '.HBBBBBBBBBBBBH.',
      '.HBGGLLLLLLGGBH.',
      '.HBBBBBBBBBBBBH.',
      '.HSSSSSSSSSSSSH.',
      '.HSSSSSSSSSSSSH.',
      '.HSWWESSSSEWWSH.',
      '.HSWWESSSSEWWSH.',
      '.HSSSSSssSSSSSH.',
      '.HSSSSSMMSSSSSH.',
      '.HsSSSMMMMSSSsH.',
      '..sSSSSSSSSSSs..',
      '..ssSSSSSSSSss..',
      '...ssssssssss...',
      '................',
    ],
  },
  {
    id: 'wizard',
    name: 'Wizard',
    palette: {
      '.': '#1d1433',
      P: '#6c35de',
      p: '#491fa3',
      G: '#ffd94a',
      S: '#f0c4a0',
      K: '#1b1029',
      E: '#5cf2ff',
      W: '#f0f4f8',
      w: '#c5d0dc',
    },
    rows: [
      '.......PP.......',
      '......PPPP......',
      '.....PPGPPp.....',
      '....PPPPPPPp....',
      '...PPGGGGGGPp...',
      '.PPPPPPPPPPPPPP.',
      '..pppppppppppp..',
      '..pKKKKKKKKKKp..',
      '..pKKEKKKKKEKp..',
      '..pKSSSSSSSSKp..',
      '..pWWSSSSSSWWp..',
      '..WWWWWWWWWWWW..',
      '...WWwWWWWwWW...',
      '....WWwWWwWW....',
      '.....WWWWWW.....',
      '.......WW.......',
    ],
  },
  {
    id: 'builder',
    name: 'Builder',
    palette: {
      '.': '#3c4f65',
      Y: '#ffca28',
      y: '#e0a200',
      L: '#fff176',
      H: '#5c3b1e',
      S: '#f4c69e',
      s: '#d9a479',
      W: '#ffffff',
      E: '#3b2b20',
      C: '#f08c8c',
      M: '#8c4b34',
    },
    rows: [
      '....YYYYYYYY....',
      '...YYLLYYYYYY...',
      '..YYYLLYYYYYYy..',
      '..YYYYYYYYYYYy..',
      '.YYYYYYYYYYYYYy.',
      '.yyyyyyyyyyyyyy.',
      '..HSSSSSSSSSSH..',
      '..HSHHSSSSHHSH..',
      '..HSWWESSEWWSH..',
      '..HSWWESSEWWSH..',
      '..HSCSSSSSSCSH..',
      '..HSSSSMMSSSSH..',
      '..HsSSMMMMSSsH..',
      '...sSSSSSSSSs...',
      '....ssssssss....',
      '................',
    ],
  },
  {
    id: 'archer',
    name: 'Archer',
    palette: {
      '.': '#233b28',
      G: '#2e8b44',
      g: '#1e632f',
      L: '#52c46a',
      Y: '#e8c456',
      S: '#f2c39d',
      s: '#d49d72',
      W: '#ffffff',
      E: '#1f5e3b',
      M: '#8c533c',
    },
    rows: [
      '....GGGGGGGG....',
      '...GLLGGGGGGG...',
      '..GGLGGGGGGGGg..',
      '..GGGGGGGGGGGg..',
      '.GGgYYYYYYYYgGg.',
      '.GgSSSSSSSSSSgG.',
      '.GgSSSSSSSSSSgG.',
      '.GgSWWESSEWWSgG.',
      '.GgSWWESSEWWSgG.',
      '.GgSSSSssSSSSgG.',
      '.GgSSSMMMMSSSgg.',
      '..gSSSSSSSSSSg..',
      '..ggSSSSSSSSgg..',
      '...gggYYYYggg...',
      '....gggggggg....',
      '................',
    ],
  },
  {
    id: 'slime',
    name: 'Slime',
    palette: {
      '.': '#203824',
      O: '#489632',
      G: '#78d455',
      L: '#9ef279',
      H: '#c9ffa8',
      D: '#5cb53f',
      K: '#1a3814',
    },
    rows: [
      '................',
      '.OOOOOOOOOOOOOO.',
      '.OGGGGGGGGGGGGO.',
      '.OGHHLLLLLLLLGO.',
      '.OGHLGGGGGGGGGO.',
      '.OGGGGGGGGGGGGO.',
      '.OGGKKGGGGKKGGO.',
      '.OGGKKGGGGKKGGO.',
      '.OGGGGGGGGGGGGO.',
      '.OGGGGGGGKKGGGO.',
      '.OGGGGGGGKKGGGO.',
      '.OGGGDDDDDDGGGO.',
      '.OGDDDDDDDDDDGO.',
      '.ODDDDDDDDDDDDO.',
      '.OOOOOOOOOOOOOO.',
      '................',
    ],
  },
];

export const AVATARS: { id: string; name: string; dataUrl: string }[] =
  AVATAR_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    dataUrl: renderPixelsToDataUrl(parseAvatarGrid(spec.rows, spec.palette), 4),
  }));
