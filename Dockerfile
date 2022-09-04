FROM ghcr.io/ender-null/polaris-base@sha256:62f6d9ba31697a63fba28a501336b3d1247a0b8ebb700724c4992312f269cc8c as builder

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn run build

FROM ghcr.io/ender-null/polaris-base@sha256:62f6d9ba31697a63fba28a501336b3d1247a0b8ebb700724c4992312f269cc8c as release

LABEL org.opencontainers.image.source https://github.com/ender-null/polaris

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/package.json ./

CMD ["yarn", "start"]
