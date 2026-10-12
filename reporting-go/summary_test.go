package main

import "testing"

func TestSummarize(t *testing.T) {
	orders := []Order{
		{ID: "1", Status: "confirmed", Total: 71.5, Items: []Item{
			{ProductID: "a", Name: "A", Quantity: 2, UnitPrice: 10.25},
			{ProductID: "b", Name: "B", Quantity: 1, UnitPrice: 51},
		}},
		{ID: "2", Status: "pending", Total: 0.1, Items: []Item{
			{ProductID: "a", Name: "A", Quantity: 1, UnitPrice: 0.1},
		}},
	}
	s := summarize(orders, 5)

	if s.OrderCount != 2 {
		t.Fatalf("orderCount = %d, want 2", s.OrderCount)
	}
	if s.TotalRevenue != 71.6 {
		t.Fatalf("totalRevenue = %v, want 71.6", s.TotalRevenue)
	}
	if s.AverageOrderValue != 35.8 {
		t.Fatalf("avg = %v, want 35.8", s.AverageOrderValue)
	}
	if s.OrdersByStatus["confirmed"] != 1 || s.OrdersByStatus["pending"] != 1 {
		t.Fatalf("bad status counts: %v", s.OrdersByStatus)
	}
	if s.TopProducts[0].ProductID != "a" || s.TopProducts[0].UnitsSold != 3 {
		t.Fatalf("bad top product: %+v", s.TopProducts[0])
	}
}

func TestSummarizeEmpty(t *testing.T) {
	s := summarize(nil, 5)
	if s.OrderCount != 0 || s.AverageOrderValue != 0 || len(s.TopProducts) != 0 {
		t.Fatalf("unexpected: %+v", s)
	}
}
