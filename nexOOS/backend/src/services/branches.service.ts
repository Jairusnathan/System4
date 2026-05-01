import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

const BRANCH_CACHE_TTL_MS = Number(process.env.BRANCH_CACHE_TTL_MS || 60_000);
const INVENTORY_CACHE_TTL_MS = Number(process.env.INVENTORY_CACHE_TTL_MS || 15_000);

@Injectable()
export class BranchesService {
  private readonly supabaseService: SupabaseService;
  private branchesCache: { expiresAt: number; data: unknown[] } | null = null;
  private branchesFetchPromise: Promise<unknown[]> | null = null;
  private inventoryCache = new Map<string, { expiresAt: number; data: unknown[] }>();
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
    const { data, error } = await this.supabaseService.supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  private async loadInventory(branchId: string) {
    const { data, error } = await this.supabaseService.supabase
      .from('branch_inventory')
      .select('*')
      .eq('branch_id', branchId);

    if (error) {
      throw error;
    }

    return data ?? [];
  }
}
