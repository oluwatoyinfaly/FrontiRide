/**
 * Vérifie que chaque clé passée à t() existe dans les deux dictionnaires.
 *
 * TypeScript garantit déjà que l'anglais couvre le français (le type de `en`
 * dérive de `fr`), mais rien ne relie les chaînes littérales des écrans aux
 * dictionnaires : une clé mal orthographiée s'afficherait brute à l'écran.
 *
 * Usage : node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../src", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? walk(full)
      : /\.tsx?$/.test(entry)
        ? [full]
        : [];
  });
}

/** Extrait les clés d'un dictionnaire, à plat : "section.clé". */
function dictionaryKeys(file) {
  const source = readFileSync(file, "utf8");
  const keys = new Set();
  let section = null;

  for (const line of source.split("\n")) {
    const sectionMatch = line.match(/^ {2}(\w+): \{/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    if (/^ {2}\},?$/.test(line)) {
      section = null;
      continue;
    }
    const keyMatch = line.match(/^ {4}(\w+):/);
    if (section && keyMatch) keys.add(`${section}.${keyMatch[1]}`);
  }

  return keys;
}

const fr = dictionaryKeys(join(SRC, "i18n/fr.ts"));
const en = dictionaryKeys(join(SRC, "i18n/en.ts"));

const files = walk(SRC).filter((f) => !f.includes("/i18n/"));

const literal = new Set();
const dynamicPrefixes = new Set();

for (const file of files) {
  const source = readFileSync(file, "utf8");

  for (const [, key] of source.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
    literal.add(key);
  }
  // Clés construites, du type t(`status.${booking.status}`) : on vérifie que
  // la section existe et qu'elle est peuplée, pas chaque valeur possible.
  for (const [, prefix] of source.matchAll(/\bt\(\s*`(\w+)\.\$\{/g)) {
    dynamicPrefixes.add(prefix);
  }
  // Clés passées indirectement, du type t(LABEL_KEY[method]) : toute chaîne
  // du fichier qui correspond à une clé connue compte comme utilisée.
  for (const [, candidate] of source.matchAll(/"(\w+\.\w+)"/g)) {
    if (fr.has(candidate)) literal.add(candidate);
  }
}

const problems = [];

for (const key of [...literal].sort()) {
  if (!fr.has(key)) problems.push(`manquante en français : ${key}`);
  if (!en.has(key)) problems.push(`manquante en anglais  : ${key}`);
}

for (const prefix of [...dynamicPrefixes].sort()) {
  const frCount = [...fr].filter((k) => k.startsWith(`${prefix}.`)).length;
  const enCount = [...en].filter((k) => k.startsWith(`${prefix}.`)).length;
  if (frCount === 0) problems.push(`section dynamique absente : ${prefix}`);
  else if (frCount !== enCount) {
    problems.push(
      `section ${prefix} : ${frCount} clés en français, ${enCount} en anglais`
    );
  }
}

const orphans = [...fr].filter(
  (key) => !literal.has(key) && !dynamicPrefixes.has(key.split(".")[0])
);

console.log(`Dictionnaires : ${fr.size} clés (fr), ${en.size} clés (en)`);
console.log(`Écrans        : ${literal.size} clés littérales, ${dynamicPrefixes.size} sections dynamiques (${[...dynamicPrefixes].join(", ")})`);

if (orphans.length) {
  console.log(`\nClés jamais utilisées (${orphans.length}) : ${orphans.join(", ")}`);
}

if (problems.length) {
  console.error(`\n${problems.length} problème(s) :`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log("\nToutes les clés utilisées existent dans les deux langues.");
