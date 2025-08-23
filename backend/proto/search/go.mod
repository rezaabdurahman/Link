module github.com/link-app/backend/proto/search

go 1.21

require (
    github.com/link-app/backend/proto/common v0.0.0
    google.golang.org/grpc v1.75.0
    google.golang.org/protobuf v1.36.8
)

replace github.com/link-app/backend/proto/common => ../common