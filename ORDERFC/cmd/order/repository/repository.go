package repository

import (
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type OrderRepository struct {
	Database *gorm.DB
	Redis    *redis.Client
}

func NewOrderRepository(db *gorm.DB, redis *redis.Client) *OrderRepository {
	return &OrderRepository{
		Database: db,
		Redis:    redis,
	}
}

