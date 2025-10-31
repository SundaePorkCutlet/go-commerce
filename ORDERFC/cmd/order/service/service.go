package service

import (
	"context"
	"orderfc/cmd/order/repository"
	"orderfc/models"

	"gorm.io/gorm"
)

type OrderService struct {
	OrderRepo repository.OrderRepository
}

func NewOrderService(orderRepo repository.OrderRepository) *OrderService {
	return &OrderService{OrderRepo: orderRepo}
}

func (s *OrderService) CheckIdempotencyToken(ctx context.Context, idempotencyToken string) (bool, error) {
	return s.OrderRepo.CheckIdempotencyToken(ctx, idempotencyToken)
}

func (s *OrderService) SaveIdempotencyToken(ctx context.Context, idempotencyToken string) error {
	return s.OrderRepo.SaveIdempotencyToken(ctx, idempotencyToken)
}

func (s *OrderService) SaveOrderAndOrderDetail(ctx context.Context, order *models.Order, orderDetail *models.OrderDetail) (int64, error) {
	var orderId int64
	err := s.OrderRepo.WithTransaction(ctx, func(tx *gorm.DB) error {
		err := s.OrderRepo.InsertOrderDetailtx(ctx, tx, orderDetail)
		if err != nil {
			return err
		}

		order.OrderDetailID = orderDetail.ID
		err = s.OrderRepo.InsertOrdertx(ctx, tx, order)
		if err != nil {
			return err
		}
		orderId = order.ID
		return nil
	})
	if err != nil {
		return 0, err
	}
	return orderId, nil
}

func (s *OrderService) GetOrderHistoryByUserId(ctx context.Context, params models.OrderHistoryparam) ([]models.OrderHistoryResponse, error) {
	results, err := s.OrderRepo.GetOrderHistoryByUserId(ctx, params)
	if err != nil {
		return nil, err
	}
	return results, nil
}
