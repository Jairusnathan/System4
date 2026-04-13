const pad = (value: number) => value.toString().padStart(2, '0');

export function normalizeDateForInput(value?: string | null) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
}

export function normalizeDateForStorage(value?: string | null) {
  const normalized = normalizeDateForInput(value);
  return normalized || null;
}
