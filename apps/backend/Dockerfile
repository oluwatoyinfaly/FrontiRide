FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspace apps/backend

COPY apps/backend apps/backend

WORKDIR /app/apps/backend
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
