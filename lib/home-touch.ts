/**
 * Touch decisions for the home page sections. The page scrolls section text
 * itself (not the browser), so one slow finger can scroll the text to its end
 * and carry on into the next section, while a fast swipe stops at the end.
 *
 * No DOM code here, so these rules can be unit tested
 * (see tests/home-touch.test.ts).
 */

export const TOUCH = {
  /** Share of the screen height that a swipe needs for a full section change. */
  distance: 0.32,
  /** Share of the way that finishes a change on release. */
  commit: 0.22,
  /** After the text last moved, a swipe at its end waits this long before it can change the section. */
  land: 500,
  /** px/ms: a finger slower than this carries on from the text into the next section. */
  slow: 0.4,
  /** px/ms: a release faster than this finishes the change in its direction. */
  flick: 0.45,
  /** Share of speed kept per millisecond while text coasts after a swipe. */
  decay: 0.9975,
  /** Pixels a finger must move before the page decides what the swipe does. */
  start: 6,
} as const;

/** Does a new swipe scroll the text, or move between sections? */
export function chooseTouchMode(o: {
  startedInBox: boolean;
  long: boolean;
  canScroll: boolean;
  justScrolled: boolean;
}): "text" | "section" {
  // Inside a long section the text moves first. Right after the text moved,
  // a swipe at its end stays a text swipe: fast, it stops there; slow, it
  // carries on to the next section. Swipes on the portrait or the tabs always
  // change the section.
  return o.startedInBox && o.long && (o.canScroll || o.justScrolled) ? "text" : "section";
}

export type TextDrag = {
  /** Unrounded scroll position of the text box. */
  textPos: number;
  /** Largest scroll position of the text box. */
  max: number;
  /** Finger pixels past the end of the text, moving the section. */
  past: number;
};

/**
 * Apply a finger movement of `d` pixels (above 0 is toward the next section)
 * to a text swipe. The text moves first; at its end, a slow finger moves the
 * section, and a fast one stops (`stopped`; the page then restarts the short
 * stop, so quick repeated flicks at the end keep stopping). Turning back
 * first undoes section movement.
 */
export function splitMove(s: TextDrag, d: number, slow: boolean): TextDrag & { handoff: boolean; stopped: boolean } {
  let { past, textPos } = s;
  let rest = d;
  let handoff = false;
  let stopped = false;
  if (past !== 0) {
    const next = past + rest;
    if (Math.sign(next) === Math.sign(past)) {
      past = next;
      rest = 0;
    } else {
      past = 0;
      rest = next;
    }
  }
  if (rest !== 0) {
    const want = textPos + rest;
    textPos = Math.max(0, Math.min(s.max, want));
    const over = want - textPos;
    if (Math.abs(over) > 0.01) {
      if (slow) {
        past = over;
        handoff = true;
      } else {
        stopped = true;
      }
    }
  }
  return { textPos, max: s.max, past, handoff, stopped };
}

/** Finger speed from recent samples, in px/ms. Above 0 is upward (toward the next section). */
export function fingerSpeed(samples: { y: number; t: number }[], now: number): number {
  const recent = samples.filter((s) => now - s.t <= 100);
  if (recent.length < 2) return 0;
  return (recent[0].y - recent[recent.length - 1].y) / Math.max(16, now - recent[0].t);
}

/**
 * Where a released swipe goes, relative to the current section: +1, -1 or 0.
 * `offset` is how far the section moved (in sections), `v` the release speed.
 */
export function releaseTarget(offset: number, v: number): number {
  const flick = Math.abs(v) > TOUCH.flick ? Math.sign(v) : 0;
  if (flick && Math.sign(offset) === flick) return flick;
  return Math.abs(offset) >= TOUCH.commit ? Math.sign(offset) : 0;
}

/** One frame of text coasting after a swipe. It stops at the ends and never changes the section. */
export function flingStep(pos: number, v: number, dt: number, max: number) {
  const next = Math.max(0, Math.min(max, pos + v * dt));
  const nv = v * Math.pow(TOUCH.decay, dt);
  const done = next <= 0 || next >= max || Math.abs(nv) < 0.02;
  return { pos: next, v: nv, done };
}
