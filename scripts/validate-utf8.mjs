import { isUtf8 } from "node:buffer";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".toml",
  ".yaml",
  ".yml",
]);
const ignoredDirectories = new Set([".git", "dist", "node_modules", "target"]);

function isTextFile(fileName) {
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    textExtensions.has(extname(fileName))
  );
}

async function listTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await listTextFiles(filePath)));
      }
    } else if (entry.isFile() && isTextFile(entry.name)) {
      files.push(filePath);
    }
  }

  return files;
}

const files = await listTextFiles(".");
const invalidFiles = [];

for (const filePath of files) {
  if (!isUtf8(await readFile(filePath))) {
    invalidFiles.push(filePath);
  }
}

if (invalidFiles.length > 0) {
  console.error(
    `Arquivos com UTF-8 inválido:\n${invalidFiles.map((filePath) => `- ${filePath}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(`UTF-8 válido em ${files.length} arquivos.`);
