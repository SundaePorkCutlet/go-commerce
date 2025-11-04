package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"orderfc/cmd/order/service"
	"orderfc/infrastructure/constant"
	"orderfc/infrastructure/log"
	"orderfc/kafka"
	"orderfc/models"
	"time"
)

type OrderUsecase struct {
	OrderService  service.OrderService
	KafkaProducer kafka.KafkaProducer
}

func NewOrderUsecase(orderService service.OrderService, kafkaProducer kafka.KafkaProducer) *OrderUsecase {
	return &OrderUsecase{OrderService: orderService, KafkaProducer: kafkaProducer}
}

func (u *OrderUsecase) CheckOutOrder(ctx context.Context, checkoutRequest *models.CheckoutRequest) (int64, error) {

	if checkoutRequest.IdempotencyToken != "" {
		isExist, err := u.OrderService.CheckIdempotencyToken(ctx, checkoutRequest.IdempotencyToken)
		if err != nil {
			return 0, err
		}
		if isExist {
			return 0, errors.New("idempotency token already exists")
		}
	}

	err := u.validateProducts(ctx, checkoutRequest.Items)
	if err != nil {
		return 0, err
	}

	totalQty, totalAmount := u.calculateItemSummary(ctx, checkoutRequest.Items)

	products, history := u.constructorderDetail(ctx, checkoutRequest.Items)

	orderDetail := &models.OrderDetail{
		Products:     products,
		OrderHistory: history,
	}

	order := &models.Order{
		UserID:          checkoutRequest.UserID,
		Amount:          totalAmount,
		TotalQty:        totalQty,
		PaymentMethod:   checkoutRequest.PaymentMethod,
		ShippingAddress: checkoutRequest.ShippingAddress,
		Status:          constant.OrderStatusCreated,
	}

	orderId, err := u.OrderService.SaveOrderAndOrderDetail(ctx, order, orderDetail)
	if err != nil {
		return 0, err
	}

	if checkoutRequest.IdempotencyToken != "" {
		err = u.OrderService.SaveIdempotencyToken(ctx, checkoutRequest.IdempotencyToken)
		if err != nil {
			log.Logger.Info().Err(err).Msgf("Error saving idempotency token: %s", err.Error())
		}
	}
	orderCreatedEvent := models.OrderCreatedEvent{
		OrderID:         orderId,
		UserID:          checkoutRequest.UserID,
		TotalAmount:     totalAmount,
		PaymentMethod:   checkoutRequest.PaymentMethod,
		ShippingAddress: checkoutRequest.ShippingAddress,
	}
	err = u.KafkaProducer.PublishOrderCreated(ctx, orderCreatedEvent)
	if err != nil {
		return 0, err
	}

	return orderId, nil

}

func (u *OrderUsecase) validateProducts(ctx context.Context, items []models.CheckoutItem) error {

	seen := map[int64]bool{}
	for _, item := range items {

		if seen[item.ProductID] {
			return errors.New("duplicate product id")
		}

		if item.Quantity <= 0 || item.Quantity > 1000 {
			return errors.New("quantity must be between 1 and 1000")
		}

		if item.Price <= 0 {
			return errors.New("price must be greater than 0")
		}
	}
	return nil
}

func (u *OrderUsecase) calculateItemSummary(ctx context.Context, items []models.CheckoutItem) (int, float64) {
	var totalQty int
	var totalAmount float64
	for _, item := range items {
		totalAmount += item.Price * float64(item.Quantity)
		totalQty += item.Quantity
	}
	return totalQty, totalAmount
}

func (u *OrderUsecase) constructorderDetail(ctx context.Context, items []models.CheckoutItem) (string, string) {
	productJson, err := json.Marshal(items)
	if err != nil {
		return "", ""
	}
	history := []map[string]interface{}{
		{
			"status": "created",
			"time":   time.Now(),
		},
	}
	historyJson, err := json.Marshal(history)
	if err != nil {
		return "", ""
	}
	return string(productJson), string(historyJson)
}

func (u *OrderUsecase) GetOrderHistoryByUserId(ctx context.Context, params models.OrderHistoryparam) ([]models.OrderHistoryResponse, error) {
	results, err := u.OrderService.GetOrderHistoryByUserId(ctx, params)
	if err != nil {
		return nil, err
	}
	return results, nil
}
