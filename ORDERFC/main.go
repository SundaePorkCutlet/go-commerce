package main

import (
	"orderfc/cmd/order/handler"
	"orderfc/cmd/order/repository"
	"orderfc/cmd/order/resource"
	"orderfc/cmd/order/service"
	"orderfc/cmd/order/usecase"
	"orderfc/config"
	"orderfc/infrastructure/log"
	"orderfc/models"
	"orderfc/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	log.SetupLogger()

	redis := resource.InitRedis(cfg.Redis)
	db := resource.InitDB(cfg.Database)

	// AutoMigrate: order_detail, orders, order_request_log 테이블 자동 생성/업데이트
	if err := db.AutoMigrate(&models.OrderDetail{}, &models.Order{}, &models.OrderRequestLog{}); err != nil {
		log.Logger.Fatal().Err(err).Msg("Failed to migrate database")
	}
	log.Logger.Info().Msg("Database migration completed - order_detail, orders, and order_request_log tables created")

	kafkaProducer := kafka.NewKafkaProducer(cfg.Kafka.Brokers, cfg.Kafka.Topic)

	defer kafkaProducer.Close()
	// 의존성 주입
	orderRepository := repository.NewOrderRepository(db, redis)
	orderService := service.NewOrderService(*orderRepository)
	orderUsecase := usecase.NewOrderUsecase(*orderService, kafkaProducer)
	orderHandler := handler.NewOrderHandler(*orderUsecase)

	port := cfg.App.Port
	router := gin.Default()

	// 라우트 설정
	routes.SetupRoutes(router, orderHandler)

	log.Logger.Info().Msgf("Server is running on port %s", port)
	router.Run(":" + port)
}
