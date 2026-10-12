package main

import (
	"math"
	"sort"
)

type Item struct {
	ProductID string  `json:"productId" binding:"required"`
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity" binding:"gt=0"`
	UnitPrice float64 `json:"unitPrice" binding:"gte=0"`
}

type Order struct {
	ID     string  `json:"id" binding:"required"`
	Status string  `json:"status" binding:"required"`
	Total  float64 `json:"total" binding:"gte=0"`
	Items  []Item  `json:"items" binding:"dive"`
}

type SummaryRequest struct {
	Orders []Order `json:"orders" binding:"dive"`
}

type TopProduct struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	UnitsSold int     `json:"unitsSold"`
	Revenue   float64 `json:"revenue"`
}

type Summary struct {
	OrderCount        int            `json:"orderCount"`
	TotalRevenue      float64        `json:"totalRevenue"`
	AverageOrderValue float64        `json:"averageOrderValue"`
	OrdersByStatus    map[string]int `json:"ordersByStatus"`
	TopProducts       []TopProduct   `json:"topProducts"`
}

// cents avoids float drift when summing money.
func cents(v float64) int64 { return int64(math.Round(v * 100)) }

func summarize(orders []Order, topN int) Summary {
	s := Summary{OrdersByStatus: map[string]int{}, TopProducts: []TopProduct{}}
	var totalCents int64

	type agg struct {
		name  string
		units int
		cents int64
	}
	products := map[string]*agg{}

	for _, o := range orders {
		s.OrderCount++
		s.OrdersByStatus[o.Status]++
		totalCents += cents(o.Total)
		for _, it := range o.Items {
			a, ok := products[it.ProductID]
			if !ok {
				a = &agg{name: it.Name}
				products[it.ProductID] = a
			}
			a.units += it.Quantity
			a.cents += cents(it.UnitPrice) * int64(it.Quantity)
		}
	}

	s.TotalRevenue = float64(totalCents) / 100
	if s.OrderCount > 0 {
		s.AverageOrderValue = math.Round(float64(totalCents)/float64(s.OrderCount)) / 100
	}

	for id, a := range products {
		s.TopProducts = append(s.TopProducts, TopProduct{
			ProductID: id, Name: a.name, UnitsSold: a.units, Revenue: float64(a.cents) / 100,
		})
	}
	sort.Slice(s.TopProducts, func(i, j int) bool {
		a, b := s.TopProducts[i], s.TopProducts[j]
		if a.UnitsSold != b.UnitsSold {
			return a.UnitsSold > b.UnitsSold
		}
		return a.ProductID < b.ProductID // deterministic ties
	})
	if len(s.TopProducts) > topN {
		s.TopProducts = s.TopProducts[:topN]
	}
	return s
}
