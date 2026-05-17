import { Injectable } from '@nestjs/common';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { SupabaseService } from '../auth/supabase.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async trackSearchQuery(query: string, source: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Keep file log as backup
    const logPath = path.join(process.cwd(), '..', 'search-analytics.log');
    appendFile(logPath, `${JSON.stringify({ query: trimmedQuery, source, timestamp: new Date().toISOString() })}\n`, 'utf8').catch(() => {});

    try {
      await this.supabaseService.supabaseAdmin
        .from('search_analytics')
        .insert({ query: trimmedQuery, source });
    } catch {
      // Non-critical — never block the search flow
    }
  }

  async getTrending(limit = 8): Promise<{ query: string; count: number }[]> {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabaseService.supabaseAdmin
        .from('search_analytics')
        .select('query')
        .gte('searched_at', since);

      if (error || !data) return [];

      const counts = new Map<string, number>();
      for (const row of data as { query: string }[]) {
        const q = row.query.toLowerCase().trim();
        counts.set(q, (counts.get(q) ?? 0) + 1);
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([query, count]) => ({ query, count }));
    } catch {
      return [];
    }
  }
}
