package routes

import (
	"orderfc/cmd/order/handler"
	"orderfc/config"
	"orderfc/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.Engine, orderHandler *handler.OrderHandler) {
	// 미들웨어 설정
	router.Use(middleware.RequestLogger())

	// public API
	router.GET("/ping", orderHandler.Ping())
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "orderfc",
		})
	})

	// private API (인증 필요)
	private := router.Group("/api")
	private.Use(middleware.AuthMiddleware(config.GetJwtSecret()))
	{
		// 주문 관리
		private.POST("/v1/orders", orderHandler.CheckOutOrder)
		private.GET("/v1/orders/history", orderHandler.GetOrderHistoryByUserId)

	}
}
