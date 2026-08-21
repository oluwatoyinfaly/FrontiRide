FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/admin/package.json apps/admin/package.json
RUN npm install --workspace apps/admin

COPY apps/admin apps/admin

WORKDIR /app/apps/admin

EXPOSE 47005

# --host expose le serveur hors du conteneur ; sans lui Vite n'écoute que sur
# la boucle locale et le port publié ne répond pas.
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "47005"]
