// Stand-in data until the Neon schema (build step 2), uploads (3),
// gap analysis (4), minutes ledger (5) and review queue (6) exist.
// Shapes follow the brief's data model so the swap is mechanical.

export interface ReviewCard {
  id: string;
  topic: string;
  prompt: string;
  note: string;
  status: "gap" | "skipped";
}

export interface Finding {
  id: string;
  status: "clear" | "gap" | "skipped";
  title: string;
  detail: string;
  sourceRef: string;
  fromNotes?: string;
}

export const me = { name: "Ama", minutesLeft: 142, minutesTotal: 200, renews: "1 December", mastered: 27 };

export const lastTopic = { title: "Enzyme kinetics", subject: "Biochemistry", clear: 5, total: 8, gaps: 2 };

export const reviewQueue: ReviewCard[] = [
  { id: "r1", topic: "Enzymes", prompt: "Why does a competitive inhibitor raise Km but not Vmax?", note: "You mixed these up on Tuesday · Slide 16", status: "gap" },
  { id: "r2", topic: "Markets", prompt: "Why does price elasticity change along a straight demand curve?", note: "Skipped last Friday · Lecture 4, page 9", status: "skipped" },
  { id: "r3", topic: "Enzymes", prompt: "What makes an inhibitor reversible?", note: "Gap from today · Slide 14", status: "gap" },
];

export const sessionFindings: Finding[] = [
  { id: "f1", status: "gap", title: "You said it's “bound weakly”, but not why.", detail: "", sourceRef: "Slide 14", fromNotes: "Held by non-covalent bonds, so it can leave the active site." },
  { id: "f2", status: "gap", title: "Km and Vmax were swapped.", detail: "", sourceRef: "Slide 16", fromNotes: "Competitive: Km rises, Vmax unchanged." },
  { id: "f3", status: "skipped", title: "Non-competitive inhibition never came up.", detail: "", sourceRef: "Slides 17 to 19" },
  { id: "c1", status: "clear", title: "Where a competitive inhibitor binds", detail: "", sourceRef: "Slide 12" },
  { id: "c2", status: "clear", title: "Adding more substrate", detail: "", sourceRef: "Slide 15" },
  { id: "c3", status: "clear", title: "Active site shape", detail: "", sourceRef: "Slide 9" },
  { id: "c4", status: "clear", title: "What an enzyme does", detail: "", sourceRef: "Slide 3" },
  { id: "c5", status: "clear", title: "Substrate and product", detail: "", sourceRef: "Slide 4" },
];
