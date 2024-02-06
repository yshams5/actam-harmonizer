# Music Harmoniser

Music Harmoniser is a tool that suggests possible chords for each bar when a melody is provided. It lets the user input a melody and displays the corresponding chords for each bar, continuously ranked depending upon the preceding chord selections.

This enables both advanced and amateur musicians to explore the magic of chords, by inputting any melody of their liking, with an easy to navigate user interface. The only pre-requisite is the knowledge to draw notes on a pianoroll, which is the easiest form of music input.

## Implementation

Inputs from the user are:
* Tempo
* Key of the melody
* Required complexity of the chords
* Melody input using a piano roll

Output is an easy-to-read list of chords for each bar, ranked in order of suitability, which dynamically updates based on the user selections.

### Piano Roll and MML 

Piano roll is implemented using [webaudio-pianoroll]([https://github.com/g200kg/webaudio-pianoroll). webaudio-pianoroll is a GUI library for displaying piano rolls used in music applications. 
The output from this pianoroll is by default stored in the form of Music Macro Language (MML). MML is a method of transcribing musical notation as sequence data, which then gets processed into binary performance data, akin to MIDI, for a computer to playback.

MML can be decoded in the following way:

* cdefgab — The letters a to g correspond to the musical pitches and cause the corresponding note to be played.
* Black key notes are produced by appending a - with the next white key.
* The length of a note is specified by appending a number representing its length as a fraction of a whole note and adding a dot(.) whenever it is a dotted note.
* l — Followed by a number, specifies the default length used by notes or rests which do not explicitly define one.
* r — A pause or rest. The length of the rest is specified in the same manner as the length of a note.
* o — Followed by a number, o selects the octave the instrument will play in.
* t — Followed by a number, sets the tempo in beats per minute.

An example of a 4 bar melody in MML: t120o4l8cr8.d16ro5c4r16o6a-8.

The tempo here is 120 (t120), starts on octave 4 (o4), default note length is 1/8 (l8). Breaking down the MML:


| Notation  | Note+Octave/Rest   | Note/Rest Value | 
| :-------------: |:-------------:| :-----:|
| c     | c4 | 8th |
| r8  | rest      |  Dotted 8th |
| d16 | d4     |    16th  |
| r     | rest | 8th |
| o  | default octave change to 5      |  -- |
| c4 | c5     |    4th  |
| r16     | rest | 16th |
| o6  |   default octave change to 6     | -- |
| a-8. | a6    |    Dotted 8th  |



The key challenges in implementing the user input functionality was extracting the output from the piano roll according to our requirements. Since there is no delimiter in an MML string between notes/rests/octaves, 
the presence (and sometimes absence) of alphabets, numbers and other special characters which contains rests, note, octave information all combined into one, made parsing the string tricky.
Using conditional statements and regulax expressions such as slice, match and replace functions of javascript, the single MML string output was parsed and segmented into
* Tempo
* Notes
* Rests
* Durations of notes/rests
* Octave

The notes and octaves are then converted into an integer using the formula 

*notevalue+12(octave+1)*

where notevalue is 0 for c, 1 for d flat and so on, upto 12 for b.


