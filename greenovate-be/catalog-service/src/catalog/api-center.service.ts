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
        'APICenter is not configured. Set APICENTER_URL, APICENTER_TRIBE_ID, and APICENTER_TRIBE_SECRET to enable Kafka publishing.',
      );
      return;
    }

    const TribeClient = await this.loadTribeClient();
    if (!TribeClient) {
      this.logger.warn('APICenter SDK (@implementsprint/sdk) could not be loaded.');
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
      this.logger.log('APICenter catalog-service client authenticated — Kafka publishing enabled');
    } catch (err) {
      this.logger.warn(
        `APICenter authentication failed: ${err instanceof Error ? err.message : JSON.stringify(err)}.`,
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
      this.configService.get<string>('OOS_CATALOG_APICENTER_URL')
    );
  }

  private getApiCenterTribeId(): string | undefined {
    return (
      this.configService.get<string>('APICENTER_TRIBE_ID') ??
      this.configService.get<string>('OOS_CATALOG_APICENTER_TRIBE_ID')
    );
  }

  private getApiCenterSecret(): string | undefined {
    return (
      this.configService.get<string>('APICENTER_TRIBE_SECRET') ??
      this.configService.get<string>('OOS_CATALOG_APICENTER_TRIBE_SECRET')
    );
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async kafkaPublish(
    topic: string,
    eventType: string,
    payload: Record<string, unknown>,
    key?: string,
  ): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.kafkaPublish({ topic, eventType, payload, ...(key ? { key } : {}) });
    } catch (error) {
      this.logger.warn(`Kafka publish failed [${topic}/${eventType}]: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }

  buildTopic(suffix: string): string {
    const tribeId = this.getApiCenterTribeId() ?? 'unknown';
    const normalizedId = tribeId.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    const topicMap: Record<string, string> = {
      orders  : 'events',
      users   : 'events',
      products: 'events',
      returns : 'events',
      admin   : 'audit',
    };
    const s = suffix.trim().toLowerCase();
    return `tribe.${normalizedId}.${topicMap[s] ?? s}`;
  }

  private async loadTribeClient(): Promise<TribeClientConstructor | null> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier);') as (
        specifier: string,
      ) => Promise<{ TribeClient?: TribeClientConstructor }>;
      const sdkModule = await dynamicImport('@implementsprint/sdk');
      return sdkModule.TribeClient ?? null;
    } catch (error) {
      this.logger.debug(
        `Failed to load @implementsprint/sdk: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}
