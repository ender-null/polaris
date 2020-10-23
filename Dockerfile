FROM node:15-alpine as builder

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk add python make gcc g++
RUN npm install

COPY . .

RUN npm run build

FROM node:15-alpine AS release

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/package.json ./

CMD ["node", "build/src/main.js"]