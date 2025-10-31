package repository

import (
	"context"
	"encoding/json"
	"orderfc/infrastructure/constant"
	"orderfc/infrastructure/log"
	"orderfc/models"
	"time"

	"gorm.io/gorm"
)

func (r *OrderRepository) WithTransaction(ctx context.Context, fn func(tx *gorm.DB) error) error {
	tx := r.Database.WithContext(ctx).Begin()

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	return nil
}

func (r *OrderRepository) InsertOrdertx(ctx context.Context, tx *gorm.DB, order *models.Order) error {
	err := tx.WithContext(ctx).Create(order).Error
	return err
}

func (r *OrderRepository) InsertOrderDetailtx(ctx context.Context, tx *gorm.DB, orderDetail *models.OrderDetail) error {
	err := tx.WithContext(ctx).Create(orderDetail).Table("order_details").Error
	return err
}

func (r *OrderRepository) CheckIdempotencyToken(ctx context.Context, idempotencyToken string) (bool, error) {
	var log models.OrderRequestLog
	err := r.Database.WithContext(ctx).Table("order_request_logs").First(&log, "idempotency_token = ?", idempotencyToken).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *OrderRepository) SaveIdempotencyToken(ctx context.Context, idempotencyToken string) error {
	log := models.OrderRequestLog{
		IdempotencyToken: idempotencyToken,
		CreateTime:       time.Now(),
	}

	err := r.Database.WithContext(ctx).Table("order_request_logs").Create(&log).Error
	if err != nil {
		return err
	}
	return nil

}

func (r *OrderRepository) GetOrderHistoryByUserId(ctx context.Context, params models.OrderHistoryparam) ([]models.OrderHistoryResponse, error) {
	var queryResults []models.OrderHistoryResult
	query := r.Database.WithContext(ctx).Table("orders").
		Select(`orders.id, orders.amount, orders.total_qty, orders.payment_method, orders.shipping_address, orders.create_time, 
		orders.update_time, order_details.products, order_details.order_history`).
		Joins("JOIN order_details ON orders.order_detail_id = order_details.id").
		Where("user_id = ?", params.UserID)

	if params.Status > 0 {
		query = query.Where("status = ?", params.Status)
	}
	err := query.Order("orders.id DESC").Scan(&queryResults).Error
	if err != nil {
		return nil, err
	}
	var results []models.OrderHistoryResponse
	for _, result := range queryResults {
		var products []models.CheckoutItem
		var orderHistory []models.StatusHistory
		err := json.Unmarshal([]byte(result.Products), &products)
		if err != nil {
			log.Logger.Info().Err(err).Msg("Error unmarshalling products")
			return nil, err
		}
		err = json.Unmarshal([]byte(result.OrderHistory), &orderHistory)
		if err != nil {
			log.Logger.Info().Err(err).Msg("Error unmarshalling order history")
			return nil, err
		}
		results = append(results, models.OrderHistoryResponse{
			OrderID:         result.Id,
			TotalAmount:     result.Amount,
			TotalQty:        result.TotalQty,
			PaymentMethod:   result.PaymentMethod,
			ShippingAddress: result.ShippingAddress,
			Products:        products,
			History:         orderHistory,
			Status:          constant.OrderStatusMap[result.Status],
		})
	}

	return results, nil
}
