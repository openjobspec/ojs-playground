const { readFileSync } = require("fs");
const { spawnSync } = require("child_process");
const { resolve } = require("path");

const root = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const uiPkg = JSON.parse(
  readFileSync(resolve(root, "..", "ui", "package.json"), "utf8")
);
const uiLock = JSON.parse(
  readFileSync(resolve(root, "..", "ui", "package-lock.json"), "utf8")
);
const changelog = readFileSync(resolve(root, "..", "CHANGELOG.md"), "utf8");

if (
  pkg.version !== uiPkg.version ||
  uiLock.version !== pkg.version ||
  uiLock.packages[""].version !== pkg.version
) {
  throw new Error("npm launcher, UI manifest, and UI lockfile versions do not match");
}
if (!changelog.includes(`## [${pkg.version}]`)) {
  throw new Error(`CHANGELOG.md has no ${pkg.version} release heading`);
}
if (process.env.OJS_RELEASE_ASSETS) {
  run(process.execPath, [resolve(root, "..", "scripts", "verify-release-assets.mjs")]);
}

run(process.execPath, ["--check", resolve(root, pkg.bin["ojs-playground"])]);
const dryRun = JSON.parse(run("npm", ["pack", "--dry-run", "--json"], root))[0];
const files = new Set(dryRun.files.map((file) => file.path));
const binPath = pkg.bin["ojs-playground"];

if (!files.has(binPath)) {
  throw new Error(`Packed package omitted CLI entry point: ${binPath}`);
}
if (!files.has("lib/launcher.cjs")) {
  throw new Error("Packed package omitted checksum-verifying launcher library");
}

const binEntry = dryRun.files.find((file) => file.path === binPath);
if ((binEntry.mode & 0o111) === 0) {
  throw new Error(`Packed CLI entry point is not executable: ${binPath}`);
}

console.log(
  `Verified ${pkg.name}@${pkg.version} CLI syntax, executable mode, and dry-run package contents.`,
);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`
    );
  }
  return result.stdout.trim();
}
