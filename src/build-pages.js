import fs from "node:fs";
import path from "node:path";
import { dataDir, publicDir, rootDir } from "./paths.js";

const distDir = path.join(rootDir, "dist");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

copyDir(publicDir, distDir);

if (fs.existsSync(dataDir)) {
  const targetDataDir = path.join(distDir, "data");
  fs.mkdirSync(targetDataDir, { recursive: true });

  for (const fileName of ["data.json", "archive.json", "archive.csv"]) {
    const source = path.join(dataDir, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(targetDataDir, fileName));
    }
  }
}

fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf8");

console.log(`Built GitHub Pages site at ${distDir}`);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDir(source, target);
    } else if (entry.isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}
