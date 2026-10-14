import Note from "./Note.js";
//Define a chord class

/*
Instances of this class do not describe a specific chord like Cmaj7 for example.
It is meant to describe a certain functional chord like Imaj7, IIm7 etc.
The key is assumed to start at the note value 0. Transposition will be done to everything to interface with this class.

for example to describe Imaj7 one would code it as
var my_chord = new Chord(0,ChordType.Maj7,[Scale.ionian])

*/


export default class Chord {
    static key = new Note(0);
    static complexity = 0;
    static rootNoteScore = 0.8;
    static chordToneScore = 1;
    static tensionNoteScore = 0.5;
    static avoidNoteScore = 0.2;
    static outNoteScore = -1;
    static progressionWeight = 0.1;   // score added per point of progression bonus (see Harmonizer.progressionBonus)

    #root;
    #type;
    #scales;
    #symbol;
    
    constructor(root, type, scales) {

        this.#root = new Note(root);
        this.#type = type;
        this.#scales = scales;
        this.#symbol = type.symbol;
    }

    get root() {
        return this.#root;
    }
    get type() {
        return this.#type;
    }
    get scales() {
        return this.#scales;
    }

    static setComplexity(comp){
        this.complexity = comp;
        switch (comp) {
            case 0:
                this.rootNoteScore = 0.8;
                this.chordToneScore = 1;
                this.tensionNoteScore = 0.5;
                this.avoidNoteScore = 0.2;
                this.outNoteScore = -1;
                break;
            case 1:
                this.rootNoteScore = 0.7;
                this.chordToneScore = 1;
                this.tensionNoteScore = 0.7;
                this.avoidNoteScore = 0.2;
                this.outNoteScore = -1;
                break;
            case 2:
                this.rootNoteScore = 0.5;
                this.chordToneScore = 1;
                this.tensionNoteScore = 0.7;
                this.avoidNoteScore = 0.4;
                this.outNoteScore = -1;
                break;
            case 3:
                this.rootNoteScore = 0.6;
                this.chordToneScore = 0.8;
                this.tensionNoteScore = 1;
                this.avoidNoteScore = 0.4;
                this.outNoteScore = -0.5;
                break;
            case 4:
                this.rootNoteScore = 0.5;
                this.chordToneScore = 0.7;
                this.tensionNoteScore = 1;
                this.avoidNoteScore = 0.5;
                this.outNoteScore = -0.2;
                break;
            default:
                break;
        }
    }
    //accepts either a Note or a plain number (0 = C ... 11 = B)
    static setKey(key){
        Chord.key = key instanceof Note ? new Note(key.value) : new Note(key);
        Note.setKey(Chord.key);
    }


    isDominant(){
        const dominantChords = [
            DiatonicChords.V7_I,
            DiatonicChords.V7sus4,
            ...Object.values(SecondaryDominants),
            ...Object.values(SubstituteDominants)
        ];

        return dominantChords.includes(this);
    }

    isSubstituteDominant(){
        return Object.values(SubstituteDominants).includes(this);
    }

    //true if the root of this chord is a perfect fifth below the root of the given chord (e.g. C is a fifth down from G)
    isFifthDownFrom(chord){
        return Note.mod12(chord.root.value - this.root.value) === 7;
    }

    //true if the root of this chord is a half step below the root of the given chord (e.g. C is a half step down from Db)
    isHalfStepDownFrom(chord){
        return Note.mod12(chord.root.value - this.root.value) === 1;
    }

    resolvesTo(chord){
        if(!chord || !this.isDominant()) { // for now only dominant chords resolve. later we can change this
            return false;
        }
        if(this.isSubstituteDominant()) {
            // a tritone substitute resolves a half step down (Db7 -> C)
            return chord.isHalfStepDownFrom(this);
        }
        // a regular dominant resolves a fifth down (G7 -> C)
        return chord.isFifthDownFrom(this);
    }

    //checks if a chord "allows" a set of notes by comparing the notes against the allowed scales
    allows(notes, allowAvoid = false) {
        let allowed = false;
    
        
        let transposedNotes = notes.map(note => note.getTransposed(Chord.key.value + this.#root.value,false));
        
        this.#scales.forEach(scale => {
            if (scale && scale.chord) {
                let allNotesAllowed = transposedNotes.every(note => {
                    let chordMatch = scale.chord.some(chordNote => chordNote.value === note.value);
                    let tensionMatch = scale.tension.some(tensionNote => tensionNote.value === note.value);
                    let avoidMatch = scale.avoid.some(avoidNote => avoidNote.value === note.value);   //it's okay to use avoid notes sometimes
                    return chordMatch || tensionMatch || (avoidMatch && allowAvoid);
                });
    
                if (allNotesAllowed) {
                    allowed = true;
                }
            }
        });
    
        return allowed;
    }
    
    isIChord(){
        return [DiatonicChords.Imaj7 /* add I- chords */ ].includes(this);
    }

    isDiatonic(){
        return Object.values(DiatonicChords).includes(this);
    }

    //scores how well the chord fits the melody notes of one bar (roughly -1 to 1),
    //plus progressionWeight for every point of progression bonus (e.g. resolution from the previous chord).
    //the progression bonus is added on top of the melody fit so that it can break ties between chords that fit equally well
    calculateChordScore(melodyNotes, noteDurations,bonus = 0,lastBar = false) {
        
        const progression = bonus + (lastBar && this.isIChord()?1:0);
        const diatonicBonus = this.isDiatonic() ? 4 : 0;   // diatonic chords count as if one extra beat of chord tones was played
        const scales = this.scales; 
        // after this transposition every melody note is expressed relative to the chord root (root = 0)
        let transposedMelody = melodyNotes.map(note => note.getTransposed(Chord.key.value + this.#root.value,false));

        let totalWeightedScore = 0;
        let totalDuration = noteDurations.reduce((acc, duration) => acc + duration, 0);

        if (totalDuration + diatonicBonus === 0) {
            return 0; // empty bar (only rests) and no bonus: nothing to judge
        }
    
        transposedMelody.forEach((melodyNote, index) => {
            let noteScore = Chord.outNoteScore;
            
            // Check each scale in the chord for a match
            scales.forEach(scale => {
                if (scale.chord.some(chordNote => chordNote.value === melodyNote.value)) {
                    if(melodyNote.value === 0) {
                        // the root is a chord tone, but a less interesting melody note than the other chord tones
                        if(Chord.rootNoteScore> noteScore){noteScore = Chord.rootNoteScore;}
                    } else if(Chord.chordToneScore> noteScore){noteScore = Chord.chordToneScore;}
                } else if (scale.tension.some(tensionNote => tensionNote.value === melodyNote.value)) {
                    if(Chord.tensionNoteScore> noteScore){noteScore = Chord.tensionNoteScore;}
                } else if (scale.avoid.some(avoidNote => avoidNote.value === melodyNote.value)) {
                    if(Chord.avoidNoteScore> noteScore){noteScore = Chord.avoidNoteScore;}
                }
            });
            
            // Weight the score by the duration of the melody note
            totalWeightedScore += noteScore * noteDurations[index];
        });
        const melodyFit = (totalWeightedScore + diatonicBonus) / (totalDuration + diatonicBonus);

        // Calculate the final score for the chord
        return parseFloat((melodyFit + Chord.progressionWeight * progression).toFixed(3));
    }
    
    
    
    

    
    toString(){
        let actualRoot = this.#root.getTransposed(Chord.key.value,true);
        return actualRoot.toString() + this.#symbol;
    }
}


// Define chord types.
export const ChordType = Object.freeze({
	Maj7:       { notes : Note.notesFactory([0,4,7,11]),   symbol: '\u0394'    },  //'\u0394' is unicode for delta
	Maj6:       { notes : Note.notesFactory([0,4,7,9]),    symbol: '6'         },
	Maj7s5:     { notes : Note.notesFactory([0,4,8,11]),   symbol: '\u0394#5'  },
	Maj7b5:     { notes : Note.notesFactory([0,4,6,11]),   symbol: '\u0394b5'  },

	dom7:       { notes : Note.notesFactory([0,4,7,10]),   symbol: '7'         },
	dom7sus4:   { notes : Note.notesFactory([0,5,7,10]),   symbol: '7sus4'     },
	dom7s5:     { notes : Note.notesFactory([0,4,8,10]),   symbol: '+7'        },

	m7:         { notes : Note.notesFactory([0,3,7,10]),   symbol: '-7'        },
	mMaj7:      { notes : Note.notesFactory([0,3,7,11]),   symbol: '-\u0394'   },
	m6:         { notes : Note.notesFactory([0,3,7,9]),    symbol: '-6'        },

	m7b5:       { notes : Note.notesFactory([0,3,6,10]),   symbol: '\u03C6'    },  //\u03C6 is unicode for phi
	dim7:       { notes : Note.notesFactory([0,3,6,9]),    symbol: '\u00B07'  }    //\u00B0 is unicode for small circle
});

//Define scales but split each scale into 3 lists (chord tones, tension notes, avoid notes) 
export const Scale = Object.freeze({
    //Major scale modes
    ionian:     { chord: ChordType.Maj7.notes,    tension: Note.notesFactory([2,9]),     avoid: Note.notesFactory([5])  },
    dorian_m7:  { chord: ChordType.m7.notes,      tension: Note.notesFactory([2,5]),     avoid: Note.notesFactory([9])  },
    dorian_m6:  { chord: ChordType.m6.notes,      tension: Note.notesFactory([2,5,10]),  avoid: Note.notesFactory([])   },
    phrygian:   { chord: ChordType.m7.notes,      tension: Note.notesFactory([5]),       avoid: Note.notesFactory([1,8])},
    lydian:     { chord: ChordType.Maj7.notes,    tension: Note.notesFactory([2,6,9]),   avoid: Note.notesFactory([])   },
    mixo:       { chord: ChordType.dom7.notes,    tension: Note.notesFactory([2,9]),     avoid: Note.notesFactory([5])  },
    mixo_sus:   { chord: ChordType.dom7sus4.notes,tension: Note.notesFactory([2,4,9]),   avoid: Note.notesFactory([])   },
    aeolian:    { chord: ChordType.m7.notes,      tension: Note.notesFactory([2,5]),     avoid: Note.notesFactory([8])  },
    locrian:    { chord: ChordType.m7b5.notes,    tension: Note.notesFactory([5,8]),     avoid: Note.notesFactory([1])  },

    //dominant scales
    // first one is mixo, already defined in major scale modes                                                          //9,13
    mixob9:     { chord: ChordType.dom7.notes,    tension: Note.notesFactory([1,3,9]),   avoid: Note.notesFactory([5])  },    //b9,#9,13
    mixob13:    { chord: ChordType.dom7.notes,    tension: Note.notesFactory([2,8]),     avoid: Note.notesFactory([5])  },    //9,b13
    mixob9b13:  { chord: ChordType.dom7.notes,    tension: Note.notesFactory([1,3,8]),   avoid: Note.notesFactory([5])  },	//b9,#9,b13
    lydianb7:   { chord: ChordType.dom7.notes,    tension: Note.notesFactory([2,6,9]),   avoid: Note.notesFactory([])   },	//9,#11,13
    wholeTone:  { chord: ChordType.dom7.notes,    tension: Note.notesFactory([2,6,8]),   avoid: Note.notesFactory([])   },	//9,#11,b13
    halfWhole:  { chord: ChordType.dom7.notes,    tension: Note.notesFactory([1,3,6,9]), avoid: Note.notesFactory([])   },	//b9,#9,#11,13
    altered:    { chord: ChordType.dom7.notes,    tension: Note.notesFactory([1,3,6,8]), avoid: Note.notesFactory([])   },	//b9,#9,#11,b13

    //melodic minor modes: to be completed
    mel_minor:  {chord: ChordType.mMaj7.notes,    tension: Note.notesFactory([2,5,9]),   avoid: Note.notesFactory([])   }

});

// Major scale diatonic chords
export const DiatonicChords = Object.freeze({
    Imaj7 :     new Chord(0,ChordType.Maj7,[Scale.ionian]),
    IIm7 :      new Chord(2,ChordType.m7,[Scale.dorian_m7]),
    IIIm7 :     new Chord(4,ChordType.m7,[Scale.phrygian]),
    IVMaj7 :    new Chord(5,ChordType.Maj7,[Scale.lydian]),
    V7_I :      new Chord(7,ChordType.dom7,[Scale.mixo,Scale.mixob9,Scale.mixob13,Scale.mixob9b13,Scale.wholeTone,Scale.lydianb7,Scale.halfWhole,Scale.altered]),
    V7sus4 :    new Chord(7,ChordType.dom7sus4,[Scale.mixo_sus]),
    VIm7 :      new Chord(9,ChordType.m7,[Scale.aeolian]),
    VIIm7b5 :   new Chord(11,ChordType.m7b5,[Scale.locrian])
});

export const SecondaryDominants = Object.freeze({
    V7_II :     new Chord(9,ChordType.dom7,[Scale.mixob13,Scale.mixob9b13,Scale.halfWhole,Scale.altered]),
    V7_III :    new Chord(11,ChordType.dom7,[Scale.mixob9b13,Scale.altered]),
    V7_IV :     new Chord(0,ChordType.dom7,[Scale.mixo,Scale.lydianb7]),
    V7_V :      new Chord(2,ChordType.dom7,[Scale.mixo,Scale.mixob9,Scale.lydianb7]),
    V7_VI :     new Chord(4,ChordType.dom7,[Scale.mixob9b13,Scale.altered])
});

export const Relatedm7OfSecondaryDominants = Object.freeze({
    // IIm7_II :     new Chord(4,ChordType.m7,[Scale.phrygian]),
    IIm7_III :    new Chord(6,ChordType.m7,[Scale.dorian_m7]),
    IIm7_IV :     new Chord(7,ChordType.m7,[Scale.dorian_m7]),
    // IIm7_V :      new Chord(9,ChordType.m7,[Scale.aeolian]),
    IIm7_VI :     new Chord(11,ChordType.m7,[Scale.dorian_m7])
    //IIm7b5_VI :   new Chord(11,ChordType.m7b5,[Scale.locrian])
});

export const SubstituteDominants = Object.freeze({
    subV7_II :     new Chord(3,ChordType.dom7,[Scale.lydianb7]),
    subV7_III :    new Chord(5,ChordType.dom7,[Scale.lydianb7]),
    subV7_IV :     new Chord(6,ChordType.dom7,[Scale.lydianb7]),
    subV7_V :      new Chord(8,ChordType.dom7,[Scale.lydianb7]),
    subV7_VI :     new Chord(10,ChordType.dom7,[Scale.lydianb7])
});

export const Relatedm7OfSubstituteDominants = Object.freeze({
    subIIm7_II :     new Chord(10,ChordType.m7,[Scale.dorian_m7]),
    subIIm7_III :    new Chord(0,ChordType.m7,[Scale.dorian_m7]),
    subIIm7_IV :     new Chord(1,ChordType.m7,[Scale.dorian_m7]),
    subIIm7_V :      new Chord(3,ChordType.m7,[Scale.dorian_m7]),
    subIIm7_VI :     new Chord(5,ChordType.m7,[Scale.dorian_m7])
});

/*more lists:

Sub-Dominant Minor Chords:
bIIMaj7,IIm7b5,IVm7,bVIMaj7,bVI7,bVII7

Diminished chords...

Special Function Dominant 7th chords: (Dom7 chords that do not function as Dominant)
I7,II7,IV7,bVI7,bVII7,bVII7

Modal Interchange chords ...
*/
