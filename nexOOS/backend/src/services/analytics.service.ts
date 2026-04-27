import { Injectable } from '@nestjs/common';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';

@Injectable()
export class AnalyticsService {
  async trackSearchQuery(query: string, source: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    const logPath = path.join(process.cwd(), '..', 'search-analytics.log');
    const entry = JSON.stringify({
      query: trimmedQuery,
      source,
      timestamp: new Date().toISOString(),
    });

    await appendFile(logPath, `${entry}\n`, 'utf8');
  }
}
