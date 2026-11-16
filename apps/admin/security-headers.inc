# Une interface d'administration n'a aucune raison d'être affichée dans le cadre
# d'un autre site, ni d'être interprétée comme autre chose que ce qu'elle est.
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "same-origin" always;
# Politique de contenu : seuls les scripts du site lui-même s'exécutent. Le
# jeton de session vit dans le navigateur ; un script injecté ne doit pas
# pouvoir le lire ni l'envoyer ailleurs que vers l'API (connect-src https:).
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https:; frame-src blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header Strict-Transport-Security "max-age=31536000" always;
