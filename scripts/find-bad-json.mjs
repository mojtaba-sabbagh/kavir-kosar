// scripts/find-bad-json.mjs
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".turbo", ".git", "dist", "build", ".vercel"]);

async function walk(dir, files = []) {
  for (const name of await fs.readdir(dir)) {
    const p = path.join(dir, name);
    const stat = await fs.lstat(p);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(name)) await walk(p, files);
    } else if (name.toLowerCase().endsWith(".json")) {
      files.push(p);
    }
  }
  return files;
}

function indexToLineCol(str, index) {
  let line = 1, col = 1;
  for (let i = 0; i < index && i < str.length; i++) {
    if (str[i] === "\n") { line++; col = 1; }
    else col++;
  }
  return { line, col };
}

function snippet(str, index, width = 80) {
  const start = Math.max(0, index - width);
  const end = Math.min(str.length, index + width);
  return str.slice(start, end);
}

(async () => {
  const files = await walk(ROOT);
  let hadError = false;

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    try {
      JSON.parse(text);
    } catch (e) {
      hadError = true;
      // try to extract "position N" from V8 error message
      const m = /position (\d+)/i.exec(String(e.message));
      let pos = m ? parseInt(m[1], 10) : null;
      let loc = pos != null ? indexToLineCol(text, pos) : { line: "?", col: "?" };
      console.log("\n❌ Invalid JSON:", file);
      console.log("   Error:", e.message);
      console.log(`   At: position ${pos ?? "?"} (line ${loc.line}, col ${loc.col})`);
      if (pos != null) {
        console.log("   Snippet around error:\n---");
        console.log(snippet(text, pos));
        console.log("\n---");
      }
    }
  }

  if (!hadError) {
    console.log("✅ All JSON files parsed cleanly (excluding node_modules/.next/etc).");
  }
})();
