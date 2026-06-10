import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TribeClient as TribeClientType } from '@implementsprint/sdk';

type TribeClientConstructor = new (config: {
  gatewayUrl: string;
  tribeId: string;
  secret: string;
}) => TribeClientType;

@Injectable()
export class ApiCenterService implements OnModuleInit {
  private readonly logger = new Logger(ApiCenterService.name);
  private client: TribeClientType | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'APICenter is not configured. Set OOS_DELIVERY_APICENTER_URL, OOS_DELIVERY_APICENTER_TRIBE_ID, and OOS_DELIVERY_APICENTER_TRIBE_SECRET to enable shared services.',
      );
      return;
    }

    const TribeClient = await this.loadTribeClient();

    if (!TribeClient) {
      this.logger.warn(
        'APICenter SDK package is not installed yet. Add GitHub Packages auth and run npm install in delivery-service.',
      );
      return;
    }

    const clientInstance = new TribeClient({
      gatewayUrl: this.getApiCenterUrl(),
      tribeId: this.getApiCenterTribeId(),
      secret: this.getApiCenterSecret(),
    });

    try {
      await clientInstance.authenticate();
      this.client = clientInstance;
      this.logger.log('APICenter client authenticated — geolocation routing via API Center active');
    } catch (err) {
      this.logger.warn(
        `APICenter authentication failed: ${err instanceof Error ? err.message : JSON.stringify(err)}. Geolocation services will use local fallbacks.`,
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.getApiCenterUrl()?.trim() &&
        this.getApiCenterTribeId()?.trim() &&
        this.getApiCenterSecret()?.trim(),
    );
  }

  private getApiCenterUrl(): string | undefined {
    return (
      this.configService.get<string>('APICENTER_URL') ??
      this.configService.get<string>('OOS_DELIVERY_APICENTER_URL')
    );
  }

  private getApiCenterTribeId(): string | undefined {
    return (
      this.configService.get<string>('APICENTER_TRIBE_ID') ??
      this.configService.get<string>('OOS_DELIVERY_APICENTER_TRIBE_ID')
    );
  }

  private getApiCenterSecret(): string | undefined {
    return (
      this.configService.get<string>('APICENTER_TRIBE_SECRET') ??
      this.configService.get<string>('OOS_DELIVERY_APICENTER_TRIBE_SECRET')
    );
  }

  isReady(): boolean {
    return this.client !== null;
  }

  getClient(): TribeClientType {
    if (this.client) return this.client;
    throw new Error(
      'APICenter client is not ready. Set OOS_DELIVERY_APICENTER_URL, OOS_DELIVERY_APICENTER_TRIBE_ID, OOS_DELIVERY_APICENTER_TRIBE_SECRET, and verify SDK is authenticated.',
    );
  }

  private async loadTribeClient(): Promise<TribeClientConstructor | null> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier);') as (
        specifier: string,
      ) => Promise<{ TribeClient?: TribeClientConstructor }>;
      const sdkModule = await dynamicImport('@implementsprint/sdk');
      return sdkModule.TribeClient ?? null;
    } catch (error) {
      this.logger.debug(`Failed to load @implementsprint/sdk: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
    }
  }
}
