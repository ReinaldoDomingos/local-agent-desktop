import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const roots = process.argv.slice(2);
const extension = /\.(?:[cm]?js|[cm]?ts|tsx|jsx|css|rs)$/;

if (roots.length === 0)
  throw new Error("Informe ao menos um diretório de código.");

function isSource(file) {
  return extension.test(file);
}

function files(directory) {
  if (statSync(directory).isFile())
    return isSource(directory) ? [directory] : [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["dist", "node_modules", "target"].includes(entry.name)) return [];
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return files(file);
    return isSource(file) ? [file] : [];
  });
}

function commentLines(source) {
  const found = new Set();
  let mode = "code";
  let escaped = false;
  for (const [index, text] of source.split("\n").entries()) {
    for (let column = 0; column < text.length; column += 1) {
      const character = text[column];
      const next = text[column + 1];
      if (mode === "block") {
        if (character === "*" && next === "/") {
          mode = "code";
          column += 1;
        }
        continue;
      }
      if (mode !== "code") {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (
          (mode === "single" && character === "'") ||
          (mode === "double" && character === '"') ||
          (mode === "template" && character === "`")
        )
          mode = "code";
        continue;
      }
      if (character === "/" && next === "/") {
        found.add(index + 1);
        break;
      }
      if (character === "/" && next === "*") {
        found.add(index + 1);
        mode = "block";
        column += 1;
      } else if (character === "'") mode = "single";
      else if (character === '"') mode = "double";
      else if (character === "`") mode = "template";
    }
    if (mode === "single" || mode === "double") {
      mode = "code";
      escaped = false;
    }
  }
  return found;
}

const failures = [];
for (const root of roots) {
  for (const file of files(root)) {
    for (const line of commentLines(readFileSync(resolve(file), "utf8"))) {
      failures.push(`${file}:${line}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(
    `Comentários não são permitidos em código:\n${failures.join("\n")}\n`,
  );
  process.exitCode = 1;
} else process.stdout.write("Nenhum comentário foi encontrado em código.\n");
