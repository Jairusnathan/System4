import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getServiceInfo', () => {
    it('returns the correct service name', () => {
      const info = service.getServiceInfo();
      expect(info.service).toBe('system4-backend');
    });

    it('returns the correct version', () => {
      const info = service.getServiceInfo();
      expect(info.version).toBe('1.0.0');
    });

    it('returns an object with both service and version keys', () => {
      const info = service.getServiceInfo();
      expect(info).toEqual({ service: 'system4-backend', version: '1.0.0' });
    });
  });
});
