import Harmonizer from "./Harmonizer.js";
import MelodyModel from "./input/MelodyModel.js";
import PianoRoll from "./input/PianoRoll.js";
import { StepEntry, LENGTHS, attachKeyboard, connectMIDI } from "./input/stepEntry.js";
import { detectKey, STEPS_PER_BAR } from "./input/noteEvents.js";
import { PRESETS, presetNotes } from "./input/presets.js";
import { previewNote } from "./input/notePreview.js";

const STORAGE_KEY = "harmonizer.melody";
const KEY_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "Bb", "B/Cb"];

const tempo = document.getElementById("tempo");
const key = document.getElementById("key");
const complexity = document.getElementById("complexity");
const presetSelect = document.getElementById("presets");
const loadPresetButton = document.getElementById("loadPreset");
const lengthButtons = document.getElementById("lengths");
const dotButton = document.getElementById("dot");
const octaveDown = document.getElementById("octaveDown");
const octaveUp = document.getElementById("octaveUp");
const octaveLabel = document.getElementById("octave");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const clearButton = document.getElementById("clear");
const midiButton = document.getElementById("midi");
const status = document.getElementById("status");
const generate = document.getElementById("generate");
const play = document.getElementById("play");
const stop = document.getElementById("stop");
const canvas = document.getElementById("chord-grid-canvas");
const canvas_ctx = canvas.getContext("2d");

let harmonizer;

// ---- melody input ----

const model = new MelodyModel(loadSavedMelody());
const stepEntry = new StepEntry(model);
const roll = new PianoRoll(document.getElementById("pianoroll"), model, stepEntry, { onNote: previewNote });

attachKeyboard(window, stepEntry, { onNote: previewNote, onDelete: () => roll.deleteSelected() });

function loadSavedMelody() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveMelody() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // storage can be unavailable (private mode); the melody just isn't remembered
  }
}

LENGTHS.forEach(length => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = length.name;
  button.title = `${length.name} note (key ${length.key})`;
  button.dataset.steps = length.steps;
  button.addEventListener("click", () => stepEntry.setLength(length.steps));
  lengthButtons.appendChild(button);
});
dotButton.addEventListener("click", () => stepEntry.toggleDot());
octaveDown.addEventListener("click", () => stepEntry.setOctave(stepEntry.octave - 1));
octaveUp.addEventListener("click", () => stepEntry.setOctave(stepEntry.octave + 1));
undoButton.addEventListener("click", () => model.undo());
redoButton.addEventListener("click", () => model.redo());
clearButton.addEventListener("click", () => {
  model.clear();
  stepEntry.setCursor(0);
});

midiButton.addEventListener("click", async () => {
  const onNote = pitch => {
    stepEntry.insert(pitch);
    previewNote(pitch);
  };
  midiButton.disabled = true;
  const text = await connectMIDI(onNote, t => (midiButton.textContent = t));
  midiButton.textContent = text;
  midiButton.disabled = false;
});

PRESETS.forEach((preset, i) => presetSelect.add(new Option(preset.name, i)));
loadPresetButton.addEventListener("click", () => {
  const preset = PRESETS[presetSelect.value];
  model.set(presetNotes(preset));
  stepEntry.setCursor(model.end);
  tempo.value = preset.tempo;
  key.value = preset.key;
  const pitches = model.notes.map(n => n.pitch);
  roll.scrollToPitch((Math.min(...pitches) + Math.max(...pitches)) / 2);
  roll.scroller.scrollLeft = 0;
  updateStatus();
});

function updateToolbar() {
  [...lengthButtons.children].forEach(button =>
    button.classList.toggle("active", Number(button.dataset.steps) === stepEntry.baseLength));
  dotButton.classList.toggle("active", stepEntry.dotted);
  octaveLabel.textContent = stepEntry.octave;
  undoButton.disabled = !model.canUndo;
  redoButton.disabled = !model.canRedo;
}

function currentKey() {
  return key.value === "auto" ? detectKey(model.notes) ?? 0 : parseInt(key.value);
}

function updateStatus() {
  const detected = detectKey(model.notes);
  key.options[0].textContent = detected === null ? "Auto" : `Auto (${KEY_NAMES[detected]})`;
  const bars = Math.ceil(model.end / STEPS_PER_BAR);
  status.textContent = model.isEmpty
    ? "Empty melody: click the grid or type notes."
    : `${model.notes.length} notes, ${bars} bar${bars === 1 ? "" : "s"}`;
}

model.addEventListener("change", () => { saveMelody(); updateToolbar(); updateStatus(); });
stepEntry.addEventListener("change", updateToolbar);
updateToolbar();
updateStatus();

// ---- harmonizing ----

tempo.addEventListener("change", () => {
  if (harmonizer) harmonizer.bpm = parseInt(tempo.value) || 120;
});

generate.addEventListener("click", () => {
  if (model.isEmpty) {
    status.textContent = "Add some notes first.";
    return;
  }
  const { values, durations } = model.toSequence();
  harmonizer = new Harmonizer(currentKey(), values, durations, complexity.value, STEPS_PER_BAR, tempo.value);
  drawChordGrid();
});

play.addEventListener("click", () => harmonizer?.playChords());
stop.addEventListener("click", () => harmonizer?.stopChords());

// ---- chord grid (to be replaced by the chord lane) ----

let numRows = 5; // initial number
let numCols = 8; // initial number

let cellWidth = canvas.width/numCols;
let cellHeight = canvas.height/numRows;

const gridBorderColor = '#fff';
const chordTextColor = '#fff';
const cellColor = '#0e0a2a';
const chosenColor = '#2d3058';

function setGridParams() {
  const strings = harmonizer.getChordStrings();
  numRows = Math.max(1, ...strings.map(list => list.length));
  numCols = Math.max(1, strings.length);

  cellWidth = canvas.width / numCols;
  cellHeight = canvas.height / numRows;
}

function drawChordGrid() {
  setGridParams();
  canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
  const strings = harmonizer.getChordStrings();

  for (let col = 0; col < strings.length; col++) {
    for (let row = 0; row < strings[col].length; row++) {
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

      canvas_ctx.fillText(strings[col][row], x+cellWidth/2, y+cellHeight/2,cellWidth);

      // Draw cell border
      canvas_ctx.strokeStyle = gridBorderColor;
      canvas_ctx.strokeRect(x, y, cellWidth, cellHeight);
    }
  }
}

canvas.addEventListener("click", event => {
  if (!harmonizer) return;
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((event.clientX - rect.left) / cellWidth);
  const row = Math.floor((event.clientY - rect.top) / cellHeight);
  const strings = harmonizer.getChordStrings();
  if (strings[col] && strings[col].length > row) {
    harmonizer.chooseChord(col, row);
    drawChordGrid();
  }
});
