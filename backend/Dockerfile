FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 8217

CMD ["sh", "-c", "npx prisma db push && npm run prisma:seed && npm start"]
