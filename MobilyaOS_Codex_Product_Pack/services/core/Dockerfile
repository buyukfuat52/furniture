FROM golang:1.22-alpine AS build
WORKDIR /src
COPY services/core/go.mod ./services/core/go.mod
WORKDIR /src/services/core
RUN go mod download
COPY services/core/ ./
RUN go build -o /out/core ./cmd/core

FROM alpine:3.20
RUN adduser -D -H appuser
USER appuser
COPY --from=build /out/core /usr/local/bin/core
EXPOSE 8080
ENTRYPOINT ["core"]
