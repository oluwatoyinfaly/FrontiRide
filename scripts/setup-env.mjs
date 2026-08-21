#!/usr/bin/env node
// Crée les fichiers .env locaux à partir des .env.example.
//
//   npm run setup:env          n'écrase rien
//   npm run setup:env -- --force   réécrit les fichiers existants
//
// Les .env sont gitignorés : ce script est le seul moyen de les livrer avec
// le dépôt sans y publier de secrets.

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");

/** Le mobile n'a pas d'exemple à copier : son .env n'est qu'une surcharge. */
const MOBILE_ENV = `# Adresse de l'API vue depuis le téléphone.
#
# Laisse cette ligne commentée tant que le téléphone et le PC sont sur le même
# Wi-Fi : l'app vise alors automatiquement la machine qui sert Metro, sur le
# port 47001. Décommente et corrige l'IP si la connexion échoue.
#
# EXPO_PUBLIC_API_URL="http://192.168.1.42:47001"
`;

const targets = [
  { file: "apps/backend/.env", from: "apps/backend/.env.example" },
  { file: "apps/mobile/.env", content: MOBILE_ENV },
];

let created = 0;

for (const target of targets) {
  const path = join(root, target.file);

  if (existsSync(path) && !force) {
    console.log(`  = ${target.file} existe déjà, laissé tel quel`);
    continue;
  }

  mkdirSync(dirname(path), { recursive: true });

  if (target.from) {
    const source = join(root, target.from);
    if (!existsSync(source)) {
      console.error(`  ! ${relative(root, source)} est introuvable`);
      process.exitCode = 1;
      continue;
    }
    copyFileSync(source, path);
  } else {
    writeFileSync(path, target.content);
  }

  console.log(`  + ${target.file}`);
  created += 1;
}

console.log(
  created === 0
    ? "\nRien à faire. Relance avec --force pour réécrire les fichiers."
    : "\nPorts du projet : PostgreSQL 47432, API 47001, back-office 47005, Metro 47081."
);
