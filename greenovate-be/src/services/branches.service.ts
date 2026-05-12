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
    const metadataBranches = await this.loadPrimaryBranches();
    const catalogBranches = await this.loadCatalogBranches();

    return this.mergeBranches(metadataBranches, catalogBranches);
  }

  private async loadPrimaryBranches() {
    try {
      const client = this.getPrimaryBranchReadClient();
      const { data, error } = await client
        .from('branches')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.warn(
          'Primary branch metadata lookup failed, returning an empty branch list instead:',
          this.describeError(error),
        );
        return [];
      }

      return this.normalizeBranchRows(data ?? []);
    } catch (error) {
      console.warn(
        'Primary branch metadata client is unavailable, returning an empty branch list instead:',
        this.describeError(error),
      );
      return [];
    }
  }

  private getPrimaryBranchReadClient() {
    try {
      return this.supabaseService.supabaseAdmin;
    } catch {
      return this.supabaseService.supabase;
    }
  }

  private async loadInventory(branchId: string) {
    let client;
    try {
      client = this.supabaseService.secondSupabaseAdmin;
    } catch (error) {
      console.warn(
        `Catalog inventory client is unavailable for branch ${branchId}, returning an empty inventory list instead:`,
        this.describeError(error),
      );
      return [];
    }

    const { data, error } = await client
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

  private async loadCatalogBranches() {
    let client;
    try {
      client = this.supabaseService.secondSupabaseAdmin;
    } catch (error) {
      console.warn(
        'Catalog branch client is unavailable, returning an empty branch list instead:',
        this.describeError(error),
      );
      return [];
    }

    const { data, error } = await client
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (!error) {
      return this.normalizeBranchRows(data ?? []);
    }

    if (!this.isMissingTableError(error, 'branches')) {
      console.warn(
        'Catalog branches lookup failed, attempting storebranches fallback:',
        this.describeError(error),
      );
    }

    try {
      return await this.loadStoreBranches();
    } catch (fallbackError) {
      console.warn(
        'Catalog branches fallback (storebranches) failed, returning an empty branch list instead:',
        this.describeError(fallbackError),
      );
      return [];
    }
  }

  private async loadStoreBranches() {
    const { data, error } = await this.supabaseService.secondSupabaseAdmin
      .from('storebranches')
      .select('*');

    if (error) {
      throw error;
    }

    return this.normalizeBranchRows(data ?? []);
  }

  private mergeBranches(metadataBranches: unknown[], catalogBranches: unknown[]) {
    const metadata = this.normalizeBranchRows(metadataBranches);
    const catalog = this.normalizeBranchRows(catalogBranches);

    if (metadata.length === 0) {
      return catalog;
    }

    if (catalog.length === 0) {
      return metadata;
    }

    const metadataById = new Map(metadata.map((branch) => [branch.id, branch]));
    const metadataByName = new Map(
      metadata.map((branch) => [this.normalizeBranchName(branch.name), branch]),
    );

    return catalog.map((catalogBranch) => {
      const metadataBranch =
        metadataById.get(catalogBranch.id) ??
        metadataByName.get(this.normalizeBranchName(catalogBranch.name));

      if (!metadataBranch) {
        return catalogBranch;
      }

      return {
        ...catalogBranch,
        ...metadataBranch,
        id: catalogBranch.id || metadataBranch.id,
      };
    });
  }

  private normalizeBranchRows(rows: unknown[]) {
    return rows.map((branch) => {
      const row = branch as Record<string, unknown>;

      return {
        id: this.toNumber(row.id ?? row.branch_id),
        name: String(
          row.branch_name ?? row.name ?? `Branch ${String(row.id ?? row.branch_id ?? '')}`,
        ),
        address: String(row.address ?? 'Address unavailable'),
        phone: String(row.phone ?? ''),
        latitude: this.toNumber(row.latitude, NaN),
        longitude: this.toNumber(row.longitude, NaN),
        opening_time: this.normalizeTime(row.opening_time, '08:00'),
        closing_time: this.normalizeTime(row.closing_time, '20:00'),
        is_active: row.is_active === false ? false : true,
      };
    });
  }

  private normalizeTime(value: unknown, fallback: string) {
    if (typeof value !== 'string' || value.trim() === '') {
      return fallback;
    }

    return value.slice(0, 5);
  }

  private normalizeBranchName(value: string) {
    return value.trim().toLowerCase();
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
