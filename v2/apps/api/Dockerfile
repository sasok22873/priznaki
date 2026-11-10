FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @pb/api db:generate && pnpm --filter @pb/api build

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /repo/node_modules node_modules
COPY --from=deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
EXPOSE 4000
WORKDIR /repo/apps/api
CMD ["node", "dist/src/server.js"]
