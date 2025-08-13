// Audio sofort (falls im User-Gesture-Kontext) + Fallback beim nächsten Klick/Key
export function primeAudioOnUserGesture () {
  const doResume = () => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch {}
  };
  doResume(); // Versuch sofort
  const resume = () => { doResume(); cleanup(); };
  const cleanup = () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  window.addEventListener('touchstart', resume, { once: true });
}

// Deutlich hörbarer Doppel-Ping (ohne Datei)
export function playBing () {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;

    const makeBeep = (start, dur = 0.22, f0 = 880, f1 = 1320) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle'; // voller als sine
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

    makeBeep(t0, 0.22, 880, 1320);
    makeBeep(t0 + 0.14, 0.20, 990, 1480);
  } catch {}
}
