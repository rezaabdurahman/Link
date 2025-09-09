module github.com/link-app/shared-libs/grpc

go 1.23.0

require (
	github.com/hashicorp/consul/api v1.32.1
	github.com/link-app/proto/ai v0.0.0
	github.com/link-app/proto/chat v0.0.0
	github.com/link-app/proto/common v0.0.0
	github.com/link-app/proto/discovery v0.0.0
	github.com/link-app/proto/search v0.0.0
	github.com/link-app/proto/user v0.0.0
	github.com/prometheus/client_golang v1.23.0
	github.com/sirupsen/logrus v1.9.3
	go.opentelemetry.io/otel v1.37.0
	go.opentelemetry.io/otel/trace v1.37.0
	google.golang.org/grpc v1.75.0
)

require (
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/fatih/color v1.16.0 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-hclog v1.5.0 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/hashicorp/go-rootcerts v1.0.2 // indirect
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/hashicorp/serf v0.10.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.65.0 // indirect
	github.com/prometheus/procfs v0.16.1 // indirect
	go.opentelemetry.io/otel/metric v1.37.0 // indirect
	golang.org/x/net v0.41.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/text v0.26.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250707201910-8d1bb00bc6a7 // indirect
	google.golang.org/protobuf v1.36.8 // indirect
)

replace (
	github.com/link-app/proto/ai => ../../proto/ai
	github.com/link-app/proto/chat => ../../proto/chat
	github.com/link-app/proto/common => ../../proto/common
	github.com/link-app/proto/discovery => ../../proto/discovery
	github.com/link-app/proto/search => ../../proto/search
	github.com/link-app/proto/user => ../../proto/user
)