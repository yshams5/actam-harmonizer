export default class Note {
    //static field used to hold a default value for whether to write sharps or flats when converting notes to strings
    static sharpKey = true;
    static #key = 0;
    #value; // = midiValue%12 (0 to 11, C to B)
    #midiValue;
    #octave;
    //#octave;
    constructor(midiValue) {
        this.#midiValue = midiValue;
        this.#value = midiValue % 12;
        this.#octave = Math.floor(midiValue / 12) -1;
    }
    
    static setKey(value){
        this.#key = new Note(value);
        this.sharpKey = this.#key.startsSharpKey();
    }

    //takes an array of note values and returns an array of notes based on these values
    static notesFactory(values) {
        let notes = [];
        values.forEach(value => {
            notes.push(new Note(value));
        });
        return notes;
    }

    get value(){
        return this.#value;
    }
    get midiValue(){
        return this.#midiValue;
    }

    toString(){
        return Note.sharpKey? this.getSharpName() : this.getFlatName();
    }
    valueOf(){
        return this.#value;
    }
    
    //transposes the note by a number of steps up or down by changing the note value
    transpose(steps, up = true) {
        this.#midiValue = (this.#midiValue  + ((steps) * (up ? 1 : -1)));
        this.#value = (this.#midiValue+12) % 12;
        this.#octave = Math.floor(this.#midiValue / 12) -1;
        return this; // Return the modified instance
    }

    getTransposed(steps,up=true){
        return new Note(this.#value).transpose(steps,up);
    }


    //handles enharmonic note names
    getName(sharp=sharpKey) { 
        // Return the appropriate note name
        return sharp ? this.getSharpName() : this.getFlatName();
    }

    


    // returns true if the major key that starts on this instance note is represented using sharps
    // the key of C, Gb/F# will return the default value "true" because C has none and Gb/F# could be 6 flats or sharps
    startsSharpKey(){
        switch (this.#value) {
            case 1:                 //Db
            case 10:                //Bb
            case 3:                 //Eb
            case 5:                 //F
            case 8: return false;   //Ab
            case 2:                 //D            
            case 4:                 //E            
            case 7:                 //G            
            case 9:                 //A            
            case 11:                //B
            default: return true;
        }
    }
    getSharpName() {
        switch (this.#value) {
            case 0: return 'C';
            case 1: return 'C#';
            case 2: return 'D';
            case 3: return 'D#';
            case 4: return 'E';
            case 5: return 'F';
            case 6: return 'F#';
            case 7: return 'G';
            case 8: return 'G#';
            case 9: return 'A';
            case 10: return 'A#';
            case 11: return 'B';
            default: return 'Unknown';
        }
    }

    getFlatName() {
        switch (this.#value) {
            case 0: return 'C';
            case 1: return 'Db';
            case 2: return 'D';
            case 3: return 'Eb';
            case 4: return 'E';
            case 5: return 'F';
            case 6: return 'Gb';
            case 7: return 'G';
            case 8: return 'Ab';
            case 9: return 'A';
            case 10: return 'Bb';
            case 11: return 'B';
            default: return 'Unknown';
        }
    }

    
    
}