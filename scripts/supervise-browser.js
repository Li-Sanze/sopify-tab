#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const timeoutMs = Number(process.argv[2]);
const cmd = process.argv[3];
const args = process.argv.slice(4);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !cmd) {
  console.error('usage: supervise-browser.js <timeout-ms> <command> [args...]');
  process.exit(1);
}

const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sopify-run-'));
const started = Date.now();
let bodyMs = 0;
let timedOut = false;
let finished = false;

const child = spawn(cmd, args, {
  detached: true,
  stdio: 'inherit',
  env: Object.assign({}, process.env, { SOPIFY_RUN_ROOT: runRoot }),
});

function pidsUsing(dir) {
  const out = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  const hits = [];
  const text = out.stdout || '';
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const pid = Number(match[1]);
    if (pid === process.pid || pid === child.pid) continue;
    if (match[2].includes(dir)) hits.push(pid);
  }
  return hits;
}

function killGroup() {
  if (child.pid == null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
  for (const pid of pidsUsing(runRoot)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

function finish(code) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (!timedOut) bodyMs = Date.now() - started;
  killGroup();
  const cleanStart = Date.now();
  try { fs.rmSync(runRoot, { recursive: true, force: true }); } catch { /* already gone */ }
  const cleanMs = Date.now() - cleanStart;
  fs.writeSync(1, `reliability: supervisor body ${bodyMs}ms cleanup ${cleanMs}ms timeout ${timedOut ? 'yes' : 'no'}\n`);
  process.exit(timedOut ? 124 : code);
}

const timer = setTimeout(() => {
  timedOut = true;
  bodyMs = Date.now() - started;
  console.error(`reliability: supervisor timeout ${timeoutMs}ms; killing this run only`);
  killGroup();
}, timeoutMs);

child.on('exit', (code, signal) => {
  if (signal && !timedOut) timedOut = signal === 'SIGKILL';
  finish(code == null ? 1 : code);
});
child.on('error', (err) => {
  console.error(err && err.message ? err.message : err);
  finish(1);
});
