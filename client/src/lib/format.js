/** Format amount in Indian Rupees (INR). */
export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/** Short date for Indian locale. */
export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Check if a batch is expired. */
export function isExpired(expiryDate) {
  const end = new Date(expiryDate);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}
