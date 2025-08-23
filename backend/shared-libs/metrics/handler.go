package metrics

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// SetupMetricsEndpoint adds the /metrics endpoint to a Gin router
func SetupMetricsEndpoint(router *gin.Engine) {
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
}

// SetupMetricsEndpointWithGroup adds the /metrics endpoint to a Gin router group
func SetupMetricsEndpointWithGroup(group *gin.RouterGroup) {
	group.GET("/metrics", gin.WrapH(promhttp.Handler()))
}