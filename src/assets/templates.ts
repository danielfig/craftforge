// Curated 16x16 Minecraft-style pixel-art item templates & color palettes

export interface ItemTemplate {
  id: string;
  name: string;
  category:
    | 'weapon'
    | 'tool'
    | 'armor'
    | 'potion'
    | 'food'
    | 'block'
    | 'magic'
    | 'mob';
  pixels: string[];
}

function parseSprite(rows: string[], palette: Record<string, string>): string[] {
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

export const ITEM_TEMPLATES: ItemTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    category: 'block',
    pixels: new Array(256).fill(''),
  },
  {
    id: 'diamond-sword',
    name: 'Diamond Sword',
    category: 'weapon',
    pixels: parseSprite(
      [
        '.............KKK',
        '............KHHK',
        '...........KHCCK',
        '..........KHCCDK',
        '.........KHCCDK.',
        '........KHCCDK..',
        '.......KHCCDK...',
        '..KK..KHCCDK....',
        '..KDK.KHCDK.....',
        '...KDKHCDK......',
        '....KKCDK.......',
        '....KWWKDK......',
        '...KWWK.KDK.....',
        '..KWWK...KK.....',
        '.KCCK...........',
        '.KKKK...........',
      ],
      {
        K: '#142c33',
        H: '#b8ffff',
        C: '#3ce6db',
        D: '#199ba1',
        W: '#7a5230',
      }
    ),
  },
  {
    id: 'emerald-pickaxe',
    name: 'Emerald Pickaxe',
    category: 'tool',
    pixels: parseSprite(
      [
        '....KKKKKKK.....',
        '...KHHGGGGGKK...',
        '..KHHGGGGGGDGK..',
        '..KGGGGGGDDGGK..',
        '...KKKKKWWKGGDK.',
        '.......KWWKGGDK.',
        '......KWWK.KGDK.',
        '.....KWWK..KGDK.',
        '....KWWK....KDK.',
        '...KWWK.....KK..',
        '..KWWK..........',
        '.KWWK...........',
        '.KWWK...........',
        '.KDK............',
        '.KK.............',
        '................',
      ],
      {
        K: '#13301c',
        H: '#9effb3',
        G: '#2be06b',
        D: '#129443',
        W: '#8c5e34',
      }
    ),
  },
  {
    id: 'healing-potion',
    name: 'Healing Potion',
    category: 'potion',
    pixels: parseSprite(
      [
        '......KKKK......',
        '......KCCK......',
        '.....KCCCCK.....',
        '.....KKKKKK.....',
        '......KGGK......',
        '......KGGK......',
        '....KKGGGGKK....',
        '...KGGLLLLGGK...',
        '..KGLHLLLLLLGK..',
        '..KGLHLLRRRRGK..',
        '..KGLRRRRRRRGK..',
        '..KGRRRRRRRDGK..',
        '..KGRRRRRRDDGK..',
        '...KGRRRDDDGK...',
        '....KKKKKKKK....',
        '................',
      ],
      {
        K: '#261c2c',
        C: '#a87643',
        G: '#c9e6f2',
        L: '#ff6996',
        H: '#ffd1e2',
        R: '#e62259',
        D: '#9c113b',
      }
    ),
  },
  {
    id: 'golden-apple',
    name: 'Golden Apple',
    category: 'food',
    pixels: parseSprite(
      [
        '........KK......',
        '.......KBBK.KK..',
        '.......KBBKLGGK.',
        '....KKK.KKKGGK..',
        '...KYYKKKKKKK...',
        '..KYYHYYYYGGYK..',
        '.KYYHYYYYYYGGYK.',
        '.KYYHYYYYYYGGDK.',
        '.KYYYYYYYYYGGDK.',
        '.KYYYYYYYYGGDDK.',
        '.KYYYYYYYGGDDDK.',
        '..KYYYYYGGDDDK..',
        '..KYYYYGGDDDDK..',
        '...KYYGGDDDDK...',
        '....KKKKKKKK....',
        '................',
      ],
      {
        K: '#4d3108',
        B: '#6e451d',
        L: '#7be055',
        G: '#e0a519',
        Y: '#ffd93d',
        H: '#fff9b3',
        D: '#ad720c',
      }
    ),
  },
  {
    id: 'enchanted-shield',
    name: 'Enchanted Shield',
    category: 'armor',
    pixels: parseSprite(
      [
        '..KKKKKKKKKKKK..',
        '.KIIIWWWWWWIIIK.',
        '.KIIWWPPPPWWIIK.',
        '.KIWWPPHHPPWWIK.',
        '.KIWWPPHHPPWWIK.',
        '.KIWWPPPPPPWWIK.',
        '.KIWWWPPPPWWWIK.',
        '.KIWWWWPPWWWWIK.',
        '.KIIWWWWWWWWIIK.',
        '..KIWWWWWWWWIK..',
        '..KIIWWWWWWIIK..',
        '...KIWWPPWWIK...',
        '....KIWWWWIK....',
        '.....KIIIIK.....',
        '......KKKK......',
        '................',
      ],
      {
        K: '#1f1a29',
        I: '#b8c4d0',
        W: '#8c5e34',
        P: '#9b4dff',
        H: '#e4b8ff',
      }
    ),
  },
  {
    id: 'magic-staff',
    name: 'Magic Staff',
    category: 'magic',
    pixels: parseSprite(
      [
        '.........KKKK...',
        '........KHHHHK..',
        '.......KHPPPPGK.',
        '.......KHPCCPGK.',
        '.......KPPCCPGK.',
        '........KPPPPK..',
        '.......KKGGGGKK.',
        '.......KGGGGK...',
        '......KWWKKK....',
        '.....KWWK.......',
        '....KWWK........',
        '...KWWK.........',
        '..KWWK..........',
        '.KWWK...........',
        '.KDK............',
        '.KK.............',
      ],
      {
        K: '#241536',
        H: '#f5d6ff',
        P: '#a348ff',
        C: '#5cf2ff',
        G: '#ffd24a',
        W: '#7c512d',
        D: '#4f3119',
      }
    ),
  },
  {
    id: 'hunter-bow',
    name: "Hunter's Bow",
    category: 'weapon',
    pixels: parseSprite(
      [
        '.........KKK....',
        '.......KKWWWK...',
        '......KWWKSSK...',
        '.....KWWK.SK....',
        '....KWWK..SK.KK.',
        '...KWWK...SKKIIK',
        '..KWWK....SKKIK.',
        '..KWK....KSSKK..',
        '..KWK...KWWK....',
        '..KWWK.KWWK.SK..',
        '...KWWKWWK..SK..',
        '....KWWWK...SK..',
        '.....KWWK..SSK..',
        '......KKWWKKK...',
        '........KKK.....',
        '................',
      ],
      {
        K: '#2e1d10',
        W: '#9c6838',
        S: '#e0dcd3',
        I: '#b8c7d4',
      }
    ),
  },
  {
    id: 'diamond-chestplate',
    name: 'Diamond Chestplate',
    category: 'armor',
    pixels: parseSprite(
      [
        '.KKKK......KKKK.',
        'KHHCCK....KCCHHK',
        'KHCCCKKKKKKCCCDK',
        'KHCCCCCCCCCCCCDK',
        'KHHCCCCCCCCCCDDK',
        'KCCKCCCCCCCCKDDK',
        '.KKKCHHCCCCCDKK.',
        '...KCHHCCCCCDK..',
        '...KCCCCCCCCDK..',
        '...KCCCCCCCDDK..',
        '...KCCCCCCDDDK..',
        '...KCCCCCDDDDK..',
        '...KCCDDDDDDDK..',
        '...KDDDDDDDDDK..',
        '....KKKKKKKKK...',
        '................',
      ],
      {
        K: '#122930',
        H: '#b5ffff',
        C: '#36e3d8',
        D: '#17959c',
      }
    ),
  },
  {
    id: 'tnt-block',
    name: 'TNT Block',
    category: 'block',
    pixels: parseSprite(
      [
        '.KKKKKKKKKKKKKK.',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        'KWWWWWWWWWWWWWWK',
        'KWKKKWKWWKWKKKWK',
        'KWWKWWKKWKWKWWWK',
        'KWWKWWKWKKWKWWWK',
        'KWWKWWKWWKWKWWWK',
        'KWWWWWWWWWWWWWWK',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        'KRRDRRDRRDRRDRRK',
        '.KKKKKKKKKKKKKK.',
      ],
      {
        K: '#241818',
        R: '#e03126',
        D: '#a81d15',
        W: '#f0ece1',
      }
    ),
  },
  {
    id: 'ender-gem',
    name: 'Ender Gem',
    category: 'magic',
    pixels: parseSprite(
      [
        '.....KKKKKK.....',
        '...KKDDDDDDKK...',
        '..KDDGGGGGGDDK..',
        '.KDGGLLGGLLGGDK.',
        '.KDGLHGGGGGGDDK.',
        'KDDGLHGGKKGGDDDK',
        'KDGLLGGKPPKGGDDK',
        'KDGGGGGKPPKGGDDK',
        'KDGGGGGKPPKGGDDK',
        'KDDGGGGKPPKGDDDK',
        'KDDGGGGGKKGGDDDK',
        '.KDDGGGGGGGGDDK.',
        '.KDDDGGGGGGDDDK.',
        '..KDDDDDDDDDDK..',
        '...KKDDDDDDKK...',
        '.....KKKKKK.....',
      ],
      {
        K: '#0c1f1c',
        D: '#125c53',
        G: '#1ca88f',
        L: '#63f5b8',
        H: '#d4ffea',
        P: '#170a24',
      }
    ),
  },
  {
    id: 'creeper-buddy',
    name: 'Creeper Buddy',
    category: 'mob',
    pixels: parseSprite(
      [
        '.KKKKKKKKKKKKKK.',
        'KGGLLGGGGGGLLGGK',
        'KGLGGGGDDGGGGLGK',
        'KGGGGGGGGGGGGGGK',
        'KGGKKKGGGGKKKGGK',
        'KGGKKKGGGGKKKGGK',
        'KGGKKKGGGGKKKGGK',
        'KGGGGGKKKKGGDGGK',
        'KGDGGKKKKKKGGGGK',
        'KGGGGKKKKKKGLGGK',
        'KGLGGKKKKKKGGGGK',
        'KGGGGKKGGKKGDDGK',
        'KGGGGKKGGKKGGGGK',
        'KGGDDGGGGGGLLGGK',
        'KGGGGGGGGGGGGGGK',
        '.KKKKKKKKKKKKKK.',
      ],
      {
        K: '#142614',
        G: '#4bb843',
        L: '#7be36b',
        D: '#30852a',
      }
    ),
  },
];

export const COLOR_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Diamond',
    colors: [
      '#122930',
      '#176570',
      '#199ba1',
      '#28c7c4',
      '#3ce6db',
      '#7af5f0',
      '#b8ffff',
      '#ffffff',
    ],
  },
  {
    name: 'Gold',
    colors: [
      '#4d3108',
      '#7d4f0a',
      '#ad720c',
      '#d99b14',
      '#f5bd27',
      '#ffd93d',
      '#fff08a',
      '#fffbe0',
    ],
  },
  {
    name: 'Emerald',
    colors: [
      '#0e2b17',
      '#145229',
      '#128a3d',
      '#1eb854',
      '#2be06b',
      '#63f28e',
      '#a8ffbf',
      '#e3ffea',
    ],
  },
  {
    name: 'Netherite',
    colors: [
      '#17141a',
      '#2b262e',
      '#3f3842',
      '#544c57',
      '#6e6470',
      '#8f8591',
      '#b8aeb8',
      '#d94a38',
    ],
  },
  {
    name: 'Redstone',
    colors: [
      '#330808',
      '#660f0f',
      '#9c1414',
      '#cc1f1f',
      '#f23026',
      '#ff6647',
      '#ffa385',
      '#ffd9cc',
    ],
  },
  {
    name: 'Amethyst',
    colors: [
      '#210c38',
      '#431870',
      '#6727a8',
      '#8c3de0',
      '#b066ff',
      '#cf99ff',
      '#e8ccff',
      '#ffffff',
    ],
  },
  {
    name: 'Oak & Stone',
    colors: [
      '#3b2410',
      '#6b4423',
      '#9c6838',
      '#c4955c',
      '#4d4d4d',
      '#7d7d7d',
      '#a8a8a8',
      '#dedede',
    ],
  },
  {
    name: 'Potion Glow',
    colors: [
      '#ff2e7a',
      '#ff70a6',
      '#a348ff',
      '#5cf2ff',
      '#4dff88',
      '#ffe14d',
      '#ff8533',
      '#ffffff',
    ],
  },
  {
    name: 'Classic Rainbow',
    colors: [
      '#1c1c1c',
      '#e63946',
      '#f77f00',
      '#fcbf49',
      '#4bb843',
      '#2a9df4',
      '#8338ec',
      '#ffffff',
    ],
  },
];
