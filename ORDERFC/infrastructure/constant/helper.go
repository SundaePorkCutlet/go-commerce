package constant

const (
	OrderStatusCreated    = 0
	OrderStatusProcessing = 1
	OrderStatusCompleted  = 2
	OrderStatusCancelled  = 3
	OrderStatusFailed     = 4
)

var OrderStatusMap = map[int]string{
	OrderStatusCreated:    "created",
	OrderStatusProcessing: "processing",
	OrderStatusCompleted:  "completed",
	OrderStatusCancelled:  "cancelled",
	OrderStatusFailed:     "failed",
}
