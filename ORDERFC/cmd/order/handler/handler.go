package handler

import (
	"net/http"
	"orderfc/cmd/order/usecase"
	"orderfc/infrastructure/log"
	"orderfc/models"
	"strconv"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	OrderUsecase usecase.OrderUsecase
}

func NewOrderHandler(orderUsecase usecase.OrderUsecase) *OrderHandler {
	return &OrderHandler{OrderUsecase: orderUsecase}
}

func (h *OrderHandler) Ping() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	}
}

func (h *OrderHandler) CheckOutOrder(c *gin.Context) {
	var checkoutRequest models.CheckoutRequest
	if err := c.ShouldBindJSON(&checkoutRequest); err != nil {
		log.Logger.Info().Err(err).Msg("Invalid JSON format in checkout request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIdStr, ok := c.Get("user_id")
	if !ok {
		log.Logger.Info().Msg("User ID not found in context")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID not found in context"})
		return
	}
	userId, ok := userIdStr.(float64)
	if !ok {
		log.Logger.Info().Msg("Invalid user ID")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}

	if len(checkoutRequest.Items) == 0 {
		log.Logger.Info().Msg("Items are required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Items are required"})
		return
	}

	checkoutRequest.UserID = int64(userId)

	orderId, err := h.OrderUsecase.CheckOutOrder(c.Request.Context(), &checkoutRequest)
	if err != nil {
		log.Logger.Info().Err(err).Msg("Error checking out order")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Order created successfully", "order_id": orderId})
}

func (h *OrderHandler) GetOrderHistoryByUserId(c *gin.Context) {
	var params models.OrderHistoryparam

	userIdStr, ok := c.Get("user_id")
	if !ok {
		log.Logger.Info().Msg("User ID not found in context")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User ID not found in context"})
		return
	}
	userId, ok := userIdStr.(float64)
	if !ok {
		log.Logger.Info().Msg("Invalid user ID")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID"})
		return
	}
	params.UserID = int64(userId)

	statusStr := c.Query("status")
	if statusStr != "" {
		status, err := strconv.Atoi(statusStr)
		if err != nil {
			log.Logger.Info().Err(err).Msg("Invalid status")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}
		params.Status = status
	}

	results, err := h.OrderUsecase.GetOrderHistoryByUserId(c.Request.Context(), params)
	if err != nil {
		log.Logger.Info().Err(err).Msg("Error getting order history by user id")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
