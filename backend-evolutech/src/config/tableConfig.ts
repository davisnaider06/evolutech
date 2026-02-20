interface TableConfig {
  searchFields: string[];
  allowedOrderBy: string[];
  defaultOrderBy: string;
  dateField: string;
  moduleCodes?: string[];
}

export const TABLE_CONFIG: Record<string, TableConfig> = {
  customers: {
    searchFields: ['name', 'email', 'phone', 'document'],
    allowedOrderBy: ['name', 'createdAt', 'updatedAt', 'isActive'],
    defaultOrderBy: 'createdAt',
    dateField: 'createdAt',
    moduleCodes: ['customers', 'clientes'],
  },
  products: {
    searchFields: ['name', 'sku'],
    allowedOrderBy: ['name', 'createdAt', 'price', 'stockQuantity', 'isActive'],
    defaultOrderBy: 'createdAt',
    dateField: 'createdAt',
    moduleCodes: ['products', 'produtos'],
  },
  appointments: {
    searchFields: ['customerName', 'serviceName'],
    allowedOrderBy: ['scheduledAt', 'createdAt', 'updatedAt', 'status'],
    defaultOrderBy: 'scheduledAt',
    dateField: 'scheduledAt',
    moduleCodes: ['appointments', 'agendamentos'],
  },
  orders: {
    searchFields: ['customerName'],
    allowedOrderBy: ['createdAt', 'updatedAt', 'status', 'total'],
    defaultOrderBy: 'createdAt',
    dateField: 'createdAt',
    moduleCodes: ['orders', 'pedidos'],
  },
};
