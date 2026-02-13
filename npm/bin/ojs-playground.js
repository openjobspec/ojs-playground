#!/usr/bin/env node

const { execFileSync, spawn } = require("child_process");
const { existsSync, mkdirSync, createWriteStream, chmodSync } = require("fs");
const { join } = require("path");
const { get: httpsGet } = require("https");
const { pipeline } = require("stream/promises");

const VERSION = "0.1.0";
const REPO = "openjobspec/ojs-playground";
const CACHE_DIR = join(
  process.env.HOME || process.env.USERPROFILE || "/tmp",
  ".ojs-playground",
  "bin"
);

function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap = {
    darwin: "darwin",
    linux: "linux",
  };

  const archMap = {
    arm64: "arm64",
    x64: "amd64",
  };

  const os = platformMap[platform];
  const cpu = archMap[arch];

  if (!os || !cpu) {
    console.error(
      `Unsupported platform: ${platform}-${arch}. ` +
        "OJS Playground supports darwin-arm64, darwin-amd64, linux-amd64, and linux-arm64."
    );
    process.exit(1);
  }

  return { os, arch: cpu };
}

function getBinaryName({ os, arch }) {
  return `ojs-playground-${os}-${arch}`;
}

function getBinaryPath(platform) {
  return join(CACHE_DIR, `ojs-playground-${VERSION}-${platform.os}-${platform.arch}`);
}

function download(url) {
  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      resolve(res);
    }).on("error", reject);
  });
}

async function ensureBinary() {
  const platform = getPlatform();
  const binaryPath = getBinaryPath(platform);

  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  mkdirSync(CACHE_DIR, { recursive: true });

  const binaryName = getBinaryName(platform);
  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${binaryName}`;

  console.log(`Downloading OJS Playground v${VERSION} for ${platform.os}/${platform.arch}...`);

  try {
    const response = await download(url);
    const writer = createWriteStream(binaryPath);
    await pipeline(response, writer);
    chmodSync(binaryPath, 0o755);
    console.log("Download complete.\n");
  } catch (err) {
    console.error(`Failed to download from ${url}`);
    console.error(err.message);
    console.error(
      "\nYou can also build from source:\n" +
        "  git clone https://github.com/openjobspec/ojs-playground\n" +
        "  cd ojs-playground/server && make build"
    );
    process.exit(1);
  }

  return binaryPath;
}

async function main() {
  const binaryPath = await ensureBinary();
  const args = process.argv.slice(2);

  // Default to "dev" command if no args
  if (args.length === 0) {
    args.push("dev");
  }

  const child = spawn(binaryPath, args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  // Forward signals
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
}

main();
