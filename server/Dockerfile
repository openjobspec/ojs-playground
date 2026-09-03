# Stage 1: Build UI
FROM node:22-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY THIRD_PARTY_NOTICES.md /app/THIRD_PARTY_NOTICES.md
COPY npm/package.json /app/npm/package.json
COPY ui/ ./
RUN npm run notices:check
RUN npm run build
RUN node -p "require('/app/npm/package.json').version" > /app/playground-version

# Stage 2: Build Go server
FROM golang:1.24-alpine AS server-builder
RUN apk add --no-cache git
WORKDIR /app/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=ui-builder /app/ui/dist ./internal/embed/dist
COPY --from=ui-builder /app/playground-version /app/playground-version
RUN VERSION="$(cat /app/playground-version)" && \
    CGO_ENABLED=0 go build -ldflags="-s -w -X main.version=${VERSION} -X github.com/openjobspec/ojs-playground/server/internal/api.version=${VERSION}" -o /ojs-playground ./cmd/playground

# Stage 3: Final image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates && \
    adduser -D -u 1001 ojs
COPY --from=server-builder /ojs-playground /usr/local/bin/ojs-playground
COPY LICENSE THIRD_PARTY_NOTICES.md /licenses/
USER ojs
EXPOSE 4200
ENTRYPOINT ["ojs-playground"]
CMD ["dev", "--no-scan", "--open=false"]
