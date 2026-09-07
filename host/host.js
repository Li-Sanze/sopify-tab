'use strict';

const fs = require('fs');
const path = require('path');

const HOST_ID = 'com.sopify.tab';

function readPaths() {
  const file = path.join(__dirname, 'local-paths.json');
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function readExact(n) {
  const buf = Buffer.alloc(n);
  let off = 0;
  while (off < n) {
    let r;
    try {
      r = fs.readSync(0, buf, off, n - off, null);
    } catch (e) {
      if (e && e.code === 'EOF') return null;
      throw e;
    }
    if (r === 0) return null;
    off += r;
  }
  return buf;
}

function readMessage() {
  const header = readExact(4);
  if (!header) return null;
  const len = header.readUInt32LE(0);
  if (!len) return null;
  const body = readExact(len);
  if (!body) return null;
  return JSON.parse(body.toString('utf8'));
}

function writeMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  fs.writeSync(1, header);
  fs.writeSync(1, json);
}

function handle(msg) {
  const type = msg && msg.type;
  if (type === 'detect' || type === 'ping') {
    const paths = readPaths();
    return {
      type: 'pong',
      ok: true,
      host: HOST_ID,
      wave: 2,
      proxySnapshotted: Boolean(paths.cursorAgentProxy),
    };
  }
  if (type === 'ask') {
    return { type: 'error', ok: false, error: 'ask_not_implemented', wave: 2 };
  }
  return { type: 'error', ok: false, error: 'unknown_message' };
}

function main() {
  for (;;) {
    let msg;
    try {
      msg = readMessage();
    } catch (e) {
      writeMessage({ type: 'error', ok: false, error: 'bad_message' });
      break;
    }
    if (!msg) break;
    writeMessage(handle(msg));
  }
}

main();
