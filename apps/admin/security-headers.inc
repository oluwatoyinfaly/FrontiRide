# Une interface d'administration n'a aucune raison d'être affichée dans le cadre
# d'un autre site, ni d'être interprétée comme autre chose que ce qu'elle est.
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "same-origin" always;
