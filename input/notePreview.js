// A short sound when a note is entered, so the user hears what they draw or type.
let context = null;

// one shared AudioContext, created on first use (browsers only allow audio after a user gesture)
export function audioContext() {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    return context;
}

export function previewNote(pitch, seconds = 0.35) {
    const ctx = audioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + seconds);
}
