#!/usr/bin/env bash
# Test de bout en bout de l'API FrontiRide.
# Usage : API=http://localhost:3000 bash scripts/smoke.sh
# Suppose une base fraîchement migrée + seedée (npm run prisma:seed).
API=${API:-http://localhost:3000}
HERE=$(dirname "$0")
j() { python3 "$HERE/jsonpath.py" "$1"; }
fail=0
check() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (attendu $3, obtenu $2)"; fail=1; fi }

echo "== Inscription + OTP =="
REG=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"awa.test@example.com","phone":"+22996111222","fullName":"Awa Test","locale":"fr"}')
USERID=$(echo "$REG" | j userId); EC=$(echo "$REG" | j devCodes.email); SC=$(echo "$REG" | j devCodes.sms)
check "compte créé" "$([ -n "$USERID" ] && echo ok)" "ok"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/verify-otp -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USERID\",\"emailCode\":\"000000\",\"smsCode\":\"000000\"}")
check "mauvais code refusé" "$code" "400"

VER=$(curl -s -X POST $API/auth/verify-otp -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USERID\",\"emailCode\":\"$EC\",\"smsCode\":\"$SC\"}")
TOKEN=$(echo "$VER" | j token)
check "connexion" "$([ -n "$TOKEN" ] && echo ok)" "ok"

check "sans token = 401" "$(curl -s -o /dev/null -w '%{http_code}' $API/bookings)" "401"

echo "== Réservation frontalier =="
BK=$(curl -s -X POST $API/bookings/frontalier -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tranconId\":\"trancon-cotonou-lome\",\"departureAt\":\"$(date -u -d '+3 days' +%Y-%m-%dT%H:%M:%SZ)\",\"isRoundTrip\":true,\"seats\":2}")
BID=$(echo "$BK" | j booking.id)
check "prix aller-retour 2x(25000+3000)" "$(echo "$BK" | j price.totalFcfa)" "56000"
check "référence FR-" "$(echo "$BK" | j booking.reference | cut -c1-3)" "FR-"

check "date passée refusée" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/frontalier \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"tranconId":"trancon-cotonou-lome","departureAt":"2020-01-01T00:00:00Z"}')" "400"

check "5 places refusées (max 4)" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/frontalier \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tranconId\":\"trancon-cotonou-lome\",\"departureAt\":\"$(date -u -d '+3 days' +%Y-%m-%dT%H:%M:%SZ)\",\"seats\":5}")" "400"

echo "== Paiement espèces =="
curl -s -X POST $API/payments/initiate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bookingId\":\"$BID\",\"method\":\"CASH\"}" > /dev/null
check "réservation confirmée" "$(curl -s $API/bookings/$BID -H "Authorization: Bearer $TOKEN" | j status)" "CONFIRMED"

echo "== Historique et annulation =="
check "présente dans l'historique" "$(curl -s $API/bookings -H "Authorization: Bearer $TOKEN" | j 0.id)" "$BID"
check "annulation" "$(curl -s -X POST $API/bookings/$BID/cancel -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"reason":"test"}' | j status)" "CANCELLED"
check "double annulation refusée" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/$BID/cancel \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}')" "409"
check "notation d'une course non terminée refusée" "$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST $API/bookings/$BID/rating -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"score":5}')" "409"



login() {
  R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\"}")
  U=$(echo "$R" | j userId); E=$(echo "$R" | j devCodes.email); S=$(echo "$R" | j devCodes.sms)
  curl -s -X POST $API/auth/verify-otp -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$U\",\"emailCode\":\"$E\",\"smsCode\":\"$S\"}" | j token
}

echo "== Admin =="
ADMIN=$(login admin@frontiride.com)
STATS=$(curl -s $API/admin/stats -H "Authorization: Bearer $ADMIN")
PENDING_BEFORE=$(echo "$STATS" | j drivers.pendingReview)
APPROVED_BEFORE=$(echo "$STATS" | j drivers.approved)
check "des dossiers attendent un contrôle" "$([ "$PENDING_BEFORE" -ge 1 ] && echo ok)" "ok"
check "des chauffeurs sont validés" "$([ "$APPROVED_BEFORE" -ge 1 ] && echo ok)" "ok"
check "le CA des courses terminées est renseigné" "$([ "$(echo "$STATS" | j revenue.totalFcfa)" -gt 0 ] && echo ok)" "ok"
echo "  séquestre: $(echo "$STATS" | j escrow.amountFcfa) FCFA sur $(echo "$STATS" | j escrow.count) paiements"

CLIENT=$(login client@example.com)
check "un client ne peut pas voir /admin/stats" "$(curl -s -o /dev/null -w '%{http_code}' $API/admin/stats -H "Authorization: Bearer $CLIENT")" "403"

echo "== Validation d'un chauffeur =="
TO_APPROVE=$(curl -s "$API/admin/drivers?status=PENDING_REVIEW" -H "Authorization: Bearer $ADMIN" | j 0.id)
check "validation" "$(curl -s -X POST $API/admin/drivers/$TO_APPROVE/approve -H "Authorization: Bearer $ADMIN" | j status)" "APPROVED"
check "un dossier de moins en attente" \
  "$(curl -s $API/admin/stats -H "Authorization: Bearer $ADMIN" | j drivers.pendingReview)" \
  "$((PENDING_BEFORE - 1))"

echo "== Parcours chauffeur =="
DRIVER=$(login kofi.adjovi@example.com)
ME=$(curl -s $API/driver/me -H "Authorization: Bearer $DRIVER")
check "dossier complet" "$(echo "$ME" | j missingDocuments)" "[]"
echo "  solde: $(echo "$ME" | j wallet.balanceFcfa) FCFA / en attente: $(echo "$ME" | j wallet.pendingFcfa) FCFA"

AVAIL=$(curl -s $API/driver/rides/available -H "Authorization: Bearer $DRIVER")
RIDE=$(echo "$AVAIL" | j 0.id)
N_AVAIL=$(echo "$AVAIL" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
check "des courses sont proposées au chauffeur" "$([ "$N_AVAIL" -ge 1 ] && echo ok)" "ok"

check "acceptation" "$(curl -s -X POST $API/driver/rides/$RIDE/accept -H "Authorization: Bearer $DRIVER" | j status)" "DRIVER_ASSIGNED"

DRIVER2=$(login amivi.kossi@example.com)
check "un 2e chauffeur ne peut plus la prendre" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/driver/rides/$RIDE/accept -H "Authorization: Bearer $DRIVER2")" "409"

curl -s -X POST $API/driver/rides/$RIDE/start -H "Authorization: Bearer $DRIVER" > /dev/null
RIDE_PRICE=$(echo "$AVAIL" | j 0.estimatedPriceFcfa)
COMP=$(curl -s -X POST $API/driver/rides/$RIDE/complete -H "Authorization: Bearer $DRIVER")
check "gains = prix moins 12 % de commission" "$(echo "$COMP" | j earningsFcfa)" \
  "$(python3 -c "print(round($RIDE_PRICE * 0.88))")"

echo "== Retrait =="
check "retrait > solde refusé" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/driver/withdrawals \
  -H "Authorization: Bearer $DRIVER" -H 'Content-Type: application/json' -d '{"amountFcfa":999999,"destination":"+22997000001"}')" "400"
check "retrait sous le minimum refusé" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/driver/withdrawals \
  -H "Authorization: Bearer $DRIVER" -H 'Content-Type: application/json' -d '{"amountFcfa":1000,"destination":"+22997000001"}')" "400"
check "retrait valide" "$(curl -s -X POST $API/driver/withdrawals -H "Authorization: Bearer $DRIVER" \
  -H 'Content-Type: application/json' -d '{"amountFcfa":40000,"destination":"+22997000001"}' | j status)" "REQUESTED"

echo "== Notation par le client =="
CTOKEN=$(login client@example.com)
check "note enregistrée" "$(curl -s -X POST $API/bookings/$RIDE/rating -H "Authorization: Bearer $CTOKEN" \
  -H 'Content-Type: application/json' -d '{"score":4,"comment":"Bien"}' | j score)" "4"
check "double notation refusée" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/$RIDE/rating \
  -H "Authorization: Bearer $CTOKEN" -H 'Content-Type: application/json' -d '{"score":1}')" "409"


echo "== Régressions corrigées =="
# Bug 1 : après une première location, le véhicule redevenait irréservable —
# le test de chevauchement ne comparait que les dates de début.
V=$(curl -s "$API/vehicles?city=Cotonou" | j 0.id)
D1=$(date -u -d '+40 days' +%Y-%m-%dT%H:%M:%SZ)
D2=$(date -u -d '+80 days' +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST $API/bookings/location-ville -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"vehicleId\":\"$V\",\"startAt\":\"$D1\",\"durationDays\":2}" > /dev/null
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/location-ville \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"vehicleId\":\"$V\",\"startAt\":\"$D2\",\"durationDays\":2}")
check "période disjointe acceptée" "$code" "201"

# Bug 2 : la référence est courte, donc les collisions arrivent ; la création
# doit réessayer au lieu de remonter une erreur serveur.
fails=0
for i in $(seq 1 25); do
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/bookings/frontalier \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"tranconId\":\"trancon-cotonou-lome\",\"departureAt\":\"$(date -u -d '+9 days' +%Y-%m-%dT%H:%M:%SZ)\",\"seats\":1}")
  [ "$c" = "201" ] || fails=$((fails+1))
done
check "25 réservations d'affilée sans échec" "$fails" "0"

echo; [ $fail = 0 ] && echo "TOUS LES TESTS PASSENT" || echo "DES TESTS ÉCHOUENT"
exit $fail
