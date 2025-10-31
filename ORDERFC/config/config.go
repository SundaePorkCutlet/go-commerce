package config

import (
	"log"

	"github.com/spf13/viper"
)

func LoadConfig() Config {
	var cfg Config

	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./files/config")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Failed to read config file: %v", err)
	}

	if err := viper.Unmarshal(&cfg); err != nil {
		log.Fatalf("Failed to unmarshal config: %v", err)
	}

	return cfg
}

func GetJwtSecret() string {
	return viper.GetString("secret.jwt_secret")
}
