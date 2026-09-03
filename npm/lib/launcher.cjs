const { createHash, randomBytes } = require("crypto");
const {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} = require("fs");
const { get: httpsGet } = require("https");
const { homedir } = require("os");
const { join } = require("path");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");

const { version: VERSION } = require("../package.json");
const REPO = "openjobspec/ojs-playground";

function getPlatform(platform = process.platform, architecture = process.arch) {
  const os = { darwin: "darwin", linux: "linux" }[platform];
  const arch = { arm64: "arm64", x64: "amd64" }[architecture];
  if (!os || !arch) {
    throw new Error(
      `Unsupported platform: ${platform}-${architecture}. ` +
        "OJS Playground supports darwin-arm64, darwin-amd64, linux-amd64, and linux-arm64."
    );
  }
  return { os, arch };
}

function getBinaryName({ os, arch }) {
  return `ojs-playground-${os}-${arch}`;
}

function getBinaryPath(cacheDir, version, platform) {
  return join(
    cacheDir,
    `ojs-playground-${version}-${platform.os}-${platform.arch}`
  );
}

function parseChecksumFile(text, binaryName) {
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line.trim());
    if (match && match[2] === binaryName) return match[1];
  }
  throw new Error(`checksums.txt has no SHA-256 entry for ${binaryName}`);
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function ensureBinary(options = {}) {
  const version = options.version ?? VERSION;
  const repo = options.repo ?? REPO;
  const platform = options.platform ?? getPlatform();
  const cacheDir =
    options.cacheDir ??
    join(
      process.env.HOME ||
        process.env.USERPROFILE ||
        homedir() ||
        process.cwd(),
      ".ojs-playground",
      "bin"
    );
  const fetchText = options.fetchText ?? fetchUrlText;
  const downloadFile = options.downloadFile ?? downloadUrlToFile;
  const logger = options.logger ?? console;
  const binaryName = getBinaryName(platform);
  const binaryPath = getBinaryPath(cacheDir, version, platform);
  const releaseBase = `https://github.com/${repo}/releases/download/v${version}`;
  const expectedChecksum = parseChecksumFile(
    await fetchText(`${releaseBase}/checksums.txt`),
    binaryName
  );

  mkdirSync(cacheDir, { recursive: true });
  if (existsSync(binaryPath)) {
    if (sha256File(binaryPath) === expectedChecksum) return binaryPath;
    rmSync(binaryPath, { force: true });
    logger.warn(`Cached ${binaryName} failed checksum verification; downloading again.`);
  }

  const partialPath = `${binaryPath}.partial-${process.pid}-${randomBytes(6).toString("hex")}`;
  try {
    logger.log(`Downloading OJS Playground v${version} for ${platform.os}/${platform.arch}...`);
    await downloadFile(`${releaseBase}/${binaryName}`, partialPath);
    const actualChecksum = sha256File(partialPath);
    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `${binaryName} checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`
      );
    }
    chmodSync(partialPath, 0o755);
    renameSync(partialPath, binaryPath);
    logger.log("Download complete.\n");
    return binaryPath;
  } catch (error) {
    rmSync(partialPath, { force: true });
    rmSync(binaryPath, { force: true });
    throw error;
  } finally {
    rmSync(partialPath, { force: true });
  }
}

async function fetchUrlText(url) {
  const response = await request(url);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function downloadUrlToFile(url, destination) {
  const response = await request(url);
  await pipeline(
    response,
    createWriteStream(destination, { flags: "wx", mode: 0o600 })
  );
}

function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects while downloading ${url}`));
      return;
    }
    httpsGet(url, (response) => {
      const location = response.headers.location;
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        location
      ) {
        response.resume();
        request(new URL(location, url).toString(), redirects + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed: HTTP ${response.statusCode} for ${url}`));
        return;
      }
      resolve(response);
    }).on("error", reject);
  });
}

async function main() {
  const binaryPath = await ensureBinary();
  const args = process.argv.slice(2);
  if (args.length === 0) args.push("dev");

  const child = spawn(binaryPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

module.exports = {
  ensureBinary,
  getBinaryName,
  getBinaryPath,
  getPlatform,
  main,
  parseChecksumFile,
  sha256File,
};
