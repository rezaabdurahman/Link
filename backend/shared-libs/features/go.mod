module github.com/link-app/shared-libs/features

go 1.21

require (
	github.com/google/uuid v1.3.0
	github.com/lib/pq v1.10.9
	github.com/link-app/shared-libs/config v0.0.0
	github.com/redis/go-redis/v9 v9.0.5
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/stretchr/testify v1.11.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/link-app/shared-libs/config => ../config
