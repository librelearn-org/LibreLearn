FROM oven/bun:1.3.10-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.10-alpine AS production-dependencies-env
COPY ./package.json bun.lock prisma.config.ts /app/
COPY ./prisma /app/prisma
WORKDIR /app
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1.3.10-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN bunx prisma generate
RUN bun run build

FROM oven/bun:1.3.10-alpine
COPY ./package.json bun.lock prisma.config.ts tsconfig.json server.ts /app/
COPY ./prisma /app/prisma
COPY ./app /app/app
COPY ./public /app/public
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=build-env /app/generated /app/generated
WORKDIR /app
CMD ["sh", "-c", "bunx prisma db push --accept-data-loss && bun run start"]