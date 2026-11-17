FROM node:22-slim

WORKDIR /app

COPY package.json .npmrc ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY server.ts ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
