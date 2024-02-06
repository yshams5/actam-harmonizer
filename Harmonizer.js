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

    chooseChord(barNumber,chordIndex){

        this.chosenChords[barNumber] = this.chords[barNumber][chordIndex];
        this.chosenIndices[barNumber] = chordIndex;

        
        if(barNumber < this.numOfBars - 1){
            let [sortedChords,sortedScores] = this.reSort(barNumber+1);
            this.chords[barNumber + 1] = sortedChords;
            this.scores[barNumber + 1] = sortedScores;
            this.chosenIndices[barNumber+1]=-1;
            this.chosenChords[barNumber+1]=this.chords[barNumber+1][0];
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
            let myChords = Harmonizer.scoreChords(myNotes,myDurations);
            [this.chords[i],this.scores[i]] = Harmonizer.calculateAndSortChords(myChords.flat(),myNotes,myDurations);
            this.chosenChords[i] = this.chords[i][0];
            this.chosenIndices[i] = -1;
            
        }
    }

    static scoreChords(notes,durations) {
        let myChords = [];
        const thresh = 0.4;
        function scoreChordsFromEnum(chordEnum, notes,durations) {
            let recommendedChords = [];
        
            Object.keys(chordEnum).forEach(key => {
                const chord = chordEnum[key];
                const score = chord.calculateChordScore(notes,durations);
                
                if (score>thresh) {
                    recommendedChords.push(chord);
                }
            });
            myChords.push(recommendedChords);
            return recommendedChords;
        }
        let diatonicChords =[];
        let secondaryDominants =[]; 
        let relatedm7SecondaryDominants =[]; 
        let substituteDominants =[]; 
        let relatedm7SubstituteDominants =[];
    
        switch (Chord.complexity) {
            case 4:
                relatedm7SubstituteDominants = scoreChordsFromEnum(Enums.Relatedm7OfSubstituteDominants, notes, durations);
            case 3:
                substituteDominants = scoreChordsFromEnum(Enums.SubstituteDominants, notes, durations);
            case 2:
                relatedm7SecondaryDominants = scoreChordsFromEnum(Enums.Relatedm7OfSecondaryDominants, notes, durations);
            case 1:
                secondaryDominants = scoreChordsFromEnum(Enums.SecondaryDominants, notes, durations);       
            default:
                diatonicChords = scoreChordsFromEnum(Enums.DiatonicChords, notes, durations);
                break;
        }
        return myChords;
        
    }
    
    static calculateAndSortChords(chords, melodyNotes, noteDurations) {
        const chordScores = chords.map(chord => ({
            chord,
            score: chord.calculateChordScore(melodyNotes, noteDurations)
        }));
    
        // Sort chords in descending order based on scores
        const sortedChords = chordScores.sort((a, b) => b.score - a.score);
    
        // Extract chords and scores separately
        const sortedChordArray = sortedChords.map(item => item.chord);
        const sortedScoreArray = sortedChords.map(item => item.score);
    
        return [sortedChordArray, sortedScoreArray];
    }
    
    reSort(barNumber){
        const chords = this.chords[barNumber];
        const melodyNotes = Note.notesFactory(this.melody[barNumber]);
        const noteDurations =this.durations[barNumber];
        const previousChord = this.chosenChords[barNumber-1];
        const isLastBar = this.numOfBars == barNumber+1;

        const chordScores = chords.map(chord => ({
            chord,
            score: (chord.calculateChordScore(melodyNotes, noteDurations,( (previousChord.isFifthDownFrom(chord)?1:0) +(chord.isFifthDownFrom(previousChord)?1:0) + (previousChord.resolvesTo(chord)?1:0) ),isLastBar) 
            ) 
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


/*  Testing Functions

function testTranspose(){
    console.log('Transpose Test');
    let myKey = new Note(4);
    let values = [0,2,4,7]; //C D E G
    let notes = Note.notesFactory(values);              // make note objects
    console.log(notes.map(note => note.toString()));    // C D E G
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey);     
    });
    console.log(notes.map(note => note.toString()));    //E F# G# B
}

function testSplitToBars() {
    console.log('Test splitting an array of notes into multiple bars');

    // Generate random note values and durations
    let values = [];
    let durations = [];
    const numNotes = 20; // You can adjust this number

    for (let i = 0; i < numNotes; i++) {
        // Random note values between 0 and 12
        values.push(Math.floor(Math.random() * 13)-1);

        // Random durations between 1 and 8 (you can adjust this range)
        durations.push(Math.floor(Math.random() * 50)/10);
    }

    // Test the splitToBars function
    const barLength = 4; // You can adjust this value
    const result = splitToBars(values, durations, barLength);
    removeRests(result);
    // Display the original values and durations
    console.log('Original Values:', values);
    console.log('Original Durations:', durations);

    // Display the result of splitToBars
    console.log('Split Values:', result[0]);
    console.log('Split Durations:', result[1]);
}



function testChordOptions(){
    console.log('Test chord options based on some notes:');
    // set to the key of E
    let myKey = new Note(4);
    Chord.setKey(myKey); 
    // create array of note values
    let values = [0,2,4,7]; //c d e g
    // make note objects
    let notes = Note.notesFactory(values);
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey,true);     
    });
    let chords = recommendChord(notes);
    console.log(chords)  
    let durations = [0.5,1,1,0.5];
    let [sortedChords,scores] = calculateAndSortChords(chords[0],notes,durations);
    console.log(sortedChords);
    console.log(scores);
    
    
    let testString = 'Key:' + myKey.toString() + '<br>' + notes + 
        '<br>Diatonic Chords: ' + chords[0] + 
        '<br>Secondary Dominant Chords: ' + chords[1] + 
        '<br>Related minor 7th of Secondary Dominants: ' + chords[2] + 
        '<br>Substitute Dominants: '+ chords[3] +
        '<br>Related minor 7th of Substitute Dominants: ' + chords[4];

    document.getElementById("demo").innerHTML = testString;
}

function testChordScore(){
    let myKey = new Note(5);
    Chord.setKey(myKey); 
    // create array of note values
    let values = [0,2,4,7]; //c d e g
    // make note objects
    let notes = Note.notesFactory(values);
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey);     
    });
    let chords = recommendChord(notes);
    console.log(chords) ;
    let durations = [0.5,1,1,0.5];
    let [sortedChords,scores] = calculateAndSortChords(chords.flat(),notes,durations);
    console.log(sortedChords);
    console.log(scores);

    let testString = 'Key: ' + myKey.toString() +
        '<br>Notes: '+ notes.map(note => note.toString()) +
        '<br>Durations: '+ durations;

    //sortedChords.forEach(entry => '<br>' entry.chord.toString() + ': ' + entry.score);
    sortedChords.forEach(entry => {
        testString += '<br>' + entry.chord.toString() + ': ' + Math.round(entry.score * 100) / 100;
    });

    document.getElementById("demo").innerHTML = testString;
}

function testResolvedPairs(){
    Chord.setKey(0);
    let list1 = [Enums.DiatonicChords.Imaj7,Enums.DiatonicChords.V7_I,Enums.SecondaryDominants.V7_II,Enums.SubstituteDominants.subV7_II];
    let list2 = [Enums.DiatonicChords.Imaj7,Enums.DiatonicChords.IIm7,Enums.DiatonicChords.IVMaj7,Enums.SubstituteDominants.subV7_IV];

    let resolutions = findResolvingPairs(list1,list2);
    console.log(resolutions);
}


function testMelodyToChordOptions(){
    console.log('Testing everything from melody input to chord suggestions and scores');
    let inputValues =       [-1,60,57, -1, 57, 60, 62,55,-1, 55, 57,58, 65, 65, 64, 60, 62,  60,  58,57]; //hey jude
    let inputDurations =    [ 3, 1, 2,0.5,0.5,0.5,0.5, 2, 1,0.5,0.5, 1,1.5,0.5,0.5,0.5,0.5,0.25,0.25, 3];
    let myKey = new Note(5)
    let barLength = 4;
    let complexity = 0;
    Chord.setComplexity(complexity);
    let [chords,scores] =initChordsFromMelody(inputValues,inputDurations,myKey,barLength);
    console.log(chords);
    console.log(scores);
    let testString = 'Key:' + myKey.toString() + '<br> Hey Jude' +
        '<br>Complexity:' + complexity +
        '<br>Bar 0 : ' + chords[0] + 
        '<br>Bar 1 : ' + chords[1] + 
        '<br>Bar 2 : ' + chords[2] + 
        '<br>Bar 3 : ' + chords[3] +
        '<br>Bar 4 : ' + chords[4];

    document.getElementById("demo").innerHTML = testString;
}





function testTranspose(){
    console.log('Transpose Test');
    let myKey = new Note(4);
    let values = [0,2,4,7]; //C D E G
    let notes = Note.notesFactory(values);              // make note objects
    console.log(notes.map(note => note.toString()));    // C D E G
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey);     
    });
    console.log(notes.map(note => note.toString()));    //E F# G# B
}

function testSplitToBars() {
    console.log('Test splitting an array of notes into multiple bars');

    // Generate random note values and durations
    let values = [];
    let durations = [];
    const numNotes = 20; // You can adjust this number

    for (let i = 0; i < numNotes; i++) {
        // Random note values between 0 and 12
        values.push(Math.floor(Math.random() * 13)-1);

        // Random durations between 1 and 8 (you can adjust this range)
        durations.push(Math.floor(Math.random() * 50)/10);
    }

    // Test the splitToBars function
    const barLength = 4; // You can adjust this value
    const result = splitToBars(values, durations, barLength);
    removeRests(result);
    // Display the original values and durations
    console.log('Original Values:', values);
    console.log('Original Durations:', durations);

    // Display the result of splitToBars
    console.log('Split Values:', result[0]);
    console.log('Split Durations:', result[1]);
}


function testChordOptions(){
    console.log('Test chord options based on some notes:');
    // set to the key of E
    let myKey = new Note(4);
    Chord.setKey(myKey); 
    // create array of note values
    let values = [0,2,4,7]; //c d e g
    // make note objects
    let notes = Note.notesFactory(values);
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey,true);     
    });
    let chords = recommendChord(notes);
    console.log(chords)  
    let durations = [0.5,1,1,0.5];
    let [sortedChords,scores] = calculateAndSortChords(chords[0],notes,durations);
    console.log(sortedChords);
    console.log(scores);
    
    
    let testString = 'Key:' + myKey.toString() + '<br>' + notes + 
        '<br>Diatonic Chords: ' + chords[0] + 
        '<br>Secondary Dominant Chords: ' + chords[1] + 
        '<br>Related minor 7th of Secondary Dominants: ' + chords[2] + 
        '<br>Substitute Dominants: '+ chords[3] +
        '<br>Related minor 7th of Substitute Dominants: ' + chords[4];

    document.getElementById("demo").innerHTML = testString;
}

function testChordScore(){
    let myKey = new Note(5);
    Chord.setKey(myKey); 
    // create array of note values
    let values = [0,2,4,7]; //c d e g
    // make note objects
    let notes = Note.notesFactory(values);
    // transpose the notes to key of E
    notes.forEach(note => {
        note.transpose(myKey);     
    });
    let chords = recommendChord(notes);
    console.log(chords) ;
    let durations = [0.5,1,1,0.5];
    let [sortedChords,scores] = calculateAndSortChords(chords.flat(),notes,durations);
    console.log(sortedChords);
    console.log(scores);

    let testString = 'Key: ' + myKey.toString() +
        '<br>Notes: '+ notes.map(note => note.toString()) +
        '<br>Durations: '+ durations;

    //sortedChords.forEach(entry => '<br>' entry.chord.toString() + ': ' + entry.score);
    sortedChords.forEach(entry => {
        testString += '<br>' + entry.chord.toString() + ': ' + Math.round(entry.score * 100) / 100;
    });

    document.getElementById("demo").innerHTML = testString;
}

function testResolvedPairs(){
    Chord.setKey(0);
    let list1 = [Enums.DiatonicChords.Imaj7,Enums.DiatonicChords.V7_I,Enums.SecondaryDominants.V7_II,Enums.SubstituteDominants.subV7_II];
    let list2 = [Enums.DiatonicChords.Imaj7,Enums.DiatonicChords.IIm7,Enums.DiatonicChords.IVMaj7,Enums.SubstituteDominants.subV7_IV];

    let resolutions = findResolvingPairs(list1,list2);
    console.log(resolutions);
}


function testMelodyToChordOptions(){
    console.log('Testing everything from melody input to chord suggestions and scores');
    let inputValues =       [-1,60,57, -1, 57, 60, 62,55,-1, 55, 57,58, 65, 65, 64, 60, 62,  60,  58,57]; //hey jude
    let inputDurations =    [ 3, 1, 2,0.5,0.5,0.5,0.5, 2, 1,0.5,0.5, 1,1.5,0.5,0.5,0.5,0.5,0.25,0.25, 3];
    let myKey = new Note(5)
    let barLength = 4;
    let complexity = 0;
    Chord.setComplexity(complexity);
    let [chords,scores] =initChordsFromMelody(inputValues,inputDurations,myKey,barLength);
    console.log(chords);
    console.log(scores);
    let testString = 'Key:' + myKey.toString() + '<br> Hey Jude' +
        '<br>Complexity:' + complexity +
        '<br>Bar 0 : ' + chords[0] + 
        '<br>Bar 1 : ' + chords[1] + 
        '<br>Bar 2 : ' + chords[2] + 
        '<br>Bar 3 : ' + chords[3] +
        '<br>Bar 4 : ' + chords[4];

    document.getElementById("demo").innerHTML = testString;
}
*/

/* unused function

function findResolvingPairs(list1, list2) {
    const resolutions = [];

    list1.forEach(chord1 => {
        list2.forEach(chord2 => {
            if (chord1.resolvesTo(chord2)) {
                resolutions.push({ dominant: chord1, resolution: chord2 });
            }
        });
    });

    return resolutions;
}
*/

/* Old function

function recommendChords(notes,allowAvoid=false) {
    let chords = [];

    function recommendChordsFromEnum(chordEnum, notes) {
        let recommendedChords = [];
    
        Object.keys(chordEnum).forEach(key => {
            const chord = chordEnum[key];
            if (chord.allows(notes,allowAvoid)) {
                recommendedChords.push(chord);
            }
        });
        chords.push(recommendedChords);
        return recommendedChords;
    }

    const diatonicChords = recommendChordsFromEnum(Enums.DiatonicChords, notes);
    const secondaryDominants = recommendChordsFromEnum(Enums.SecondaryDominants, notes);
    const relatedm7SecondaryDominants = recommendChordsFromEnum(Enums.Relatedm7OfSecondaryDominants, notes);
    const substituteDominants = recommendChordsFromEnum(Enums.SubstituteDominants, notes);
    const relatedm7SubstituteDominants = recommendChordsFromEnum(Enums.Relatedm7OfSubstituteDominants, notes);

    return chords;
}

*/