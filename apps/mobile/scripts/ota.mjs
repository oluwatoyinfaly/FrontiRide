#!/usr/bin/env node
// Publie une mise à jour à distance (EAS Update) sur un canal.
//
//   npm run ota:preview  -- "Correction de l'écran paiement"
//   npm run ota:staging  -- "…"
//   npm run ota:production -- "…"
//
// Pourquoi un script plutôt que `eas update` directement : l'adresse de l'API
// (EXPO_PUBLIC_API_URL) est figée dans le JavaScript publié. `eas update` ne lit
// PAS les variables des profils de build d'eas.json ; lancé sans elle, il
// publierait une version qui vise « localhost » et couperait l'application de
// tous les utilisateurs du canal. Ce script reprend l'adresse du profil de
// build lié au canal, et refuse de publier sans elle.
//
// Ce qu'une mise à jour à distance peut changer : le JavaScript et les images
// (écrans, textes, logique). Ce qu'elle ne peut pas changer : tout ce qui est
// natif (nouveau module, permission, icône, version d'Expo). Pour ça, nouveau
// build ET nouvelle version dans app.json — voir docs/mises-a-jour-ota.md.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [channel, ...words] = process.argv.slice(2);

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const eas = JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8"));
const profiles = Object.entries(eas.build ?? {}).filter(([, p]) => p.channel === channel);
if (!channel || profiles.length === 0) {
  const known = Object.values(eas.build ?? {}).map((p) => p.channel).filter(Boolean);
  fail(`Canal inconnu « ${channel ?? ""} ». Canaux d'eas.json : ${known.join(", ")}`);
}
const [profileName, profile] = profiles[0];

const apiUrl = profile.env?.EXPO_PUBLIC_API_URL;
if (!apiUrl) fail(`Le profil « ${profileName} » ne définit pas EXPO_PUBLIC_API_URL dans eas.json.`);
if (/api\.frontiride\.com/.test(apiUrl)) {
  fail(`Le profil « ${profileName} » vise encore l'adresse d'exemple ${apiUrl}. Mettez la vraie URL dans eas.json.`);
}

let message = words.join(" ").trim();
if (!message) {
  const last = spawnSync("git", ["log", "-1", "--format=%s"], { cwd: root, encoding: "utf8" });
  message = last.stdout?.trim();
}
if (!message) fail("Indiquez un message : npm run ota:<canal> -- \"ce qui change\"");

const app = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8")).expo;
console.log(`Canal       : ${channel} (profil de build « ${profileName} »)`);
console.log(`API         : ${apiUrl}`);
console.log(`Version     : ${app.version} — seuls les builds de cette version la recevront`);
console.log(`Message     : ${message}\n`);

const result = spawnSync(
  "npx",
  [
    "--yes", "eas-cli@latest", "update",
    "--channel", channel,
    "--platform", "android",
    "--message", message,
    // Indispensable : Metro garde en cache le code déjà transformé, adresse de
    // l'API comprise. Sans ce vidage, une compilation antérieure faite sans
    // EXPO_PUBLIC_API_URL (un `expo start` local) serait publiée telle quelle.
    // Vérifié : sans --clear, l'adresse manquait dans le paquet exporté.
    "--clear-cache",
  ],
  {
    cwd: root,
    stdio: "inherit",
    // npx est un script .cmd sous Windows : il lui faut un shell.
    shell: process.platform === "win32",
    env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
  }
);
process.exit(result.status ?? 1);
