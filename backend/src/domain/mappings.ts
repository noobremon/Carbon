// Field alias configuration mapping canonical property names to potential client JSON field names

export const FIELD_ALIASES = {
  client_id: ['client_id', 'client', 'source', 'app_id', 'client_name', 'sender', 'uid', 'customer_id'],
  metric: ['metric', 'metric_name', 'event_type', 'type', 'event', 'action', 'name'],
  amount: ['amount', 'value', 'price', 'val', 'total', 'amt', 'cost', 'sum'],
  timestamp: ['timestamp', 'ts', 'date', 'created_at', 'event_timestamp', 'time', 'datetime']
};

export function findMatchingField(data: Record<string, any>, aliases: string[]): { key: string; value: any } | null {
  if (!data || typeof data !== 'object') return null;

  for (const alias of aliases) {
    // Check exact match
    if (alias in data && data[alias] !== undefined && data[alias] !== null) {
      return { key: alias, value: data[alias] };
    }
    // Check case-insensitive match
    const foundKey = Object.keys(data).find(k => k.toLowerCase() === alias.toLowerCase());
    if (foundKey && data[foundKey] !== undefined && data[foundKey] !== null) {
      return { key: foundKey, value: data[foundKey] };
    }
  }

  return null;
}
