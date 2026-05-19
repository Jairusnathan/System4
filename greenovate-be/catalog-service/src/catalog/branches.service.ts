import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

const BRANCH_CACHE_TTL_MS = Number(process.env.OOS_CATALOG_BRANCH_CACHE_TTL_MS || 60_000);

@Injectable()
export class BranchesService {
  private branchesCache: { expiresAt: number; data: unknown[] } | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  async getBranches() {
    const now = Date.now();
    if (this.branchesCache && this.branchesCache.expiresAt > now) return this.branchesCache.data;
    const data = await this.loadBranches();
    this.branchesCache = { data, expiresAt: Date.now() + BRANCH_CACHE_TTL_MS };
    return data;
  }

  async getInventory(branchId: string) {
    try {
      const { data, error } = await this.supabaseService.secondSupabaseAdmin.from('branch_inventory').select('*').eq('branch_id', branchId);
      if (error) return [];
      return data ?? [];
    } catch { return []; }
  }

  private async loadBranches() {
    try {
      const { data, error } = await this.supabaseService.secondSupabaseAdmin.from('storebranches').select('*').eq('is_active', true);
      if (!error) return this.normalizeBranchRows(data ?? []);
    } catch { /* fallback */ }
    try {
      const { data } = await this.supabaseService.secondSupabase.from('storebranches').select('*').eq('is_active', true);
      return this.normalizeBranchRows(data ?? []);
    } catch { return []; }
  }

  private normalizeBranchRows(rows: unknown[]) {
    return rows.map((branch) => {
      const row = branch as Record<string, unknown>;
      return { id: Number(row.id ?? row.branch_id), name: String(row.branch_name ?? row.name ?? `Branch ${String(row.id ?? '')}`), address: String(row.address ?? 'Address unavailable'), phone: String(row.phone ?? ''), latitude: Number(row.latitude) || NaN, longitude: Number(row.longitude) || NaN, opening_time: String(row.opening_time ?? '08:00').slice(0, 5), closing_time: String(row.closing_time ?? '20:00').slice(0, 5), is_active: row.is_active !== false };
    });
  }
}
