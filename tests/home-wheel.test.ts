// Unit tests for the home page wheel and trackpad rules (lib/home-wheel.ts).
// Run: npm test
//
// A small simulator plays the part of the page: it holds the text box scroll
// position of each section, applies the controller's actions, runs the
// trackpad release timer and the section change animation. Event streams
// imitate a mouse wheel, Windows and Mac touchpads (with glide), and slow
// pushes.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { WHEEL, WheelController, type WheelAction } from "../lib/home-wheel.ts";

type Ev = { at: number; dy: number; over?: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

class Sim {
  t = 0;
  active: number;
  top: number;
  p: number;
  maxes: number[];
  textMovedAt = Number.NEGATIVE_INFINITY;
  animUntil = -1;
  releaseAt: number | null = null;
  ctl = new WheelController();
  changes: { at: number; from: number; to: number }[] = [];
  actions: WheelAction["kind"][] = [];

  /** maxes[i] = how far section i's text can scroll (0 = it fits). */
  constructor(maxes: number[], start = 0, top = 0) {
    this.maxes = maxes;
    this.active = start;
    this.p = start;
    this.top = top;
  }
  get max() {
    return this.maxes[this.active];
  }
  get animating() {
    return this.t < this.animUntil;
  }
  canScroll(dir: number) {
    if (this.max <= 1) return false;
    return dir > 0 ? this.top < this.max - 1 : this.top > 1;
  }
  private tick(to: number) {
    if (this.releaseAt !== null && this.releaseAt <= to) {
      const at = this.releaseAt;
      this.releaseAt = null;
      const r = this.ctl.release();
      if (r !== null && !(at < this.animUntil)) this.settle(this.active + r, at);
    }
    this.t = Math.max(this.t, to);
  }
  settle(target: number, at: number) {
    const c = clamp(target, 0, this.maxes.length - 1);
    if (c !== this.active) {
      this.top = c > this.active ? 0 : this.maxes[c];
      this.changes.push({ at, from: this.active, to: c });
      this.active = c;
      this.textMovedAt = Number.NEGATIVE_INFINITY;
    }
    const dist = Math.abs(this.p - c);
    this.p = c;
    if (dist > 0.001) this.animUntil = at + Math.min(850, 320 + dist * 140);
  }
  wheel(dy: number, over = true) {
    const act = this.ctl.handle({
      dy,
      now: this.t,
      canScroll: this.canScroll(Math.sign(dy)),
      overBox: over,
      textMovedAt: this.textMovedAt,
      animating: this.animating,
    });
    this.actions.push(act.kind);
    if (act.kind === "native" || act.kind === "scrollBox") {
      const before = this.top;
      this.top = clamp(this.top + dy, 0, this.max);
      // The browser animates a mouse notch for about 150 ms.
      if (this.top !== before) this.textMovedAt = this.t + (act.kind === "native" && Math.abs(dy) >= 50 ? 150 : 0);
    } else if (act.kind === "go") {
      this.releaseAt = null;
      this.settle(this.active + act.dir, this.t);
    } else if (act.kind === "drag") {
      this.p = this.active + clamp(act.offset, -1, 1);
      this.releaseAt = this.t + WHEEL.release;
    }
    return act;
  }
  play(events: Ev[]) {
    const t0 = this.t;
    for (const e of events) {
      this.tick(t0 + e.at);
      this.wheel(e.dy, e.over ?? true);
    }
    return this;
  }
  wait(ms: number) {
    this.tick(this.t + ms);
    return this;
  }
  get atEnd() {
    return this.top >= this.max - 1;
  }
}

// ---- Event streams ---------------------------------------------------------

/** Deterministic pseudo random numbers. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A mouse wheel: n notches, `gap` ms apart. */
function mouse(n: number, gap = 40, delta = 100, start = 0): Ev[] {
  return Array.from({ length: n }, (_, i) => ({ at: start + i * gap, dy: delta }));
}

/**
 * A touchpad swipe: an active phase with a bell shaped speed and some noise,
 * then (optionally) glide that decays like Chrome's fling or macOS momentum.
 */
function swipe(
  total: number,
  o: { ms?: number; step?: number; glide?: boolean; decay?: number; start?: number; seed?: number } = {},
): Ev[] {
  const { ms = 160, step = 16, glide = true, decay = 0.93, start = 0, seed = 1 } = o;
  const r = rng(seed);
  const n = Math.max(1, Math.round(ms / step));
  // The finger speeds up and is still moving when it lifts; glide starts there.
  const w = Array.from({ length: n }, (_, i) => Math.sin((Math.PI / 2) * ((i + 0.5) / n)));
  const sum = w.reduce((a, b) => a + b, 0);
  const sign = Math.sign(total);
  const evs: Ev[] = [];
  let at = start;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const d = (Math.abs(total) * w[i]) / sum;
    const noisy = Math.max(1, d * (0.8 + 0.4 * r()));
    evs.push({ at, dy: sign * noisy });
    last = noisy;
    at += step;
  }
  if (glide) {
    let v = last;
    while (v >= 1) {
      evs.push({ at, dy: sign * v });
      v *= decay;
      at += step;
    }
  }
  return evs;
}

/** A slow, steady touchpad scroll: `px` pixels per event for `ms`. */
function steady(px: number, ms: number, step = 16, start = 0): Ev[] {
  return Array.from({ length: Math.round(ms / step) }, (_, i) => ({ at: start + i * step, dy: px }));
}

const lastAt = (evs: Ev[]) => evs[evs.length - 1].at;

// Section text overflow as on a laptop: home fits, news 300 px, academic 35,
// tools 156, blog fits, interests fits.
const LAPTOP = [0, 300, 35, 156, 0, 0];

// ---- Tests -----------------------------------------------------------------

describe("mouse wheel", () => {
  test("a notch on a section that fits moves to the next section", () => {
    const s = new Sim(LAPTOP, 0).play(mouse(1)).wait(900);
    assert.equal(s.active, 1);
  });

  test("a notch on a long section scrolls its text first", () => {
    const s = new Sim(LAPTOP, 1, 0).play(mouse(1)).wait(900);
    assert.equal(s.active, 1);
    assert.equal(s.top, 100);
  });

  test("a fast spin that reaches the end of the text stops there", () => {
    const s = new Sim(LAPTOP, 1, 0).play(mouse(6, 30)).wait(900);
    assert.equal(s.active, 1);
    assert.ok(s.atEnd);
  });

  test("several quick flicks of the wheel stop at the end of the text", () => {
    // Flicks of 4 notches with short pauses, like spinning a wheel fast.
    const evs = [...mouse(4, 25), ...mouse(4, 25, 100, 220), ...mouse(4, 25, 100, 440)];
    const s = new Sim(LAPTOP, 3, 0).play(evs).wait(50);
    assert.equal(s.active, 3, "stayed in tools");
    assert.ok(s.atEnd);
  });

  test("after the text stops, a pause and one notch move to the next section", () => {
    const s = new Sim(LAPTOP, 3, 0).play(mouse(4, 30)).wait(800);
    assert.equal(s.active, 3);
    s.play(mouse(1)).wait(900);
    assert.equal(s.active, 4);
  });

  test("still spinning past the end moves on after a short stop (never stuck)", () => {
    // The user's report: at the end of the text, whatever they try, the
    // section never changed. A continuous spin must get through.
    const s = new Sim(LAPTOP, 3, 0).play(mouse(40, 50)).wait(50);
    assert.equal(s.changes.length >= 1, true, "moved on");
    const first = s.changes[0];
    assert.equal(first.from, 3);
    assert.equal(first.to, 4);
    // ...but not before the short stop at the end of the text.
    assert.ok(first.at >= 150 + WHEEL.land, `moved at ${first.at} ms`);
  });

  test("a new spin soon after the text stopped moves on once the stop is over", () => {
    const s = new Sim(LAPTOP, 3, 0).play(mouse(3, 30)).wait(300);
    assert.equal(s.active, 3);
    s.play(mouse(12, 40)).wait(900);
    assert.equal(s.active, 4);
  });

  test("each section change waits for the previous one to finish", () => {
    const s = new Sim([0, 0, 0, 0, 0, 0], 0).play(mouse(80, 40)).wait(1000);
    assert.ok(s.changes.length >= 2);
    for (let i = 1; i < s.changes.length; i++) {
      assert.ok(s.changes[i].at - s.changes[i - 1].at >= 320, "a change never interrupts the previous one");
      assert.equal(Math.abs(s.changes[i].to - s.changes[i].from), 1, "never skips a section");
    }
  });

  test("one notch at a time walks every section and back", () => {
    const s = new Sim(LAPTOP, 0);
    for (let i = 0; i < 30 && s.active < 5; i++) s.play(mouse(1)).wait(900);
    assert.equal(s.active, 5);
    for (let i = 0; i < 30 && s.active > 0; i++) s.play([{ at: 0, dy: -100 }]).wait(900);
    assert.equal(s.active, 0);
  });

  test("the ends of the page stay put and scrolling still works afterwards", () => {
    const s = new Sim(LAPTOP, 0).play([{ at: 0, dy: -100 }]).wait(900);
    assert.equal(s.active, 0);
    s.play(mouse(1)).wait(900);
    assert.equal(s.active, 1);
    const e = new Sim(LAPTOP, 5).play(mouse(5, 300)).wait(900);
    assert.equal(e.active, 5);
    e.play([{ at: 0, dy: -100 }]).wait(900);
    assert.equal(e.active, 4);
  });

  test("scrolling up in a long section scrolls its text back first", () => {
    const s = new Sim(LAPTOP, 1, 300).play([{ at: 0, dy: -100 }]).wait(900);
    assert.equal(s.active, 1);
    assert.equal(s.top, 200);
  });

  test("reversing at the end of the text scrolls it back at once", () => {
    const s = new Sim(LAPTOP, 3, 0).play(mouse(4, 30));
    assert.ok(s.atEnd);
    s.wait(60).play([{ at: 0, dy: -100 }]);
    assert.equal(s.top, 56);
    assert.equal(s.active, 3);
  });

  test("small notches (Firefox style, 48 px) still move one section", () => {
    const s = new Sim(LAPTOP, 0).play(mouse(3, 60, 48)).wait(900);
    assert.equal(s.active, 1);
  });

  test("a wheel over the portrait scrolls the text box", () => {
    const s = new Sim(LAPTOP, 1, 0).play([{ at: 0, dy: 100, over: false }]).wait(50);
    assert.equal(s.actions[0], "scrollBox");
    assert.equal(s.top, 100);
  });
});

describe("touchpad", () => {
  test("a swipe with glide on a long section only scrolls its text", () => {
    const s = new Sim(LAPTOP, 3, 0).play(swipe(250)).wait(900);
    assert.equal(s.active, 3);
    assert.ok(s.atEnd);
  });

  test("glide that keeps going past the end of the text never changes the section", () => {
    for (const decay of [0.9, 0.95, 0.97]) {
      const s = new Sim(LAPTOP, 2, 0).play(swipe(400, { decay })).wait(900);
      assert.equal(s.active, 2, `decay ${decay}`);
    }
  });

  test("after the glide ends, a new swipe moves to the next section", () => {
    const first = swipe(400);
    const s = new Sim(LAPTOP, 3, 0).play(first).wait(400);
    assert.equal(s.active, 3);
    s.play(swipe(200, { seed: 7 })).wait(900);
    assert.equal(s.active, 4);
  });

  test("a new swipe during the glide (no pause) moves on (never stuck)", () => {
    // Windows touchpads: swiping again while the page still glides sends no
    // gap between the two swipes.
    const a = swipe(300, { decay: 0.97 });
    const t = 700; // the second swipe starts while the first still glides
    const evs = a.filter((e) => e.at < t).concat(swipe(250, { start: t, seed: 3 }));
    const s = new Sim(LAPTOP, 3, 0).play(evs).wait(900);
    assert.equal(s.changes.length, 1);
    assert.equal(s.active, 4);
  });

  test("repeated swipes at the end always get through, one section at a time", () => {
    const s = new Sim(LAPTOP, 1, 0);
    let at = 0;
    const evs: Ev[] = [];
    for (let k = 0; k < 8; k++) {
      evs.push(...swipe(300, { start: at, seed: k + 1, decay: 0.95 }));
      at += 380; // swipes overlap the previous glide
    }
    s.play(evs).wait(900);
    assert.ok(s.active >= 2, `reached ${s.active}`);
    for (const c of s.changes) assert.equal(Math.abs(c.to - c.from), 1);
  });

  test("a slow scroll reaches the end, pauses there, then carries on to the next section", () => {
    const s = new Sim(LAPTOP, 3, 0).play(steady(4, 2000)).wait(900);
    assert.equal(s.active, 4);
    const c = s.changes[0];
    // 156 px of text at 4 px per 16 ms takes 624 ms; then the stop.
    assert.ok(c.at >= 600 + WHEEL.land, `moved at ${c.at}`);
  });

  test("a slow scrub halfway and release finishes the change", () => {
    const s = new Sim(LAPTOP, 0).play(steady(6, 400)).wait(900);
    assert.equal(s.active, 1);
  });

  test("a tiny scrub springs back", () => {
    const s = new Sim(LAPTOP, 0).play(steady(3, 64)).wait(900);
    assert.equal(s.active, 0);
    assert.equal(s.p, 0);
  });

  test("glide after a section change does not scroll the new section's text", () => {
    const s = new Sim(LAPTOP, 0).play(swipe(500, { decay: 0.97 })).wait(900);
    assert.equal(s.active, 1);
    assert.equal(s.top, 0, "news text untouched");
  });

  test("a big fast swipe moves one section, not two", () => {
    const s = new Sim([0, 0, 0, 0, 0, 0], 0).play(swipe(1500, { ms: 200, decay: 0.97 })).wait(900);
    assert.equal(s.active, 1);
  });

  test("glide rounded to whole pixels (as some browsers send it) still never changes the section", () => {
    for (const decay of [0.93, 0.95, 0.97, 0.98]) {
      const evs = swipe(500, { decay }).map((e) => ({ ...e, dy: Math.round(e.dy) })).filter((e) => e.dy !== 0);
      const s = new Sim(LAPTOP, 2, 0).play(evs).wait(900);
      assert.equal(s.active, 2, `decay ${decay}`);
    }
  });

  test("glide that starts with a jump (finger slowed before lifting) still moves only one section", () => {
    const active = steady(30, 160);
    const glide: Ev[] = [];
    let v = 80;
    for (let at = 176; v >= 1; at += 16, v *= 0.96) glide.push({ at, dy: v });
    const s = new Sim([0, 0, 0, 0], 0).play([...active, { at: 160, dy: 3 }, ...glide]).wait(900);
    assert.equal(s.active, 1);
    const t = new Sim([0, 400, 0], 1, 300).play([...active, { at: 160, dy: 3 }, ...glide]).wait(900);
    assert.equal(t.active, 1, "from inside text: stops at its end");
  });

  test("a noisy slow finger at the end of the text carries on to the next section", () => {
    const r = rng(42);
    const evs = Array.from({ length: 150 }, (_, i) => ({ at: i * 16, dy: 2 + r() * 5 }));
    const s = new Sim(LAPTOP, 3, 0).play(evs).wait(900);
    assert.equal(s.active, 4);
  });

  test("scrubbing forward and back during a drag springs back cleanly", () => {
    const evs = [...steady(8, 160), ...steady(-8, 160, 16, 176)];
    const s = new Sim(LAPTOP, 0).play(evs).wait(900);
    assert.equal(s.active, 0);
    assert.equal(s.p, 0);
  });

  test("pushing with the pointer over the portrait gets past the end of the text too", () => {
    const evs = mouse(30, 50).map((e) => ({ ...e, over: false }));
    const s = new Sim(LAPTOP, 3, 0).play(evs).wait(900);
    assert.deepEqual([s.changes[0].from, s.changes[0].to], [3, 4]);
  });

  test("tiny jitter does nothing", () => {
    const s = new Sim(LAPTOP, 0).play([{ at: 0, dy: 1 }, { at: 16, dy: -1 }, { at: 32, dy: 1 }]).wait(900);
    assert.equal(s.active, 0);
  });
});

describe("never stuck (random input)", () => {
  // Random mixes of every input kind. After each mix, wait, then scroll
  // forward with notches: the section must change within a few notches.
  for (let seed = 1; seed <= 300; seed++) {
    test(`mix ${seed}`, () => {
      const r = rng(seed);
      const maxes = Array.from({ length: 6 }, () => (r() < 0.5 ? 0 : Math.round(r() * 600)));
      const s = new Sim(maxes, Math.floor(r() * 5), 0);
      s.top = Math.round(r() * s.max);
      const evs: Ev[] = [];
      let at = 0;
      const parts = 2 + Math.floor(r() * 6);
      for (let k = 0; k < parts; k++) {
        const kind = r();
        const dir = r() < 0.75 ? 1 : -1;
        if (kind < 0.3) evs.push(...mouse(1 + Math.floor(r() * 12), 20 + r() * 300, dir * 100, at));
        else if (kind < 0.6) evs.push(...swipe(dir * (50 + r() * 700), { start: at, seed: seed * 10 + k, decay: 0.88 + r() * 0.1, glide: r() < 0.8 }));
        else evs.push(...steady(dir * (1 + r() * 8), 100 + r() * 1500, 16, at));
        at = lastAt(evs) + r() * 700;
      }
      s.play(evs);
      for (const c of s.changes) assert.equal(Math.abs(c.to - c.from), 1, "never skips a section");
      for (let i = 1; i < s.changes.length; i++) assert.ok(s.changes[i].at - s.changes[i - 1].at >= 300, "changes never overlap");
      assert.ok(s.active >= 0 && s.active < 6);
      assert.ok(Math.abs(s.p - s.active) <= 1);

      s.wait(1500);
      assert.equal(s.p, s.active, "at rest after input stops");
      if (s.active === 5) return;
      const before = s.active;
      for (let i = 0; i < 12 && s.active === before; i++) s.play(mouse(1)).wait(700);
      assert.equal(s.active, before + 1, "a few notches always reach the next section");
    });
  }
});

describe("one swipe (random)", () => {
  for (let seed = 1; seed <= 300; seed++) {
    test(`swipe ${seed}`, () => {
      const r = rng(seed * 7919);
      const max = 50 + Math.round(r() * 800);
      const top = Math.round(r() * (max - 20));
      const decay = 0.88 + r() * 0.1;
      const round = r() < 0.5;
      let evs = swipe(100 + r() * 1500, { ms: 80 + r() * 300, decay, seed });
      if (round) evs = evs.map((e) => ({ ...e, dy: Math.round(e.dy) })).filter((e) => e.dy !== 0);
      // Starting inside text that can still scroll: the swipe never changes the section.
      const s = new Sim([0, max, 0], 1, top).play(evs).wait(900);
      assert.equal(s.active, 1, `max ${max} top ${top} decay ${decay.toFixed(3)} rounded ${round} changes ${JSON.stringify(s.changes)} ${process.env.DBG ? JSON.stringify(evs.map((e) => [Math.round(e.at), +e.dy.toFixed(1)])) : ""}`);
      // Starting on a section that fits: at most one section.
      const t = new Sim([0, 0, 0, 0], 1).play(evs).wait(900);
      assert.ok(t.active - 1 <= 1, `moved ${t.active - 1} changes ${JSON.stringify(t.changes)} ms ${process.env.DBG ? JSON.stringify(evs.map((e) => [Math.round(e.at), +e.dy.toFixed(1)])) : ""}`);
    });
  }
});

describe("reported: at the end of the text, waiting and scrolling again did nothing", () => {
  const toEnd = () => new Sim(LAPTOP, 3, 0).play(swipe(250)); // tools text 156 px

  for (const wait of [0, 300, 600, 1000, 2000, 5000]) {
    test(`touchpad: reach the end, lift, wait ${wait} ms, swipe -> next`, () => {
      const s = toEnd().wait(wait).play(swipe(200, { seed: 4 })).wait(900);
      assert.equal(s.active, 4);
    });
    test(`mouse: reach the end, wait ${wait} ms, scroll -> next`, () => {
      const s = new Sim(LAPTOP, 3, 0).play(mouse(3, 60)).wait(wait).play(mouse(6, 60)).wait(900);
      // With no pause this is one short fast spin, which stops at the end.
      assert.equal(s.active, wait === 0 ? 3 : 4);
    });
  }

  test("fingers resting on the touchpad (a trickle of tiny events) do not block the next swipe", () => {
    const s = toEnd();
    const trickle: Ev[] = Array.from({ length: 120 }, (_, k) => ({ at: k * 16, dy: k % 2 ? 1 : 0.6 }));
    s.play(trickle);
    s.play(swipe(150, { seed: 8 })).wait(900);
    assert.equal(s.active, 4);
  });

  test("a gentle swipe in the middle of a trickle gets through", () => {
    const s = toEnd().wait(600);
    const trickle: Ev[] = Array.from({ length: 60 }, (_, k) => ({ at: k * 16, dy: 1 }));
    const gentle = swipe(90, { start: 60 * 16, ms: 200, seed: 2 });
    s.play([...trickle, ...gentle]).wait(900);
    assert.equal(s.active, 4);
  });

  test("a gentle swipe right after a strong glide (no gap) gets through", () => {
    const s = toEnd();
    const trickle: Ev[] = Array.from({ length: 90 }, (_, k) => ({ at: k * 16, dy: k % 2 ? 1 : 0.6 }));
    const gentle = swipe(110, { ms: 200, start: 90 * 16, seed: 2, glide: false });
    s.play([...trickle, ...gentle]).wait(900);
    assert.equal(s.active, 4);
  });

  test("a long Windows glide (3 s) at the end, then a gentle swipe -> next", () => {
    const s = new Sim(LAPTOP, 3, 0).play(swipe(300, { decay: 0.985 })).wait(500);
    assert.equal(s.active, 3, "the glide alone stopped at the end");
    s.play(swipe(80, { seed: 6 })).wait(900);
    assert.equal(s.active, 4);
  });

  test("a gentle 55 px touchpad swipe moves one section", () => {
    const s = new Sim(LAPTOP, 0).play(swipe(55, { glide: false })).wait(900);
    assert.equal(s.active, 1);
  });

  test("small mouse notches (33 px, Windows set to one line) work one by one", () => {
    const s = new Sim(LAPTOP, 0).play(mouse(1, 0, 33.3)).wait(900);
    assert.equal(s.active, 1, "notch on a section that fits");
    const t = new Sim(LAPTOP, 3, 0).play(mouse(8, 60, 33.3)).wait(800).play(mouse(1, 0, 33.3)).wait(900);
    assert.equal(t.active, 4, "notch after reaching the end of the text");
  });

  test("leftover glide after a hold-up never finishes a section change", () => {
    // The glide of a swipe that already changed the section, cut by a 380 ms
    // gap (the browser was busy), arrives as if it were a new gesture.
    const s = new Sim([0, 0, 0, 0], 0).play(swipe(400, { decay: 0.95 })).wait(900);
    assert.equal(s.active, 1);
    let v = 6;
    const tail: Ev[] = [];
    for (let at = 0; v >= 1; at += 16, v *= 0.95) tail.push({ at, dy: v });
    s.play(tail).wait(900);
    assert.equal(s.active, 1);
    assert.equal(s.p, 1);
  });

  test("a full trackpad drag never moves two sections", () => {
    const s = new Sim([0, 0, 0, 0], 0).play(steady(30, 300)).wait(900);
    assert.equal(s.active, 1);
  });
});
