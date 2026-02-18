interface TableConfig {
  searchFields: string[];
  allowedOrderBy: string[];
  defaultOrderBy: string;
  dateField: string;
}

export const TABLE_CONFIG: Record<string, TableConfig> = {
  customers: {
    searchFields: ['name', 'email', 'phone', 'document'],
    allowedOrderBy: ['name', 'created_at', 'updated_at', 'is_active'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  products: {
    searchFields: ['name', 'sku', 'barcode'],
    allowedOrderBy: ['name', 'created_at', 'updated_at', 'stock_quantity', 'sale_price', 'is_active'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  appointments: {
    searchFields: ['customer_name', 'service_name'],
    allowedOrderBy: ['scheduled_at', 'created_at', 'updated_at', 'status'],
    defaultOrderBy: 'scheduled_at',
    dateField: 'scheduled_at',
  },
  orders: {
    searchFields: ['customer_name'],
    allowedOrderBy: ['created_at', 'updated_at', 'status', 'payment_status', 'total'],
    defaultOrderBy: 'created_at',
    dateField: 'created_at',
  },
  cash_transactions: {
    searchFields: ['description', 'category', 'type'],
    allowedOrderBy: ['transaction_date', 'created_at', 'amount', 'type'],
    defaultOrderBy: 'created_at',
    dateField: 'transaction_date',
  },
};