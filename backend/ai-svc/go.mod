module github.com/link-app/ai-svc

go 1.23.0

toolchain go1.24.6

require (
	github.com/go-chi/chi/v5 v5.0.12
	github.com/go-chi/cors v1.2.2
	github.com/go-chi/httprate v0.15.0
	github.com/golang-jwt/jwt/v4 v4.5.2
	github.com/golang-jwt/jwt/v5 v5.3.0
	github.com/google/uuid v1.6.0
	github.com/jmoiron/sqlx v1.4.0
	github.com/link-app/backend/proto/ai v0.0.0
	github.com/link-app/backend/proto/common v0.0.0
	github.com/link-app/shared-libs v0.0.0
	github.com/redis/go-redis/v9 v9.12.1
	github.com/rs/zerolog v1.34.0
	github.com/sashabaranov/go-openai v1.36.0
	golang.org/x/time v0.12.0
	google.golang.org/grpc v1.75.0
	google.golang.org/protobuf v1.36.8
)

replace (
	github.com/link-app/backend/proto/ai => ../proto/ai
	github.com/link-app/backend/proto/common => ../proto/common
	github.com/link-app/shared-libs => ../shared-libs
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	golang.org/x/net v0.41.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/text v0.26.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250707201910-8d1bb00bc6a7 // indirect
)
