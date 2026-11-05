// Applies patches/ (patch-package) after npm install.
// The API deploy on Vercel installs without the mobile app's native packages
// or patch-package itself, so there is nothing to patch there: skip quietly.
// Everywhere the patched package is installed (EAS, local), patch-package
// must be present too, and a failure stops the install.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const has = (p) => {
  try {
    require.resolve(p);
    return true;
  } catch {
    return false;
  }
};

if (!has("onnxruntime-react-native/package.json")) {
  console.log("apply-patches: onnxruntime-react-native not installed, nothing to patch");
} else if (!has("patch-package/index.js") && process.env.VERCEL) {
  // Vercel builds only the API, which never loads the mobile packages.
  console.log("apply-patches: patch-package missing on Vercel, skipping (API build only)");
} else {
  const bin = require.resolve("patch-package/index.js");
  execFileSync(process.execPath, [bin], { stdio: "inherit" });
}
