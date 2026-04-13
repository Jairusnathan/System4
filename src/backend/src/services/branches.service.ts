import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class BranchesService {
  private readonly supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  async getBranches() {
    const { data, error } = await this.supabaseService.supabase
      .from('branches')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async getInventory(branchId: string) {
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
