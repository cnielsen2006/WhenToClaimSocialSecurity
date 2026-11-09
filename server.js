#!/usr/bin/env node
// LAN server for the Social Security claiming page.
// Serves the HTML and keeps one shared copy of the people/settings on disk.
// No dependencies: needs only Node 18+.
//
//   node server.js            start on the default port
//   node server.js --open     also open the page in your browser
//   PORT=48000 node server.js use a different port
"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { exec } = require("child_process");

const PORT = parseInt(process.env.PORT, 10) || 47821;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PAGE = path.join(ROOT, "social-security-claiming.html");
const SEED = path.join(ROOT, "craig-and-wife.json");
const DATA_DIR = path.join(ROOT, "data");
const DATA = path.join(DATA_DIR, "state.json");
const PREV = path.join(DATA_DIR, "state.prev.json");
const MAX_BODY = 256 * 1024;
const OPEN = process.argv.includes("--open");

const log = (m) => console.log(new Date().toLocaleTimeString() + "  " + m);

// ---------- Storage ----------
function readState() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (e) { return null; }
}

let lastStamp = 0;
function writeState(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // The server's clock is the only clock that matters: it orders every save.
  lastStamp = Math.max(Date.now(), lastStamp + 1, (readState() || {}).savedAt + 1 || 0);
  const clean = {
    version: 1,
    savedAt: lastStamp,
    activeId: typeof obj.activeId === "string" ? obj.activeId : undefined,
    settings: obj.settings && typeof obj.settings === "object" ? obj.settings : {},
    profiles: obj.profiles,
  };
  if (fs.existsSync(DATA)) fs.copyFileSync(DATA, PREV);   // keep one step of undo
  const tmp = DATA + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(clean, null, 2));
  fs.renameSync(tmp, DATA);                                // atomic swap
  return clean.savedAt;
}

function seedIfNeeded() {
  if (fs.existsSync(DATA)) return;
  try {
    const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
    if (Array.isArray(seed.profiles) && seed.profiles.length) {
      writeState(seed);
      log("First run: loaded people from " + path.basename(SEED));
    }
  } catch (e) { /* no seed file: start empty, people can Import in the page */ }
}

// ---------- HTTP ----------
function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(body);
}
const sendJson = (res, code, obj) => send(res, code, JSON.stringify(obj), "application/json; charset=utf-8");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, tooBig = false;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (tooBig) return;                     // drain the rest without keeping it
      if (size > MAX_BODY) { tooBig = true; chunks.length = 0; return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (tooBig) reject(Object.assign(new Error("too large"), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

// A web page on some other site must not be able to write to us from a visitor's browser.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  try {
    if (url === "/api/health" && req.method === "GET") return sendJson(res, 200, { app: "retirement-claiming" });

    if (url === "/api/state") {
      if (req.method === "GET") {
        const s = readState();
        return s ? sendJson(res, 200, s) : sendJson(res, 404, { error: "no data yet" });
      }
      if (req.method === "PUT") {
        if (!sameOrigin(req)) return sendJson(res, 403, { error: "cross-origin write refused" });
        if (!/^application\/json/i.test(req.headers["content-type"] || "")) return sendJson(res, 415, { error: "send JSON" });
        let obj;
        try { obj = JSON.parse(await readBody(req)); } catch (e) {
          if (e.status) return sendJson(res, e.status, { error: e.message });
          return sendJson(res, 400, { error: "bad JSON" });
        }
        if (!obj || !Array.isArray(obj.profiles) || obj.profiles.length < 1 || obj.profiles.length > 20) {
          return sendJson(res, 400, { error: "expected 1-20 profiles" });
        }
        const savedAt = writeState(obj);
        log("Saved " + obj.profiles.length + " people from " + (req.socket.remoteAddress || "").replace(/^::ffff:/, ""));
        return sendJson(res, 200, { savedAt });
      }
      res.setHeader("Allow", "GET, PUT");
      return sendJson(res, 405, { error: "method not allowed" });
    }

    if ((url === "/" || url === "/social-security-claiming.html") && req.method === "GET") {
      return send(res, 200, fs.readFileSync(PAGE), "text/html; charset=utf-8");
    }
    // Nothing else is served, so the data files and this script stay private.
    return send(res, 404, "Not found");
  } catch (e) {
    log("Error: " + e.message);
    if (!res.headersSent) sendJson(res, 500, { error: "server error" });
  }
});

// ---------- Startup ----------
function lanUrls() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const a of nets[name]) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      out.push({ name, url: "http://" + a.address + ":" + PORT });
    }
  }
  return out;
}

function openBrowser() {
  if (process.platform === "win32") exec('start "" "http://localhost:' + PORT + '"');
  else if (process.platform === "darwin") exec('open "http://localhost:' + PORT + '"');
  else exec('xdg-open "http://localhost:' + PORT + '"');
}

server.on("error", (e) => {
  if (e.code !== "EADDRINUSE") { console.error("Could not start: " + e.message); process.exit(1); }
  // Port taken. If it's us, just open the page; otherwise say so.
  http.get({ host: "127.0.0.1", port: PORT, path: "/api/health", timeout: 2000 }, (r) => {
    let b = "";
    r.on("data", (c) => (b += c));
    r.on("end", () => {
      let ours = false;
      try { ours = JSON.parse(b).app === "retirement-claiming"; } catch (x) {}
      if (ours) {
        console.log("Already running on port " + PORT + ".");
        if (OPEN) openBrowser();
        process.exit(0);
      }
      console.error("Port " + PORT + " is used by another program. Start with a different one, e.g. PORT=48000");
      process.exit(1);
    });
  }).on("error", () => {
    console.error("Port " + PORT + " is in use. Start with a different one, e.g. PORT=48000");
    process.exit(1);
  });
});

server.listen(PORT, HOST, () => {
  seedIfNeeded();
  console.log("");
  console.log("  Social Security claiming page is running. Leave this window open.");
  console.log("");
  console.log("  On this computer:  http://localhost:" + PORT);
  const urls = lanUrls();
  if (HOST === "0.0.0.0" && urls.length) {
    console.log("  On your network (share one of these; pick the one on your home network):");
    urls.forEach((u) => console.log("    " + u.url + "   (" + u.name + ")"));
  }
  console.log("");
  console.log("  Shared data file:  " + DATA);
  console.log("  Press Ctrl+C or close this window to stop.");
  console.log("");
  if (OPEN) openBrowser();
});
