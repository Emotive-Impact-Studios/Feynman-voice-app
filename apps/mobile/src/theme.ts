// Design tokens for the "one light" direction (round 3 on the design canvas).
// Graphite ground, glass surfaces, silver for the one thing to press,
// a soft steel-blue light for the student, coral only ever for a gap.

export const colour = {
  ground: "#0A0B0D",
  glass: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(20,21,24,0.85)",
  hairline: "rgba(255,255,255,0.12)",
  hairlineSoft: "rgba(255,255,255,0.08)",
  text: "#F2F3F5",
  textDim: "#6F737B",
  muted: "#8E929A",
  soft: "#A9ADB4",
  silver: "#E6E9EE",
  student: "#A9BEE6",
  gap: "#F09A80",
  clear: "#E6E9EE",
  onLight: "#0A0B0D",
} as const;

// Stops for the polished silver ring (a sweep gradient).
export const silverStops = ["#5B5F66", "#F2F4F7", "#8E939B", "#FFFFFF", "#666A72", "#CDD1D7", "#5B5F66"];

// The student's living light: drifting blobs plus a bright core.
export const lightBlobs = ["#8EA6D4", "#C7CFDC", "#6E86BC"];

export const font = {
  regular: "InstrumentSans_400Regular",
  medium: "InstrumentSans_500Medium",
  semibold: "InstrumentSans_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const radius = { card: 32, sheet: 38, pill: 999 } as const;

export const space = { gutter: 20, gap: 10 } as const;
