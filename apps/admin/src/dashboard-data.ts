/** Response contract for the dashboard overview. */
export interface DashboardData {
  period: { days: number, start: string, end: string }
  totals: { products: number, orders: number, customers: number, revenue: number }
  deltas: { orders: number | null, customers: number | null, revenue: number | null }
  charts: {
    status: Array<{ status: string, count: number }>
    revenue: Array<{ date: string, revenue: number, orders: number }>
    annotations: Array<{ date: string, note: string }>
    products: Array<{ status: string, count: number }>
  }
  recent: { orders: Array<{ id: number, number: string, customer: string, product: string, warehouse: string, status: string, total: number, createdAt: string, placedAt: string, overdueHours: number | null }> }
  rankings: {
    payments: Array<{ method: string, count: number, revenue: number }>
    customers: Array<{ name: string, tier: string, orders: number, spent: number }>
  }
}
