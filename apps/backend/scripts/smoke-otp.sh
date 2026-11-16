#!/usr/bin/env bash
# Test de l'OTP par email, sans fournisseur : un faux SMTP capte les messages.
#
# Lancer d'abord, dans deux terminaux (base migrée et seedée) :
#   node scripts/smtp-sink.mjs 2525 /tmp/mails.jsonl
#   OTP_CHANNELS=email SMTP_HOST=127.0.0.1 SMTP_PORT=2525 \
#     MAIL_FROM="FrontiRide <no-reply@test.local>" npm run dev
# puis :
#   MAILS=/tmp/mails.jsonl bash scripts/smoke-otp.sh
#
# Dure ~35 s : il faut attendre la fin du délai entre deux envois.
API=${API:-http://localhost:47001}
MAILS=${MAILS:-/tmp/mails.jsonl}
HERE=$(dirname "$0")
j() { python3 "$HERE/jsonpath.py" "$1"; }
fail=0
check() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (attendu $3, obtenu $2)"; fail=1; fi }
post() { curl -s -w '\n%{http_code}' -X POST "$API$1" -H 'Content-Type: application/json' -d "$2"; }
last_code() { python3 -c "
import json,re
m=[json.loads(l) for l in open('$MAILS')][-1]
print(re.search(r'\b(\d{6})\b',m['subject']).group(1))"; }

echo "== Envoi du code par email =="
R=$(post /auth/login '{"email":"client@example.com"}'); BODY=$(echo "$R" | head -1)
check "connexion acceptée" "$(echo "$R" | tail -1)" "200"
check "seul le canal email est exigé" "$(echo "$BODY" | j channels)" '["email"]'
check "le code n'est PAS dans la réponse" "$(echo "$BODY" | j devCodes)" "None"
check "le message est parti vers la bonne adresse" \
  "$(python3 -c "import json;print([json.loads(l) for l in open('$MAILS')][-1]['to'])")" "client@example.com"
UID_=$(echo "$BODY" | j userId); CODE=$(last_code)

echo "== Garde-fous =="
check "renvoi immédiat refusé" "$(post /auth/resend-otp "{\"userId\":\"$UID_\"}" | tail -1)" "429"
for i in 1 2 3 4; do post /auth/verify-otp "{\"userId\":\"$UID_\",\"emailCode\":\"000000\"}" > /dev/null; done
check "le bon code passe après 4 échecs" \
  "$(post /auth/verify-otp "{\"userId\":\"$UID_\",\"emailCode\":\"$CODE\"}" | tail -1)" "200"

echo "== Plafond d'essais =="
sleep 31
R=$(post /auth/login '{"email":"client@example.com"}'); UID_=$(echo "$R" | head -1 | j userId); CODE=$(last_code)
for i in 1 2 3 4 5; do last=$(post /auth/verify-otp "{\"userId\":\"$UID_\",\"emailCode\":\"000000\"}" | tail -1); done
check "le 5e échec bloque" "$last" "429"
check "le bon code est alors invalidé" \
  "$(post /auth/verify-otp "{\"userId\":\"$UID_\",\"emailCode\":\"$CODE\"}" | tail -1)" "400"

echo; [ $fail = 0 ] && echo "TOUS LES TESTS PASSENT" || echo "DES TESTS ÉCHOUENT"
exit $fail
