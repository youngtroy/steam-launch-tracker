import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const dataDir = path.join(rootDir, "data");
export const publicDir = path.join(rootDir, "public");
export const dataPath = path.join(dataDir, "data.json");
export const errorLogPath = path.join(dataDir, "errors.log");
export const configPath = path.join(rootDir, "config.json");
export const exampleConfigPath = path.join(rootDir, "config.example.json");

export function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
