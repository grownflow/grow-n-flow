// Sound manager — plays game audio clips and respects the global mute toggle.
// Audio objects are cached so repeated play() calls don't allocate new nodes.
// Mute preference is persisted in localStorage under 'gnf_muted'.

const SOUNDS = {
  eventAlert:   '/audio/floraphonic-8-bit-game-1-186975.mp3',
  feedFish:     '/audio/pwlpl-power-up-game-sound-effect-359227.mp3',
  harvest:      '/audio/freesound_community-win-short-38508.mp3',
  consumable:   '/audio/dammafra-virtual-pet-happy-458154.mp3',
  progressDay:  '/audio/universfield-video-game-bonus-323603.mp3',
  progress3Days: '/audio/ribhavagrawal-achievement-video-game-type-1-230515.mp3',
};

const STORAGE_KEY = 'gnf_muted';
const _cache = {};

function _getAudio(src) {
  if (!_cache[src]) _cache[src] = new Audio(src);
  return _cache[src];
}

export function isMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}

export function setMuted(val) {
  try { localStorage.setItem(STORAGE_KEY, val ? 'true' : 'false'); } catch {}
}

export function play(key) {
  if (isMuted()) return;
  const src = SOUNDS[key];
  if (!src) return;
  try {
    const audio = _getAudio(src);
    audio.currentTime = 0;
    audio.play().catch(() => {}); // ignore autoplay-policy errors
  } catch {}
}

const soundManager = { play, isMuted, setMuted };
export default soundManager;
