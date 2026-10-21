FROM node:26-alpine AS build-stage

WORKDIR /app
RUN npm install -g corepack && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# SSR
FROM node:26-alpine AS production-stage

WORKDIR /app

COPY --from=build-stage /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
