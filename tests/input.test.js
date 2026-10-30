import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, toSequence, fromSequence, parseMML, detectKey, pitchName } from '../input/noteEvents.js';
import MelodyModel from '../input/MelodyModel.js';
import { StepEntry } from '../input/stepEntry.js';
import { PRESETS, presetNotes } from '../input/presets.js';
import Harmonizer from '../Harmonizer.js';

const n = (pitch, start, duration) => ({ pitch, start, duration });

test('normalize sorts, drops invalid notes and makes the melody monophonic', () => {
    assert.deepEqual(normalize([
        n(64, 4, 4),
        n(60, 0, 8),          // overlaps the E: shortened to 4
        n(62, 4, 2),          // same start as the E, added later: replaces it
        n(65, -1, 2),         // invalid
        n(67, 10, 0),         // invalid
        { pitch: 'x', start: 0, duration: 1 },
    ]), [n(60, 0, 4), n(62, 4, 2)]);
});

test('toSequence turns gaps into rests and fromSequence reverses it', () => {
    const notes = [n(60, 2, 2), n(62, 4, 4), n(64, 12, 4)];
    const seq = toSequence(notes);
    assert.deepEqual(seq, { values: [-1, 60, 62, -1, 64], durations: [2, 2, 4, 4, 4] });
    assert.deepEqual(fromSequence(seq.values, seq.durations), notes);
});

test('parseMML handles octaves, accidentals, lengths, dots, rests and ties', () => {
    const { tempo, notes } = parseMML('t90 o4 l8 c d-4. r16 e+16 > c < b2 a4&a8 l4. g');
    assert.equal(tempo, 90);
    assert.deepEqual(notes, [
        n(60, 0, 2),      // c, default length 8
        n(61, 2, 6),      // d- dotted quarter
        n(65, 9, 1),      // e+ = F, after a 16th rest
        n(72, 10, 2),     // > octave up
        n(71, 12, 8),     // < back, half note
        n(69, 20, 6),     // a4 tied to a8
        n(67, 26, 6),     // default length l4. = dotted quarter
    ]);
});

test('parseMML ignores spaces and unknown characters, defaults to quarter notes', () => {
    assert.deepEqual(parseMML('c | v10 d').notes, [n(60, 0, 4), n(62, 4, 4)]);
});

test('presets parse into whole bars of plausible melodies', () => {
    for (const preset of PRESETS) {
        const notes = presetNotes(preset);
        assert.ok(notes.length > 10, preset.name);
        notes.forEach(note => {
            assert.ok(note.pitch >= 55 && note.pitch <= 84, `${preset.name}: ${pitchName(note.pitch)}`);
            assert.ok(Number.isInteger(note.duration * 2), `${preset.name}: duration ${note.duration}`);
        });
    }
    // first notes of Hey Jude: (rest) C5 A4 (rest) A4 C5 D5 G4
    assert.deepEqual(presetNotes(PRESETS[0]).slice(0, 3).map(x => pitchName(x.pitch)), ['C5', 'A4', 'A4']);
});

test('detectKey finds the key of scales and of the presets', () => {
    assert.equal(detectKey([]), null);
    const majorScale = key => [0, 2, 4, 5, 7, 9, 11, 12].map((s, i) => n(60 + key + s, i * 4, s === 0 || s === 7 ? 8 : 4));
    for (let key = 0; key < 12; key++) assert.equal(detectKey(majorScale(key)), key, `key ${key}`);
    assert.equal(detectKey(presetNotes(PRESETS[0])), 5, 'Hey Jude: F');
    assert.equal(detectKey(presetNotes(PRESETS[2])), 9, 'Every Breath You Take: A');
    // Never Gonna Give You Up only uses Db Eb F Ab (+ one short Gb), which fits Ab major as well as Db major,
    // so detection can't tell them apart; the preset sets its key explicitly.
    assert.ok([1, 8].includes(detectKey(presetNotes(PRESETS[1]))));
});

test('MelodyModel normalizes, notifies and supports undo/redo', () => {
    const model = new MelodyModel();
    let changes = 0;
    model.addEventListener('change', () => changes++);

    model.add(n(60, 0, 4));
    model.add(n(62, 2, 4));                  // cuts the first note
    assert.deepEqual(model.notes, [n(60, 0, 2), n(62, 2, 4)]);
    assert.equal(model.end, 6);
    model.set(model.notes);                  // no change: no event, no undo step
    assert.equal(changes, 2);

    model.undo();
    assert.deepEqual(model.notes, [n(60, 0, 4)]);
    model.redo();
    assert.equal(model.notes.length, 2);
    model.remove(0);
    assert.deepEqual(model.notes, [n(62, 2, 4)]);
    assert.equal(model.canRedo, false);
    assert.equal(model.indexAt(3), 0);
    assert.equal(model.indexAt(3, 60), -1);

    const copy = model.notes;
    copy[0].pitch = 0;                        // changing the copy doesn't change the model
    assert.equal(model.notes[0].pitch, 62);
});

test('step entry types notes, rests and deletes at the cursor', () => {
    const model = new MelodyModel();
    const entry = new StepEntry(model);
    assert.equal(entry.pitchForKey('KeyA'), 60);
    assert.equal(entry.pitchForKey('KeyK'), 72);
    assert.equal(entry.pitchForKey('KeyQ'), null);

    entry.setLength(4);
    entry.insert(60);
    entry.rest();
    entry.toggleDot();
    entry.insert(64);                         // dotted quarter
    assert.deepEqual(model.notes, [n(60, 0, 4), n(64, 8, 6)]);
    assert.equal(entry.cursor, 14);

    entry.backspace();                        // removes the E
    assert.deepEqual(model.notes, [n(60, 0, 4)]);
    assert.equal(entry.cursor, 8);
    entry.backspace();                        // removes the rest
    assert.equal(entry.cursor, 4);
    entry.backspace();                        // removes the C
    assert.equal(model.isEmpty, true);
    assert.equal(entry.cursor, 0);

    entry.setOctave(20);
    assert.equal(entry.octave, 8);
});

test('note events feed the harmonizer', () => {
    const preset = PRESETS[0];
    const { values, durations } = toSequence(presetNotes(preset));
    const h = new Harmonizer(preset.key, values, durations, 0, 16, preset.tempo);
    assert.equal(h.numOfBars, 9);           // the last note of the transcription runs into bar 9
    assert.equal(String(h.chosenChords[0]), 'FΔ');
});
