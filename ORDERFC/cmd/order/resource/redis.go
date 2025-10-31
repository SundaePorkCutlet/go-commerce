package resource

import (
	"context"
	"fmt"
	"orderfc/config"
	"orderfc/infrastructure/log"

	"github.com/redis/go-redis/v9"
)

func InitRedis(cfg config.RedisConfig) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       0,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Logger.Fatal().Err(err).Msg("Failed to connect to Redis")
	}

	log.Logger.Info().Msg("Connected to Redis")
	return rdb
}

