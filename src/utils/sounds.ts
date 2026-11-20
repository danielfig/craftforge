// Zero-dependency Web Audio API retro Minecraft-inspired sound effects

export type SoundType =
  | 'click'
  | 'paint'
  | 'erase'
  | 'craft'
  | 'chest'
  | 'grade'
  | 'xp';

const MUTE_STORAGE_KEY = 'craftforge_muted';

let audioCtx: AudioContext | null = null;
let mutedState: boolean = loadInitialMute();

function loadInitialMute(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    }
  } catch {
    // Ignore storage errors (private mode / sandbox)
  }
  return false;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      audioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Ignore autoplay resume rejection
    });
  }
  return audioCtx;
}

export function isMuted(): boolean {
  return mutedState;
}

export function setMuted(muted: boolean): void {
  mutedState = Boolean(muted);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(mutedState));
    }
  } catch {
    // Ignore storage errors
  }
}

function playTone(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    startTime: number;
    duration: number;
    gainPeak: number;
    attack?: number;
  }
): void {
  const {
    type,
    freqStart,
    freqEnd,
    startTime,
    duration,
    gainPeak,
    attack = 0.005,
  } = options;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startTime);
  if (freqEnd !== undefined && freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freqEnd),
      startTime + duration
    );
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function playNoiseBurst(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  filterFreq: number,
  gainPeak: number
): void {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);
  filter.Q.setValueAtTime(1.8, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(startTime);
  source.stop(startTime + duration + 0.01);
}

export function playSound(type: SoundType): void {
  if (mutedState) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    switch (type) {
      case 'click': {
        // Crisp Minecraft stone/wood GUI click
        playNoiseBurst(ctx, now, 0.032, 1600, 0.14);
        playTone(ctx, {
          type: 'square',
          freqStart: 620,
          freqEnd: 340,
          startTime: now,
          duration: 0.045,
          gainPeak: 0.07,
          attack: 0.002,
        });
        break;
      }

      case 'paint': {
        // Playful tactile pop with subtle pitch variance so painting feels musical
        const jitter = 0.92 + Math.random() * 0.18;
        playTone(ctx, {
          type: 'triangle',
          freqStart: 460 * jitter,
          freqEnd: 680 * jitter,
          startTime: now,
          duration: 0.055,
          gainPeak: 0.11,
          attack: 0.003,
        });
        break;
      }

      case 'erase': {
        // Soft downward brush-off pop
        const jitter = 0.95 + Math.random() * 0.1;
        playTone(ctx, {
          type: 'triangle',
          freqStart: 300 * jitter,
          freqEnd: 150 * jitter,
          startTime: now,
          duration: 0.06,
          gainPeak: 0.09,
          attack: 0.003,
        });
        break;
      }

      case 'craft': {
        // Wooden crafting knocks followed by triumphant blocky fanfare
        playNoiseBurst(ctx, now, 0.04, 700, 0.16);
        playNoiseBurst(ctx, now + 0.07, 0.04, 850, 0.16);
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        notes.forEach((freq, idx) => {
          playTone(ctx, {
            type: 'square',
            freqStart: freq,
            startTime: now + 0.12 + idx * 0.065,
            duration: idx === notes.length - 1 ? 0.28 : 0.12,
            gainPeak: 0.075,
            attack: 0.005,
          });
          playTone(ctx, {
            type: 'triangle',
            freqStart: freq * 2,
            startTime: now + 0.12 + idx * 0.065,
            duration: idx === notes.length - 1 ? 0.24 : 0.09,
            gainPeak: 0.04,
            attack: 0.005,
          });
        });
        break;
      }

      case 'chest': {
        // Classic Minecraft wooden chest lid creak + latch thump
        playNoiseBurst(ctx, now, 0.06, 520, 0.14);
        playTone(ctx, {
          type: 'sawtooth',
          freqStart: 145,
          freqEnd: 235,
          startTime: now + 0.015,
          duration: 0.14,
          gainPeak: 0.055,
          attack: 0.015,
        });
        playTone(ctx, {
          type: 'triangle',
          freqStart: 220,
          freqEnd: 110,
          startTime: now + 0.14,
          duration: 0.07,
          gainPeak: 0.09,
          attack: 0.004,
        });
        break;
      }

      case 'grade': {
        // Bright emerald achievement chime
        const notes = [783.99, 987.77, 1174.66]; // G5 B5 D6
        notes.forEach((freq, idx) => {
          playTone(ctx, {
            type: 'triangle',
            freqStart: freq,
            startTime: now + idx * 0.07,
            duration: 0.2,
            gainPeak: 0.12,
            attack: 0.004,
          });
        });
        break;
      }

      case 'xp': {
        // Iconic sparkling Minecraft XP orb pickup chimes!
        const base = 0.96 + Math.random() * 0.08;
        const orbs = [
          { freq: 1318.5 * base, delay: 0.0, dur: 0.16 }, // E6
          { freq: 1760.0 * base, delay: 0.065, dur: 0.18 }, // A6
          { freq: 1975.5 * base, delay: 0.13, dur: 0.2 }, // B6
          { freq: 2637.0 * base, delay: 0.2, dur: 0.32 }, // E7
        ];
        orbs.forEach(({ freq, delay, dur }) => {
          playTone(ctx, {
            type: 'sine',
            freqStart: freq,
            freqEnd: freq * 1.015,
            startTime: now + delay,
            duration: dur,
            gainPeak: 0.12,
            attack: 0.004,
          });
          playTone(ctx, {
            type: 'triangle',
            freqStart: freq * 0.5,
            startTime: now + delay,
            duration: dur * 0.85,
            gainPeak: 0.05,
            attack: 0.004,
          });
        });
        break;
      }
    }
  } catch {
    // Never break UI interactions due to audio glitches
  }
}
