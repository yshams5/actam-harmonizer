// Step entry: notes are typed one after another at a cursor, with a chosen length,
// from the computer keyboard or a MIDI keyboard. No timing skill needed.

export const LENGTHS = [
    { steps: 1, name: '16th', key: '1' },
    { steps: 2, name: '8th', key: '2' },
    { steps: 4, name: 'quarter', key: '3' },
    { steps: 8, name: 'half', key: '4' },
    { steps: 16, name: 'whole', key: '5' },
];

// computer keys laid out like a piano: the home row is the white keys, the row above the black keys
const KEY_TO_SEMITONE = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
    KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
};

export class StepEntry extends EventTarget {
    cursor = 0;       // step where the next note goes
    baseLength = 2;   // in 16ths, without the dot
    dotted = false;
    octave = 4;       // octave of the A key (4 = middle C)

    constructor(model) {
        super();
        this.model = model;
        this.cursor = model.end;
    }

    get length() {
        return this.dotted ? this.baseLength * 1.5 : this.baseLength;
    }

    setLength(steps) {
        this.baseLength = steps;
        this.#changed();
    }

    toggleDot() {
        this.dotted = !this.dotted;
        this.#changed();
    }

    setOctave(octave) {
        this.octave = Math.max(0, Math.min(8, octave));
        this.#changed();
    }

    setCursor(step) {
        this.cursor = Math.max(0, step);
        this.#changed();
    }

    // puts a note at the cursor and moves the cursor after it
    insert(pitch) {
        this.model.add({ pitch, start: this.cursor, duration: this.length });
        this.cursor += this.length;
        this.#entered();
    }

    rest() {
        this.cursor += this.length;
        this.#entered();
    }

    // deletes what is right before the cursor: a rest (gap) or the previous note
    backspace() {
        const notes = this.model.notes;
        let previous = -1;
        notes.forEach((n, i) => { if (n.start < this.cursor) previous = i; });
        if (previous === -1) {
            this.cursor = 0;
        } else {
            const n = notes[previous];
            const end = n.start + n.duration;
            if (end < this.cursor) {
                this.cursor = end;           // remove the rest between the previous note and the cursor
            } else {
                this.model.remove(previous);
                this.cursor = n.start;
            }
        }
        this.#entered();
    }

    move(direction) {
        this.setCursor(this.cursor + direction * this.length);
    }

    // MIDI pitch for a computer key, or null
    pitchForKey(code) {
        return code in KEY_TO_SEMITONE ? KEY_TO_SEMITONE[code] + 12 * (this.octave + 1) : null;
    }

    #changed() {
        this.dispatchEvent(new Event('change'));
    }

    // 'entry' is fired for notes, rests and deletions typed at the cursor (not for settings changes)
    #entered() {
        this.dispatchEvent(new Event('entry'));
        this.#changed();
    }
}

// Handles the keyboard shortcuts for step entry. onNote is called for every entered pitch (for a sound preview).
// Keys are ignored while the user types in a form field.
export function attachKeyboard(target, stepEntry, { onNote = () => {}, onDelete = null } = {}) {
    target.addEventListener('keydown', event => {
        const el = event.target;
        if (el.closest && el.closest('input, select, textarea, [contenteditable]')) return;
        const model = stepEntry.model;

        if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
            event.shiftKey ? model.redo() : model.undo();
        } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
            model.redo();
        } else if (event.ctrlKey || event.metaKey || event.altKey) {
            return; // leave browser shortcuts alone
        } else if (event.repeat) {
            event.preventDefault();
            return;
        } else if (stepEntry.pitchForKey(event.code) !== null) {
            const pitch = stepEntry.pitchForKey(event.code);
            stepEntry.insert(pitch);
            onNote(pitch);
        } else if (event.code === 'Space') {
            stepEntry.rest();
        } else if (event.code === 'Backspace' || event.code === 'Delete') {
            // a selected note in the piano roll is deleted first
            if (!(onDelete && onDelete())) stepEntry.backspace();
        } else if (event.code === 'KeyZ') {
            stepEntry.setOctave(stepEntry.octave - 1);
        } else if (event.code === 'KeyX') {
            stepEntry.setOctave(stepEntry.octave + 1);
        } else if (event.code === 'Period') {
            stepEntry.toggleDot();
        } else if (event.code === 'ArrowLeft') {
            stepEntry.move(-1);
        } else if (event.code === 'ArrowRight') {
            stepEntry.move(1);
        } else {
            const length = LENGTHS.find(l => event.key === l.key);
            if (!length) return;
            stepEntry.setLength(length.steps);
        }
        event.preventDefault();
    });
}

// Connects all MIDI inputs (Web MIDI). onNote(pitch) is called on every note-on,
// onStatus(text) whenever a keyboard is plugged in or out. Returns a short status text for the UI.
export async function connectMIDI(onNote, onStatus = () => {}) {
    if (!navigator.requestMIDIAccess) {
        return 'This browser does not support Web MIDI (try Chrome or Edge).';
    }
    let access;
    try {
        access = await navigator.requestMIDIAccess();
    } catch {
        return 'MIDI access was blocked.';
    }
    const listen = input => {
        input.onmidimessage = ({ data }) => {
            const [status, pitch, velocity] = data;
            if ((status & 0xf0) === 0x90 && velocity > 0) onNote(pitch);
        };
    };
    const describe = () => {
        const names = [...access.inputs.values()].map(input => input.name);
        return names.length ? `MIDI: ${names.join(', ')}` : 'No MIDI keyboard found. Plug one in.';
    };
    access.inputs.forEach(listen);
    access.onstatechange = event => {
        if (event.port.type === 'input' && event.port.state === 'connected') listen(event.port);
        onStatus(describe());
    };
    return describe();
}
