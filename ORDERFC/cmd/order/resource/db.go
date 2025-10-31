package resource

import (
	"fmt"
	"orderfc/config"
	"orderfc/infrastructure/log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func InitDB(cfg config.DatabaseConfig) *gorm.DB {

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{

		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Logger.Fatal().Err(err).Msg("Failed to connect to database")
	}

	log.Logger.Info().Msg("Connected to database")
	return db
}

