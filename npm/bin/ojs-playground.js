#!/usr/bin/env node

const { main } = require("../lib/launcher.cjs");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
