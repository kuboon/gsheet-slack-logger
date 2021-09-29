FROM node:16-slim as node_modules
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile --prod

FROM node:16-slim as build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile
COPY . .
RUN yarn build

FROM gcr.io/distroless/nodejs:16
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
COPY --from=node_modules /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
CMD ["/app/dist/monthly.js"]
