package middleware

import (
	"context"
	"orderfc/infrastructure/log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestId := uuid.New().String()

		timeoutCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		ctx := context.WithValue(timeoutCtx, "request_id", requestId)
		ctx = context.WithValue(ctx, "start_time", time.Now())

		c.Request = c.Request.WithContext(ctx)

		c.Next()

		latency := time.Since(ctx.Value("start_time").(time.Time))

		log.Logger.Info().
			Str("request_id", requestId).
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", latency).
			Msg("Request completed")
	}
}
