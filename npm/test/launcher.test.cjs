const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { join, resolve } = require("node:path");
const { afterEach, test } = require("node:test");
const { ensureBinary, getBinaryPath } = require("../lib/launcher.cjs");

const scratchRoot = resolve(__dirname, ".cache");
const platform = { os: "linux", arch: "amd64" };
const version = "0.5.0";
const binaryName = "ojs-playground-linux-amd64";
const fullBinary = Buffer.from("complete release binary");
const fullChecksum = sha256(fullBinary);

afterEach(() => rmSync(scratchRoot, { recursive: true, force: true }));

test("removes a truncated temporary download", async () => {
  const cacheDir = createCase("truncated");
  await assert.rejects(
    ensureBinary({
      version,
      platform,
      cacheDir,
      fetchText: async () => `${fullChecksum}  ${binaryName}\n`,
      downloadFile: async (_url, destination) => {
        writeFileSync(destination, fullBinary.subarray(0, 5));
      },
      logger: quietLogger(),
    }),
    /checksum mismatch/
  );
  assertNoBinaryOrPartials(cacheDir);
});

test("removes a checksum-mismatched temporary download", async () => {
  const cacheDir = createCase("mismatch");
  await assert.rejects(
    ensureBinary({
      version,
      platform,
      cacheDir,
      fetchText: async () => `${"0".repeat(64)}  ${binaryName}\n`,
      downloadFile: async (_url, destination) => {
        writeFileSync(destination, fullBinary);
      },
      logger: quietLogger(),
    }),
    /checksum mismatch/
  );
  assertNoBinaryOrPartials(cacheDir);
});

test("removes a partial file when the download fails", async () => {
  const cacheDir = createCase("download-failure");
  await assert.rejects(
    ensureBinary({
      version,
      platform,
      cacheDir,
      fetchText: async () => `${fullChecksum}  ${binaryName}\n`,
      downloadFile: async (_url, destination) => {
        writeFileSync(destination, fullBinary.subarray(0, 3));
        throw new Error("connection reset");
      },
      logger: quietLogger(),
    }),
    /connection reset/
  );
  assertNoBinaryOrPartials(cacheDir);
});

test("recovers from a corrupt cached binary", async () => {
  const cacheDir = createCase("cache-recovery");
  const binaryPath = getBinaryPath(cacheDir, version, platform);
  writeFileSync(binaryPath, "corrupt cache");
  let downloads = 0;

  const resolved = await ensureBinary({
    version,
    platform,
    cacheDir,
    fetchText: async () => `${fullChecksum}  ${binaryName}\n`,
    downloadFile: async (_url, destination) => {
      downloads += 1;
      writeFileSync(destination, fullBinary);
    },
    logger: quietLogger(),
  });

  assert.equal(resolved, binaryPath);
  assert.deepEqual(readFileSync(binaryPath), fullBinary);
  assert.equal(downloads, 1);
  assert.equal(
    readdirSync(cacheDir).some((name) => name.includes(".partial-")),
    false
  );
});

test("uses a checksum-valid cached binary without downloading", async () => {
  const cacheDir = createCase("valid-cache");
  const binaryPath = getBinaryPath(cacheDir, version, platform);
  writeFileSync(binaryPath, fullBinary);

  const resolved = await ensureBinary({
    version,
    platform,
    cacheDir,
    fetchText: async () => `${fullChecksum}  ${binaryName}\n`,
    downloadFile: async () => {
      throw new Error("download should not run");
    },
    logger: quietLogger(),
  });

  assert.equal(resolved, binaryPath);
});

function createCase(name) {
  const directory = join(scratchRoot, name);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function assertNoBinaryOrPartials(cacheDir) {
  assert.equal(readdirSync(cacheDir).length, 0);
}

function quietLogger() {
  return { log() {}, warn() {} };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
