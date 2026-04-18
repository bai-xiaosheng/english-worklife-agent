export function clampScore(score) {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function averageScore(items, field) {
  if (!items.length) return 0;
  const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
  return clampScore(sum / items.length);
}

