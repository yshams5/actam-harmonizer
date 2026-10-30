# Music Harmoniser

Music Harmoniser is a tool that suggests possible chords for each bar when a melody is provided. It lets the user input a melody and displays the corresponding chords for each bar, continuously ranked depending upon the preceding chord selections.

This enables both advanced and amateur musicians to explore the magic of chords, by inputting any melody of their liking, with an easy to navigate user interface. The only pre-requisite is the knowledge to draw notes on a pianoroll, which is the easiest form of music input.

## Implementation

Inputs from the user are:
* Tempo
* Key of the melody (or "Auto", which detects it from the melody)
* Required complexity of the chords
* The melody, entered with the mouse, the computer keyboard or a MIDI keyboard, or loaded from a preset

Output is an easy-to-read list of chords for each bar, ranked in order of suitability, which dynamically updates based on the user selections.

Open `index.html` through any static web server (for example `python3 -m http.server`) since the scripts are ES modules. No build step or external libraries are needed.

### Melody input

The melody is stored as a list of note events, `{ pitch, start, duration }`: the pitch is a MIDI note number (60 = middle C), and start and duration are counted in 16th notes. This list (`input/MelodyModel.js`) is the single source of truth: every input method edits it, and the piano roll is drawn from it.

* **Piano roll** (`input/PianoRoll.js`): click the grid to add a note and drag to set its length, drag a note to move it, drag its right edge to resize it, right-click it (or select it and press Delete) to remove it. Click a piano key to hear it.
* **Computer keyboard** (`input/stepEntry.js`): notes are typed one after another at the cursor (the yellow line, which can be moved by clicking the bar numbers). The keys `A S D F G H J K L ;` are the white keys and `W E T Y U O P` the black keys. `1`-`5` choose the length (16th to whole), `.` makes it dotted, `Space` adds a rest, `Backspace` deletes, `Z`/`X` change the octave, `Ctrl+Z` undoes.
* **MIDI keyboard**: after pressing "Connect MIDI keyboard" (Chrome/Edge, Web MIDI), played notes are entered at the cursor like typed notes.
* **Presets** (`input/presets.js`) are written in Music Macro Language and converted to note events by `parseMML`.

The melody is monophonic: a note that overlaps the next one is shortened, and a note placed at the same position as another replaces it. The melody is remembered in the browser between visits.

Before harmonising, `toSequence` (`input/noteEvents.js`) converts the note events to the arrays the harmonizer uses: MIDI values and durations, where the gaps between notes become rests (-1). The harmonizer then splits them into bars of 16 steps.

#### Key detection

"Auto" key detection correlates how long each pitch class sounds in the melody with the Krumhansl-Kessler major key profile and picks the best matching major key. Minor melodies give their relative major, which is what the harmonizer expects. Short melodies that only use a few notes can be ambiguous (for example a melody on Db Eb F Ab fits both Db and Ab major); in that case choose the key by hand.

## Tests

The chord model and harmonizer logic (`Note.js`, `Chord.js`, `Harmonizer.js`) have unit tests that run with Node 18+ and no dependencies:

```
npm test
```
