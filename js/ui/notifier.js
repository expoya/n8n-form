// js/ui/notifier.js
let audioCtx;
let primed = false;

/** Audio + (optional) Notification-Permission nach erster User-Geste freischalten */
export function primeAudioOnUserGesture () {
  const doResume = () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch {}
  };
  // Sofort versuchen (falls im User-Gesten-Context aufgerufen)
  doResume();

  // Fallback: beim nächsten Click/Key/Tap
  const resume = () => { doResume(); cleanup(); };
  const cleanup = () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });

  // Notifications früh anfragen (nur über https/localhost sinnvoll)
  try {
    if ('Notification' in window && location.protocol.startsWith('http')) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(()=>{});
      }
    }
  } catch {}
  primed = true;
}

/** Deutlich hörbarer Doppel-Ping (ohne Audiofile) */
export function playBing () {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;

    const beep = (start, dur = 0.22, f0 = 880, f1 = 1320) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';                          // voller als sine
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.8);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    beep(t0,       0.22, 880, 1320);
    beep(t0 + 0.14,0.20, 990, 1480);
  } catch {}
}

/** Ton immer; Browser-Notification nur wenn Tab im Hintergrund */
export async function notify (title, body) {
  playBing();

  if (document.visibilityState === 'visible') return; // keine System-Notif im Vordergrund

  if (!('Notification' in window)) return;
  if (!location.protocol.startsWith('http')) return;

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return;
    }
    if (Notification.permission === 'default' && primed) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification(title, { body });
    }
  } catch {}
}
