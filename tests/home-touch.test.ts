// Unit tests for the home page touch rules (lib/home-touch.ts).
// Run: npm test

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TOUCH, chooseTouchMode, fingerSpeed, flingStep, releaseTarget, splitMove, type TextDrag } from "../lib/home-touch.ts";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe("choosing what a swipe does", () => {
  test("every combination", () => {
    for (const startedInBox of [false, true])
      for (const long of [false, true])
        for (const canScroll of [false, true])
          for (const justScrolled of [false, true]) {
            const mode = chooseTouchMode({ startedInBox, long, canScroll, justScrolled });
            const text = startedInBox && long && (canScroll || justScrolled);
            assert.equal(mode, text ? "text" : "section", JSON.stringify({ startedInBox, long, canScroll, justScrolled }));
          }
  });
});

describe("splitting a finger movement", () => {
  const box = (textPos: number, max = 200, past = 0): TextDrag => ({ textPos, max, past });

  test("the text moves first", () => {
    const r = splitMove(box(50), 30, false);
    assert.equal(r.textPos, 80);
    assert.equal(r.past, 0);
  });

  test("a fast finger stops at the end of the text", () => {
    const r = splitMove(box(190), 50, false);
    assert.equal(r.textPos, 200);
    assert.equal(r.past, 0);
    assert.equal(r.handoff, false);
    assert.equal(r.stopped, true);
  });

  test("a slow finger carries on into the next section", () => {
    const r = splitMove(box(190), 50, true);
    assert.equal(r.textPos, 200);
    assert.equal(r.past, 40);
    assert.equal(r.handoff, true);
  });

  test("going back at the top carries on into the previous section when slow", () => {
    const r = splitMove(box(10), -30, true);
    assert.equal(r.textPos, 0);
    assert.equal(r.past, -20);
  });

  test("once moving the section, the finger keeps moving it at any speed", () => {
    const r = splitMove(box(200, 200, 40), 100, false);
    assert.equal(r.past, 140);
    assert.equal(r.textPos, 200);
  });

  test("turning back first undoes the section movement, then scrolls the text", () => {
    let r = splitMove(box(200, 200, 40), -30, false);
    assert.equal(r.past, 10);
    assert.equal(r.textPos, 200);
    r = splitMove(r, -30, false);
    assert.equal(r.past, 0);
    assert.equal(r.textPos, 180);
  });

  test("the text never leaves its range", () => {
    for (let i = 0; i < 2000; i++) {
      const max = Math.random() * 500;
      const pos = Math.random() * max;
      const r = splitMove(box(pos, max, 0), (Math.random() - 0.5) * 800, Math.random() < 0.5);
      assert.ok(r.textPos >= 0 && r.textPos <= max);
      // Pixels are never lost or invented.
      if (!r.handoff) assert.ok(r.past === 0);
    }
  });

  test("a slow finger's movement is fully accounted for", () => {
    for (let i = 0; i < 2000; i++) {
      const max = Math.random() * 500;
      const pos = Math.random() * max;
      const d = (Math.random() - 0.5) * 800;
      const r = splitMove(box(pos, max, 0), d, true);
      assert.ok(near(r.textPos - pos + r.past, d, 0.011));
    }
  });
});

describe("finger speed", () => {
  test("no movement is zero", () => {
    assert.equal(fingerSpeed([], 0), 0);
    assert.equal(fingerSpeed([{ y: 100, t: 0 }], 10), 0);
  });
  test("a finger held still before lifting has no speed", () => {
    const s = [{ y: 500, t: 0 }, { y: 400, t: 50 }];
    assert.equal(fingerSpeed(s, 200), 0);
  });
  test("moving up 100 px in 100 ms is 1 px/ms", () => {
    const s = [{ y: 500, t: 0 }, { y: 450, t: 50 }, { y: 400, t: 100 }];
    assert.ok(near(fingerSpeed(s, 100), 1));
  });
  test("a pause before lifting lowers the speed", () => {
    const s = [{ y: 500, t: 0 }, { y: 400, t: 40 }];
    assert.ok(fingerSpeed(s, 90) < fingerSpeed(s, 40));
  });
  test("moving down is negative", () => {
    assert.ok(fingerSpeed([{ y: 100, t: 0 }, { y: 200, t: 50 }], 50) < 0);
  });
});

describe("release", () => {
  test("a flick in the direction of the movement finishes the change", () => {
    assert.equal(releaseTarget(0.05, 1), 1);
    assert.equal(releaseTarget(-0.05, -1), -1);
  });
  test("a flick against the movement does not", () => {
    assert.equal(releaseTarget(0.1, -1), 0);
  });
  test("past the commit share it finishes without a flick", () => {
    assert.equal(releaseTarget(TOUCH.commit, 0), 1);
    assert.equal(releaseTarget(-TOUCH.commit, 0), -1);
  });
  test("a short slow movement springs back", () => {
    assert.equal(releaseTarget(TOUCH.commit - 0.01, 0.2), 0);
    assert.equal(releaseTarget(0, 0), 0);
  });
});

describe("fling", () => {
  const run = (pos: number, v: number, max: number) => {
    let frames = 0;
    for (;;) {
      const f = flingStep(pos, v, 16, max);
      pos = f.pos;
      v = f.v;
      frames++;
      if (f.done || frames > 10000) return { pos, frames };
    }
  };
  test("stops at the end of the text", () => {
    assert.equal(run(100, 3, 300).pos, 300);
  });
  test("stops at the top", () => {
    assert.equal(run(100, -3, 300).pos, 0);
  });
  test("slows down and stops on its own", () => {
    const r = run(0, 0.5, 100000);
    assert.ok(r.pos > 50 && r.pos < 400, `coasted ${r.pos}`);
    assert.ok(r.frames < 400);
  });
});

// ---- Whole swipes ------------------------------------------------------------
// A small simulator that follows the page's touch handler step by step.

type Swipe = { dy: number; ms: number; hold?: number; steps?: number };

class TouchSim {
  active: number;
  pos: number;
  maxes: number[];
  p: number;
  textMovedAt = Number.NEGATIVE_INFINITY;
  t = 0;
  vh = 844;
  constructor(maxes: number[], start: number, pos = 0) {
    this.maxes = maxes;
    this.active = start;
    this.p = start;
    this.pos = pos;
  }
  get max() {
    return this.maxes[this.active];
  }
  canScroll(dir: number) {
    if (this.max <= 1) return false;
    return dir > 0 ? this.pos < this.max - 1 : this.pos > 1;
  }
  swipe(s: Swipe, inBox = true) {
    const steps = s.steps ?? 10;
    const dt = s.ms / steps;
    let y = 600;
    const samples = [{ y, t: this.t }];
    let mode: "pending" | "text" | "section" = "pending";
    let drag: TextDrag = { textPos: 0, max: 0, past: 0 };
    let past = 0;
    const startY = y;
    let lastY = y;
    for (let i = 1; i <= steps; i++) {
      this.t += dt;
      y = startY - (s.dy * i) / steps;
      samples.push({ y, t: this.t });
      if (mode === "pending") {
        const total = startY - y;
        if (Math.abs(total) < TOUCH.start) continue;
        const dir = Math.sign(total);
        mode = chooseTouchMode({
          startedInBox: inBox,
          long: this.max > 1,
          canScroll: this.canScroll(dir),
          justScrolled: this.t - this.textMovedAt < TOUCH.land,
        });
        if (mode === "text") drag = { textPos: this.pos, max: this.max, past: 0 };
        lastY = startY;
      }
      const d = lastY - y;
      lastY = y;
      if (mode === "text") {
        const r = splitMove(drag, d, Math.abs(fingerSpeed(samples, this.t)) < TOUCH.slow);
        if (r.textPos !== drag.textPos || r.stopped) this.textMovedAt = this.t;
        drag = r;
        this.pos = r.textPos;
        this.p = this.active + Math.max(-1, Math.min(1, r.past / (this.vh * TOUCH.distance)));
      } else {
        past += d;
        this.p = this.active + Math.max(-1, Math.min(1, past / (this.vh * TOUCH.distance)));
      }
    }
    this.t += s.hold ?? 0;
    const v = fingerSpeed(samples, this.t);
    if (mode === "section" || (mode === "text" && drag.past !== 0)) {
      const to = Math.max(0, Math.min(this.maxes.length - 1, this.active + releaseTarget(this.p - this.active, v)));
      if (to !== this.active) {
        this.pos = to > this.active ? 0 : this.maxes[to];
        this.active = to;
        this.textMovedAt = Number.NEGATIVE_INFINITY;
      }
    } else if (mode === "text" && Math.abs(v) >= 0.08) {
      let vv = v;
      for (;;) {
        const f = flingStep(this.pos, vv, 16, this.max);
        if (f.pos !== this.pos) this.textMovedAt = this.t;
        this.pos = f.pos;
        vv = f.v;
        this.t += 16;
        if (f.done) break;
      }
    }
    this.p = this.active;
    return this;
  }
  wait(ms: number) {
    this.t += ms;
    return this;
  }
}

const PHONE = [46, 300, 563, 266, 120, 80];

describe("whole swipes", () => {
  test("a normal swipe in long text scrolls it and coasts", () => {
    const s = new TouchSim(PHONE, 2, 0).swipe({ dy: 80, ms: 100 });
    assert.equal(s.active, 2);
    assert.ok(s.pos > 80, `coasted to ${s.pos}`);
  });

  test("fast swipes through long text stop at its end", () => {
    const s = new TouchSim(PHONE, 2, 0);
    // Swipe until the text reaches its end...
    for (let i = 0; i < 6 && s.pos < 563; i++) s.swipe({ dy: 250, ms: 120 }).wait(150);
    assert.equal(s.pos, 563);
    // ...and quick swipes after that keep stopping there.
    for (let i = 0; i < 8; i++) s.wait(300).swipe({ dy: 250, ms: 120 });
    assert.equal(s.active, 2);
  });

  test("after the stop, a swipe at the end moves to the next section", () => {
    const s = new TouchSim(PHONE, 2, 500).swipe({ dy: 250, ms: 120 }).wait(800);
    assert.equal(s.active, 2);
    s.swipe({ dy: 150, ms: 120 });
    assert.equal(s.active, 3);
  });

  test("one slow drag scrolls the rest of the text, then moves to the next section", () => {
    const s = new TouchSim(PHONE, 1, 260).swipe({ dy: 260, ms: 1300, steps: 80 });
    assert.equal(s.active, 2);
  });

  test("a slow drag that turns back stays in the section", () => {
    const s = new TouchSim(PHONE, 1, 280);
    s.swipe({ dy: 120, ms: 600, steps: 40 });
    // (released mid-way past the end: 100 px of 270 is enough to finish)
    assert.equal(s.active, 2);
    const t = new TouchSim(PHONE, 1, 280).swipe({ dy: 50, ms: 400, steps: 30 });
    assert.equal(t.active, 1, "30 px past the end is not enough");
  });

  test("a flick on a section that fits moves one section", () => {
    const s = new TouchSim([0, 0, 0], 0).swipe({ dy: 60, ms: 60 });
    assert.equal(s.active, 1);
  });

  test("a swipe on the portrait always changes the section", () => {
    const s = new TouchSim(PHONE, 2, 100).swipe({ dy: 150, ms: 120 }, false);
    assert.equal(s.active, 3);
  });

  test("swiping down at the top of a long section goes back after the stop", () => {
    const s = new TouchSim(PHONE, 2, 100).swipe({ dy: -200, ms: 120 });
    assert.equal(s.active, 2);
    assert.equal(s.pos, 0);
    s.wait(800).swipe({ dy: -150, ms: 120 });
    assert.equal(s.active, 1);
  });

  test("the first and last sections stay put", () => {
    const s = new TouchSim([0, 0], 0).swipe({ dy: -200, ms: 100 });
    assert.equal(s.active, 0);
    const e = new TouchSim([0, 0], 1).swipe({ dy: 200, ms: 100 });
    assert.equal(e.active, 1);
  });
});

describe("random swipes", () => {
  for (let seed = 1; seed <= 300; seed++) {
    test(`swipes ${seed}`, () => {
      let x = seed;
      const r = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
      const maxes = Array.from({ length: 6 }, () => (r() < 0.4 ? 0 : Math.round(r() * 700)));
      const s = new TouchSim(maxes, Math.floor(r() * 6), 0);
      s.pos = Math.round(r() * s.max);
      for (let k = 0; k < 12; k++) {
        const before = s.active;
        const fast = r() < 0.5;
        const dy = (r() < 0.75 ? 1 : -1) * (20 + r() * 400);
        const ms = fast ? Math.abs(dy) / (1 + r() * 2) : Math.abs(dy) / (0.05 + r() * 0.3);
        const inBox = r() < 0.85;
        const startedInText = inBox && s.max > 1 && s.canScroll(Math.sign(dy));
        s.swipe({ dy, ms, steps: Math.max(3, Math.round(ms / 16)), hold: r() < 0.3 ? 150 : 0 }, inBox);
        assert.ok(Math.abs(s.active - before) <= 1, "never more than one section");
        assert.ok(s.pos >= 0 && s.pos <= s.max, "text stays in range");
        if (fast && startedInText) assert.equal(s.active, before, "a fast swipe in text never changes the section");
        s.wait(r() * 1000);
      }
    });
  }
});
