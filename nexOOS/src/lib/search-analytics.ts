import { appendFile } from 'fs/promises';
import path from 'path';

export async function trackSearchQuery(query: string, source: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return;
  }

  const logPath = path.join(process.cwd(), 'search-analytics.log');
  const entry = JSON.stringify({
    query: trimmedQuery,
    source,
    timestamp: new Date().toISOString(),
  });

  await appendFile(logPath, `${entry}\n`, 'utf8');
}
