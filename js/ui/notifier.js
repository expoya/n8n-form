// js/ui/notifier.js
let audioCtx;

/** Sorgt dafür, dass Audio nach einem User-Gesture erlaubt ist (Autoplay-Policy). */
export function primeAudioOnUserGesture () {
  const resume = () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch {}
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
}

/** Kleiner „Bing“-Ton per WebAudio (ohne Asset). */
export function playBing () {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Falls noch suspendiert, wird beim nächsten User-Gesture resumed (primeAudioOnUserGesture)
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t0);              // A5
    osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.18); // leichter Sweep

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.26);
  } catch {}
}

/** System-Notification (falls Tab im Hintergrund) + Ton. */
export async function notify (title, body) {
  // Immer Ton – das ist dein „Bing“-Signal
  playBing();

  // Optionale kurze Vibration auf Mobile
  if ('vibrate' in navigator) navigator.vibrate(30);

  // Nur System-Notification, wenn Seite nicht im Fokus ist
  if (document.visibilityState === 'visible') return;

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return;
    }
    if (Notification.permission !== 'denied') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') new Notification(title, { body });
      } catch {}
    }
  }
}
