#!/usr/bin/env node
// Faux FeexPay pour les tests, calqué sur le SDK officiel (feexpay-sdk 1.0.9) :
//   POST /api/transactions/public/requesttopay/:network  → { status, reference }
//   GET  /api/transactions/getrequesttopay/integration/:reference → { status, … }
//
//   node scripts/feexpay-mock.mjs 4010 /tmp/feexpay.jsonl
//
// Comportement selon le numéro du client :
//   se termine par 0000 → demande refusée (400)
//   se termine par 9999 → le client refuse sur son téléphone (FAILED)
//   se termine par 8888 → le client ne répond jamais (reste PENDING)
//   autre               → le client valide après 2 s (SUCCESSFUL)
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
        const body = JSON.parse(raw || "{}");
        appendFileSync(file, JSON.stringify({ network: create[1], ...body }) + "\n");

        if (!body.shop || !body.phoneNumber || !body.amount) {
          return send(res, 400, { message: "Champs manquants" });
        }
        if (String(body.phoneNumber).endsWith("0000")) {
          return send(res, 400, { message: "Numéro invalide" });
        }

        const reference = `mock-${++counter}-${Date.now()}`;
        const phone = String(body.phoneNumber);
        transactions.set(reference, {
          createdAt: Date.now(),
          amount: body.amount,
          outcome: phone.endsWith("9999") ? "FAILED" : phone.endsWith("8888") ? "PENDING" : "SUCCESSFUL",
        });
        return send(res, 200, { status: "PENDING", reference });
      }

      const check = /^\/api\/transactions\/getrequesttopay\/integration\/(.+)$/.exec(url.pathname);
      if (req.method === "GET" && check) {
        const tx = transactions.get(decodeURIComponent(check[1]));
        if (!tx) return send(res, 404, { message: "Transaction introuvable" });
        const settled = Date.now() - tx.createdAt >= 2000 ? tx.outcome : "PENDING";
        return send(res, 200, {
          status: settled,
          amount: tx.amount,
          currency: "XOF",
          transactionId: decodeURIComponent(check[1]),
        });
      }

      send(res, 404, { message: "Route inconnue" });
    });
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`FeexPay mock sur ${port}`));
