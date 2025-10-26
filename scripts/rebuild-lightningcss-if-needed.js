// scripts/rebuild-lightningcss-if-needed.js
const { execSync } = require("child_process");

function run(cmd) {
  console.log("> running:", cmd);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.warn("postinstall command failed (non-fatal):", e && e.message ? e.message : e);
    // Do not throw — we don't want to break installs if rebuild fails
  }
}

const isVercel = !!process.env.VERCEL;
const platform = process.platform; // 'linux', 'darwin', 'win32', etc.

console.log("postinstall: platform =", platform, "VERCEL =", !!process.env.VERCEL);

if (isVercel && platform === "linux") {
  // Only try rebuild on Vercel linux build machines
  // Force build-from-source for lightningcss only
  run("npm rebuild --build-from-source=lightningcss");
} else {
  console.log("Skipping lightningcss rebuild on this platform (not linux/vercel).");
}
