#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const skillName = "parallel-wave-executor";
const source = path.join(packageRoot, ".kiro", "skills", skillName);
const targetRoot = process.cwd();
const target = path.join(targetRoot, ".kiro", "skills", skillName);

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function samePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

if (!fs.existsSync(source)) {
  fail(`Skill source not found: ${source}`);
}

if (!fs.existsSync(path.join(source, "SKILL.md"))) {
  fail(`SKILL.md not found in skill source: ${source}`);
}

if (samePath(source, target)) {
  console.log(`parallel-wave-executor skill is already available at ${target}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

console.log(`Installed ${skillName} skill to ${target}`);
console.log("Restart or reload your Kiro/Codex session if the skill list does not update immediately.");
