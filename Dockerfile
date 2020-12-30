FROM ghcr.io/luksireiku/polaris-base as builder

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM ghcr.io/luksireiku/polaris-base AS release

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/.git ./.git

CMD ["npm", "start"]
