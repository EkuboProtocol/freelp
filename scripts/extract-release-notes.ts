export function extractEntry(text: string, version: string): string {
  const plain = version.startsWith("v") ? version.slice(1) : version;
  if (!/^\d+\.\d+\.\d+$/.test(plain)) throw new Error(`Invalid version: ${version}`);
  const lines = text.split("\n");
  const start = lines.findIndex((line) =>
    new RegExp(`^FreeLP ${plain.replaceAll(".", "\\.")}(\\s|$)`).test(line),
  );
  if (start < 0) throw new Error(`No entry for ${plain}.`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^FreeLP \d+\.\d+\.\d+(\s|$)/.test(line));
  const entry = (end < 0 ? rest : rest.slice(0, end)).join("\n").trimEnd();
  if (!entry) throw new Error(`Empty entry for ${plain}.`);
  return `${lines[start]}\n${entry}\n`;
}

if (import.meta.main) {
  const [file, version, out] = Bun.argv.slice(2);
  if (!file || !version) throw new Error("Usage: extract-release-notes.ts <file> <version> [out]");
  const entry = extractEntry(await Bun.file(file).text(), version);
  if (out) await Bun.write(out, entry);
  else process.stdout.write(entry);
}
