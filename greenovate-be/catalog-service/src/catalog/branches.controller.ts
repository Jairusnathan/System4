import { Controller, Get, InternalServerErrorException, Param } from '@nestjs/common';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async getBranches() {
    try { return await this.branchesService.getBranches(); } catch (error) { console.error('Branches API error:', error); throw new InternalServerErrorException(); }
  }

  @Get(':id/inventory')
  async getInventory(@Param('id') id: string) {
    try { return await this.branchesService.getInventory(id); } catch (error) { console.error('Branch inventory API error:', error); throw new InternalServerErrorException(); }
  }
}
