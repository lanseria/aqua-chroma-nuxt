FROM node:26-alpine AS build-stage

WORKDIR /app
# 统一设置 Corepack 镜像源，后续所有继承 base 的阶段（builder / prod-deps）全局继承
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN npm install -g corepack && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

COPY . .
RUN pnpm build

# SSR
FROM node:26-alpine AS production-stage

WORKDIR /app

COPY --from=build-stage /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
