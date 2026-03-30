FROM node:20-alpine

RUN npm install -g pm2

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

COPY . .

EXPOSE 3002

CMD ["pm2-runtime", "ecosystem.config.js"]
