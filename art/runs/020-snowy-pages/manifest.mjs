// Puts run 020's snowy sets in the show manifest, each with exactly its base set's marks (every snowy
// piece keeps its base piece's alpha, so the marks hold), and adds their folders to artFolders.
// Re-run whenever a base set's marks change (lane B owns them); tests/chapter-3.test.ts fails if
// they drift apart. Touches only the `-snow` entries.
// Usage, from the repo root: node art/runs/020-snowy-pages/manifest.mjs
import fs from 'node:fs';

const MANIFEST = 'client/public/show/manifest.json';
const SNOWY = ['the-lamp', 'the-landing', 'the-gap'];
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

for (const base of SNOWY) {
  const id = `${base}-snow`;
  if (!fs.existsSync(`art/sets/${id}/set.json`)) throw new Error(`art/sets/${id}/set.json is missing: run make_snow.py first`);
  const from = manifest.sets.find((s) => s.id === base);
  if (!from) throw new Error(`${base} isn't in the manifest`);
  const entry = {
    id,
    name: `${from.name}, in the snow`,
    description: `${from.description} Under fresh snow, on the longest night.`,
    file: `sets/${id}/set.json`,
    marks: structuredClone(from.marks),
  };
  const at = manifest.sets.findIndex((s) => s.id === id);
  if (at >= 0) manifest.sets[at] = entry;
  else manifest.sets.push(entry);
  if (!manifest.artFolders.includes(`sets/${id}`)) manifest.artFolders.push(`sets/${id}`);
  console.log(`${id}: ${entry.marks.length} marks from ${base}`);
}
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
