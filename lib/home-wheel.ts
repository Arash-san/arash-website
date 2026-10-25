/**
 * Mouse wheel and trackpad handling for the home page sections.
 *
 * Scrolling has two layers. A section whose text does not fit scrolls inside
 * its own box first. When that text reaches its end, scrolling stops there
 * for a moment, so a fast spin or a trackpad glide does not skip ahead. After
 * that moment, an active scroll (a new spin, or still spinning, or a fresh
 * trackpad push) moves to the next section. Trackpad glide that only decays
 * never moves a section.
 *
 * This file has no DOM code, so the decisions can be unit tested with made-up
 * event streams (see tests/home-wheel.test.ts).
 */

export const WHEEL = {
  /** Trackpad pixels for a full section change. */
  distance: 280,
  /** Share of the way that finishes a change when the trackpad is released (about 50 px). */
  commit: 0.18,
  /** Milliseconds without wheel events that end a gesture. */
  gap: 220,
  /** A single wheel event this large (in pixels) is a mouse notch. Windows
   * sends about 33 px per notch when scrolling is set to one line. */
  mouseStep: 30,
  /** After the text last moved, wheel input waits this long before it can change the section. */
  land: 500,
  /** Milliseconds without events that end a trackpad drag between sections. */
  release: 140,
  /** After a section change, wheel input waits this long (even if nothing animates). */
  cooldown: 450,
  /** Events averaging less than a quarter of this (in pixels) never count as a push. */
  minPush: 8,
} as const;

export type WheelInput = {
  /** Scroll amount in pixels; above 0 goes toward the next section. */
  dy: number;
  /** Event time in milliseconds. */
  now: number;
  /** Can the active section's text box still scroll in this direction? */
  canScroll: boolean;
  /** Is the pointer over the active text box (so the browser scrolls it natively)? */
  overBox: boolean;
  /** When the active box's text last moved, in the same clock as `now`. */
  textMovedAt: number;
  /** Is a section change animating right now? */
  animating: boolean;
};

export type WheelAction =
  /** Let the browser scroll the text box. */
  | { kind: "native" }
  /** Scroll the text box by this many pixels (the pointer is outside it). */
  | { kind: "scrollBox"; by: number }
  /** Ignore the event and stop the page from scrolling. */
  | { kind: "swallow" }
  /** Change the section now, in this direction. */
  | { kind: "go"; dir: number }
  /** Show the section change partly done; `first` means the gesture just started. */
  | { kind: "drag"; offset: number; first: boolean };

type Mode = "text" | "section" | "done";

/**
 * True when the latest events are not decaying: either they clearly ramp up,
 * or the newest four average at least 95% of the four before them and at
 * least half of the gesture's biggest event. Glide falls faster than that
 * and ends far below its start.
 */
function steadyOrGrowing(r: number[], peak: number) {
  if (r.length < 4) return false;
  const half = Math.min(4, Math.floor(r.length / 2));
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const newer = mean(r.slice(-half));
  const older = mean(r.slice(-2 * half, -half));
  // A clear ramp up is always a push: glide only shrinks, even when rounded.
  if (newer >= 3 && newer >= older * 1.15) return true;
  return newer >= WHEEL.minPush / 4 && newer >= older * 0.95 && newer >= peak * 0.5;
}

export class WheelController {
  private mode: Mode = "done";
  private dir = 0;
  private acc = 0;
  private last = Number.NEGATIVE_INFINITY;
  private prevAbs = 0;
  /** Sizes of the latest events in this gesture, newest last. */
  private recent: number[] = [];
  /** Biggest event since the gesture started. */
  private peak = 0;
  /** No section change before this time. */
  private calmUntil = Number.NEGATIVE_INFINITY;

  /** Decide what one wheel event does. */
  handle(i: WheelInput): WheelAction {
    const abs = Math.abs(i.dy);
    const dir = Math.sign(i.dy);
    if (dir === 0) return { kind: "swallow" };
    // Turning back during a trackpad drag between sections is part of that
    // drag (scrubbing back), not a new gesture.
    const dragging = this.mode === "section" && this.acc !== 0;
    const fresh = i.now - this.last > WHEEL.gap || (dir !== this.dir && !dragging);
    this.last = i.now;

    // An active push shows up as events that stay steady or grow. Trackpad
    // glide only decays, so it never counts. A jump in size (a new swipe
    // during glide) starts the comparison afresh, but only counts once the
    // following events hold up too.
    const jump = !fresh && abs > this.prevAbs * 1.5 + 3;
    if (fresh || jump) {
      this.recent = [];
      this.peak = 0;
    }
    this.recent.push(abs);
    if (this.recent.length > 8) this.recent.shift();
    this.peak = Math.max(this.peak, abs);
    this.prevAbs = abs;
    const pushing = steadyOrGrowing(this.recent, this.peak);

    if (i.animating || i.now < this.calmUntil) {
      // Events during a section change belong to that change.
      this.dir = dir;
      this.mode = "done";
      this.acc = 0;
      return { kind: "swallow" };
    }

    if (fresh || (this.mode === "done" && pushing)) {
      this.dir = dir;
      this.acc = 0;
      this.mode = i.canScroll ? "text" : "section";
    }

    if (this.mode === "done") return { kind: "swallow" };

    if (this.mode === "text") {
      if (i.canScroll) return i.overBox ? { kind: "native" } : { kind: "scrollBox", by: i.dy };
      // The text is at its end. The rest of this gesture stops here, unless
      // the reader keeps pushing after the text has settled.
      if (!(pushing && i.now - i.textMovedAt >= WHEEL.land)) return { kind: "swallow" };
      this.mode = "section";
      this.acc = 0;
    }

    // Section mode. The text just stopped moving: hold still for a moment.
    if (i.now - i.textMovedAt < WHEEL.land) return { kind: "swallow" };
    if (this.acc === 0 && abs >= WHEEL.mouseStep) return this.go(dir, i.now);
    const first = this.acc === 0;
    this.acc += i.dy;
    const offset = this.acc / WHEEL.distance;
    if (Math.abs(offset) >= 1) return this.go(Math.sign(offset), i.now);
    return { kind: "drag", offset, first };
  }

  private go(dir: number, now: number): WheelAction {
    this.mode = "done";
    this.acc = 0;
    this.calmUntil = now + WHEEL.cooldown;
    return { kind: "go", dir };
  }

  /**
   * Call when no wheel event arrived for WHEEL.release ms. Returns the
   * direction to finish a partial section change (+1 or -1), 0 to spring
   * back, or null when nothing is in progress.
   */
  release(): number | null {
    if (this.mode !== "section" || this.acc === 0) return null;
    const offset = this.acc / WHEEL.distance;
    this.mode = "done";
    this.acc = 0;
    return Math.abs(offset) >= WHEEL.commit ? Math.sign(offset) : 0;
  }

  /** Forget the current gesture (for example after a tab click). */
  reset() {
    this.mode = "done";
    this.acc = 0;
  }
}
