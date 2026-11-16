FROM node:22-slim

# Prisma a besoin d'OpenSSL, absent de l'image slim.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspace apps/backend

COPY apps/backend apps/backend

WORKDIR /app/apps/backend
RUN npx prisma generate

EXPOSE 3000

# Le seed est idempotent (upserts sur identifiants fixes), donc le rejouer à
# chaque démarrage ne duplique rien et garantit une base exploitable d'emblée.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run dev"]
