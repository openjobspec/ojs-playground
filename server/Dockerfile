# Stage 1: Build UI
FROM node:22-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Stage 2: Build Go server
FROM golang:1.22-alpine AS server-builder
RUN apk add --no-cache git
WORKDIR /app/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=ui-builder /app/ui/dist ./internal/embed/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /ojs-playground ./cmd/playground

# Stage 3: Final image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=server-builder /ojs-playground /usr/local/bin/ojs-playground
EXPOSE 4200
ENTRYPOINT ["ojs-playground"]
CMD ["dev", "--no-scan", "--open=false"]
