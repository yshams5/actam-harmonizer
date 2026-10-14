import { test } from 'node:test';
import assert from 'node:assert/strict';
import Note from '../Note.js';
import Chord, { ChordType, DiatonicChords as D, SecondaryDominants, SubstituteDominants as Sub } from '../Chord.js';
import Harmonizer from '../Harmonizer.js';

const pcs = notes => notes.map(n => n.value);

test('transposition always gives a pitch class between 0 and 11', () => {
    assert.equal(new Note(0).getTransposed(14, false).value, 10);
    assert.equal(new Note(-1).value, 11);
    assert.equal(new Note(62).getTransposed(25, true).value, 3);
});

test('getName works without arguments', () => {
    Note.setKey(5); // F major -> flats
    assert.equal(new Note(10).getName(), 'Bb');
});

test('minor chord types have a minor third', () => {
    assert.deepEqual(pcs(ChordType.mMaj7.notes), [0, 3, 7, 11]);
    assert.deepEqual(pcs(ChordType.m6.notes), [0, 3, 7, 9]);
});

test('keys above C score the same as in C (no negative pitch classes)', () => {
    Chord.setComplexity(0);
    // F A C over the VIm7 chord of each key: all chord tones
    for (let key = 0; key < 12; key++) {
        Chord.setKey(key);
        const melody = Note.notesFactory([key + 60, key + 64, key + 67]);
        assert.equal(D.VIm7.calculateChordScore(melody, [4, 4, 8]), 1, `key ${key}`);
    }
});

test('the root, not another chord tone, gets the root note score', () => {
    Chord.setComplexity(0);
    Chord.setKey(0);
    const durations = [16];
    // G over G7 (the root) vs D over G7 (the fifth), no diatonic bonus effect on the comparison
    const root = D.V7_I.calculateChordScore(Note.notesFactory([67]), durations);
    const fifth = D.V7_I.calculateChordScore(Note.notesFactory([62]), durations);
    assert.ok(root < fifth, `root ${root} should score below fifth ${fifth}`);
});

test('dominants resolve: V7 -> I, V7/II -> II, subV7 -> half step down', () => {
    Chord.setKey(0);
    assert.equal(D.V7_I.resolvesTo(D.Imaj7), true);
    assert.equal(SecondaryDominants.V7_II.resolvesTo(D.IIm7), true);
    assert.equal(Sub.subV7_II.resolvesTo(D.IIm7), true);
    assert.equal(Sub.subV7_IV.resolvesTo(D.IVMaj7), true);
    assert.equal(D.V7_I.resolvesTo(D.IIm7), false);
    assert.equal(D.Imaj7.resolvesTo(D.IVMaj7), false);
});

test('a bar of only rests does not produce NaN scores', () => {
    Chord.setComplexity(4);
    Chord.setKey(0);
    for (const s of Harmonizer.scoreChords([], [])[1]) assert.ok(Number.isFinite(s));
});

test('every bar has at least one chord, even for a clashing melody', () => {
    // chromatic cluster that fits nothing well
    const h = new Harmonizer(0, [60, 61, 62, 63, -1], [4, 4, 4, 4, 16], 0, 16, 120);
    assert.equal(h.numOfBars, 2);
    h.chords.forEach(list => assert.ok(list.length > 0));
    h.chosenChords.forEach(c => assert.ok(c));
});

test('splitToBars splits notes over the barline and skips invalid durations', () => {
    const [values, durations] = Harmonizer.splitToBars([60, 62, 64], [12, 8, undefined], 16);
    assert.deepEqual(values, [[60, 62], [62]]);
    assert.deepEqual(durations, [[12, 4], [4]]);
});

test('choosing a chord re-ranks all later bars and keeps earlier user choices', () => {
    // hey jude style melody in F, 4 bars
    const values = [-1, 60, 57, -1, 57, 60, 62, 55, -1, 55, 57, 58, 65, 65, 64, 60, 62, 60, 58, 57];
    const durations = [12, 4, 8, 2, 2, 2, 2, 8, 4, 2, 2, 4, 6, 2, 2, 2, 2, 1, 1, 12];
    const h = new Harmonizer(5, values, durations, 2, 16, 120);
    assert.ok(h.numOfBars >= 3);

    h.chooseChord(2, h.chords[2].length - 1);
    const picked = h.chosenChords[2];
    h.chooseChord(0, 0);
    assert.equal(h.chosenChords[2], picked, 'user choice in bar 2 survives a later click on bar 0');
    assert.equal(h.chords[2][h.chosenIndices[2]], picked, 'index points at the chosen chord after re-sorting');

    h.chooseChord(1, 99); // out of range: ignored
    assert.ok(h.chosenChords[1]);
});

test('V7 is ranked higher after choosing its II chord', () => {
    Chord.setComplexity(0);
    // C major: bar 1 = D F A C (Dm7), bar 2 = B D (fits G7 and Bm7b5 and more)
    const h = new Harmonizer(0, [62, 65, 69, 72, 71, 74], [4, 4, 4, 4, 8, 8], 0, 16, 120);
    h.chooseChord(0, h.chords[0].indexOf(D.IIm7));
    assert.equal(h.chords[1][0], D.V7_I);
});
