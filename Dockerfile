FROM node:13-alpine as builder

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:13-alpine AS release

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/locales ./locales
COPY --from=builder /usr/src/app/package.json ./

CMD ["node", "build/src/main.js"]