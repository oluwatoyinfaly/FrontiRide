#!/usr/bin/env node
// Faux serveur SMTP pour les tests : accepte tout, et écrit chaque message reçu
// sur une ligne JSON { to, subject, body } dans le fichier donné.
//
//   node scripts/smtp-sink.mjs 2525 /tmp/mails.jsonl
//
// Il n'annonce ni STARTTLS ni AUTH : à utiliser sans SMTP_USER, en clair, sur
// la boucle locale seulement.

import { appendFileSync } from "node:fs";
import net from "node:net";

const [port = "2525", file = "mails.jsonl"] = process.argv.slice(2);

net
  .createServer((socket) => {
    let inData = false;
    let buffer = "";
    let rcpt = "";

    const reply = (line) => socket.write(`${line}\r\n`);
    reply("220 sink ready");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      while (true) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          const raw = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;

          const subject = /^Subject: (.*)$/im.exec(raw)?.[1] ?? "";
          const body = raw.split(/\r\n\r\n/).slice(1).join("\n\n");
          appendFileSync(file, JSON.stringify({ to: rcpt, subject, body }) + "\n");
          reply("250 queued");
          continue;
        }

        const eol = buffer.indexOf("\r\n");
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const verb = line.slice(0, 4).toUpperCase();

        if (verb === "EHLO" || verb === "HELO") reply("250 sink");
        else if (verb === "MAIL") reply("250 ok");
        else if (verb === "RCPT") {
          rcpt = /<(.+?)>/.exec(line)?.[1] ?? "";
          reply("250 ok");
        } else if (verb === "DATA") {
          inData = true;
          reply("354 go");
        } else if (verb === "QUIT") {
          reply("221 bye");
          socket.end();
        } else reply("250 ok");
      }
    });
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`SMTP sink sur ${port}`));
