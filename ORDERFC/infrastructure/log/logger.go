package log

import (
	"os"

	"github.com/rs/zerolog"
)

var Logger zerolog.Logger

func SetupLogger() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()
}

