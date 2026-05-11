import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

const BRANCH_CACHE_TTL_MS = Number(process.env.BRANCH_CACHE_TTL_MS || 60_000);
const INVENTORY_CACHE_TTL_MS = Number(
  process.env.INVENTORY_CACHE_TTL_MS || 15_000,
);

@Injectable()
export class BranchesService {
  private readonly supabaseService: SupabaseService;
  private branchesCache: { expiresAt: number; data: unknown[] } | null = null;
  private branchesFetchPromise: Promise<unknown[]> | null = null;
  private inventoryCache = new Map<
    string,
    { expiresAt: number; data: unknown[] }
  >();
  private inventoryFetchPromises = new Map<string, Promise<unknown[]>>();

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  async getBranches() {
    const now = Date.now();
    if (this.branchesCache && this.branchesCache.expiresAt > now) {
      return this.branchesCache.data;
    }

    if (this.branchesFetchPromise) {
      return this.branchesFetchPromise;
    }

    this.branchesFetchPromise = this.loadBranches();

    try {
      const data = await this.branchesFetchPromise;
      this.branchesCache = {
        data,
        expiresAt: Date.now() + BRANCH_CACHE_TTL_MS,
      };
      return data;
    } finally {
      this.branchesFetchPromise = null;
    }
  }

  async getInventory(branchId: string) {
    const cached = this.inventoryCache.get(branchId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const pending = this.inventoryFetchPromises.get(branchId);
    if (pending) {
      return pending;
    }

    const promise = this.loadInventory(branchId);
    this.inventoryFetchPromises.set(branchId, promise);

    try {
      const data = await promise;
      this.inventoryCache.set(branchId, {
        data,
        expiresAt: Date.now() + INVENTORY_CACHE_TTL_MS,
      });
      return data;
    } finally {
      this.inventoryFetchPromises.delete(branchId);
    }
  }

  private async loadBranches() {
    const { data, error } = await this.supabaseService.secondSupabaseAdmin
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) {
      if (this.isMissingTableError(error, 'branches')) {
        try {
          return await this.loadStoreBranches();
        } catch (fallbackError) {
          console.warn(
            'Branches fallback (storebranches) also failed, returning empty list:',
            this.describeError(fallbackError),
          );
          return [];
        }
      }

      console.warn(
        'Branches lookup failed, returning an empty branch list instead:',
        this.describeError(error),
      );
      return [];
    }

    return data ?? [];
  }

  private async loadInventory(branchId: string) {
    const { data, error } = await this.supabaseService.secondSupabaseAdmin
      .from('branch_inventory')
      .select('*')
      .eq('branch_id', branchId);

    if (error) {
      if (this.isMissingTableError(error, 'branch_inventory')) {
        return [];
      }

      if (this.shouldFallbackToEmptyResult(error)) {
        console.warn(
          `Branch inventory lookup failed for branch ${branchId}, returning an empty inventory list instead:`,
          this.describeError(error),
        );
        return [];
      }

      throw error;
    }

    return data ?? [];
  }

  private async loadStoreBranches() {
    const { data, error } = await this.supabaseService.secondSupabaseAdmin
      .from('storebranches')
      .select('*');

    if (error) {
      throw error;
    }

    return (data ?? []).map((branch) => {
      const row = branch as Record<string, unknown>;

      return {
        id: this.toNumber(row.id),
        name: String(row.branch_name ?? row.name ?? `Branch ${String(row.id ?? '')}`),
        address: String(row.address ?? 'Address unavailable'),
        phone: String(row.phone ?? ''),
        opening_time: String(row.opening_time ?? '08:00'),
        closing_time: String(row.closing_time ?? '20:00'),
        is_active: row.is_active === false ? false : true,
      };
    });
  }

  private isMissingTableError(error: unknown, tableName: string) {
    const details = this.describeError(error).toLowerCase();
    return (
      details.includes('pgrst205') &&
      details.includes(`public.${tableName}`.toLowerCase())
    );
  }

  private shouldFallbackToEmptyResult(error: unknown) {
    const details = this.describeError(error);

    return /fetch failed|enotfound|econnrefused|timed out|network/i.test(
      details,
    );
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.stack || error.message;
    }

    if (typeof error === 'object' && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }

    return String(error);
  }

  private toNumber(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
