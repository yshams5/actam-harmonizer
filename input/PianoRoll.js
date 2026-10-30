import { STEPS_PER_BAR, pitchName } from './noteEvents.js';

const KEY_W = 46;      // width of the piano keys column
const RULER_H = 22;    // height of the bar number ruler
const ROW_H = 14;      // height of one semitone row
const STEP_W = 18;     // width of one 16th note
const LOW = 36;        // lowest pitch shown (C2)
const HIGH = 95;       // highest pitch shown (B6)
const EDGE = 6;        // grab zone at the end of a note for resizing, in px

const isBlackKey = pitch => [1, 3, 6, 8, 10].includes(pitch % 12);

// Piano roll editor drawn from a MelodyModel.
// - click on an empty spot: add a note (with the current step entry length); drag to change its length
// - drag a note: move it; drag its right edge: change its length
// - right click a note, or select it and press Delete: remove it
// - click the bar ruler: move the step entry cursor
// - click a piano key: hear the note
// The keys column and the ruler stay in place while the grid scrolls.
export default class PianoRoll {
    #drag = null;       // { mode: 'move' | 'resize', index, offset, start, moved, x }
    #draft = null;      // notes being edited during a drag, committed to the model on release
    #selected = null;   // { pitch, start } of the selected note
    #hover = null;      // { step, pitch } under the mouse

    constructor(container, model, stepEntry, { onNote = () => {}, minBars = 8 } = {}) {
        this.model = model;
        this.stepEntry = stepEntry;
        this.onNote = onNote;
        this.minBars = minBars;

        this.scroller = container;
        this.scroller.classList.add('roll');
        this.scroller.tabIndex = 0;   // focusable, so typed notes don't also trigger the last clicked button
        this.spacer = document.createElement('div');
        this.spacer.className = 'roll-spacer';
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'roll-canvas';
        this.canvas.setAttribute('role', 'img');
        this.canvas.setAttribute('aria-label', 'Piano roll melody editor');
        this.spacer.appendChild(this.canvas);
        this.scroller.appendChild(this.spacer);
        this.ctx = this.canvas.getContext('2d');

        model.addEventListener('change', () => this.draw());
        stepEntry.addEventListener('change', () => { this.#scrollCursorIntoView(); this.draw(); });
        // once the user types, Delete/Backspace should act on the typed notes, not on a note selected earlier
        stepEntry.addEventListener('entry', () => { this.#selected = null; });
        this.scroller.addEventListener('scroll', () => this.draw());
        new ResizeObserver(() => this.#resize()).observe(this.scroller);

        this.canvas.addEventListener('pointerdown', e => this.#pointerDown(e));
        this.canvas.addEventListener('pointermove', e => this.#pointerMove(e));
        this.canvas.addEventListener('pointerup', e => this.#pointerUp(e));
        this.canvas.addEventListener('pointercancel', () => { this.#drag = null; this.#draft = null; this.draw(); });
        this.canvas.addEventListener('pointerleave', () => { this.#hover = null; this.draw(); });
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.#resize();
        this.scrollToPitch(67);
    }

    // removes the selected note; returns false if nothing was selected
    deleteSelected() {
        const index = this.#selectedIndex(this.model.notes);
        if (index === -1) return false;
        this.model.remove(index);
        this.#selected = null;
        return true;
    }

    // scrolls vertically so this pitch is in the middle
    scrollToPitch(pitch) {
        const y = RULER_H + (HIGH - pitch) * ROW_H;
        this.scroller.scrollTop = y - this.scroller.clientHeight / 2;
    }

    // ---- geometry ----

    get #notes() {
        return this.#draft ?? this.model.notes;
    }

    get #totalSteps() {
        const end = Math.max(...this.#notes.map(n => n.start + n.duration), this.stepEntry.cursor, 0);
        return Math.max(this.minBars, Math.ceil(end / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;
    }

    #resize() {
        const dpr = window.devicePixelRatio || 1;
        const w = this.scroller.clientWidth;
        const h = this.scroller.clientHeight;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    }

    // pointer position in the visible area (vx, vy) and in grid content coordinates (step, pitch)
    #locate(e) {
        const rect = this.canvas.getBoundingClientRect();
        const vx = e.clientX - rect.left;
        const vy = e.clientY - rect.top;
        const x = vx + this.scroller.scrollLeft - KEY_W;   // px from the start of the grid
        const y = vy + this.scroller.scrollTop - RULER_H;
        return {
            vx, vy, x,
            step: Math.max(0, Math.floor(x / STEP_W)),
            pitch: Math.max(LOW, Math.min(HIGH, HIGH - Math.floor(y / ROW_H))),
            inRuler: vy < RULER_H,
            inKeys: vx < KEY_W,
        };
    }

    #selectedIndex(notes) {
        if (!this.#selected) return -1;
        return notes.findIndex(n => n.pitch === this.#selected.pitch && n.start === this.#selected.start);
    }

    #scrollCursorIntoView() {
        const x = KEY_W + this.stepEntry.cursor * STEP_W;
        const left = this.scroller.scrollLeft + KEY_W;
        const right = this.scroller.scrollLeft + this.scroller.clientWidth;
        if (x < left + STEP_W) this.scroller.scrollLeft = x - KEY_W - 4 * STEP_W;
        else if (x > right - 4 * STEP_W) this.scroller.scrollLeft = x - this.scroller.clientWidth + 8 * STEP_W;
    }

    // ---- mouse / touch ----

    #pointerDown(e) {
        const p = this.#locate(e);
        this.scroller.focus({ preventScroll: true });
        if (p.inRuler && !p.inKeys) {
            this.stepEntry.setCursor(Math.round(p.x / STEP_W));
            return;
        }
        if (p.inKeys) {
            if (!p.inRuler) this.onNote(p.pitch);
            return;
        }

        const notes = this.model.notes;
        const index = this.model.indexAt(p.step, p.pitch);

        if (e.button === 2) {
            if (index !== -1) this.model.remove(index);
            return;
        }

        if (index !== -1) {
            const n = notes[index];
            const endX = (n.start + n.duration) * STEP_W;
            this.#drag = {
                mode: p.x > endX - EDGE ? 'resize' : 'move',
                index, offset: p.step - n.start, start: n.start, moved: false, x: p.x,
            };
            this.#selected = { pitch: n.pitch, start: n.start };
            this.#draft = notes;
        } else {
            const note = { pitch: p.pitch, start: p.step, duration: this.stepEntry.length };
            this.#draft = [...notes, note];
            this.#drag = { mode: 'resize', index: this.#draft.length - 1, start: p.step, moved: false, x: p.x };
            this.#selected = { pitch: note.pitch, start: note.start };
        }
        this.onNote(this.#draft[this.#drag.index].pitch);
        this.canvas.setPointerCapture(e.pointerId);
        this.draw();
    }

    #pointerMove(e) {
        const p = this.#locate(e);
        if (!this.#drag) {
            this.#hover = p.inRuler || p.inKeys ? null : { step: p.step, pitch: p.pitch };
            this.canvas.style.cursor = this.#cursorFor(p);
            this.draw();
            return;
        }

        const drag = this.#drag;
        if (Math.abs(p.x - drag.x) > 3) drag.moved = true;
        const note = { ...this.#draft[drag.index] };

        if (drag.mode === 'move') {
            note.start = Math.max(0, p.step - drag.offset);
            if (note.pitch !== p.pitch) {
                note.pitch = p.pitch;
                this.onNote(p.pitch);
            }
        } else if (drag.moved) {
            const end = Math.max(drag.start + 1, Math.round(p.x / STEP_W));
            note.duration = end - drag.start;
        }
        this.#draft = this.#draft.map((n, i) => (i === drag.index ? note : n));
        this.#selected = { pitch: note.pitch, start: note.start };
        this.draw();
    }

    #pointerUp() {
        if (!this.#drag) return;
        const note = this.#draft[this.#drag.index];
        const draft = this.#draft;
        this.#drag = null;
        this.#draft = null;
        this.model.set(draft);
        // typed notes continue after the note that was just drawn, moved or resized
        this.stepEntry.setCursor(note.start + note.duration);
        this.draw();
    }

    #cursorFor(p) {
        if (p.inRuler && !p.inKeys) return 'col-resize';
        if (p.inKeys) return 'pointer';
        const index = this.model.indexAt(p.step, p.pitch);
        if (index === -1) return 'crosshair';
        const n = this.model.notes[index];
        return p.x > (n.start + n.duration) * STEP_W - EDGE ? 'ew-resize' : 'grab';
    }

    // ---- drawing ----

    draw() {
        const ctx = this.ctx;
        const css = getComputedStyle(this.scroller);
        const color = name => css.getPropertyValue(name).trim();
        const w = this.scroller.clientWidth;
        const h = this.scroller.clientHeight;
        const steps = this.#totalSteps;
        const gridW = steps * STEP_W;
        const gridH = (HIGH - LOW + 1) * ROW_H;

        this.spacer.style.width = KEY_W + gridW + 'px';
        this.spacer.style.height = RULER_H + gridH + 'px';
        const sl = this.scroller.scrollLeft;
        const st = this.scroller.scrollTop;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color('--roll-bg');
        ctx.fillRect(0, 0, w, h);

        // ---- grid (scrolls in both directions) ----
        ctx.save();
        ctx.beginPath();
        ctx.rect(KEY_W, RULER_H, w - KEY_W, h - RULER_H);
        ctx.clip();
        ctx.translate(KEY_W - sl, RULER_H - st);

        for (let pitch = LOW; pitch <= HIGH; pitch++) {
            const y = (HIGH - pitch) * ROW_H;
            if (isBlackKey(pitch)) {
                ctx.fillStyle = color('--roll-row-black');
                ctx.fillRect(0, y, gridW, ROW_H);
            }
            if (pitch % 12 === 0) {           // line under every C
                ctx.fillStyle = color('--roll-beat');
                ctx.fillRect(0, y + ROW_H - 1, gridW, 1);
            }
        }
        for (let s = 0; s <= steps; s++) {
            ctx.fillStyle = color(s % STEPS_PER_BAR === 0 ? '--roll-bar' : s % 4 === 0 ? '--roll-beat' : '--roll-line');
            ctx.fillRect(s * STEP_W, 0, s % STEPS_PER_BAR === 0 ? 2 : 1, gridH);
        }

        // ghost note under the mouse
        if (this.#hover && !this.#drag && this.model.indexAt(this.#hover.step, this.#hover.pitch) === -1) {
            ctx.fillStyle = color('--roll-ghost');
            ctx.fillRect(this.#hover.step * STEP_W, (HIGH - this.#hover.pitch) * ROW_H,
                this.stepEntry.length * STEP_W, ROW_H);
        }

        const notes = this.#notes;
        const selected = this.#selectedIndex(notes);
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        notes.forEach((n, i) => {
            const x = n.start * STEP_W;
            const y = (HIGH - n.pitch) * ROW_H;
            const nw = n.duration * STEP_W;
            ctx.fillStyle = color(i === selected ? '--roll-note-selected' : '--roll-note');
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, nw - 2, ROW_H - 2, 3);
            ctx.fill();
            ctx.fillStyle = color('--roll-note-edge');
            ctx.fillRect(x + nw - 4, y + 3, 2, ROW_H - 6);
            if (nw > 30) {
                ctx.fillStyle = color('--roll-note-text');
                ctx.fillText(pitchName(n.pitch), x + 5, y + ROW_H / 2 + 1);
            }
        });

        // step entry cursor
        ctx.fillStyle = color('--roll-cursor');
        ctx.fillRect(this.stepEntry.cursor * STEP_W - 1, 0, 2, gridH);
        ctx.restore();

        // ---- ruler (scrolls horizontally only) ----
        ctx.save();
        ctx.beginPath();
        ctx.rect(KEY_W, 0, w - KEY_W, RULER_H);
        ctx.clip();
        ctx.fillStyle = color('--roll-ruler');
        ctx.fillRect(KEY_W, 0, w, RULER_H);
        ctx.fillStyle = color('--roll-text');
        ctx.font = '12px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        for (let bar = 0; bar < steps / STEPS_PER_BAR; bar++) {
            const x = KEY_W - sl + bar * STEPS_PER_BAR * STEP_W;
            ctx.fillRect(x, 0, 1, RULER_H);
            ctx.fillText(String(bar + 1), x + 5, RULER_H / 2 + 1);
        }
        const cx = KEY_W - sl + this.stepEntry.cursor * STEP_W;
        ctx.fillStyle = color('--roll-cursor');
        ctx.beginPath();
        ctx.moveTo(cx - 6, 0);
        ctx.lineTo(cx + 6, 0);
        ctx.lineTo(cx, 9);
        ctx.fill();
        ctx.restore();

        // ---- piano keys (scroll vertically only) ----
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, RULER_H, KEY_W, h - RULER_H);
        ctx.clip();
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        for (let pitch = LOW; pitch <= HIGH; pitch++) {
            const y = RULER_H - st + (HIGH - pitch) * ROW_H;
            const hovered = this.#hover && this.#hover.pitch === pitch;
            ctx.fillStyle = color(hovered ? '--roll-key-hover' : isBlackKey(pitch) ? '--roll-key-black' : '--roll-key-white');
            ctx.fillRect(0, y, KEY_W - 1, ROW_H - 1);
            if (pitch % 12 === 0) {
                ctx.fillStyle = color('--roll-key-label');
                ctx.fillText(pitchName(pitch), 4, y + ROW_H / 2);
            }
        }
        ctx.restore();

        // corner
        ctx.fillStyle = color('--roll-ruler');
        ctx.fillRect(0, 0, KEY_W, RULER_H);
    }
}
