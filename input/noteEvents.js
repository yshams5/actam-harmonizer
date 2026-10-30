// A melody is a list of note events: { pitch, start, duration }
//   pitch:    MIDI note number (60 = middle C)
//   start:    position in 16th notes from the beginning
//   duration: length in 16th notes
// These functions are pure: they never modify the arrays they get.

export const STEPS_PER_BAR = 16;

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function pitchName(pitch) {
    return NOTE_NAMES[((pitch % 12) + 12) % 12] + (Math.floor(pitch / 12) - 1);
}

function isValidNote(n) {
    return n
        && Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127
        && Number.isFinite(n.start) && n.start >= 0
        && Number.isFinite(n.duration) && n.duration > 0;
}

// Returns a clean, sorted, monophonic copy of the notes:
// invalid notes are dropped, and a note that overlaps the next one is shortened to end where the next one starts.
// When two notes start at the same time, the one that comes later in the array wins
// (so a newly added note replaces the one it was placed on).
export function normalize(notes) {
    const sorted = notes
        .filter(isValidNote)
        .map((n, index) => ({ pitch: n.pitch, start: n.start, duration: n.duration, index }))
        .sort((a, b) => a.start - b.start || a.index - b.index);

    const result = [];
    for (let i = 0; i < sorted.length; i++) {
        const { pitch, start, duration } = sorted[i];
        const next = sorted[i + 1];
        const end = next ? Math.min(start + duration, next.start) : start + duration;
        if (end > start) {
            result.push({ pitch, start, duration: end - start });
        }
    }
    return result;
}

export function endOf(notes) {
    return notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
}

// Converts note events to the format used by Harmonizer: parallel arrays of
// MIDI values and durations, where gaps between notes become rests (value -1).
export function toSequence(notes) {
    const values = [];
    const durations = [];
    let time = 0;
    for (const n of normalize(notes)) {
        if (n.start > time) {
            values.push(-1);
            durations.push(n.start - time);
        }
        values.push(n.pitch);
        durations.push(n.duration);
        time = n.start + n.duration;
    }
    return { values, durations };
}

// The inverse of toSequence.
export function fromSequence(values, durations) {
    const notes = [];
    let time = 0;
    values.forEach((value, i) => {
        if (value !== -1) {
            notes.push({ pitch: value, start: time, duration: durations[i] });
        }
        time += durations[i];
    });
    return normalize(notes);
}

const MML_PITCH_CLASSES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

// Parses Music Macro Language (used for the presets) into note events.
// Supports: notes a-g with accidentals (+ or # = sharp, - = flat), rests r, lengths and dots (c4. = dotted quarter),
// o<n> octave, < and > octave down/up, l<n> default length, t<n> tempo, & ties.
// o4c is middle C (MIDI 60). Lengths are fractions of a whole note: 16 steps = 1 whole note.
export function parseMML(mml) {
    const s = mml.toLowerCase();
    let i = 0;
    let octave = 4;
    let defaultLength = 4;
    let defaultDots = 0;
    let tempo = null;
    let time = 0;
    let tie = false;
    const notes = [];

    const readNumber = () => {
        const match = /^\d+/.exec(s.slice(i));
        if (!match) return null;
        i += match[0].length;
        return parseInt(match[0], 10);
    };
    const readDots = () => {
        let dots = 0;
        while (s[i] === '.') { dots++; i++; }
        return dots;
    };
    const steps = (length, dots) => {
        const base = STEPS_PER_BAR / length;
        let total = base;
        for (let d = 1; d <= dots; d++) total += base / 2 ** d;
        return total;
    };
    const readLength = () => {
        const length = readNumber();
        const dots = readDots();
        return length ? steps(length, dots) : steps(defaultLength, defaultDots + dots);
    };

    while (i < s.length) {
        const ch = s[i++];
        if (ch in MML_PITCH_CLASSES) {
            let pc = MML_PITCH_CLASSES[ch];
            while (s[i] === '+' || s[i] === '#' || s[i] === '-') {
                pc += s[i] === '-' ? -1 : 1;
                i++;
            }
            const pitch = pc + 12 * (octave + 1);
            const duration = readLength();
            const previous = notes[notes.length - 1];
            if (tie && previous && previous.pitch === pitch && previous.start + previous.duration === time) {
                previous.duration += duration;
            } else {
                notes.push({ pitch, start: time, duration });
            }
            time += duration;
            tie = false;
        } else if (ch === 'r') {
            time += readLength();
            tie = false;
        } else if (ch === 'o') {
            octave = readNumber() ?? octave;
        } else if (ch === '<') {
            octave--;
        } else if (ch === '>') {
            octave++;
        } else if (ch === 'l') {
            defaultLength = readNumber() ?? defaultLength;
            defaultDots = readDots();
        } else if (ch === 't') {
            tempo = readNumber() ?? tempo;
        } else if (ch === '&') {
            tie = true;
        }
        // anything else (spaces, bar lines, unknown commands) is ignored
    }
    return { tempo, notes: normalize(notes) };
}

// Krumhansl-Kessler major key profile: how strongly each scale degree suggests a key
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];

function correlation(a, b) {
    const mean = arr => arr.reduce((x, y) => x + y, 0) / arr.length;
    const ma = mean(a), mb = mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) {
        num += (a[i] - ma) * (b[i] - mb);
        da += (a[i] - ma) ** 2;
        db += (b[i] - mb) ** 2;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
}

// Guesses the major key of a melody (0 = C ... 11 = B), or null for an empty melody.
// Each pitch class is weighted by how long it sounds. Minor melodies give their relative major,
// which is what the harmonizer expects since it only knows major keys.
export function detectKey(notes) {
    const histogram = new Array(12).fill(0);
    for (const n of notes) {
        histogram[((n.pitch % 12) + 12) % 12] += n.duration;
    }
    if (histogram.every(v => v === 0)) return null;

    let bestKey = 0;
    let bestScore = -Infinity;
    for (let key = 0; key < 12; key++) {
        const profile = MAJOR_PROFILE.map((_, degree) => MAJOR_PROFILE[(degree - key + 12) % 12]);
        const score = correlation(histogram, profile);
        if (score > bestScore) {
            bestScore = score;
            bestKey = key;
        }
    }
    return bestKey;
}
