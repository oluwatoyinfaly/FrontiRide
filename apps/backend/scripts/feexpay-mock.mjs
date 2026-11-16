#!/usr/bin/env node
// Faux FeexPay pour les tests, calqué sur la documentation V2 (pages Payin,
// Payin status et Sandbox) :
//   POST /api/transactions/public/requesttopay/:network
//   GET  /api/transactions/public/single/status/:reference
//
//   node scripts/feexpay-mock.mjs 4010 /tmp/feexpay.jsonl
//
// Il applique les règles de la documentation : numéro béninois à 10 chiffres
// (229 + 01 + 8 chiffres), montant entier de 10 à 1 000 000, description sans
// caractère spécial. Un appel qui les enfreint est refusé, ce qui permet de
// vérifier ce que NOTRE code envoie réellement.
//
// Comme la sandbox, l'issue dépend des deux DERNIERS chiffres du numéro :
//   00 réussi · 01 échec (solde insuffisant) · 02 erreur HTTP 503
//   03 en attente puis échec · 04 numéro invalide (400) · 05 en attente
//   tout autre : réussi
// MTN et Moov répondent l'issue finale dans la création ; Celtiis répond
// « en attente » puis règle après 2 s.
//
// Chaque demande reçue est écrite en JSON dans le fichier, pour les assertions.

import { appendFileSync } from "node:fs";
import http from "node:http";

const [port = "4010", file = "feexpay.jsonl"] = process.argv.slice(2);
const TOKEN = process.env.MOCK_TOKEN ?? "test-token";
const transactions = new Map();
let counter = 0;

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const outcomeFor = (phone) => {
  const tail = String(phone).slice(-2);
  if (tail === "01") return "FAILED";
  if (tail === "03") return "FAIL_LATER";
  if (tail === "05") return "PENDING";
  return "SUCCESSFUL";
};

http
  .createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { message: "Token invalide" });
    }

    const url = new URL(req.url, "http://x");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const create = /^\/api\/transactions\/public\/requesttopay\/(\w+)$/.exec(url.pathname);
      if (req.method === "POST" && create) {
        const network = create[1];
        const body = JSON.parse(raw || "{}");
        appendFileSync(file, JSON.stringify({ network, ...body }) + "\n");

        const togo = network === "moov_tg" || network === "togocom_tg";
        if (!["mtn", "moov", "celtiis_bj", "moov_tg", "togocom_tg"].includes(network)) {
          return send(res, 404, { message: "Canal inconnu" });
        }
        if (!body.shop) return send(res, 400, { message: "shop requis" });
        if (!Number.isInteger(body.amount) || body.amount < 10 || body.amount > 1000000) {
          return send(res, 400, { message: "amount : entier de 10 à 1 000 000" });
        }
        if (body.description !== undefined && /[^A-Za-z0-9 ]/.test(body.description)) {
          return send(res, 400, { message: "description : pas de caractères spéciaux" });
        }
        const phone = String(body.phoneNumber ?? "");
        // Bénin : 229 + 01 + 8 chiffres. Togo (hypothèse) : 228 + 8 chiffres.
        const wellFormed = togo ? /^228\d{8}$/.test(phone) : /^22901\d{8}$/.test(phone);
        if (!wellFormed || phone.endsWith("04")) {
          return send(res, 400, { code: "INVALID_PHONE_NUMBER", message: "Invalid phone number" });
        }
        if (phone.endsWith("02")) {
          return send(res, 503, { message: "Service indisponible" });
        }

        const outcome = outcomeFor(phone);
        const reference = `mock-${++counter}-${Date.now()}`;
        transactions.set(reference, { createdAt: Date.now(), body, outcome });

        // MTN et Moov Bénin répondent l'issue tout de suite ; Celtiis et les
        // canaux togolais répondent « en attente » puis règlent quelques
        // secondes plus tard.
        const immediate = network === "mtn" || network === "moov";
        const status = immediate
          ? outcome === "FAIL_LATER" ? "FAILED" : outcome
          : "PENDING";

        return send(res, 200, {
          reference,
          message: status === "SUCCESSFUL" ? "Successful" : status === "FAILED" ? "Insufficient balance" : "Accepted",
          status,
          amount: body.amount,
          description: body.description ?? "",
          callback_info: body.callback_info ?? null,
          phoneNumber: phone,
        });
      }

      const check = /^\/api\/transactions\/public\/single\/status\/(.+)$/.exec(url.pathname);
      if (req.method === "GET" && check) {
        const reference = decodeURIComponent(check[1]);
        const tx = transactions.get(reference);
        if (!tx) return send(res, 404, { message: "Transaction introuvable" });

        const settledYet = Date.now() - tx.createdAt >= 2000;
        const status =
          tx.outcome === "PENDING" ? "PENDING"
          : tx.outcome === "FAIL_LATER" ? (settledYet ? "FAILED" : "PENDING")
          : settledYet || tx.outcome !== "SUCCESSFUL" ? tx.outcome : "PENDING";

        return send(res, 200, {
          reference,
          amount: tx.body.amount,
          phoneNumber: tx.body.phoneNumber,
          status,
          callback_info: null,
          responsecode: status,
          responsemsg: status,
          transref: reference,
          serviceref: reference,
          reason: status === "FAILED" ? "LOW_BALANCE_OR_PAYEE_LIMIT_REACHED_OR_NOT_ALLOWED" : "",
        });
      }

      send(res, 404, { message: "Route inconnue" });
    });
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`FeexPay mock sur ${port}`));
