// Bundles the function into Vercel's Build Output API layout:
//   .vercel/output/functions/api/turn.func/index.mjs
// One self-contained file, so workspace packages written in TypeScript and
// the eSpeak build inside `phonemizer` all come along without extra config.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const out = ".vercel/output";
const fn = `${out}/functions/api/turn.func`;
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: ["src/node-handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: `${fn}/index.mjs`,
  // Some dependencies use require(); give ESM output a working one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 30 }, null, 2),
);
writeFileSync(`${out}/config.json`, JSON.stringify({ version: 3 }, null, 2));
console.log(`Built ${fn}/index.mjs`);
