FROM debian:latest as builder

RUN npm install yarn@latest -g --force

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn run build

FROM debian:latest as release

LABEL org.opencontainers.image.source https://github.com/ender-null/polaris

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/package.json ./

RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y ffmpeg opus-tools cron
RUN npm install yarn@latest -g --force
RUN crontab -l -u root | echo "*/15 * * * * find /tmp -type f -delete" | crontab -u root -
ENV TZ=Europe/Madrid

CMD ["yarn", "start"]
