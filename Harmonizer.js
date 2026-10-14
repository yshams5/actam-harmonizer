import Chord from './Chord.js';
import * as Enums from './Chord.js';
import Note from './Note.js'


export default class Harmonizer {

    key = new Note(0);

    melody = [];
    durations = [];

    melodyPB =[];
    durationsPB = [];
    bpm = 120;

    complexity = 0;
    barLength = 16;
    numOfBars = 0;

    chords = [];
    scores = [];

    chosenChords = [];
    chosenIndices = []; //we might need it for color

    static stopPlaying = false;

    constructor(key,melodyValues,durations,complexity,barLength,bpm){
        this.setKey(parseInt(key));
        this.melodyPB = melodyValues;
        this.durationsPB = durations;
        let bars = Harmonizer.splitToBars(melodyValues,durations,barLength);
        bars = Harmonizer.removeRests(bars);     
        [this.melody,this.durations] = bars;   
        this.setComplexity(parseInt(complexity));
        this.barLength = barLength;
        this.numOfBars = this.melody.length;
        this.bpm = parseInt(bpm);
        this.initChordsFromMelody(bars);
    }

    setComplexity(complexity){
        this.complexity= complexity;
        Chord.setComplexity(complexity);
    }
    setKey(key){
        let myKey = new Note(key);
        this.key= myKey;
        Chord.setKey(myKey);
    }

    //the user picks a chord for a bar; the following bars are re-ranked based on this choice
    chooseChord(barNumber,chordIndex){
        if(!this.chords[barNumber] || chordIndex < 0 || chordIndex >= this.chords[barNumber].length){
            return;
        }
        this.chosenChords[barNumber] = this.chords[barNumber][chordIndex];
        this.chosenIndices[barNumber] = chordIndex;

        this.updateFollowingBars(barNumber);
    }

    //re-ranks every bar after barNumber, based on the chord chosen in the bar before it.
    //bars where the user already picked a chord keep that chord (its index is updated after sorting),
    //the other bars use their best ranked chord, which then affects the ranking of the next bar.
    updateFollowingBars(barNumber){
        for (let bar = barNumber + 1; bar < this.numOfBars; bar++) {
            const userChoice = this.chosenIndices[bar] >= 0 ? this.chosenChords[bar] : null;

            [this.chords[bar], this.scores[bar]] = this.reSort(bar);

            if (userChoice) {
                this.chosenIndices[bar] = this.chords[bar].indexOf(userChoice);
                this.chosenChords[bar] = userChoice;
            } else {
                this.chosenIndices[bar] = -1;
                this.chosenChords[bar] = this.chords[bar][0];
            }
        }
    }
    
    getChordStrings(){
        
        const strings = this.chords.map(chordList =>
            (chordList.map(chord => chord.toString())).slice(0, 5)
        );
        return strings;

    }

    initChordsFromMelody(bars){

        for (let i = 0; i < this.numOfBars; i++) {
            let myNotes = Note.notesFactory(bars[0][i]);
            let myDurations = bars[1][i];
            [this.chords[i],this.scores[i]] = Harmonizer.scoreChords(myNotes,myDurations);
            this.chosenChords[i] = this.chords[i][0];
            this.chosenIndices[i] = -1;
        }
        // take the chord progression into account from the start, not only after the first click
        this.updateFollowingBars(0);
    }

    //returns the chords available at the current complexity level
    static candidateChords() {
        const enums = [Enums.DiatonicChords];
        // each complexity level adds one more family of chords
        if (Chord.complexity >= 1) enums.push(Enums.SecondaryDominants);
        if (Chord.complexity >= 2) enums.push(Enums.Relatedm7OfSecondaryDominants);
        if (Chord.complexity >= 3) enums.push(Enums.SubstituteDominants);
        if (Chord.complexity >= 4) enums.push(Enums.Relatedm7OfSubstituteDominants);
        return enums.flatMap(chordEnum => Object.values(chordEnum));
    }

    //scores all candidate chords against the notes of one bar and returns [sortedChords, sortedScores]
    //chords scoring below the threshold are dropped, but at least one chord is always returned
    static scoreChords(notes,durations) {
        const thresh = 0.4;
        const scored = Harmonizer.candidateChords()
            .map(chord => ({ chord, score: chord.calculateChordScore(notes, durations) }))
            .sort((a, b) => b.score - a.score);

        let kept = scored.filter(item => item.score > thresh);
        if (kept.length === 0) {
            kept = scored.slice(0, 1); // nothing fits well: still offer the least bad chord
        }
        return [kept.map(item => item.chord), kept.map(item => item.score)];
    }
    
    //bonus points for moving from previousChord to chord
    static progressionBonus(previousChord, chord) {
        if (!previousChord) {
            return 0;
        }
        return (previousChord.isFifthDownFrom(chord) ? 1 : 0)   // root moves up a fifth / down a fourth (e.g. IV -> I)
             + (chord.isFifthDownFrom(previousChord) ? 1 : 0)   // root moves down a fifth (e.g. II -> V)
             + (previousChord.resolvesTo(chord) ? 1 : 0);       // dominant resolution (e.g. V7 -> I, subV7 -> I)
    }
    
    reSort(barNumber){
        const chords = this.chords[barNumber];
        const melodyNotes = Note.notesFactory(this.melody[barNumber]);
        const noteDurations =this.durations[barNumber];
        const previousChord = this.chosenChords[barNumber-1];
        const isLastBar = this.numOfBars == barNumber+1;

        const chordScores = chords.map(chord => ({
            chord,
            score: chord.calculateChordScore(melodyNotes, noteDurations, Harmonizer.progressionBonus(previousChord, chord), isLastBar)
        }));
    
        // Sort chords in descending order based on scores
        const sortedChords = chordScores.sort((a, b) => b.score - a.score);
    
        // Extract chords and scores separately
        const sortedChordArray = sortedChords.map(item => item.chord);
        const sortedScoreArray = sortedChords.map(item => item.score);
    
        return [sortedChordArray, sortedScoreArray];
    }
    
    static splitToBars(values, durations, barLength) {
        let acc = 0; // accumulator
        let barNumber = 0;
        let outValues = [[]]; // Initialize with an empty array for the first bar
        let outDurations = [[]]; // Initialize with an empty array for the first bar
        
        // Copy the values and durations arrays and reverse them
        let valuesStack = [...values].reverse();
        let durationsStack = [...durations].reverse();
    
        while (valuesStack.length > 0) {
            const currentValue = valuesStack.pop();
            const currentDuration = durationsStack.pop();

            if(!Number.isFinite(currentDuration) || currentDuration <= 0){
                console.warn('skipping note with invalid duration', currentValue, currentDuration);
                continue;
            }
    
            if(acc+currentDuration>barLength){
                outValues[barNumber].push(currentValue);
                outDurations[barNumber].push(barLength-acc);
                valuesStack.push(currentValue);
                durationsStack.push(currentDuration-(barLength-acc));
                acc=0;
                barNumber++;
                outValues[barNumber]=[];
                outDurations[barNumber]=[];
            }else if(acc+currentDuration===barLength){
                outValues[barNumber].push(currentValue);
                outDurations[barNumber].push(currentDuration);
                acc=0;
                barNumber++;
                outValues[barNumber]=[];
                outDurations[barNumber]=[];
            }else { //acc+currentDuration<barLength
                outValues[barNumber].push(currentValue);
                outDurations[barNumber].push(currentDuration);
                acc+=currentDuration;
            }
    
            if(acc>barLength){
                console.log('something is wrong: accumulator greater than bar')
            }
        }
        if(outValues[barNumber].length ===0 ){
            outValues.splice(barNumber,1);
            outDurations.splice(barNumber,1);
        }
        return [outValues,outDurations];
    }
    
    static removeRests(bars) {
        let [myValues, myDurations] = bars;
    
        for (let i = 0; i < myValues.length; i++) {
            const indexesToRemove = [];
            for (let j = 0; j < myValues[i].length; j++) {
                if (myValues[i][j] === -1) {
                    indexesToRemove.push(j);
                }
            }
    
            // Remove rests from values and corresponding durations
            for (let k = indexesToRemove.length - 1; k >= 0; k--) {
                myValues[i].splice(indexesToRemove[k], 1);
                myDurations[i].splice(indexesToRemove[k], 1);
            }
        }
    
        return [myValues, myDurations];
    }
    
    
    // plays chords and melody together
    playChords(){
        // console.log("playing chords");
        Harmonizer.stopPlaying = false;

        const beatTime = 60/(this.bpm * 4);
    
        const c = new AudioContext();
        const g = c.createGain();
        const comp = c.createDynamicsCompressor();
        g.connect(comp);
        g.gain.value = 0.3;
        comp.connect(c.destination);
        const attack = 0.1;
    
        const chordDuration = this.barLength;

        function chordsToLines(chords){
            let roots =[];
            let fifths = [];
            let thirds = [];
            let sevenths = [];
            let times = [];
    
            chords.forEach((chord, i) => {
                let arr = chord.type.notes.map(note => note.getTransposed(Chord.key.value+chord.root.value,true));
    
                roots[i] = arr[0].value + 36;
                fifths[i] = arr[2].value + 48;
                thirds[i] = arr[1].value + 60;
                sevenths[i] = arr[3].value + 60;
    
                times.push(chordDuration);
            });
    
            return [roots,thirds,fifths,sevenths,times];
        }
    
        function playNote(note,time,type="sine",peak=0.2) {
            const o = c.createOscillator();
            const freq = 440 * ( 2**((note-69)/12) ); //freq = 440*2^((n-69)/12)
            const myG = c.createGain();
            o.frequency.value = freq;
            o.type = type;
            o.connect(myG);
            
            myG.gain.value=0;
            o.connect(myG);
            myG.connect(g);
            myG.gain.setValueAtTime(0,c.currentTime);
            myG.gain.linearRampToValueAtTime(peak,c.currentTime + attack);
            myG.gain.linearRampToValueAtTime(0,c.currentTime + (time*beatTime) );
            o.start(c.currentTime);
            o.stop(c.currentTime + time*beatTime);
        }
        
        function playLine(notes,times,i=0,type="sine",peak=0.2) {
            if(notes[i] != -1){
                playNote(notes[i],times[i],type,peak);
            }
            if ((i< notes.length-1) && (Harmonizer.stopPlaying != true)) {                
                setTimeout(() => playLine(notes,times,i+1,type,peak), times[i]*1000*beatTime);
            }             
        }
    
        let [roots,thirds,fifths,sevenths,times] = chordsToLines(this.chosenChords);
    
        playLine(this.melodyPB,this.durationsPB,0,"triangle",0.6);
        playLine(roots,times);
        playLine(thirds,times);
        playLine(fifths,times);
        playLine(sevenths,times);
    
    }
    stopChords(){
        Harmonizer.stopPlaying = true;
    }
}