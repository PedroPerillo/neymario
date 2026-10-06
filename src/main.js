import { Game } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const HI_KEY = 'neymario.highscore';
const SAVE_KEY = 'neymario.save';
const STEP_MS = 1000 / 60;

const readHighScore = () => {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
};

const readSave = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) ?? null;
  } catch {
    return null;
  }
};

const writeSave = (save) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable (private mode); progress just won't persist.
  }
};

const audio = createAudio();
const game = new Game({
  sfx: (name) => audio.play(name),
  seed: Date.now() >>> 0,
  highScore: readHighScore(),
  save: readSave(),
  onSave: writeSave,
});
const renderer = createRenderer(document.getElementById('screen'));
const input = createInput(window, document.getElementById('touch'));
input.onGesture(() => audio.unlock());
input.onMute(() => audio.toggleMute());

// A hidden tab stops the game loop, so pause the match and silence the audio
// rather than letting the music stutter on in the background.
document.addEventListener('visibilitychange', () => {
  const hidden = document.visibilityState === 'hidden';
  if (hidden) game.setPaused(true);
  audio.setSuspended(hidden);
});

// Exposed for debugging from the console.
window.neymario = game;

let savedHigh = game.highScore;
let last = performance.now();
let acc = 0;
let reported = false;

function tick(now) {
  // Capped so a stall (or a run of failed frames that never drained it) can't replay a burst of catch-up ticks.
  acc = Math.min(acc + (now - last), 250);
  last = now;
  while (acc >= STEP_MS) {
    game.update(input.state());
    acc -= STEP_MS;
  }
  renderer.draw(game);
  if (game.highScore > savedHigh) {
    savedHigh = game.highScore;
    try {
      localStorage.setItem(HI_KEY, String(savedHigh));
    } catch {
      // Storage can be unavailable (private mode); the high score just won't persist.
    }
  }
}

// Schedule the next frame first, so one bad frame (say, a sprite missing a
// colour) shows a glitch instead of freezing the game for good.
function frame(now) {
  requestAnimationFrame(frame);
  try {
    tick(now);
  } catch (err) {
    if (!reported) console.error('Super Neymario frame failed:', err);
    reported = true;
  }
}
requestAnimationFrame(frame);
