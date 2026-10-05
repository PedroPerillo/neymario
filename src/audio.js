// Chiptune-style sound effects and original music loops, synthesised with
// WebAudio so there are no audio assets. Nothing plays until unlock() runs
// inside a user gesture (browser autoplay rules).

const midi = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + base + (m[2] ? 1 : 0);
};
const freq = (note) => 440 * 2 ** ((midi(note) - 69) / 12);

/** "C5:2 r:1 E5:1" → [[freq|null, sixteenths], ...] */
const parse = (str) => str.trim().split(/\s+/).map((tok) => {
  const [n, len] = tok.split(':');
  return [n === 'r' ? null : freq(n), Number(len)];
});

const TRACKS = {
  // Original samba-flavoured loop for the stadium levels.
  day: {
    step: 0.105,
    shaker: true,
    melody: parse(`
      C5:2 E5:1 G5:2 E5:1 G5:2 A5:2 G5:2 E5:2 C5:2
      D5:1 E5:1 F5:2 E5:1 D5:2 C5:1 D5:4 r:4
      C5:2 E5:1 G5:2 E5:1 G5:2 C6:2 B5:2 A5:2 G5:2
      F5:1 E5:1 D5:2 G4:1 B4:2 D5:1 C5:6 r:2`),
    bass: parse(`
      C3:3 C3:1 G2:2 G2:2 C3:3 C3:1 G2:4
      G2:3 G2:1 D3:2 D3:2 G2:3 G2:1 D3:4
      C3:3 C3:1 G2:2 G2:2 C3:3 C3:1 G2:4
      F2:3 F2:1 G2:2 G2:2 C3:8`),
  },
  castle: {
    step: 0.14,
    shaker: false,
    melody: parse(`
      A4:2 C5:2 E5:2 D#5:2 E5:4 r:4
      A4:2 C5:2 F5:2 E5:2 D5:4 r:4
      G4:2 B4:2 D5:2 C#5:2 D5:4 r:4
      E5:2 D5:2 C5:2 B4:2 A4:6 r:2`),
    bass: parse(`
      A2:4 A2:4 A2:4 A2:4
      F2:4 F2:4 F2:4 F2:4
      G2:4 G2:4 G2:4 G2:4
      E2:4 E2:4 E2:4 E2:4`),
  },
  star: {
    step: 0.075,
    shaker: true,
    melody: parse('C5:1 E5:1 G5:1 C6:1 G5:1 E5:1 C5:1 E5:1 D5:1 F5:1 A5:1 D6:1 A5:1 F5:1 D5:1 F5:1'),
    bass: parse('C3:2 C3:2 G2:2 G2:2 D3:2 D3:2 A2:2 A2:2'),
  },
};
TRACKS.dusk = TRACKS.day;
TRACKS.night = TRACKS.day;
TRACKS.desert = TRACKS.day;

export function createAudio() {
  let ctx = null;
  let master;
  let sfxBus;
  let musicBus;
  let noiseBuf;
  let muted = false;
  let track = null;
  let timer = null;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.5;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.22;
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone({ type = 'square', from, to = from, dur = 0.1, vol = 0.3, at = 0, bus = sfxBus }) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.1, vol = 0.3, at = 0, cutoff = 4000, bus = sfxBus }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const arp = (notes, step, opts = {}) => notes.forEach((n, i) => tone({ from: freq(n), dur: step * 1.6, at: i * step, vol: 0.22, ...opts }));

  const SFX = {
    jump: () => tone({ from: 320, to: 720, dur: 0.16, vol: 0.18 }),
    jumpBig: () => tone({ from: 220, to: 560, dur: 0.18, vol: 0.18 }),
    coin: () => { tone({ from: 1047, dur: 0.06, vol: 0.18 }); tone({ from: 1568, dur: 0.28, at: 0.06, vol: 0.18 }); },
    stomp: () => tone({ type: 'triangle', from: 300, to: 60, dur: 0.12, vol: 0.4 }),
    kick: () => { noise({ dur: 0.06, vol: 0.3, cutoff: 2500 }); tone({ type: 'triangle', from: 500, to: 120, dur: 0.1, vol: 0.3 }); },
    bump: () => tone({ type: 'triangle', from: 140, to: 90, dur: 0.08, vol: 0.4 }),
    break: () => noise({ dur: 0.25, vol: 0.35, cutoff: 1800 }),
    item: () => arp(['C4', 'G4', 'C5', 'E5', 'G5'], 0.05, { type: 'triangle' }),
    powerup: () => arp(['C5', 'E5', 'G5', 'C6', 'E5', 'G5', 'C6', 'E6'], 0.045),
    shrink: () => arp(['C6', 'G5', 'E5', 'C5', 'G4'], 0.06),
    fireball: () => { noise({ dur: 0.08, vol: 0.2, cutoff: 3000 }); tone({ from: 700, to: 300, dur: 0.08, vol: 0.12 }); },
    oneup: () => arp(['C5', 'E5', 'G5', 'C6', 'G6'], 0.09),
    die: () => arp(['E5', 'D#5', 'D5', 'C#5', 'C5', 'G4', 'C4'], 0.15),
    flag: () => tone({ from: 1200, to: 200, dur: 1.0, vol: 0.15 }),
    clear: () => arp(['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'E6'], 0.11),
    tick: () => tone({ from: 1760, dur: 0.03, vol: 0.08 }),
    hurry: () => arp(['G5', 'G5', 'G5', 'C6'], 0.1),
    pause: () => arp(['E5', 'C5', 'E5', 'C5'], 0.06),
    resume: () => arp(['C5', 'E5'], 0.06),
    bossfire: () => noise({ dur: 0.6, vol: 0.3, cutoff: 900 }),
    bossdie: () => { noise({ dur: 1.0, vol: 0.4, cutoff: 600 }); tone({ type: 'sawtooth', from: 300, to: 40, dur: 1.0, vol: 0.2 }); },
    gameover: () => arp(['G4', 'F4', 'E4', 'D4', 'C4', 'G3', 'C3'], 0.2, { type: 'triangle' }),
    victory: () => arp(['G4', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.14),
  };

  // ── music sequencer ──
  function stopMusic() {
    track = null;
    clearInterval(timer);
    timer = null;
  }

  function playMusic(name) {
    stopMusic();
    const data = TRACKS[name];
    if (!data) return;
    track = { data, lines: ['melody', 'bass'].map((k) => ({ notes: data[k], i: 0, next: ctx.currentTime + 0.05 })), beat: ctx.currentTime + 0.05 };
    timer = setInterval(schedule, 25);
    schedule();
  }

  function schedule() {
    if (!track || !ctx) return;
    const horizon = ctx.currentTime + 0.15;
    const { step } = track.data;
    track.lines.forEach((line, idx) => {
      while (line.next < horizon) {
        const [f, len] = line.notes[line.i];
        if (f) {
          tone({
            type: idx === 0 ? 'square' : 'triangle', from: f, dur: Math.max(0.06, len * step * 0.9),
            vol: idx === 0 ? 0.16 : 0.32, at: line.next - ctx.currentTime, bus: musicBus,
          });
        }
        line.next += len * step;
        line.i = (line.i + 1) % line.notes.length;
      }
    });
    if (track.data.shaker) {
      while (track.beat < horizon) {
        noise({ dur: 0.04, vol: 0.08, cutoff: 7000, at: track.beat - ctx.currentTime, bus: musicBus });
        track.beat += step * 2;
      }
    }
  }

  function play(name) {
    if (!ctx) return;
    if (name.startsWith('music:')) {
      const which = name.slice(6);
      if (which === 'stop') stopMusic();
      else playMusic(which);
      return;
    }
    SFX[name]?.();
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.6;
    return muted;
  }

  return { unlock, play, toggleMute };
}
