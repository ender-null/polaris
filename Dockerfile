FROM ghcr.io/ender-null/polaris-base:latest as builder

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn run build

FROM ghcr.io/ender-null/polaris-base:debian as release

LABEL org.opencontainers.image.source https://github.com/ender-null/polaris

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/package.json ./

CMD ["yarn", "start"]
