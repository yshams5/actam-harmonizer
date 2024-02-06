import Harmonizer from "./Harmonizer.js";
import Chord from './Chord.js';
import * as Enums from './Chord.js';
import Note from './Note.js'

let harmonizer;

// const nroNameDisplay = document.getElementById("nronamesdisplay");
// const nroDurationDisplay = document.getElementById("nrovaluesdisplay");
// const nrNameDisplay = document.getElementById("notenamesdisplay");
// const nrDurationDisplay = document.getElementById("durationdisplay");
// const nrIntegerDisplay = document.getElementById("noteintegerdisplay");

const tempoButton = document.getElementById("tempoButton");
const tempo = document.getElementById("tempo");
const pianoroll = document.getElementById("pianoroll");
const generate = document.getElementById("generate");
const play = document.getElementById("play");
const stop = document.getElementById("stop");
const clear = document.getElementById("clear");
const complexity = document.getElementById("complexity");
const key = document.getElementById("key"); 
const setMML = document.getElementById("setmml");
const presetSong = document.getElementById("presets");
const canvas = document.getElementById('chord-grid-canvas');
const canvas_ctx = canvas.getContext('2d');


const audio_ctx = new AudioContext();
const osc = audio_ctx.createOscillator();
const gain = audio_ctx.createGain();
gain.gain.value = 0;
osc.type = "sine";
osc.start();
osc.connect(gain).connect(audio_ctx.destination);
let substring, nroNames, notesarray, mml, nroValues = [], noteinteger = [], nrDurations = [], nrNames = [];




//control
tempoButton.addEventListener("click", setTempo);

generate.addEventListener("click", generateClick);

play.addEventListener("click", playClick);

stop.addEventListener("click", stopClick);

clear.addEventListener("click", clearClick);

setMML.addEventListener("click", setPresetSong);

//model

function Callback(ev){
  osc.detune.setValueAtTime((ev.n-69)*100,ev.t);
  gain.gain.setTargetAtTime(0.5,ev.t,0.005);
  gain.gain.setTargetAtTime(0,ev.g,0.001);
}
         
function setPresetSong()
{
  if(presetSong.value=="0"){
    pianoroll.markend="144";
    pianoroll.setMMLString("t74o4l8r2.o5c4o4a4.r4ao5cdo4g4.r4.gab-4o5f4rfecdc16o4b-16a4r4.o5cddrd16r16g16fef16dc4r4o4fgao5dc4rco4b-a8.r16ef4.");
    tempo.value="74";
    key.value="5";
  }
  if(presetSong.value=="1"){
    pianoroll.markend="128";
    pianoroll.setMMLString("t120o4l8o5d-4.e-4.o4a-4o5e-4.f4.a-16g-16fd-4.e-4.o4a-4.r2a-16a-16b-16o5d-8.d-4.e-4.o4a-4o5e-4.f4.a-16g-16fd-4.e-4.o4a-4.");
    tempo.value="114";
    key.value="1";
  }
  if(presetSong.value=="2"){
    pianoroll.markend="144";
    pianoroll.setMMLString("t117o4l8r4o5d-dd-4o4b4a1r4o5d-dd-4o4b4a1raao5d-4d4o4a4aao5d4d-4o4b4bao5d-ro4a4a4");
    tempo.value="119";
    key.value="9";
  }
}

function setTempo()
{
pianoroll.tempo=tempo.value;
if(harmonizer){harmonizer.bpm = tempo.value;}
}

function playClick()
{
// if (play.innerText=="Play") 
//   {
//     audio_ctx.resume();
//     play.innerText = "Pause";
//     pianoroll.play(audio_ctx, Callback);
//   }
// else
//   {
//     play.innerText = "Play";
//     pianoroll.stop();
//   }
  harmonizer.playChords();
}

function stopClick()
{
  // pianoroll.stop();
  // pianoroll.locate(0);
  // play.innerText = "Play";
  harmonizer.stopChords();
}

function clearClick()
{
  //location.reload();
 window.location.replace(window.location.href);
}
  
function generateClick()
{
  // nroNameDisplay.textContent = pianoroll.getMMLString();
  mml = pianoroll.getMMLString();
  //notesarray = mml.match(/[a-g-]+|r(?:2|4|8|16|2.|4.|8.|16.|2..|4..|8..|16..)|cr/g);
  initialMMLSlice();
  notesarray = substring.match(/((\w\d\.)|(\w-\d\.)|(\w\d\d)|(\w\d)|(\w-\d\d)|(\w-\d)|(\w-)|(\w))/g);
  //notesarray = parseString(mml);
  //notes.textContent = mml;
  nroNames = parseNotes();
  nroValues = parseDuration();
  nrDurations = parseValues();
  noteinteger = notesToInteger();
  // nroNameDisplay.textContent = "Notes/Rests/Octaves: " + nroNames;
  // nroDurationDisplay.textContent = "Note/Rests/Octave Values: " +nroValues;
  // nrNameDisplay.textContent = "Note/Rests names: " + nrNames;
  // nrDurationDisplay.textContent = "Note/Rests Duration: " + nrDurations;
  // nrIntegerDisplay.textContent = "Integer value of the Notes/Rests: " +noteinteger;
  

  harmonizer = new Harmonizer(key.value,noteinteger,nrDurations,complexity.value,16,tempo.value);
  console.log(harmonizer);
  drawChordGrid();
  
}

function initialMMLSlice()
{
  if (tempo.value<100)
  {
    substring = mml.slice(7);
  }
  else
  {
    substring = mml.slice(8);
  }
}

function parseNotes() 
//Gets note names from mml, adds octave info and stores them in notesarray
{
  let notename = [], octave = "/4";
  for(let i = 0;i<notesarray.length;i++)
  {
    notename[i] = notesarray[i].replace(/-/g, 'b'); // changing - to flat sign
    notename[i] = notename[i].match(/(\wb)|[a-z]/g); //extracting the note name
    //notename[i] = notename[i]+octave; //adding octave info for EasyScore sheet notation
    //need to take care of octaves and rests
    //flat notes 8th note bug
  }
  return notename;
}

function parseDuration() 
//Gets note duration from mml, replaces null with 8th notes, 4th notes with q, and stores them in notesarray
{
  let noteduration = [];
  for(let i = 0;i<notesarray.length;i++)
  {
    noteduration[i] = notesarray[i].match(/(\d\.)|(\d\d)|(\d)/g);
    if (noteduration[i]==null)
    {
      noteduration[i] = "8"; //since 8th note is the default value, mml doesn't explicitly specify it
    }
    /*
    else
    if (noteduration[i]=="4")
    {
      noteduration[i] = "q"; //In Easyscore, 4th notes need to be specified as q 
    }
    */
  }
  //valuenoteValueser();
  return noteduration;
}
  
function parseValues()
//Converts notes into the length occupied by them. 16th notes = 1 is the default.
{
  let notevalues = [];
  for(let i = 0;i<nroValues.length;i++)
  {
    if(nroValues[i]=="16")
    {
      notevalues[i]=1;
    }
    else
    if(nroValues[i]=="8")
    {
      notevalues[i]=2;
    }
    else
    if(nroValues[i]=="8.")
    {
      notevalues[i]=3;
    }
    else
    if(nroValues[i]=="4")
    {
      notevalues[i]=4;
    }
    else
    if(nroValues[i]=="4.")
    {
      notevalues[i]=6;
    }
    else
    if(nroValues[i]=="2")
    {
      notevalues[i]=8;
    }
    else
    if(nroValues[i]=="2.")
    {
      notevalues[i]=12;
    }
    else
    if(nroValues[i]=="1")
    {
      notevalues[i]=16;
    }
  }
  return notevalues;
}

function notesToInteger()
//Converts notes in alphabets to integer values. Rest = -1. 
//Octaves are not considered when storing into the integer array but their values are used in computing the value.
{
  let noteinteger = [], octave = 4;
  for(let i = 0;i<nroNames.length;i++)
  {
    // console.log(nroNames[i]);
    if(nroNames[i]=='c')
    {
      noteinteger[i] = 0+12*(octave+1);
    }
    else
    if(nroNames[i]=='db')
    {
      noteinteger[i] = 1+12*(octave+1);
    }
    else
    if(nroNames[i]=='d')
    {
      noteinteger[i] = 2+12*(octave+1);
    } 
    else
    if(nroNames[i]=='eb')
    {
      noteinteger[i] = 3+12*(octave+1);
    } 
    else
    if(nroNames[i]=='e')
    {
      noteinteger[i] = 4+12*(octave+1);
    } 
    else
    if(nroNames[i]=='f')
    {
      noteinteger[i] = 5+12*(octave+1);
    }
    if(nroNames[i]=='gb')
    {
      noteinteger[i] = 6+12*(octave+1);
    } 
    else
    if(nroNames[i]=='g')
    {
      noteinteger[i] = 7+12*(octave+1);
    } 
    else
    if(nroNames[i]=='ab')
    {
      noteinteger[i] = 8+12*(octave+1);
    } 
    else
    if(nroNames[i]=='a')
    {
      noteinteger[i] = 9+12*(octave+1);
    }
    if(nroNames[i]=='bb')
    {
      noteinteger[i] = 10+12*(octave+1);
    } 
    else
    if(nroNames[i]=='b')
    {
      noteinteger[i] = 11+12*(octave+1);
    }
    else
    if(nroNames[i]=='o')
    {
      noteinteger[i] = '';
      octave = parseInt(nroValues[i]);
    }
    else
    if(nroNames[i]=='r')
    {
      noteinteger[i]=-1;
    }
  }
  noteinteger=removeOctaves(noteinteger);
  return noteinteger;
}

function removeOctaves(nrIntegers)
//Stores only Notes and Rest informations on noteinteger, noteDuration and nroNames
{
  
  let tempnoteint = [], tempduration = [], tempnote = [];
  for(let i=0;i<nrIntegers.length;i++)
  {
    if((nrIntegers[i]!='')&&(nrIntegers[i]!=null))
    {
      tempnoteint.push(nrIntegers[i]);
      tempduration.push(nrDurations[i]);
      tempnote.push(nroNames[i]);
      /*
      tempnote.push(notename[i]);
      tempnotevalue.push(notevalues[i]);
      */
    }
  }

  nrIntegers.length=0;
  nrIntegers.push(...tempnoteint); //... is called the spread syntax. Spread syntax "expands" an array into its elements

  nrDurations.length=0;
  nrDurations.push(...tempduration);

  nrNames.length=0;
  nrNames.push(...tempnote);
/*
  notename.length=0;
  notename.push(...tempnote);

  notevalues.length=0;
  notevalues.push(...tempnotevalue);
*/

return nrIntegers;
}


let numRows = 5; // initial number
let numCols = 8; // initial number

let cellWidth = canvas.width/numCols;
let cellHeight = canvas.height/numRows;

const gridBorderColor = '#fff';
const chordTextColor = '#fff';
const cellColor = '#0e0a2a';
const chosenColor = '#2d3058';



function setGridParams() {
  let maxRows = 0;
  for (let i = 0; i < harmonizer.getChordStrings().length; i++) {
    if (harmonizer.getChordStrings()[i].length > maxRows) {
      maxRows = harmonizer.getChordStrings()[i].length;
    }
  }
  numRows = maxRows;
  numCols = harmonizer.getChordStrings().length;

  cellWidth = canvas.width / numCols;
  cellHeight = canvas.height / numRows;
}

function drawChordGrid() {

  // canvas.style.display = "block";
  setGridParams();
  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let col = 0; col < harmonizer.getChordStrings().length; col++) {
    for (let row = 0; row < harmonizer.getChordStrings()[col].length; row++) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      const chosen = harmonizer.chosenIndices[col] === row;

      // Draw cell background
      canvas_ctx.fillStyle = chosen ? chosenColor : cellColor;
      canvas_ctx.fillRect(x, y, cellWidth, cellHeight);
      
      canvas_ctx.fillStyle = chordTextColor;
      canvas_ctx.font = '24px Gill Sans, Gill Sans MT, Calibri, Trebuchet MS, sans-serif';
      canvas_ctx.textBaseline = "middle";
      canvas_ctx.textAlign = "center";
      
      canvas_ctx.fillText(harmonizer.getChordStrings()[col][row], x+cellWidth/2, y+cellHeight/2,cellWidth);
      
      // Draw cell border
      canvas_ctx.strokeStyle = gridBorderColor;
      canvas_ctx.strokeRect(x, y, cellWidth, cellHeight);
    }
  }
      
}
      
// Event listener for canvas clicks
canvas.addEventListener("click", (event) => {canvasClick(event);});

function canvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  // Calculate the clicked cell
  const col = Math.floor(mouseX / cellWidth) ;
  const row = Math.floor(mouseY / cellHeight);
  if (harmonizer.getChordStrings()[col].length > row) {
    chooseChord(col, row);


    drawChordGrid();
  }
}

function chooseChord(barNumber,chordIndex){
    harmonizer.chooseChord(barNumber,chordIndex);
}


/*

function barnoteValueser()
{
 
  var sum = 0
  var bLen = 16 // bar length = 4 beats
  let i,j = 0 // noteValuesers
  for(i=0; i<noteduration.length; i++)
  {
    if (sum < bLen)
    {
    output[sum][j].push(notename[i]);
    sum += noteValues[i];
    }
    else 
    if(sum==bLen) 
    {
      output[sum][j].push(notename[i]);
      sum = 0;
      j++;
    } 
    else
    {
      output[sum][j].push(notename[i]);
      j++;
      output[sum][j].push(notename[i]);
      sum+=noteValues[i] - bLen;
    }
  }
}

// Function to display the 2D array in HTML
function displayArray(array) {
  var container = document.getElementById('arrayDisplayContainer');
  var table = document.createElement('table');

  for (var i = 0; i < array.length; i++) {
      var row = document.createElement('tr');

      for (var j = 0; j < array[i].length; j++) {
          var cell = document.createElement('td');
          cell.textContent = array[i][j];
          row.appendChild(cell);
      }

      table.appendChild(row);
  }

  container.appendChild(table);
}

//view


// Call the function with the example array
displayArray(twoDArray);
staveMeasure1.addClef("treble").setContext(context).draw();

const notesMeasure1 = [new StaveNote({ keys: ["c/4"], duration: "q" }), new StaveNote({ keys: ["d/4"], duration: "q" }), new StaveNote({ keys: ["b/4"], duration: "qr" }), new StaveNote({ keys: ["c/4", "e/4", "g/4"], duration: "q" })];

// Helper function to justify and draw a 4/4 voice
Formatter.FormatAndDraw(context, staveMeasure1, notesMeasure1);

// Measure 2 - second measure is placed adjacent to first measure.
const staveMeasure2 = new Stave(staveMeasure1.width + staveMeasure1.x, 0, 400);

const notesMeasure2_part1 = [new StaveNote({ keys: ["c/4"], duration: "8" }), new StaveNote({ keys: ["d/4"], duration: "8" }), new StaveNote({ keys: ["b/4"], duration: "8" }), new StaveNote({ keys: ["c/4", "e/4", "g/4"], duration: "8" })];

const notesMeasure2_part2 = [new StaveNote({ keys: ["c/4"], duration: "8" }), new StaveNote({ keys: ["d/4"], duration: "8" }), new StaveNote({ keys: ["b/4"], duration: "8" }), new StaveNote({ keys: ["c/4", "e/4", "g/4"], duration: "8" })];

// Create the beams for 8th notes in second measure.
const beam1 = new Beam(notesMeasure2_part1);
const beam2 = new Beam(notesMeasure2_part2);

const notesMeasure2 = notesMeasure2_part1.concat(notesMeasure2_part2);

staveMeasure2.setContext(context).draw();
Formatter.FormatAndDraw(context, staveMeasure2, notesMeasure2);

// Render beams
beam1.setContext(context).draw();
beam2.setContext(context).draw();
*/