// Draws one scene frame onto a Skia canvas. Everything here runs on the UI
// thread as a worklet, once a frame, so it only uses plain maths and Skia.
//
// The visual language (Fenny Drawing Kit v2) follows the principles of
// Visual Value, softened for Fenny:
//   one idea per picture; soft silver lines on near-black, one line weight,
//   rounded ends; only one thing lit (white fill, or steel blue for the thing
//   that changes); no gradients; few, small sentence-case labels;
//   built in a few beats, then at rest with at most one slow movement.
// Kit v5 (Dan Koe's habits): only the one lit thing carries a soft halo,
//   nothing else glows; a lit line drawing on carries a small light at its
//   pen tip, so the eye knows where the explanation is.
// Motion (kit v3): every move means one thing, always.
//   draw on = being built; drift = alive, at rest; jiggle (bounce) = random
//   motion, with a fading trail for speed; cross = through a boundary;
//   rise = bubbles, lighter; fall = grains settling, heavier; flow = carried
//   along; orbit = a repeating cycle; pulse = a signal; grow = more of it;
//   tip = one side wins; slide = where it sits; spark = a reaction; step = a
//   jump between levels. Speed is shown with trails, never blur or glow.
//   Under Reduce Motion nothing loops and only the slider changes the scene.
// The panel is 300 x 176; the view scales it to fit the screen.
import { Skia, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";
import type { BalanceScene, Change, CompareScene, CrowdScene, GraphScene, LinksScene, PairScene, PairSide, ParticlesScene, Scene, Shape, SpectrumScene, StairsScene, TestScene, ThresholdScene, TreeScene, UnitsScene, VennScene } from "./types";

export const VIEW_W = 300;
export const VIEW_H = 176;

export interface Frame {
  /** Seconds since the scene appeared. */
  t: number;
  /** Seconds, but running faster or slower when a slider changes speed. */
  T: number;
  /** The slider, smoothed, 0 to 1. */
  v: number;
  /** 0 to 1 as the scene builds in. */
  intro: number;
  /** True when Reduce Motion is on: nothing loops. */
  still: boolean;
}

const SIL = "#E6E9EE";
const BLUE = "#A9BEE6";
const LAB = "#8A8F98";
const PANEL = "#0D0E11";
const W0 = 1.6;
const TAU = Math.PI * 2;

// ---- small maths ----
function clamp(x: number, a = 0, b = 1) {
  "worklet";
  return Math.max(a, Math.min(b, x));
}
/** Soft landing, no overshoot. */
function ease(x: number) {
  "worklet";
  const k = clamp(x);
  return 1 - Math.pow(1 - k, 3);
}
function ease2(x: number) {
  "worklet";
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}
function rnd(s: number) {
  "worklet";
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function bounce(x: number, L: number) {
  "worklet";
  const m = ((x % (2 * L)) + 2 * L) % (2 * L);
  return m < L ? m : 2 * L - m;
}
/** Beat k of n: each part of the picture lands in turn as it builds. */
function beat(f: Frame, k: number, n: number) {
  "worklet";
  return ease(f.intro * (n + 1) - k);
}
function has(changes: Change[], target: string, does: string) {
  "worklet";
  for (let i = 0; i < changes.length; i++) if (changes[i].does === does && changes[i].target === target) return true;
  return false;
}
function hasKind(changes: Change[], does: string) {
  "worklet";
  for (let i = 0; i < changes.length; i++) if (changes[i].does === does) return true;
  return false;
}

// ---- marks ----
function fill(p: SkPaint, colour: string, a: number) {
  "worklet";
  p.setPathEffect(null);
  p.setStyle(0);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
}
function stroke(p: SkPaint, colour: string, a: number, w = W0, dash?: number[]) {
  "worklet";
  p.setStyle(1);
  p.setStrokeWidth(w);
  p.setStrokeCap(1);
  p.setStrokeJoin(1);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
  p.setPathEffect(dash ? Skia.PathEffect.MakeDash(dash, 0) : null);
}
/** The soft halo behind the one lit thing. Nothing else glows. */
function halo(c: SkCanvas, x: number, y: number, r: number, a: number) {
  "worklet";
  const hp = Skia.Paint();
  hp.setColor(Skia.Color(BLUE));
  hp.setAlphaf(clamp(a) * 0.45);
  hp.setMaskFilter(Skia.MaskFilter.MakeBlur(0, Math.min(7, 2.5 + r * 0.25), true));
  c.drawCircle(x, y, r + 1.5, hp);
}
function dot(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = SIL) {
  "worklet";
  if (a <= 0.01 || r <= 0) return;
  if (colour === BLUE && r >= 3) halo(c, x, y, r, a);
  fill(p, colour, a);
  c.drawCircle(x, y, r, p);
}
function ring(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = SIL) {
  "worklet";
  if (a <= 0.01 || r <= 0) return;
  stroke(p, colour, a);
  c.drawCircle(x, y, r, p);
}
/** A line drawn on from its start: k from 0 to 1. */
function line(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, a: number, colour = SIL, k = 1, dash?: number[], w = W0) {
  "worklet";
  if (a <= 0.01 || k <= 0) return;
  stroke(p, colour, a, w, dash);
  c.drawLine(x1, y1, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, p);
}
function arrow(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, a: number, colour = SIL, k = 1) {
  "worklet";
  line(c, p, x1, y1, x2, y2, a, colour, k);
  // The lit line carries a small light at its pen tip while it draws.
  if (colour === BLUE && k > 0.02 && k < 0.98) dot(c, p, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 2.6, a, BLUE);
  if (k < 0.98) return;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const s = 6;
  line(c, p, x2 - Math.cos(ang - 0.5) * s, y2 - Math.sin(ang - 0.5) * s, x2, y2, a, colour);
  line(c, p, x2 - Math.cos(ang + 0.5) * s, y2 - Math.sin(ang + 0.5) * s, x2, y2, a, colour);
}
/** A spark: four short rays where two things meet. It always means "a reaction happened here". */
function spark(c: SkCanvas, p: SkPaint, x: number, y: number, a: number, colour = BLUE) {
  "worklet";
  for (let i = 0; i < 4; i++) {
    const an = Math.PI / 4 + (i * Math.PI) / 2;
    line(c, p, x + Math.cos(an) * 7, y + Math.sin(an) * 7, x + Math.cos(an) * 12, y + Math.sin(an) * 12, a, colour);
  }
}
function label(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour = LAB, a = 1) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const w = font.getTextWidth(text);
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  fill(p, colour, a);
  c.drawText(text, left, y + 3.3, p, font);
}
function axes(c: SkCanvas, p: SkPaint, font: SkFont | null, f: Frame, L: number, T: number, R: number, B: number, xl: string, yl: string) {
  "worklet";
  const k = beat(f, 0, 4);
  line(c, p, L, B, L, T, 0.32, SIL, k);
  line(c, p, L, B, R, B, 0.32, SIL, k);
  label(c, p, font, xl, (L + R) / 2, B + 14, "center", LAB, k);
  if (font && yl) {
    c.save();
    c.translate(L - 13, (T + B) / 2);
    c.rotate(-90, 0, 0);
    label(c, p, font, yl, 0, 0, "center", LAB, k);
    c.restore();
  }
}

// ---- container: stuff moving between places ----
function drawParticles(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ParticlesScene, changes: Change[], f: Frame) {
  "worklet";
  const n = Math.max(1, s.zones.length);
  const zw = VIEW_W / n;
  const top = 16;
  const bottom = 146;
  const kDiv = beat(f, 0, 3);

  for (let k = 1; k < n; k++) {
    const x = k * zw;
    if (s.divider === "membrane") line(c, p, x, 14, x, 150, 0.35, SIL, kDiv, [6, 7]);
    else if (s.divider === "wall") line(c, p, x, 14, x, 150, 0.45, SIL, kDiv);
    else if (s.divider === "sieve") for (let i = 0; i < 7; i++) line(c, p, x, 17 + i * 19, x, 25 + i * 19, 0.45 * kDiv, SIL, 1, undefined, 3);
  }

  // Bouncing marks, so collisions between different kinds can spark.
  const hx: number[] = [];
  const hy: number[] = [];
  const hg: number[] = [];
  const hf: boolean[] = [];

  for (let g = 0; g < s.things.length; g++) {
    const th = s.things[g];
    const appear = has(changes, th.name, "appear");
    const crosses = has(changes, th.name, "cross");
    const fast = has(changes, th.name, "speed");
    const grows = has(changes, th.name, "grow");
    const lit = crosses || fast || grows;
    const tm = fast ? f.T : f.t;
    const x0 = th.zone * zw + 16;
    const w = zw - 32;
    const tx0 = th.to * zw + 16;
    const h = bottom - top;
    const cx = th.zone * zw + zw / 2;
    const cy = (top + bottom) / 2;
    const dense = th.count > 10;
    let size = th.mark === "dot" ? (dense ? 3.2 : 3.6) : dense ? 7.5 : 9;
    if (grows) size *= 0.55 + f.v * 1.0;

    for (let i = 0; i < th.count; i++) {
      const seed = g * 31 + i;
      const ph = rnd(seed + 9) * TAU;
      const bx = x0 + rnd(seed) * w;
      const by = top + 6 + rnd(seed + 7) * (h - 12);
      let x = bx;
      let y = by;
      let r = size;
      let a = beat(f, 1 + g * 0.5 + i / th.count, 3);
      if (appear) a *= clamp(f.v * th.count - i);

      switch (th.motion) {
        case "drift":
          x = bx + Math.sin(tm * 0.6 + ph) * 2.5;
          y = by + Math.cos(tm * 0.5 + ph) * 2.5;
          break;
        case "jiggle": {
          // Bounce: straight lines off the walls. A short trail of fading dots
          // shows speed, worked out from where the mark was a moment ago, so
          // it bends round the walls with it. Slow marks leave almost none.
          const vx = rnd(seed + 80) - 0.5;
          const vy = rnd(seed + 120) - 0.5;
          const ox = rnd(seed) * w;
          const oy = rnd(seed + 7) * (h - 8);
          x = x0 + bounce(ox + vx * tm * 50, w);
          y = top + 4 + bounce(oy + vy * tm * 50, h - 8);
          if (!f.still && th.mark !== "blocked") {
            const sp = fast ? speedAt(changes, f.v) : 1;
            for (let j = 1; j <= 3; j++) {
              const back = tm - sp * 0.05 * j;
              const gx = x0 + bounce(ox + vx * back * 50, w);
              const gy = top + 4 + bounce(oy + vy * back * 50, h - 8);
              // A trail dot hidden under its own mark would read as a second thing.
              if ((gx - x) * (gx - x) + (gy - y) * (gy - y) <= (size + 2) * (size + 2)) continue;
              dot(c, p, gx, gy, (th.mark === "dot" ? 2.2 : 2.6) * (1 - j * 0.2), a * (0.32 - j * 0.09));
            }
          }
          if (hx.length < 40) {
            hx.push(x);
            hy.push(y);
            hg.push(g);
            hf.push(fast);
          }
          break;
        }
        case "cross": {
          if (th.zone === th.to) break;
          const q = (tm / 3.6 + rnd(seed + 3)) % 1;
          if (th.mark === "blocked") {
            const edge = th.to > th.zone ? (th.zone + 1) * zw - 14 : th.zone * zw + 14;
            x = bx + (edge - bx) * Math.sin(q * Math.PI);
          } else {
            x = bx + (tx0 + rnd(seed) * w - bx) * ease2((q - 0.1) / 0.6);
            a *= q < 0.08 ? q / 0.08 : q > 0.85 ? (1 - q) / 0.15 : 1;
          }
          break;
        }
        case "rise": {
          // Bubbles: sway as they rise and swell a little near the top.
          const q = (tm * 0.18 + rnd(seed + 3)) % 1;
          y = bottom - q * h;
          x = bx + Math.sin(q * TAU * 1.5 + ph) * 4;
          r = size * (0.8 + q * 0.5);
          a *= Math.sin(q * Math.PI);
          break;
        }
        case "fall": {
          // Grains: slow down as they sink, land on the floor, then fade.
          const q = (tm * 0.14 + rnd(seed + 3)) % 1;
          y = top + ease(q * 1.25) * (h - 4);
          a *= q > 0.85 ? (1 - q) / 0.15 : Math.min(1, q / 0.08);
          break;
        }
        case "orbit": {
          const band = i % 3;
          const ang = tm * 0.6 * (1 - band * 0.2) + i * 2.4;
          x = cx + Math.cos(ang) * (16 + band * 14);
          y = cy + Math.sin(ang) * (16 + band * 14) * 0.9;
          break;
        }
        case "pulse":
          r = size * (1 + 0.12 * Math.sin(tm * 1.8 + ph));
          break;
        case "flow": {
          const q = (rnd(seed) + tm * 0.08) % 1;
          x = 10 + q * (VIEW_W - 20);
          a *= Math.min(1, q / 0.08, (1 - q) / 0.08);
          break;
        }
        default:
          break;
      }

      if (crosses && th.zone !== th.to) x += (tx0 - x0) * ease2(clamp(f.v * 0.85 * th.count - i));

      if (th.mark === "dot") dot(c, p, x, y, r, a, lit && th.count <= 6 ? BLUE : SIL);
      else if (th.mark === "ring") ring(c, p, x, y, r, a * 0.85);
      else {
        // Something stopped: a dim ring with a cross through it.
        ring(c, p, x, y, r, a * 0.5);
        const k = r * 0.42;
        line(c, p, x - k, y - k, x + k, y + k, a * 0.5);
        line(c, p, x + k, y - k, x - k, y + k, a * 0.5);
      }
    }
  }
  // Spark where two different kinds meet while things are moving fast.
  if (f.v > 0.3 && !f.still) {
    let sparks = 0;
    for (let i = 0; i < hx.length && sparks < 6; i++)
      for (let j = i + 1; j < hx.length && sparks < 6; j++) {
        if (hg[i] === hg[j] || !(hf[i] || hf[j])) continue;
        const dx = hx[i] - hx[j];
        const dy = hy[i] - hy[j];
        if (dx * dx + dy * dy < 144) {
          spark(c, p, (hx[i] + hx[j]) / 2, (hy[i] + hy[j]) / 2, beat(f, 2, 3));
          sparks++;
        }
      }
  }
  for (let k = 0; k < n; k++) label(c, p, font, s.zones[k], k * zw + zw / 2, 164, "center", LAB, beat(f, 2.5, 3));
}

// ---- path, fork, loop and network ----
function nodePositions(s: LinksScene): number[][] {
  "worklet";
  const n = s.nodes.length;
  const out: number[][] = [];
  if (s.layout === "line") {
    for (let i = 0; i < n; i++) out.push([n === 1 ? 150 : 34 + (i * 232) / (n - 1), n > 3 ? 80 + (i % 2 === 0 ? -20 : 20) : 80]);
  } else if (s.layout === "fork") {
    out.push([56, 84]);
    const m = n - 1;
    for (let i = 0; i < m; i++) out.push([236, m === 1 ? 84 : 30 + (i * 110) / (m - 1)]);
  } else if (s.layout === "loop") {
    if (n === 2) out.push([52, 84], [248, 84]);
    else for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * TAU;
      out.push([150 + Math.cos(ang) * 96, 80 + Math.sin(ang) * 52]);
    }
  } else {
    const spots = [[64, 40], [216, 130], [244, 44], [150, 76], [64, 124], [150, 24], [266, 98]];
    for (let i = 0; i < n; i++) out.push(spots[i]);
  }
  return out;
}

/** A point at distance d round a rounded rectangle, clockwise from the top left. */
function aroundLoop(d0: number, L: number, R: number, T: number, B: number, cr: number): number[] {
  "worklet";
  const wSeg = R - L - 2 * cr;
  const hSeg = B - T - 2 * cr;
  const q = (Math.PI / 2) * cr;
  const per = 2 * wSeg + 2 * hSeg + 4 * q;
  let d = ((d0 % per) + per) % per;
  if (d <= wSeg) return [L + cr + d, T];
  if ((d -= wSeg) <= q) { const an = -Math.PI / 2 + d / cr; return [R - cr + Math.cos(an) * cr, T + cr + Math.sin(an) * cr]; }
  if ((d -= q) <= hSeg) return [R, T + cr + d];
  if ((d -= hSeg) <= q) { const an = d / cr; return [R - cr + Math.cos(an) * cr, B - cr + Math.sin(an) * cr]; }
  if ((d -= q) <= wSeg) return [R - cr - d, B];
  if ((d -= wSeg) <= q) { const an = Math.PI / 2 + d / cr; return [L + cr + Math.cos(an) * cr, B - cr + Math.sin(an) * cr]; }
  if ((d -= q) <= hSeg) return [L, B - cr - d];
  d -= hSeg;
  const an = Math.PI + d / cr;
  return [L + cr + Math.cos(an) * cr, T + cr + Math.sin(an) * cr];
}

function drawLinks(c: SkCanvas, p: SkPaint, font: SkFont | null, s: LinksScene, changes: Change[], f: Frame) {
  "worklet";
  const pos = nodePositions(s);
  const stepping = hasKind(changes, "step");
  const tm = hasKind(changes, "speed") ? f.T : f.t;
  const m = s.links.length;
  const lit: boolean[] = [];
  for (let i = 0; i < s.nodes.length; i++) lit.push(false);
  const R = 10;

  if (s.layout === "loop" && s.nodes.length === 2) {
    // A circuit: a soft loop with charge running round.
    const L = 52;
    const Rr = 248;
    const T = 30;
    const B = 138;
    const cr = 20;
    stroke(p, SIL, 0.3 * beat(f, 0, 3));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(L, T, Rr - L, B - T), cr, cr), p);
    const per = 2 * (Rr - L - 2 * cr) + 2 * (B - T - 2 * cr) + TAU * cr;
    const on = stepping ? clamp(f.v * 1.3) : 1;
    for (let i = 0; i < 20; i++) {
      const pt = aroundLoop((i / 20) * per + tm * 60, L, Rr, T, B, cr);
      let near = false;
      for (let k = 0; k < 2; k++) if (Math.abs(pt[0] - pos[k][0]) < 15 && Math.abs(pt[1] - pos[k][1]) < 15) near = true;
      if (!near) dot(c, p, pt[0], pt[1], 2.8, beat(f, 2 + i / 20, 3) * 0.9 * on);
    }
    lit[1] = on > 0.3;
  } else {
    // Light passes (kit v6): cause links are quiet lines, and one light
    // travels them in the order things happen, lighting each node as it
    // arrives. Where the light goes shows the direction, so the lines need
    // no arrowheads. Under Reduce Motion the path is lit at once, with small
    // heads, and the end node is lit.
    // The path the light takes: in a fork only the first outcome, else every cause link in order.
    const path: number[] = [];
    for (let i = 0; i < m; i++) {
      const l = s.links[i];
      if (l.kind === "cause" && (s.layout !== "fork" || l.to === s.links[0].to)) path.push(i);
    }
    const ends = (i: number) => {
      "worklet";
      const l = s.links[i];
      const a1 = pos[l.from];
      const a2 = pos[l.to];
      const ang = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
      return [a1[0] + Math.cos(ang) * (R + 5), a1[1] + Math.sin(ang) * (R + 5), a2[0] - Math.cos(ang) * (R + 5), a2[1] - Math.sin(ang) * (R + 5)];
    };
    // Stepping (a slider): the newest link draws on lit, and the node it reaches is lit.
    let newest = -1;
    for (let i = 0; i < m; i++) {
      const l = s.links[i];
      const k = stepping ? clamp(f.v * m * 1.15 - i) : beat(f, 1 + (i / Math.max(1, m)) * 1.5, 3);
      if (k <= 0) continue;
      const e = ends(i);
      const onPath = path.indexOf(i) >= 0;
      if (l.kind === "tie") {
        line(c, p, e[0], e[1], e[2], e[3], 0.25, SIL, k, [2, 5]);
        continue;
      }
      if (l.kind === "cause") {
        const drawing = k < 0.98;
        line(c, p, e[0], e[1], e[2], e[3], onPath ? 0.55 : 0.3, SIL, k);
        // The pen tip carries the light while a line draws.
        if (drawing && onPath) dot(c, p, e[0] + (e[2] - e[0]) * k, e[1] + (e[3] - e[1]) * k, 2.6, 1, BLUE);
        if (f.still && !drawing) {
          const ang = Math.atan2(e[3] - e[1], e[2] - e[0]);
          const hs = 5.5;
          const col = onPath ? BLUE : SIL;
          const ha = onPath ? 0.9 : 0.35;
          if (onPath) line(c, p, e[0], e[1], e[2], e[3], 0.9, BLUE);
          line(c, p, e[2] - Math.cos(ang - 0.5) * hs, e[3] - Math.sin(ang - 0.5) * hs, e[2], e[3], ha, col);
          line(c, p, e[2] - Math.cos(ang + 0.5) * hs, e[3] - Math.sin(ang + 0.5) * hs, e[2], e[3], ha, col);
        }
        if (!drawing && onPath) newest = i;
      } else {
        line(c, p, e[0], e[1], e[2], e[3], 0.15 * k);
        for (let d = 0; d < 5; d++) {
          const q = (d / 5 + tm * 0.2) % 1;
          dot(c, p, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 2.4, k * Math.sin(q * Math.PI));
        }
      }
    }
    if (path.length > 0) {
      const built = stepping ? newest >= 0 : f.intro >= 0.999;
      if (f.still || stepping) {
        // At rest: the end of the path so far is lit.
        if (built) lit[s.links[stepping ? newest : path[path.length - 1]].to] = true;
      } else if (built) {
        // One light, one link at a time: travel, pause on the node it reached, move on.
        const TRAVEL = 1.1;
        const DWELL = 0.35;
        const loop = s.layout === "loop";
        const cycle = path.length * (TRAVEL + DWELL) + (loop ? 0 : 1.2);
        const u = tm % cycle;
        const at = Math.floor(u / (TRAVEL + DWELL));
        if (at >= path.length) {
          lit[s.links[path[path.length - 1]].to] = true;
        } else {
          const w = u - at * (TRAVEL + DWELL);
          const e = ends(path[at]);
          if (w < TRAVEL) {
            const q = ease2(w / TRAVEL);
            const q0 = Math.max(0, q - 0.3);
            line(c, p, e[0] + (e[2] - e[0]) * q0, e[1] + (e[3] - e[1]) * q0, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 1, BLUE, 1, undefined, W0 + 0.6);
            dot(c, p, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 2.6, 1, BLUE);
          } else {
            lit[s.links[path[at]].to] = true;
          }
        }
      }
    }
  }

  for (let i = 0; i < s.nodes.length; i++) {
    const x = pos[i][0];
    const y = pos[i][1];
    const a = beat(f, (i / s.nodes.length) * 0.8, 3);
    dot(c, p, x, y, R, a, PANEL);
    if (lit[i]) dot(c, p, x, y, 6.5, a, BLUE);
    else ring(c, p, x, y, R, a * 0.7);
    // Labels sit outside the shape: under a line, away from the middle of a loop, fork or web.
    const below = s.layout === "line" ? true : y >= 80;
    const ly = below ? (y > 140 ? y - 20 : y + 20) : y < 30 ? y - 15 : y - 20;
    label(c, p, font, s.nodes[i], x, ly, x < 40 ? "left" : x > 260 ? "right" : "center", lit[i] ? SIL : LAB, a);
  }
}

// ---- plot: one thing changes with another ----
function shapeY(shape: Shape, x: number, shift: number, stretch: number) {
  "worklet";
  const X = x - shift;
  switch (shape) {
    case "rise":
      return 0.1 + 0.8 * X;
    case "fall":
      return 0.9 - 0.8 * X;
    case "saturate": {
      if (X <= 0) return 0;
      const km = 0.05 + stretch * 0.5;
      return (0.85 * X) / (km + X);
    }
    case "decay":
      return X <= 0 ? 0.9 : 0.9 * Math.exp(-X / (0.08 + stretch * 0.6));
    case "bell": {
      const w = 0.06 + stretch * 0.22;
      return 0.85 * Math.exp(-((X - 0.5) * (X - 0.5)) / (2 * w * w));
    }
    default: {
      const w = 0.03 + stretch * 0.15;
      return 0.9 / (1 + Math.exp(-(X - 0.5) / w));
    }
  }
}

function drawGraph(c: SkCanvas, p: SkPaint, font: SkFont | null, s: GraphScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 36;
  const R = 280;
  const T = 18;
  const B = 144;
  const X = (x: number) => L + x * (R - L);
  const Y = (y: number) => B - clamp(y, -0.02, 1.02) * (B - T);
  axes(c, p, font, f, L, T, R, B, s.x, s.y);

  // The lit curve: the one the slider moves, else the second of two.
  let litIndex = s.curves.length > 1 ? 1 : 0;
  for (let i = 0; i < s.curves.length; i++) {
    const n = s.curves[i].name;
    if (has(changes, n, "shift") || has(changes, n, "stretch") || has(changes, n, "ride")) litIndex = i;
  }
  const shifts: number[] = [];
  const stretches: number[] = [];
  for (let i = 0; i < s.curves.length; i++) {
    shifts.push(has(changes, s.curves[i].name, "shift") ? f.v * 0.28 : 0);
    stretches.push(has(changes, s.curves[i].name, "stretch") ? 0.12 + f.v * 0.88 : 0.35);
  }

  for (let i = 0; i < s.curves.length; i++) {
    const cv = s.curves[i];
    const isLit = i === litIndex;
    const stretched = has(changes, cv.name, "stretch");
    const moved = shifts[i] > 0.005 || (stretched && f.v > 0.02);
    for (let pass = moved ? 0 : 1; pass < 2; pass++) {
      const ghost = pass === 0;
      const sh = ghost ? 0 : shifts[i];
      const st = ghost ? (stretched ? 0.12 : 0.35) : stretches[i];
      const k = ghost ? 1 : beat(f, 1 + i, 4);
      const path = Skia.PathBuilder.Make();
      const end = 0.03 + 0.94 * k;
      for (let j = 0; j <= 80; j++) {
        const x = 0.03 + ((end - 0.03) * j) / 80;
        if (j === 0) path.moveTo(X(x), Y(shapeY(cv.shape, x, sh, st)));
        else path.lineTo(X(x), Y(shapeY(cv.shape, x, sh, st)));
      }
      stroke(p, isLit && !ghost ? BLUE : SIL, ghost ? 0.25 : isLit ? 1 : 0.55, W0, ghost ? [3, 6] : undefined);
      c.drawPath(path.build(), p);
      // Pen-tip light on the lit curve while it draws.
      if (isLit && !ghost && k > 0.02 && k < 0.98) dot(c, p, X(end), Y(shapeY(cv.shape, end, sh, st)), 2.6, 1, BLUE);
    }
    if (cv.label) label(c, p, font, cv.label, X(0.97) + 6, Y(shapeY(cv.shape, 0.97, shifts[i], stretches[i])), "left", isLit ? BLUE : LAB, beat(f, 3, 4));
  }

  const lit = s.curves[litIndex];
  const kH = beat(f, 3, 4);
  if (s.highlight === "crossing" && s.curves.length > 1) {
    let prev = 0;
    let found = -1;
    for (let k = 0; k <= 200; k++) {
      const x = k / 200;
      const d = shapeY(s.curves[0].shape, x, shifts[0], stretches[0]) - shapeY(s.curves[1].shape, x, shifts[1], stretches[1]);
      if (k > 0 && (d === 0 || d > 0 !== prev > 0)) {
        found = x;
        break;
      }
      prev = d;
    }
    if (found >= 0) {
      const px = X(found);
      const py = Y(shapeY(s.curves[0].shape, found, shifts[0], stretches[0]));
      line(c, p, px, py, px, B, 0.3, SIL, kH, [2, 5]);
      line(c, p, px, py, L, py, 0.3, SIL, kH, [2, 5]);
      dot(c, p, px, py, 4.5, kH);
    }
  } else if (s.highlight === "half") {
    let idx = 0;
    for (let i = 0; i < s.curves.length; i++) if (s.curves[i].shape === "saturate") idx = i;
    const kx = shifts[idx] + 0.05 + stretches[idx] * 0.5;
    line(c, p, L, Y(0.85), R, Y(0.85), 0.25, SIL, beat(f, 1, 4), [2, 5]);
    label(c, p, font, "Max", R, Y(0.85) - 9, "right", LAB, beat(f, 1, 4));
    line(c, p, L, Y(0.425), X(kx), Y(0.425), 0.3, SIL, kH, [2, 5]);
    line(c, p, X(kx), Y(0.425), X(kx), B, 0.3, SIL, kH, [2, 5]);
    label(c, p, font, "Half", L + 4, Y(0.425) - 9, "left", LAB, kH);
    dot(c, p, X(kx), Y(0.425), 4.5, kH);
  } else if (s.highlight === "end") {
    dot(c, p, X(0.97), Y(shapeY(lit.shape, 0.97, shifts[litIndex], stretches[litIndex])), 4.5, kH);
  }

  const rides = has(changes, lit.name, "ride");
  if (rides || s.highlight === "ride") {
    const q = rides ? 0.05 + f.v * 0.9 : f.still ? 0.4 : 0.05 + ((f.t * 0.1) % 1) * 0.9;
    const yq = shapeY(lit.shape, q, shifts[litIndex], stretches[litIndex]);
    if (rides) {
      line(c, p, X(q), Y(yq), X(q), B, 0.3, SIL, kH, [2, 5]);
      line(c, p, X(q), Y(yq), L, Y(yq), 0.3, SIL, kH, [2, 5]);
    }
    dot(c, p, X(q), Y(yq), 4.2, kH * (rides || f.still ? 1 : Math.sin(((q - 0.05) / 0.9) * Math.PI)), BLUE);
  }
}

// ---- balance: two sides being weighed ----
function drawBalance(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BalanceScene, changes: Change[], f: Frame) {
  "worklet";
  const lw = has(changes, "left", "weigh") ? Math.round(f.v * 6) : s.leftWeight;
  const rw = has(changes, "right", "weigh") ? Math.round(f.v * 6) : s.rightWeight;
  const cx = 150;
  const cy = 56;
  const arm = 96;
  const tilt = clamp((rw - lw) / 6, -1, 1) * 0.3 * beat(f, 1, 3);
  line(c, p, cx, cy + 6, cx, 140, 0.5, SIL, beat(f, 0, 3));
  line(c, p, cx - 34, 140, cx + 34, 140, 0.35, SIL, beat(f, 0, 3));
  const lx = cx - Math.cos(tilt) * arm;
  const ly = cy - Math.sin(tilt) * arm;
  const rx = cx + Math.cos(tilt) * arm;
  const ry = cy + Math.sin(tilt) * arm;
  line(c, p, lx, ly, rx, ry, 0.9, SIL, beat(f, 1, 3));
  ring(c, p, cx, cy, 4, beat(f, 1, 3));
  const heavier = rw > lw ? 1 : lw > rw ? -1 : 0;
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? lx : rx;
    const y = side === 0 ? ly : ry;
    const n = side === 0 ? lw : rw;
    const colour = (side === 0 && heavier < 0) || (side === 1 && heavier > 0) ? BLUE : SIL;
    const a = beat(f, 2, 3);
    line(c, p, x, y, x - 20, y + 32, 0.3 * a);
    line(c, p, x, y, x + 20, y + 32, 0.3 * a);
    line(c, p, x - 24, y + 32, x + 24, y + 32, 0.7 * a);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3);
      ring(c, p, x - 12 + (i % 3) * 12 + (row % 2) * 6, y + 25 - row * 10, 4.6, a, colour);
    }
    label(c, p, font, side === 0 ? s.left : s.right, x, y + 48, "center", LAB, a);
  }
  label(c, p, font, s.middle, cx, 162, "center", heavier !== 0 ? BLUE : LAB, beat(f, 2, 3));
}

// ---- scale and comparison ----
function drawCompare(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CompareScene, changes: Change[], f: Frame) {
  "worklet";
  const n = s.items.length;
  const stepping = hasKind(changes, "step");
  const values: number[] = [];
  let maxV = 0;
  let maxI = 0;
  for (let i = 0; i < n; i++) {
    const it = s.items[i];
    const v = has(changes, it.label.toLowerCase(), "grow") ? it.value * (0.08 + 0.92 * f.v) : it.value;
    values.push(v);
    if (v > maxV) {
      maxV = v;
      maxI = i;
    }
  }
  if (maxV <= 0) return;
  for (let i = 0; i < n; i++) {
    const shown = stepping ? clamp(f.v * n * 1.1 - i) : beat(f, (i / n) * 2, 3);
    if (shown <= 0) continue;
    const isLit = i === maxI || has(changes, s.items[i].label.toLowerCase(), "grow");
    if (s.style === "circles") {
      // Area in proportion. A huge ratio still shows the small one as a dot.
      const cell = VIEW_W / n;
      const maxR = Math.min(cell / 2 - 8, 62);
      const r = Math.max(1.8, maxR * Math.sqrt(values[i] / maxV));
      const x = cell * i + cell / 2;
      const y = 82;
      // A big lit circle is drawn as a blue outline so it never floods the panel.
      if (isLit && r > 16) ring(c, p, x, y, r, shown, BLUE);
      else if (isLit) dot(c, p, x, y, r, shown, BLUE);
      else if (r < 6) dot(c, p, x, y, r, shown);
      else ring(c, p, x, y, r, shown * 0.85);
      label(c, p, font, s.items[i].label, x, Math.max(y + r + 14, 104), "center", isLit ? SIL : LAB, shown);
    } else {
      const base = 146;
      const top = 22;
      const bw = Math.min(30, (240 / n) * 0.55);
      const gap = 240 / n;
      const x = 30 + gap * i + (gap - bw) / 2;
      const h = (base - top) * (values[i] / maxV) * ease(shown);
      if (isLit) {
        fill(p, BLUE, shown);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, base - h, bw, h), 3, 3), p);
      } else {
        stroke(p, SIL, shown * 0.7);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, base - h, bw, h), 3, 3), p);
      }
      label(c, p, font, s.items[i].label, x + bw / 2, base + 13, "center", isLit ? SIL : LAB, shown);
    }
  }
  if (s.style === "bars") line(c, p, 24, 146, 276, 146, 0.3, SIL, beat(f, 0, 3));
}

// ---- stairs: levels climbed in order ----
function drawStairs(c: SkCanvas, p: SkPaint, font: SkFont | null, s: StairsScene, changes: Change[], f: Frame) {
  "worklet";
  const n = s.steps.length;
  const lvl = hasKind(changes, "climb") ? Math.round(f.v * (n - 1)) : s.at;
  const w = Math.min(56, 250 / n);
  const h = Math.min(26, 120 / n);
  const x0 = (VIEW_W - w * n) / 2;
  const base = 148;
  line(c, p, x0, base, x0 + n * w, base, 0.3, SIL, beat(f, 0, 3));
  for (let i = 0; i < n; i++) {
    const k = beat(f, (i / n) * 2, 3);
    const x = x0 + i * w;
    const y = base - (i + 1) * h;
    const on = i <= lvl;
    line(c, p, x, base - i * h, x, y, on ? 0.85 : 0.25, SIL, k);
    line(c, p, x, y, x + w, y, on ? 0.85 : 0.25, SIL, k);
    label(c, p, font, s.steps[i], x + w / 2, y + 12, "center", on ? SIL : LAB, k);
  }
  const px = x0 + lvl * w + w / 2;
  const py = base - (lvl + 1) * h - 9;
  dot(c, p, px, py + (f.still ? 0 : Math.sin(f.t * 1.4) * 1.2), 5, beat(f, 3, 3), BLUE);
}

// ---- spectrum: where something sits between two ends ----
function drawSpectrum(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SpectrumScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 26;
  const R = 274;
  const Y = 92;
  const X = (v: number) => L + ((v - s.min) / (s.max - s.min)) * (R - L);
  line(c, p, L, Y, R, Y, 0.5, SIL, beat(f, 0, 3));
  for (let i = 0; i <= 10; i++) line(c, p, L + (i * (R - L)) / 10, Y - 4, L + (i * (R - L)) / 10, Y + 4, 0.3, SIL, beat(f, 1, 3));
  label(c, p, font, s.left, L, Y + 24, "left", LAB, beat(f, 1, 3));
  label(c, p, font, s.right, R, Y + 24, "right", LAB, beat(f, 1, 3));
  for (let i = 0; i < s.marks.length; i++) {
    const mx = X(s.marks[i].at);
    line(c, p, mx, Y - 10, mx, Y - 22, 0.25, SIL, beat(f, 2, 3));
    label(c, p, font, s.marks[i].label, mx, Y - 30, "center", LAB, beat(f, 2, 3));
  }
  const at = hasKind(changes, "slide") ? s.min + f.v * (s.max - s.min) : s.at;
  const k = beat(f, 3, 3);
  dot(c, p, X(at), Y, 6.5, k, BLUE);
  const span = s.max - s.min;
  label(c, p, font, span <= 20 ? at.toFixed(1) : String(Math.round(at)), X(at), Y - 52, "center", SIL, k);
}

// ---- Venn: what two things share ----
function drawVenn(c: SkCanvas, p: SkPaint, font: SkFont | null, s: VennScene, changes: Change[], f: Frame) {
  "worklet";
  const o = hasKind(changes, "overlap") ? f.v : s.overlap;
  const r = 48;
  const d = 120 - o * 80;
  const cy = 80;
  const ax = 150 - d / 2;
  const bx = 150 + d / 2;
  if (d < 2 * r) {
    c.save();
    const clip = Skia.PathBuilder.Make();
    clip.addCircle(ax, cy, r);
    c.clipPath(clip.build(), 1, true);
    dot(c, p, bx, cy, r, 0.85 * beat(f, 2, 3), BLUE);
    c.restore();
  }
  ring(c, p, ax, cy, r, beat(f, 0, 3));
  ring(c, p, bx, cy, r, beat(f, 1, 3));
  label(c, p, font, s.a, ax - r * 0.55, cy, "center", SIL, beat(f, 0, 3));
  label(c, p, font, s.b, bx + r * 0.55, cy, "center", SIL, beat(f, 1, 3));
  if (d < 2 * r - 10) label(c, p, font, s.both, 150, cy + r + 18, "center", BLUE, beat(f, 2, 3));
}

/** Draws one frame of a scene in the 300 x 176 view. */
// ---- pair: the difference between X and Y ----
/** A polyline through points (x, y) pairs, drawn on up to k of its length. */
function poly(c: SkCanvas, p: SkPaint, pts: number[], a: number, colour: string, k: number) {
  "worklet";
  const n = pts.length / 2 - 1;
  const upto = k * n;
  for (let i = 0; i < n; i++) {
    const seg = clamp(upto - i);
    if (seg <= 0) break;
    line(c, p, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], a, colour, seg);
  }
}
/** One small picture for one side of a pair. Each shape has one meaning. */
function glyph(c: SkCanvas, p: SkPaint, side: PairSide, cx: number, cy: number, colour: string, k: number, live: boolean, f: Frame) {
  "worklet";
  if (k <= 0) return;
  const a = colour === BLUE ? 1 : 0.7;
  const pts: number[] = [];
  switch (side.shape) {
    case "line":
      line(c, p, cx - 44, cy + 30, cx + 44, cy - 30, a, colour, k);
      break;
    case "curve":
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push(cx - 44 + u * 88, cy + 30 - (64 * (Math.exp(3 * u) - 1)) / (Math.exp(3) - 1));
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "jagged":
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push(cx - 44 + u * 88, cy + 14 - u * 28 + (rnd(i + 5) - 0.5) * 34);
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "smooth":
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push(cx - 44 + u * 88, cy + 14 - u * 28 + Math.sin(u * TAU) * 3);
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "split":
    case "join": {
      const n = Math.max(2, side.count);
      const one = side.shape === "split" ? cx - 38 : cx + 38;
      const many = side.shape === "split" ? cx + 36 : cx - 36;
      dot(c, p, one, cy, 6, a * ease(k * 2), colour);
      for (let i = 0; i < n; i++) {
        const y = cy + (n === 1 ? 0 : -34 + (i * 68) / (n - 1));
        const kk = clamp(k * 2 - 0.6 - i * 0.08);
        if (side.shape === "split") line(c, p, one + 7, cy, many - 6, y, a * 0.5, colour, kk);
        else line(c, p, many + 6, y, one - 7, cy, a * 0.5, colour, kk);
        dot(c, p, many, y, 4, a * kk, colour);
      }
      break;
    }
    case "scatter":
    case "aligned":
      for (let i = 0; i < 7; i++) {
        const gx = cx - 36 + (i % 3) * 36 + (i >= 6 ? 36 : 0);
        const gy = cy - 26 + Math.floor(i / 3) * 26;
        const ang = side.shape === "aligned" ? 0 : rnd(i + 11) * TAU;
        const kk = clamp(k * 1.6 - i * 0.08);
        arrow(c, p, gx - Math.cos(ang) * 10, gy - Math.sin(ang) * 10, gx + Math.cos(ang) * 10, gy + Math.sin(ang) * 10, a * 0.85, colour, kk);
      }
      break;
    case "one":
      if (colour === BLUE) dot(c, p, cx, cy, 26 * ease(k), a, BLUE);
      else ring(c, p, cx, cy, 26 * ease(k), a);
      break;
    case "many": {
      const n = Math.max(6, Math.min(24, side.count * 3));
      for (let i = 0; i < n; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        dot(c, p, cx - 40 + col * 16, cy - 24 + row * 16, 3.2, a * clamp(k * 1.5 - i / n), colour);
      }
      break;
    }
    case "loop": {
      const r = 30;
      const sweep = 300 * k;
      if (sweep > 1) {
        const b = Skia.PathBuilder.Make();
        b.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, sweep);
        stroke(p, colour, a);
        c.drawPath(b.build(), p);
      }
      if (live && !f.still && k >= 1) {
        const ang = -Math.PI / 2 + f.t * 0.6;
        dot(c, p, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 4, a, colour);
      }
      break;
    }
    case "path":
    default: {
      arrow(c, p, cx - 44, cy, cx + 44, cy, a, colour, k);
      if (live && !f.still && k >= 1) {
        const q = (f.t * 0.25) % 1;
        dot(c, p, cx - 40 + q * 80, cy, 3.4, a * Math.sin(q * Math.PI), colour);
      }
      break;
    }
  }
}
function drawPair(c: SkCanvas, p: SkPaint, font: SkFont | null, s: PairScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const kL = beat(f, 0.4, 3);
  // With a step slider, the right side builds in as the slider rises.
  const kR = stepping ? ease(clamp(f.v * 1.25)) * beat(f, 1, 3) : beat(f, 1.4, 3);
  const cy = 80;
  line(c, p, 150, 24, 150, 140, 0.16, SIL, beat(f, 0, 3));
  const sides = [s.left, s.right];
  for (let i = 0; i < 2; i++) {
    const side = sides[i];
    const cx = i === 0 ? 75 : 225;
    const lit = (i === 0 && s.lit === "left") || (i === 1 && s.lit === "right");
    const k = i === 0 ? kL : kR;
    glyph(c, p, side, cx, cy, lit ? BLUE : SIL, k, lit, f);
    label(c, p, font, side.label, cx, 18, "center", lit ? SIL : LAB, ease(k * 2));
    if (side.note) label(c, p, font, side.note, cx, 150, "center", lit ? BLUE : LAB, beat(f, i === 0 ? 2 : 2.5, 3) * ease(k * 1.5));
  }
}

// ---- tree: what branches from what ----
// A root on the left, branches, then leaves named on the right. A light
// travels from the root down the one path the lesson is about, and the node
// it reaches is lit.
function drawTree(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TreeScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const RX = 30;
  const RY = 86;
  const BX = 126;
  const LX = 210;
  let rows = 0;
  for (let b = 0; b < s.branches.length; b++) rows += Math.max(1, s.branches[b].leaves.length);
  const pitch = Math.min(26, 124 / Math.max(1, rows - 1));
  const top = RY - (pitch * (rows - 1)) / 2;
  const by: number[] = [];
  const ly: number[][] = [];
  let row = 0;
  for (let b = 0; b < s.branches.length; b++) {
    const n = Math.max(1, s.branches[b].leaves.length);
    const ys: number[] = [];
    for (let j = 0; j < n; j++) ys.push(top + (row + j) * pitch);
    by.push((ys[0] + ys[n - 1]) / 2);
    ly.push(s.branches[b].leaves.length ? ys : []);
    row += n;
  }
  const lb = s.lit.branch;
  const lf = s.lit.leaf;
  // The light's journey: root to branch, then branch to leaf.
  const lp = stepping ? f.v : beat(f, 3, 3);
  const twoLegs = lf >= 0;
  const leg1 = twoLegs ? clamp(lp * 2) : lp;
  const leg2 = twoLegs ? clamp(lp * 2 - 1) : 0;
  const arrived = lp >= 0.999;

  for (let b = 0; b < s.branches.length; b++) {
    const kB = beat(f, 0.8 + (b / s.branches.length) * 0.5, 3);
    const onPath = b === lb;
    const x1 = RX + 9;
    const x2 = BX - 7;
    line(c, p, x1, RY, x2, by[b], onPath && leg1 >= 1 ? 0.8 : 0.4, SIL, kB);
    if (onPath && leg1 > 0 && leg1 < 1) {
      const q0 = Math.max(0, leg1 - 0.35);
      line(c, p, x1 + (x2 - x1) * q0, RY + (by[b] - RY) * q0, x1 + (x2 - x1) * leg1, RY + (by[b] - RY) * leg1, 1, BLUE, 1, undefined, W0 + 0.6);
      dot(c, p, x1 + (x2 - x1) * leg1, RY + (by[b] - RY) * leg1, 2.6, 1, BLUE);
    }
    const leaves = s.branches[b].leaves;
    for (let j = 0; j < leaves.length; j++) {
      const kL = beat(f, 1.8 + (j / 3) * 0.4, 3);
      const leafLit = onPath && j === lf;
      line(c, p, BX + 7, by[b], LX - 5, ly[b][j], leafLit && leg2 >= 1 ? 0.8 : 0.4, SIL, kL);
      if (leafLit && leg2 > 0 && leg2 < 1) {
        const q0 = Math.max(0, leg2 - 0.35);
        const ax = BX + 7;
        const bx = LX - 5;
        line(c, p, ax + (bx - ax) * q0, by[b] + (ly[b][j] - by[b]) * q0, ax + (bx - ax) * leg2, by[b] + (ly[b][j] - by[b]) * leg2, 1, BLUE, 1, undefined, W0 + 0.6);
        dot(c, p, ax + (bx - ax) * leg2, by[b] + (ly[b][j] - by[b]) * leg2, 2.6, 1, BLUE);
      }
      const lit = leafLit && arrived;
      dot(c, p, LX, ly[b][j], lit ? 5 : 3.4, kL, lit ? BLUE : SIL);
      label(c, p, font, leaves[j], LX + 10, ly[b][j], "left", lit ? SIL : LAB, kL);
    }
    const branchLit = onPath && !twoLegs && arrived;
    dot(c, p, BX, by[b], 7, kB, PANEL);
    if (branchLit) dot(c, p, BX, by[b], 5, kB, BLUE);
    else ring(c, p, BX, by[b], 7, kB * 0.8);
    // Above the node for branches above the root, below for those under it, so no line runs through a label.
    if (leaves.length) label(c, p, font, s.branches[b].label, BX, by[b] > RY + 4 ? by[b] + 16 : by[b] - 15, "center", onPath ? SIL : LAB, beat(f, 1.6, 3));
    else label(c, p, font, s.branches[b].label, BX + 13, by[b], "left", branchLit ? SIL : LAB, beat(f, 1.6, 3));
  }
  const kR = beat(f, 0, 3);
  dot(c, p, RX, RY, 9, kR, PANEL);
  ring(c, p, RX, RY, 9, kR);
  label(c, p, font, s.root, 14, RY + 22, "left", LAB, kR);
}

// ---- test: does it pass every condition? ----
// A case travels a path through a row of gates. It stops at the first gate it
// fails, and that gate is lit; if it passes them all it reaches the outcome.
function drawTest(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TestScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.gates.length;
  const Y = 84;
  const X0 = 26;
  const X1 = 280;
  const G0 = 70;
  const G1 = 210;
  const fails = s.fails;
  const stopX = fails >= 0 ? G0 + (fails * (G1 - G0)) / Math.max(1, n - 1) - 11 : X1;
  const kT = stepping ? f.v : beat(f, 3, 3);
  const done = kT >= 0.999;
  const failedNow = done && fails >= 0;

  line(c, p, X0, Y, X1, Y, 0.32, SIL, beat(f, 0, 3));
  for (let i = 0; i < n; i++) {
    const x = G0 + (i * (G1 - G0)) / Math.max(1, n - 1);
    const a = beat(f, 0.8 + (i / n) * 0.8, 3) * (failedNow && i > fails ? 0.3 : 1);
    const lit = failedNow && i === fails;
    const col = lit ? BLUE : SIL;
    const w = lit ? W0 + 0.6 : W0;
    line(c, p, x, Y - 22, x, Y - 9, a * 0.9, col, 1, undefined, w);
    line(c, p, x, Y + 9, x, Y + 22, a * 0.9, col, 1, undefined, w);
    if (lit) dot(c, p, x, Y - 22, 3.2, 1, BLUE);
    const gy = n >= 4 && i % 2 === 1 ? Y - 36 : Y + 36;
    label(c, p, font, s.gates[i], x, gy, "center", lit ? SIL : LAB, beat(f, 2, 3) * (failedNow && i > fails ? 0.5 : 1));
  }
  label(c, p, font, s.case, 14, Y - 18, "left", LAB, beat(f, 1, 3));
  // The case: lit while it travels, and at the end if it passes everything.
  const x = X0 + (stopX - X0) * kT;
  const moving = kT > 0.01 && !done;
  if (moving && !f.still) {
    for (let j = 1; j <= 3; j++) dot(c, p, x - j * 4.5, Y, 3 - j * 0.5, 0.5 - j * 0.12);
  }
  const caseLit = moving || (done && fails < 0);
  dot(c, p, x, Y, caseLit ? 5 : 3.6, beat(f, 1, 3), caseLit ? BLUE : SIL);
  if (done && s.outcome) {
    if (fails >= 0) label(c, p, font, s.outcome, stopX + 24, Y - 14, "left", SIL, 1);
    else label(c, p, font, s.outcome, X1, Y - 16, "right", SIL, 1);
  }
}

// ---- threshold: has it crossed the line? ----
// A level rises in a tube against one marked line. The level is lit while it
// rises; once it crosses, the line is lit instead.
function drawThreshold(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ThresholdScene, changes: Change[], f: Frame) {
  "worklet";
  const filling = hasKind(changes, "fill");
  const TX = 62;
  const TW = 34;
  const TT = 22;
  const TB = 142;
  const H = TB - TT;
  const kTube = beat(f, 0, 3);
  stroke(p, SIL, 0.5 * kTube);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(TX, TT, TW, H), 6, 6), p);
  const lv = filling ? f.v : s.value * beat(f, 3, 3);
  const yL = TB - H * lv;
  const yT = TB - H * s.at;
  const crossed = lv >= s.at;
  if (lv > 0.04) {
    fill(p, SIL, 0.1);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(TX + 3, yL, TW - 6, TB - 3 - yL), 3, 3), p);
    line(c, p, TX + 4, yL, TX + TW - 4, yL, 1, crossed ? SIL : BLUE, 1, undefined, crossed ? W0 : W0 + 0.6);
  }
  const kLine = beat(f, 1, 3);
  const LX2 = TX + TW + 58;
  if (crossed) {
    line(c, p, TX - 14, yT, LX2, yT, 1, BLUE, 1, undefined, W0 + 0.6);
    dot(c, p, LX2, yT, 3.2, 1, BLUE);
  } else {
    line(c, p, TX - 14, yT, LX2, yT, 0.7, SIL, kLine, [6, 7]);
  }
  label(c, p, font, s.line, LX2 + 9, yT, "left", crossed ? SIL : LAB, kLine);
  label(c, p, font, s.level, TX + TW / 2, TB + 14, "center", LAB, beat(f, 2, 3));
}

// ---- units: how many out of 100 ----
// A ten by ten field of dots; the lit ones are counted in from the top left.
// They are lit as a group, so they carry no halo.
function drawUnits(c: SkCanvas, p: SkPaint, font: SkFont | null, s: UnitsScene, changes: Change[], f: Frame) {
  "worklet";
  const growing = hasKind(changes, "grow");
  const X0 = 30;
  const Y0 = 26;
  const P = 12.6;
  const shown = Math.round(s.lit * (growing ? f.v : beat(f, 2.4, 3)));
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10);
    const col = i % 10;
    const a = beat(f, (r / 10) * 1.6, 3);
    const lit = i < shown;
    dot(c, p, X0 + col * P, Y0 + r * P, lit ? 2.9 : 2.5, lit ? a : a * 0.45, lit ? BLUE : SIL);
  }
  const kLab = beat(f, 2, 3);
  label(c, p, font, `${shown} in 100`, 172, 64, "left", SIL, kLab);
  label(c, p, font, s.label, 172, 78, "left", LAB, kLab);
  if (s.rest) {
    label(c, p, font, `${100 - shown} in 100`, 172, 106, "left", LAB, kLab);
    label(c, p, font, s.rest, 172, 120, "left", LAB, kLab * 0.8);
  }
}

// ---- crowd: which one stands out ----
// Many quiet grey lines with the same shape, then one drawn on lit and named
// at its end.
function crowdY(shape: string, u: number, off: number) {
  "worklet";
  if (shape === "rise") return 0.18 + 0.55 * u + off;
  if (shape === "fall") return 0.75 - 0.55 * u + off;
  return 0.45 + off;
}
function standoutY(s: CrowdScene, u: number) {
  "worklet";
  const bump = Math.exp(-((u - 0.62) * (u - 0.62)) / 0.012);
  if (s.litShape === "peak") return crowdY(s.crowd, u, 0) + 0.3 * bump;
  if (s.litShape === "dip") return crowdY(s.crowd, u, 0) - 0.3 * bump;
  return crowdY(s.litShape, u, 0);
}
function drawCrowd(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CrowdScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 36;
  const R = 262;
  const T = 18;
  const B = 140;
  axes(c, p, font, f, L, T, R, B, s.x, s.y);
  const X = (u: number) => L + 6 + u * (R - L - 12);
  const Y = (v: number) => B - 6 - clamp(v, 0, 1) * (B - T - 14);
  const N = 14;
  for (let j = 0; j < s.count; j++) {
    const off = (rnd(j + 3) - 0.5) * 0.34;
    const k = beat(f, 1 + (j / s.count) * 0.6, 3);
    if (k <= 0.01) continue;
    const path = Skia.PathBuilder.Make();
    const m = Math.max(1, Math.round(N * k));
    for (let i = 0; i <= m; i++) {
      const u = i / N;
      const v = crowdY(s.crowd, u, off) + (rnd(j * 31 + i) - 0.5) * 0.05;
      if (i === 0) path.moveTo(X(u), Y(v));
      else path.lineTo(X(u), Y(v));
    }
    stroke(p, SIL, 0.22);
    c.drawPath(path.build(), p);
  }
  const kL = beat(f, 2.4, 3);
  if (kL > 0.01) {
    const path = Skia.PathBuilder.Make();
    for (let i = 0; i <= 60; i++) {
      const u = (kL * i) / 60;
      if (i === 0) path.moveTo(X(u), Y(standoutY(s, u)));
      else path.lineTo(X(u), Y(standoutY(s, u)));
    }
    stroke(p, BLUE, 1);
    c.drawPath(path.build(), p);
    dot(c, p, X(kL), Y(standoutY(s, kL)), kL < 0.99 ? 2.6 : 3.4, 1, BLUE);
    label(c, p, font, s.lit, X(1), Y(standoutY(s, 1)) - 11, "right", SIL, clamp((kL - 0.9) * 10));
  }
}

export function drawScene(c: SkCanvas, scene: Scene, changes: Change[], f: Frame, font: SkFont | null) {
  "worklet";
  const p = Skia.Paint();
  p.setAntiAlias(true);
  switch (scene.family) {
    case "particles":
      drawParticles(c, p, font, scene, changes, f);
      break;
    case "links":
      drawLinks(c, p, font, scene, changes, f);
      break;
    case "graph":
      drawGraph(c, p, font, scene, changes, f);
      break;
    case "balance":
      drawBalance(c, p, font, scene, changes, f);
      break;
    case "compare":
      drawCompare(c, p, font, scene, changes, f);
      break;
    case "stairs":
      drawStairs(c, p, font, scene, changes, f);
      break;
    case "spectrum":
      drawSpectrum(c, p, font, scene, changes, f);
      break;
    case "venn":
      drawVenn(c, p, font, scene, changes, f);
      break;
    case "pair":
      drawPair(c, p, font, scene, changes, f);
      break;
    case "tree":
      drawTree(c, p, font, scene, changes, f);
      break;
    case "test":
      drawTest(c, p, font, scene, changes, f);
      break;
    case "threshold":
      drawThreshold(c, p, font, scene, changes, f);
      break;
    case "units":
      drawUnits(c, p, font, scene, changes, f);
      break;
    case "crowd":
      drawCrowd(c, p, font, scene, changes, f);
      break;
  }
}

/** How fast the scene's clock runs at slider value v, when the slider changes speed. */
export function speedAt(changes: Change[], v: number) {
  "worklet";
  return hasKind(changes, "speed") ? 0.2 + v * 3 : 1;
}
