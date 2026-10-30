import { parseMML } from './noteEvents.js';

// Preset melodies, written in Music Macro Language (see parseMML).
// key: 0 = C ... 11 = B, tempo in BPM.
export const PRESETS = [
    {
        name: 'Hey Jude',
        key: 5,
        tempo: 74,
        mml: 't74o4l8r2.o5c4o4a4.r4ao5cdo4g4.r4.gab-4o5f4rfecdc16o4b-16a4r4.o5cddrd16r16g16fef16dc4r4o4fgao5dc4rco4b-a8.r16ef4.',
    },
    {
        name: 'Never Gonna Give You Up',
        key: 1,
        tempo: 114,
        mml: 't120o4l8o5d-4.e-4.o4a-4o5e-4.f4.a-16g-16fd-4.e-4.o4a-4.r2a-16a-16b-16o5d-8.d-4.e-4.o4a-4o5e-4.f4.a-16g-16fd-4.e-4.o4a-4.',
    },
    {
        name: 'Every Breath You Take',
        key: 9,
        tempo: 119,
        mml: 't117o4l8r4o5d-dd-4o4b4a1r4o5d-dd-4o4b4a1raao5d-4d4o4a4aao5d4d-4o4b4bao5d-ro4a4a4',
    },
];

export function presetNotes(preset) {
    return parseMML(preset.mml).notes;
}
