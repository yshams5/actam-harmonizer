import { normalize, endOf, toSequence } from './noteEvents.js';

// Holds the melody as note events and is the single source of truth for every input method
// (piano roll, computer keyboard, MIDI keyboard, presets).
// Every change goes through set(), which normalizes the notes, records an undo step and fires a 'change' event.
export default class MelodyModel extends EventTarget {
    #notes = [];
    #undoStack = [];
    #redoStack = [];
    static maxUndo = 200;

    constructor(notes = []) {
        super();
        this.#notes = normalize(notes);
    }

    // a copy, so callers can't change the melody without going through set()
    get notes() {
        return this.#notes.map(n => ({ ...n }));
    }

    get isEmpty() {
        return this.#notes.length === 0;
    }

    // the step where the last note ends
    get end() {
        return endOf(this.#notes);
    }

    get canUndo() {
        return this.#undoStack.length > 0;
    }

    get canRedo() {
        return this.#redoStack.length > 0;
    }

    set(notes) {
        const next = normalize(notes);
        if (JSON.stringify(next) === JSON.stringify(this.#notes)) return;
        this.#undoStack.push(this.#notes);
        if (this.#undoStack.length > MelodyModel.maxUndo) this.#undoStack.shift();
        this.#redoStack = [];
        this.#notes = next;
        this.#changed();
    }

    add(note) {
        this.set([...this.#notes, note]);
    }

    // removes the note with this index (indices refer to the notes array, sorted by start)
    remove(index) {
        this.set(this.#notes.filter((_, i) => i !== index));
    }

    clear() {
        this.set([]);
    }

    undo() {
        if (!this.canUndo) return;
        this.#redoStack.push(this.#notes);
        this.#notes = this.#undoStack.pop();
        this.#changed();
    }

    redo() {
        if (!this.canRedo) return;
        this.#undoStack.push(this.#notes);
        this.#notes = this.#redoStack.pop();
        this.#changed();
    }

    // index of the note sounding at this step (and with this pitch, if given), or -1
    indexAt(step, pitch = null) {
        return this.#notes.findIndex(n =>
            step >= n.start && step < n.start + n.duration && (pitch === null || n.pitch === pitch));
    }

    // values/durations arrays for the Harmonizer (rests are -1)
    toSequence() {
        return toSequence(this.#notes);
    }

    toJSON() {
        return this.notes;
    }

    #changed() {
        this.dispatchEvent(new Event('change'));
    }
}
