#!/usr/bin/env python3
"""Parcours réel, de bout en bout, SANS donnée fictive.

Suppose une API démarrée avec :
  SEED_DEMO=false SEED_ADMIN_EMAIL=admin@e2e.test OTP_CHANNELS=email
  SMTP_HOST=127.0.0.1 SMTP_PORT=2525 MAIL_FROM=...  (+ faux SMTP : smtp-sink.mjs)
  FEEXPAY_TOKEN=test-token FEEXPAY_SHOP_ID=shop-1 FEEXPAY_BASE_URL=http://127.0.0.1:4010
                                                    (+ faux FeexPay : feexpay-mock.mjs)
  Numéros de test = ceux de la sandbox FeexPay (issue selon les deux derniers chiffres).
  AGORA_APP_ID / AGORA_APP_CERTIFICATE (valeurs quelconques de 32 car.) pour l'appel

  python3 scripts/e2e-real.py            # API=http://localhost:47001  MAILS=/tmp/mails.jsonl

Chaque compte est créé par une vraie inscription ; chaque code est lu dans le
mail reçu, jamais dans la réponse de l'API.
"""
import base64, json, os, sys, time, urllib.error, urllib.request, uuid

API = os.environ.get("API", "http://localhost:47001")
MAILS = os.environ.get("MAILS", "/tmp/mails.jsonl")
PAYLOG = os.environ.get("PAYLOG", "/tmp/feexpay.jsonl")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@e2e.test")

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
failed = 0


def check(label, got, want):
    global failed
    ok = got == want
    print(f"  {'✓' if ok else '✗'} {label}" + ("" if ok else f"  (attendu {want!r}, obtenu {got!r})"))
    if not ok:
        failed += 1


def call(method, path, body=None, token=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = dict(headers or {})
    if raw is None and body is not None:
        h["Content-Type"] = "application/json"
    if token:
        h["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(API + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            payload = r.read()
            ctype = r.headers.get("Content-Type", "")
            return r.status, (json.loads(payload) if "json" in ctype and payload else payload), ctype
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload), ""
        except Exception:
            return e.code, payload, ""


def multipart(token, content, filename="piece.png", ctype="image/png"):
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return call("POST", "/uploads", raw=body, token=token,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})


def code_for(email, after=0):
    """Dernier code reçu par mail à cette adresse (jamais lu dans l'API)."""
    for _ in range(40):
        try:
            lines = [json.loads(l) for l in open(MAILS)]
        except FileNotFoundError:
            lines = []
        mine = [m for i, m in enumerate(lines) if i >= after and m["to"] == email]
        if mine:
            import re
            return re.search(r"\b(\d{6})\b", mine[-1]["subject"]).group(1)
        time.sleep(0.25)
    raise SystemExit(f"aucun mail reçu pour {email}")


def mail_count():
    try:
        return sum(1 for _ in open(MAILS))
    except FileNotFoundError:
        return 0


def sign_in(email, register=None):
    before = mail_count()
    if register:
        status, body, _ = call("POST", "/auth/register", register)
        assert status == 201, (status, body)
    else:
        status, body, _ = call("POST", "/auth/login", {"email": email})
        assert status == 200, (status, body)
    assert body.get("devCodes") is None, "le code ne doit pas être dans la réponse"
    code = code_for(email, before)
    status, v, _ = call("POST", "/auth/verify-otp", {"userId": body["userId"], "emailCode": code})
    assert status == 200, (status, v)
    return v["token"], v["user"]


print("== Base vierge : aucune donnée fictive ==")
status, troncons, _ = call("GET", "/troncons")
check("le catalogue de trançons existe", len(troncons), 5)
check("aucun véhicule en circulation", call("GET", "/vehicles")[1], [])

admin, admin_user = sign_in(ADMIN_EMAIL)
check("l'admin se connecte par code reçu en mail", admin_user["role"], "ADMIN")
stats = call("GET", "/admin/stats", token=admin)[1]
check("aucun chauffeur", (stats["drivers"]["pendingReview"], stats["drivers"]["approved"]), (0, 0))
check("aucune course", stats["bookings"], {})

print("== Inscriptions réelles ==")
client, client_user = sign_in("awa@e2e.test", {
    "email": "awa@e2e.test", "phone": "+22997111111", "fullName": "Awa Client", "locale": "fr"})
check("client créé, rôle CLIENT", client_user["role"], "CLIENT")
check("son téléphone n'est pas déclaré vérifié", client_user["phoneVerified"], False)

driver, _u = sign_in("kofi@e2e.test", {
    "email": "kofi@e2e.test", "phone": "+22890222222", "fullName": "Kofi Chauffeur", "locale": "fr"})
check("candidature déposée", call("POST", "/driver/register", {
    "baseCity": "Cotonou", "offersFrontalier": True, "offersLocationVille": True}, driver)[0], 201)

print("== Pièces justificatives ==")
check("file:///… du téléphone refusé", call("POST", "/driver/documents",
      {"type": "CNI", "fileUrl": "file:///data/user/0/photo.jpg"}, driver)[0], 400)
check("un client ne peut pas téléverser", multipart(client, PNG)[0], 403)
check("un fichier texte déguisé en image refusé", multipart(driver, b"pas une image", "x.png")[0], 415)
check("sans jeton, refusé", multipart(None, PNG)[0], 401)

types = ["CNI", "PERMIS", "CARTE_GRISE", "ASSURANCE", "VISITE_TECHNIQUE", "CASIER_JUDICIAIRE", "PHOTO_VEHICULE"]
first_url = None
for t in types:
    st, up, _ = multipart(driver, PNG)
    assert st == 201, (st, up)
    st, doc, _ = call("POST", "/driver/documents", {"type": t, "fileUrl": up["url"]}, driver)
    assert st == 201, (st, doc)
    first_url = first_url or up["url"]
check("dossier complet → en attente de contrôle", call("GET", "/driver/me", token=driver)[1]["status"], "PENDING_REVIEW")

other, _u = sign_in("autre@e2e.test", {
    "email": "autre@e2e.test", "phone": "+22990333333", "fullName": "Autre", "locale": "fr"})
call("POST", "/driver/register", {"baseCity": "Lomé", "offersFrontalier": True}, other)
check("sans jeton, la pièce n'est pas lisible", call("GET", first_url)[0], 401)
check("un autre chauffeur ne la lit pas", call("GET", first_url, token=other)[0], 404)
check("le propriétaire la lit", call("GET", first_url, token=driver)[0], 200)
st, body, ctype = call("GET", first_url, token=admin)
check("l'admin la lit, avec le bon type", (st, ctype), (200, "image/png"))
check("octets identiques à ceux envoyés", body, PNG)

print("== Validation par l'admin ==")
pending = call("GET", "/admin/drivers?status=PENDING_REVIEW", token=admin)[1]
check("le dossier apparaît chez l'admin", [d["user"]["email"] for d in pending], ["kofi@e2e.test"])
check("le chauffeur ne peut pas se mettre en ligne avant validation",
      call("PATCH", "/driver/status", {"isOnline": True}, driver)[0], 403)
check("validation", call("POST", f"/admin/drivers/{pending[0]['id']}/approve", token=admin)[1]["status"], "APPROVED")
check("en ligne après validation", call("PATCH", "/driver/status", {"isOnline": True}, driver)[0], 200)

print("== Véhicule ==")
st, veh, _ = call("POST", "/driver/vehicles", {
    "type": "CONFORT", "brand": "Toyota", "model": "Corolla", "plateNumber": "AB-1234-RB",
    "seats": 4, "pricePerDay": 60000}, driver)
check("véhicule ajouté", st, 201)
check("il apparaît au catalogue de location", [v["plateNumber"] for v in call("GET", "/vehicles?city=Cotonou")[1]], ["AB-1234-RB"])

def wait_status(payment_id, token, want, tries=30):
    """Interroge le statut comme le fait l'application, jusqu'à l'issue attendue."""
    last = None
    for _ in range(tries):
        last = call("GET", f"/payments/{payment_id}/status", token=token)[1]["status"]
        if last == want:
            return last
        time.sleep(0.5)
    return last


def new_booking():
    st, b, _ = call("POST", "/bookings/frontalier", {"tranconId": tid, "departureAt": depart, "seats": 1, "isRoundTrip": False}, client)
    assert st == 201, (st, b)
    return b["booking"]["id"], b["booking"]["reference"], b["price"]["totalFcfa"]


def pay(booking_id, method, phone):
    return call("POST", "/payments/initiate", {"bookingId": booking_id, "method": method, "phone": phone}, client)


def booking_status(booking_id):
    return call("GET", f"/bookings/{booking_id}", token=client)[1]["status"]


# Numéros de test de la sandbox FeexPay : l'issue dépend des deux derniers chiffres.
#   00 réussi · 01 solde insuffisant · 02 erreur 503 · 03 en attente puis échec · 04 numéro invalide

print("== Mobile Money : les refus, avant tout paiement ==")
tid = troncons[0]["id"]
depart = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 3 * 86400))
bid, ref1, price = new_booking()
check("carte bancaire : refusée proprement", call("POST", "/payments/initiate", {"bookingId": bid, "method": "CARD"}, client)[0], 400)
check("numéro invalide (…04) → erreur claire", pay(bid, "MOMO_MTN", "+22997000004")[0], 400)
st, togo, _ = pay(bid, "MOMO_MTN", "+22890222222")
check("numéro togolais → refusé avec explication", (st, "béninois" in togo.get("error", "")), (400, True))
check("erreur FeexPay (…02) → 503, pas un faux succès", pay(bid, "MOMO_MTN", "+22997000002")[0], 503)
st, low, _ = pay(bid, "MOMO_MTN", "+22997000001")
check("solde insuffisant (…01) → refusé, motif transmis", (st, bool(low.get("error"))), (400, True))
check("aucune de ces tentatives n'a confirmé la course", booking_status(bid), "AWAITING_PAYMENT")

print("== MTN : le statut final arrive dans la création ==")
st, ok, _ = pay(bid, "MOMO_MTN", "+22997000000")
check("paiement réussi, course confirmée immédiatement", (st, ok["status"]), (200, "CONFIRMED"))
check("la course est confirmée", booking_status(bid), "CONFIRMED")
sent = [json.loads(l) for l in open(PAYLOG)]
req = [r for r in sent if r.get("phoneNumber") == "2290197000000" and r["network"] == "mtn"][-1]
check("numéro envoyé au format 229 + 01 + 8 chiffres", req["phoneNumber"], "2290197000000")
check("montant entier, en francs", (req["amount"], isinstance(req["amount"], int)), (price, True))
check("identifiant de boutique", req["shop"], "shop-1")
check("description sans caractère spécial", (req["description"].startswith("FrontiRide"), req["description"].replace(" ", "").isalnum()), (True, True))
check("le webhook public n'existe plus", call("POST", "/payments/webhook", {"name": "transaction.approved", "entity": {"id": "1"}})[0], 404)

print("== Moov ==")
bid_moov, _r, _p = new_booking()
st, mv, _ = pay(bid_moov, "MOMO_MOOV", "+22997555500")
check("paiement Moov réussi", (st, mv["status"]), (200, "CONFIRMED"))
mreq = [r for r in [json.loads(l) for l in open(PAYLOG)] if r["network"] == "moov"][-1]
check("réseau moov, numéro à 10 chiffres", (mreq["network"], mreq["phoneNumber"]), ("moov", "2290197555500"))

print("== Celtiis : en attente, puis confirmé ==")
bid2, _r, _p = new_booking()
st, pay2, _ = pay(bid2, "MOMO_CELTIIS", "+22997111100")
check("invite envoyée, en attente de validation", (st, pay2["status"]), (202, "PENDING"))
check("la course n'est PAS confirmée tant que le client n'a pas validé", booking_status(bid2), "AWAITING_PAYMENT")
st, dup, _ = pay(bid2, "MOMO_CELTIIS", "+22997111100")
check("une seconde invite est refusée (pas de double validation)", st, 409)
check("personne d'autre ne suit ce paiement", call("GET", f"/payments/{pay2['payment']['id']}/status", token=driver)[0], 404)
check("le client valide → paiement sous séquestre", wait_status(pay2["payment"]["id"], client, "ESCROW_HELD"), "ESCROW_HELD")
check("la course est confirmée", booking_status(bid2), "CONFIRMED")

print("== Celtiis : refus après attente, puis espèces ==")
bid4, _r, _p = new_booking()
st, pay4, _ = pay(bid4, "MOMO_CELTIIS", "+22997119903")
check("invite envoyée", st, 202)
check("le client n'aboutit pas → échec", wait_status(pay4["payment"]["id"], client, "FAILED"), "FAILED")
check("la course reste à payer", booking_status(bid4), "AWAITING_PAYMENT")
st, again, _ = call("POST", "/payments/initiate", {"bookingId": bid4, "method": "CASH"}, client)
check("il peut se rabattre sur les espèces", (st, again["status"]), (200, "CONFIRMED"))

print("== Togo : clients togolais sur les réseaux togolais ==")
bid_tg, _r, _p = new_booking()
check("un numéro béninois ne peut pas payer sur un réseau togolais",
      pay(bid_tg, "MOMO_TOGOCOM", "+22997000000")[0], 400)
st, tg, _ = pay(bid_tg, "MOMO_TOGOCOM", "+22890222200")
check("Togocom : invite envoyée, en attente", (st, tg["status"]), (202, "PENDING"))
check("le client togolais valide → paiement sous séquestre", wait_status(tg["payment"]["id"], client, "ESCROW_HELD"), "ESCROW_HELD")
treq = [r for r in [json.loads(l) for l in open(PAYLOG)] if r["network"] == "togocom_tg"][-1]
check("numéro envoyé au format 228 + 8 chiffres", treq["phoneNumber"], "22890222200")
bid_tg2, _r, _p = new_booking()
st, mg, _ = pay(bid_tg2, "MOMO_MOOV_TG", "+22891333300")
check("Moov Togo : invite envoyée", st, 202)
check("Moov Togo : confirmé", wait_status(mg["payment"]["id"], client, "ESCROW_HELD"), "ESCROW_HELD")

print("== Réconciliation sans l'application ==")
bid3, _r, _p = new_booking()
pay(bid3, "MOMO_CELTIIS", "+22997666600")
status3 = "AWAITING_PAYMENT"
for _ in range(60):  # l'application est fermée : on n'interroge PAS le statut
    status3 = booking_status(bid3)
    if status3 == "CONFIRMED":
        break
    time.sleep(1)
check("le serveur confirme tout seul, application fermée", status3, "CONFIRMED")

print("== La course, jusqu'à la note ==")
avail = sorted(r["id"] for r in call("GET", "/driver/rides/available", token=driver)[1])
check("toutes les courses payées sont proposées au chauffeur (cinq moyens, deux pays)",
      {bid, bid_moov, bid2, bid3, bid4, bid_tg, bid_tg2} <= set(avail), True)
check("acceptation", call("POST", f"/driver/rides/{bid}/accept", token=driver)[1]["status"], "DRIVER_ASSIGNED")
check("le client voit son chauffeur", call("GET", f"/bookings/{bid}", token=client)[1]["driver"]["user"]["fullName"], "Kofi Chauffeur")
check("départ", call("POST", f"/driver/rides/{bid}/start", token=driver)[0], 200)
done = call("POST", f"/driver/rides/{bid}/complete", token=driver)[1]
check("terminée, gains calculés", done["earningsFcfa"] > 0, True)
check("notation par le client", call("POST", f"/bookings/{bid}/rating", {"score": 5, "comment": "Parfait"}, client)[0], 201)

print("== L'argent : du séquestre au retrait ==")
wallet = call("GET", "/driver/me", token=driver)[1]["wallet"]
check("gains en attente, rien de retirable encore", (wallet["pendingFcfa"] > 0, wallet["balanceFcfa"]), (True, 0))
payments = call("GET", "/admin/payments?status=ESCROW_HELD", token=admin)[1]
mine = [p for p in payments if p["booking"]["reference"] == ref1]
check("l'admin voit le paiement sous séquestre", len(mine), 1)
rel = call("POST", f"/admin/payments/{mine[0]['id']}/release", token=admin)
check("déblocage par l'admin", rel[0], 200)
wallet = call("GET", "/driver/me", token=driver)[1]["wallet"]
check("le solde du chauffeur est retirable", (wallet["balanceFcfa"] == rel[1]["releasedFcfa"], wallet["pendingFcfa"]), (True, 0))
wd = call("POST", "/driver/withdrawals", {"amountFcfa": 5000, "destination": "+22890222222"}, driver)
check("demande de retrait", (wd[0], wd[1]["status"]), (201, "REQUESTED"))
check("l'admin la verse", call("POST", f"/admin/withdrawals/{wd[1]['id']}/settle", token=admin)[0], 200)

print("== Contact : appel dans l'application ==")
st, cfg, _ = call("GET", "/calls/config", token=client)
if cfg.get("enabled"):
    st, c, _ = call("POST", "/calls", {"bookingId": bid}, client)
    check("le client appelle son chauffeur", (st, c["call"]["status"]), (201, "RINGING"))
    check("le chauffeur voit la sonnerie", call("GET", "/calls/incoming", token=driver)[1]["caller"]["fullName"], "Awa Client")
else:
    print("  (appel non configuré sur cette API : étape ignorée)")

print("== Location en ville ==")
vid = call("GET", "/vehicles?city=Cotonou")[1][0]["id"]
start = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 10 * 86400))
st, lv, _ = call("POST", "/bookings/location-ville", {"vehicleId": vid, "startAt": start, "durationDays": 2}, client)
check("réservation de location", (st, lv["booking"]["status"]), (201, "AWAITING_PAYMENT"))
check("acompte de 30 %", lv["advanceFcfa"], round(lv["price"]["totalFcfa"] * 0.3))
start2 = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 40 * 86400))
st, big, _ = call("POST", "/bookings/location-ville", {"vehicleId": vid, "startAt": start2, "durationDays": 20}, client)
st, over, _ = call("POST", "/payments/initiate", {"bookingId": big["booking"]["id"], "method": "MOMO_MTN", "phone": "+22997000000", "payFull": True}, client)
check("au-delà de 1 000 000 FCFA, le Mobile Money est refusé avec explication", (st, "1 000 000" in over.get("error", "").replace("\u202f", " ").replace("\u00a0", " ")), (400, True))

print("== Vue d'ensemble de l'admin ==")
stats = call("GET", "/admin/stats", token=admin)[1]
check("une course terminée", stats["revenue"]["completedCount"], 1)
check("un chauffeur validé", stats["drivers"]["approved"], 1)
roles = sorted({b["role"] for b in call("GET", "/bookings", token=driver)[1]})
check("le chauffeur n'a conduit que, et n'a rien réservé", roles, ["DRIVER"])

print("\n" + ("TOUS LES TESTS PASSENT" if not failed else f"{failed} TEST(S) ÉCHOUENT"))
sys.exit(1 if failed else 0)
