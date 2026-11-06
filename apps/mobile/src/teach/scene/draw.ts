// Draws one scene frame onto a Skia canvas. Everything here runs on the UI
// thread as a worklet, once a frame, so it only uses plain maths and Skia.
//
// The visual language (Fenny Drawing Kit): a 300 x 176 panel, steel-blue dots
// for things that move, thin silver rings for objects, dashed boundaries,
// coral only for something blocked, tiny grey mono capitals for labels, and
// slow eased loops. The app scales the panel to fit the screen.
import { Skia, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";
import type { BalanceScene, Change, GraphScene, LinksScene, ParticlesScene, Scene, Shape } from "./types";

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

const BLUE = "#A9BEE6";
const SILVER = "#C9CDD4";
const CORAL = "#F09A80";
const LABEL = "#7D828B";
const SOFT = "#A9ADB4";
const TEXT = "#E4E6EA";
const WHITE = "#FFFFFF";
const PANEL = "#0E1013";
const TAU = Math.PI * 2;

// ---- small maths ----
function clamp(x: number, a = 0, b = 1) {
  "worklet";
  return Math.max(a, Math.min(b, x));
}
function ease(x: number) {
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
  p.setShader(null);
  p.setPathEffect(null);
  p.setStyle(0);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
}
function stroke(p: SkPaint, colour: string, a: number, w: number, dash?: number[]) {
  "worklet";
  p.setShader(null);
  p.setStyle(1);
  p.setStrokeWidth(w);
  p.setStrokeCap(1);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
  p.setPathEffect(dash ? Skia.PathEffect.MakeDash(dash, 0) : null);
}
function dot(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = BLUE) {
  "worklet";
  if (a <= 0.01) return;
  fill(p, colour, a);
  c.drawCircle(x, y, r, p);
}
function ring(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = SILVER, w = 2) {
  "worklet";
  if (a <= 0.01) return;
  stroke(p, colour, a, w);
  c.drawCircle(x, y, r, p);
}
function line(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, colour: string, a: number, w: number, dash?: number[]) {
  "worklet";
  if (a <= 0.01) return;
  stroke(p, colour, a, w, dash);
  c.drawLine(x1, y1, x2, y2, p);
}
function glow(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = BLUE) {
  "worklet";
  if (a <= 0.01 || r <= 0) return;
  p.setPathEffect(null);
  p.setStyle(0);
  p.setColor(Skia.Color(WHITE));
  p.setAlphaf(clamp(a));
  const inner = Skia.Color(colour);
  const outer = Skia.Color(colour);
  outer[3] = 0;
  p.setShader(Skia.Shader.MakeRadialGradient({ x, y }, r, [inner, outer], null, 0));
  c.drawCircle(x, y, r, p);
  p.setShader(null);
}
function arrowHead(c: SkCanvas, p: SkPaint, x: number, y: number, ang: number, a: number) {
  "worklet";
  const s = 6;
  line(c, p, x - Math.cos(ang - 0.5) * s, y - Math.sin(ang - 0.5) * s, x, y, BLUE, a, 1.6);
  line(c, p, x - Math.cos(ang + 0.5) * s, y - Math.sin(ang + 0.5) * s, x, y, BLUE, a, 1.6);
}
function label(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour = LABEL, a = 1) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const t = text.toUpperCase();
  const w = font.getTextWidth(t);
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  fill(p, colour, a);
  c.drawText(t, left, y + 3, p, font);
}

// ---- particles: stuff moving between places ----
function drawParticles(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ParticlesScene, changes: Change[], f: Frame) {
  "worklet";
  const n = Math.max(1, s.zones.length);
  const zw = VIEW_W / n;
  const top = 16;
  const bottom = 146;
  const a0 = ease(f.intro);

  for (let k = 1; k < n; k++) {
    const x = k * zw;
    if (s.divider === "membrane") line(c, p, x, 12, x, 148, WHITE, 0.33 * a0, 3, [7, 7]);
    else if (s.divider === "wall") line(c, p, x, 12, x, 148, WHITE, 0.25 * a0, 2.5);
    else if (s.divider === "sieve") {
      fill(p, WHITE, 0.3 * a0);
      for (let i = 0; i < 7; i++) c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 4, 14 + i * 19, 8, 11), 4, 4), p);
    }
  }

  for (let g = 0; g < s.things.length; g++) {
    const th = s.things[g];
    const appear = has(changes, th.name, "appear");
    const crosses = has(changes, th.name, "cross");
    const fast = has(changes, th.name, "speed");
    const grows = has(changes, th.name, "grow");
    const tm = fast ? f.T : f.t;
    const x0 = th.zone * zw + 16;
    const w = zw - 32;
    const tx0 = th.to * zw + 16;
    const h = bottom - top;
    const cx = th.zone * zw + zw / 2;
    const cy = (top + bottom) / 2;
    const dense = th.count > 10;
    let size = th.mark === "dot" ? (dense ? 3.8 : 4.5) : dense ? 7.5 : 9.5;
    if (grows) size *= 0.55 + f.v * 1.0;

    for (let i = 0; i < th.count; i++) {
      const seed = g * 31 + i;
      const ph = rnd(seed + 9) * TAU;
      const bx = x0 + rnd(seed) * w;
      const by = top + 6 + rnd(seed + 7) * (h - 12);
      let x = bx;
      let y = by;
      let r = size;
      let a = clamp(a0 * 2 - i / th.count);
      if (appear) a *= clamp(f.v * th.count - i);

      switch (th.motion) {
        case "drift":
          x = bx + Math.sin(tm * 0.9 + ph) * 4;
          y = by + Math.cos(tm * 0.7 + ph) * 4;
          break;
        case "jiggle": {
          const vx = (rnd(seed + 80) - 0.5) * 2;
          const vy = (rnd(seed + 120) - 0.5) * 2;
          x = x0 + bounce(rnd(seed) * w + vx * tm * 24, w);
          y = top + 4 + bounce(rnd(seed + 7) * (h - 8) + vy * tm * 24, h - 8);
          break;
        }
        case "cross": {
          if (th.zone === th.to) break;
          const q = (tm / 3.4 + rnd(seed + 3)) % 1;
          if (th.mark === "blocked") {
            // Heads for the boundary and is turned back.
            const edge = th.to > th.zone ? (th.zone + 1) * zw - 14 : th.zone * zw + 14;
            x = bx + (edge - bx) * Math.sin(q * Math.PI);
          } else {
            const e = ease((q - 0.1) / 0.6);
            x = bx + (tx0 + rnd(seed) * w - bx) * e;
            a *= q < 0.08 ? q / 0.08 : q > 0.85 ? (1 - q) / 0.15 : 1;
          }
          break;
        }
        case "rise":
        case "fall": {
          const q = (tm * 0.22 + rnd(seed + 3)) % 1;
          y = th.motion === "rise" ? bottom - q * h : top + q * h;
          a *= Math.sin(q * Math.PI);
          break;
        }
        case "orbit": {
          const band = i % 3;
          const rad = 16 + band * 14;
          const ang = tm * 0.8 * (1 - band * 0.2) + i * 2.4;
          x = cx + Math.cos(ang) * rad;
          y = cy + Math.sin(ang) * rad * 0.9;
          break;
        }
        case "pulse":
          r = size * (1 + 0.18 * Math.sin(tm * 2.2 + ph));
          break;
        case "flow": {
          const q = (rnd(seed) + tm * 0.1) % 1;
          x = 10 + q * (VIEW_W - 20);
          a *= Math.min(1, q / 0.08, (1 - q) / 0.08);
          break;
        }
        default:
          break;
      }

      if (crosses && th.zone !== th.to) {
        const m = ease(clamp(f.v * 0.85 * th.count - i));
        x = x + (tx0 - x0) * m;
      }

      if (th.mark === "dot") dot(c, p, x, y, r, a);
      else if (th.mark === "ring") ring(c, p, x, y, r, a);
      else {
        ring(c, p, x, y, r, a, CORAL);
        const k = r * 0.42;
        line(c, p, x - k, y - k, x + k, y + k, CORAL, a, 2);
        line(c, p, x + k, y - k, x - k, y + k, CORAL, a, 2);
      }
    }
  }

  for (let k = 0; k < n; k++) label(c, p, font, s.zones[k], k * zw + zw / 2, 163, "center", LABEL, a0);
}

// ---- links: things joined in a chain ----
function nodePositions(s: LinksScene): number[][] {
  "worklet";
  const n = s.nodes.length;
  const out: number[][] = [];
  if (s.layout === "line") {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 150 : 34 + (i * 232) / (n - 1);
      const y = n > 3 ? 78 + (i % 2 === 0 ? -22 : 22) : 78;
      out.push([x, y]);
    }
  } else if (s.layout === "loop") {
    if (n === 2) {
      out.push([52, 84], [248, 84]);
    } else {
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / n) * TAU;
        out.push([150 + Math.cos(ang) * 100, 80 + Math.sin(ang) * 50]);
      }
    }
  } else {
    const spots = [
      [72, 42],
      [210, 128],
      [236, 46],
      [150, 84],
      [70, 122],
      [150, 26],
      [262, 100],
    ];
    for (let i = 0; i < n; i++) out.push(spots[i]);
  }
  return out;
}

function drawLinks(c: SkCanvas, p: SkPaint, font: SkFont | null, s: LinksScene, changes: Change[], f: Frame) {
  "worklet";
  const pos = nodePositions(s);
  const a0 = ease(f.intro);
  const stepping = hasKind(changes, "step");
  const tm = hasKind(changes, "speed") ? f.T : f.t;
  const m = s.links.length;
  const lit: boolean[] = [];
  for (let i = 0; i < s.nodes.length; i++) lit.push(false);
  const R = 11;

  // A circuit: two nodes on a loop with a stream running round.
  const circuit = s.layout === "loop" && s.nodes.length === 2;
  if (circuit) {
    const L = 52;
    const Rr = 248;
    const T = 30;
    const B = 138;
    const cr = 22;
    stroke(p, WHITE, 0.16 * a0, 2);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(L, T, Rr - L, B - T, ), cr, cr), p);
    const per = 2 * (Rr - L - 2 * cr) + 2 * (B - T - 2 * cr) + TAU * cr;
    const count = 22;
    const flowOn = stepping ? clamp(f.v * 1.3) : 1;
    for (let i = 0; i < count; i++) {
      let d = (((i / count) * per + tm * 60) % per + per) % per;
      // walk the rounded rectangle
      const wSeg = Rr - L - 2 * cr;
      const hSeg = B - T - 2 * cr;
      const q = (Math.PI / 2) * cr;
      let x = L + cr;
      let y = T;
      if (d <= wSeg) { x = L + cr + d; y = T; }
      else if ((d -= wSeg) <= q) { const an = -Math.PI / 2 + d / cr; x = Rr - cr + Math.cos(an) * cr; y = T + cr + Math.sin(an) * cr; }
      else if ((d -= q) <= hSeg) { x = Rr; y = T + cr + d; }
      else if ((d -= hSeg) <= q) { const an = d / cr; x = Rr - cr + Math.cos(an) * cr; y = B - cr + Math.sin(an) * cr; }
      else if ((d -= q) <= wSeg) { x = Rr - cr - d; y = B; }
      else if ((d -= wSeg) <= q) { const an = Math.PI / 2 + d / cr; x = L + cr + Math.cos(an) * cr; y = B - cr + Math.sin(an) * cr; }
      else if ((d -= q) <= hSeg) { x = L; y = B - cr - d; }
      else { d -= hSeg; const an = Math.PI + d / cr; x = L + cr + Math.cos(an) * cr; y = T + cr + Math.sin(an) * cr; }
      let near = false;
      for (let k = 0; k < 2; k++) if (Math.abs(x - pos[k][0]) < 15 && Math.abs(y - pos[k][1]) < 15) near = true;
      if (!near) dot(c, p, x, y, 3.2, clamp(a0 * 2 - i / count) * 0.95 * flowOn);
    }
    lit[0] = true;
    lit[1] = flowOn > 0.3;
  } else {
    for (let i = 0; i < m; i++) {
      const l = s.links[i];
      const k = stepping ? clamp(f.v * m * 1.15 - i) : clamp(a0 * (m + 1) - i);
      if (k <= 0) continue;
      const [x1, y1] = pos[l.from];
      const [x2, y2] = pos[l.to];
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const sx = x1 + Math.cos(ang) * (R + 4);
      const sy = y1 + Math.sin(ang) * (R + 4);
      const ex = x2 - Math.cos(ang) * (R + 4);
      const ey = y2 - Math.sin(ang) * (R + 4);
      if (l.kind === "tie") {
        line(c, p, sx, sy, sx + (ex - sx) * k, sy + (ey - sy) * k, SILVER, 0.35, 1.3, [3, 5]);
        continue;
      }
      if (l.kind === "cause") {
        line(c, p, sx, sy, sx + (ex - sx) * k, sy + (ey - sy) * k, BLUE, 0.7, 1.6);
        if (k >= 1) {
          arrowHead(c, p, ex, ey, ang, 0.85);
          if (!f.still) {
            const q = (tm * 0.45 + i * 0.37) % 1;
            dot(c, p, sx + (ex - sx) * q, sy + (ey - sy) * q, 2.4, 0.9 * Math.sin(q * Math.PI));
          }
        }
      } else {
        line(c, p, sx, sy, ex, ey, WHITE, 0.12 * k, 1.2);
        for (let d = 0; d < 6; d++) {
          const q = (d / 6 + tm * 0.25) % 1;
          dot(c, p, sx + (ex - sx) * q, sy + (ey - sy) * q, 2.8, k * Math.sin(q * Math.PI));
        }
      }
      if (k > 0.5) {
        lit[l.from] = true;
        lit[l.to] = true;
      }
    }
  }

  for (let i = 0; i < s.nodes.length; i++) {
    const [x, y] = pos[i];
    const on = lit[i];
    if (on) glow(c, p, x, y, 24, 0.32 + (f.still ? 0 : 0.08 * Math.sin(f.t * 1.6 + i)));
    fill(p, PANEL, a0);
    c.drawCircle(x, y, R, p);
    if (on) dot(c, p, x, y, R, 0.2 * a0);
    ring(c, p, x, y, R, a0 * (on ? 1 : 0.55), on ? BLUE : SILVER, 1.6);
    const below = y < 120;
    label(c, p, font, s.nodes[i], x, below ? y + 22 : y - 22, x < 40 ? "left" : x > 260 ? "right" : "center", on ? SOFT : LABEL, a0);
  }
}

// ---- graph: one thing changes with another ----
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
  const R = 284;
  const T = 16;
  const B = 144;
  const X = (x: number) => L + x * (R - L);
  const Y = (y: number) => B - clamp(y, -0.02, 1.02) * (B - T);
  const a0 = ease(f.intro);
  line(c, p, L, T, L, B, WHITE, 0.22, 1.3);
  line(c, p, L, B, R, B, WHITE, 0.22, 1.3);
  label(c, p, font, s.x, (L + R) / 2, B + 14, "center");
  if (font && s.y) {
    c.save();
    c.translate(L - 13, (T + B) / 2);
    c.rotate(-90, 0, 0);
    label(c, p, font, s.y, 0, 0, "center");
    c.restore();
  }

  // Which curve is lit: the one the slider moves, else the second of two.
  let litIndex = s.curves.length > 1 ? 1 : 0;
  for (let i = 0; i < s.curves.length; i++) {
    const n = s.curves[i].name;
    if (has(changes, n, "shift") || has(changes, n, "stretch") || has(changes, n, "ride")) litIndex = i;
  }

  const shifts: number[] = [];
  const stretches: number[] = [];
  for (let i = 0; i < s.curves.length; i++) {
    const cv = s.curves[i];
    shifts.push(has(changes, cv.name, "shift") ? f.v * 0.28 : 0);
    stretches.push(has(changes, cv.name, "stretch") ? 0.12 + f.v * 0.88 : 0.35);
  }

  for (let i = 0; i < s.curves.length; i++) {
    const cv = s.curves[i];
    const colour = i === litIndex ? BLUE : SILVER;
    const moved = shifts[i] > 0.005 || Math.abs(stretches[i] - 0.35) > 0.02 && has(changes, cv.name, "stretch");
    const paths = moved ? 2 : 1;
    for (let pass = 0; pass < paths; pass++) {
      const ghost = moved && pass === 0;
      const sh = ghost ? 0 : shifts[i];
      const st = ghost ? (has(changes, cv.name, "stretch") ? 0.12 : 0.35) : stretches[i];
      const path = Skia.PathBuilder.Make();
      const end = 0.03 + 0.94 * a0;
      for (let k = 0; k <= 80; k++) {
        const x = 0.03 + ((end - 0.03) * k) / 80;
        const px = X(x);
        const py = Y(shapeY(cv.shape, x, sh, st));
        if (k === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      }
      stroke(p, colour, ghost ? 0.28 : i === litIndex ? 1 : 0.75, 2, ghost ? [4, 6] : undefined);
      c.drawPath(path.build(), p);
    }
    if (cv.label) {
      const yEnd = shapeY(cv.shape, 0.97, shifts[i], stretches[i]);
      label(c, p, font, cv.label, X(0.97) + 6, Y(yEnd), "left", colour, a0);
    }
  }

  const lit = s.curves[litIndex];
  const pulse = f.still ? 0 : 0.15 * Math.sin(f.t * 2);
  if (s.highlight === "crossing" && s.curves.length > 1) {
    const a = s.curves[0];
    const b = s.curves[1];
    let prev = 0;
    let found = -1;
    for (let k = 0; k <= 200; k++) {
      const x = k / 200;
      const d = shapeY(a.shape, x, shifts[0], stretches[0]) - shapeY(b.shape, x, shifts[1], stretches[1]);
      if (k > 0 && (d === 0 || (d > 0) !== (prev > 0))) {
        found = x;
        break;
      }
      prev = d;
    }
    if (found >= 0) {
      const px = X(found);
      const py = Y(shapeY(a.shape, found, shifts[0], stretches[0]));
      line(c, p, px, py, px, B, WHITE, 0.22 * a0, 1.2, [3, 5]);
      line(c, p, px, py, L, py, WHITE, 0.22 * a0, 1.2, [3, 5]);
      glow(c, p, px, py, 16, (0.5 + pulse) * a0);
      dot(c, p, px, py, 5, a0, TEXT);
    }
  } else if (s.highlight === "half") {
    let idx = 0;
    for (let i = 0; i < s.curves.length; i++) if (s.curves[i].shape === "saturate") idx = i;
    const km = 0.05 + stretches[idx] * 0.5;
    const kx = shifts[idx] + km;
    line(c, p, L, Y(0.85), R, Y(0.85), WHITE, 0.2 * a0, 1.2, [3, 5]);
    label(c, p, font, "Max", R - 2, Y(0.85) - 8, "right", LABEL, a0);
    line(c, p, L, Y(0.425), X(kx), Y(0.425), WHITE, 0.2 * a0, 1.2, [3, 5]);
    label(c, p, font, "Half", L + 6, Y(0.425) - 8, "left", LABEL, a0);
    line(c, p, X(kx), Y(0.425), X(kx), B, BLUE, 0.45 * a0, 1.2, [3, 5]);
    dot(c, p, X(kx), Y(0.425), 4.5, a0, TEXT);
  } else if (s.highlight === "end") {
    const yE = shapeY(lit.shape, 0.97, shifts[litIndex], stretches[litIndex]);
    glow(c, p, X(0.97), Y(yE), 14, (0.5 + pulse) * a0);
    dot(c, p, X(0.97), Y(yE), 4.5, a0, TEXT);
  }

  // The lit point that rides the curve: the slider moves it, or it travels slowly.
  const rides = has(changes, lit.name, "ride");
  if (rides || s.highlight === "ride") {
    const q = rides ? 0.05 + f.v * 0.9 : f.still ? 0.4 : 0.05 + ((f.t * 0.12) % 1) * 0.9;
    const yq = shapeY(lit.shape, q, shifts[litIndex], stretches[litIndex]);
    if (rides) {
      line(c, p, X(q), Y(yq), X(q), B, WHITE, 0.2 * a0, 1.2, [3, 5]);
      line(c, p, X(q), Y(yq), L, Y(yq), WHITE, 0.2 * a0, 1.2, [3, 5]);
    }
    glow(c, p, X(q), Y(yq), 13, (rides ? 0.6 : 0.6 * Math.sin(((q - 0.05) / 0.9) * Math.PI)) * a0);
    dot(c, p, X(q), Y(yq), 4, a0, TEXT);
  }
}

// ---- balance: two sides being weighed ----
function drawBalance(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BalanceScene, changes: Change[], f: Frame) {
  "worklet";
  const a0 = ease(f.intro);
  const lw = has(changes, "left", "weigh") ? Math.round(f.v * 6) : s.leftWeight;
  const rw = has(changes, "right", "weigh") ? Math.round(f.v * 6) : s.rightWeight;
  const cx = 150;
  const cy = 58;
  const arm = 98;
  const tilt = clamp((rw - lw) / 6, -1, 1) * 0.3 * a0;
  const stand = Skia.PathBuilder.Make();
  stand.moveTo(cx, cy + 4);
  stand.lineTo(cx - 14, 140);
  stand.lineTo(cx + 14, 140);
  stand.close();
  fill(p, WHITE, 0.16 * a0);
  c.drawPath(stand.build(), p);
  line(c, p, cx - 40, 141, cx + 40, 141, WHITE, 0.2 * a0, 2);
  const lx = cx - Math.cos(tilt) * arm;
  const ly = cy - Math.sin(tilt) * arm;
  const rx = cx + Math.cos(tilt) * arm;
  const ry = cy + Math.sin(tilt) * arm;
  line(c, p, lx, ly, rx, ry, SILVER, 0.8 * a0, 2.4);
  dot(c, p, cx, cy, 4, a0, SILVER);
  const pan = (x: number, y: number, n: number, colour: string, name: string) => {
    "worklet";
    line(c, p, x, y, x - 22, y + 34, WHITE, 0.2 * a0, 1);
    line(c, p, x, y, x + 22, y + 34, WHITE, 0.2 * a0, 1);
    line(c, p, x - 26, y + 34, x + 26, y + 34, SILVER, 0.7 * a0, 2);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      ring(c, p, x - 13 + col * 13 + (row % 2) * 6, y + 27 - row * 11, 5, a0, colour, 1.6);
    }
    label(c, p, font, name, x, y + 50, "center", LABEL, a0);
  };
  const heavier = rw > lw ? 1 : lw > rw ? -1 : 0;
  pan(lx, ly, lw, heavier < 0 ? BLUE : SILVER, s.left);
  pan(rx, ry, rw, heavier > 0 ? BLUE : SILVER, s.right);
  label(c, p, font, s.middle, cx, 160, "center", heavier !== 0 ? BLUE : LABEL, a0);
}

/** Draws one frame of a scene in the 300 x 176 view. */
export function drawScene(c: SkCanvas, scene: Scene, changes: Change[], f: Frame, font: SkFont | null) {
  "worklet";
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (scene.family === "particles") drawParticles(c, p, font, scene, changes, f);
  else if (scene.family === "links") drawLinks(c, p, font, scene, changes, f);
  else if (scene.family === "graph") drawGraph(c, p, font, scene, changes, f);
  else drawBalance(c, p, font, scene, changes, f);
}

/** How fast the scene's clock runs at slider value v, when the slider changes speed. */
export function speedAt(changes: Change[], v: number) {
  "worklet";
  return hasKind(changes, "speed") ? 0.25 + v * 3.2 : 1;
}
