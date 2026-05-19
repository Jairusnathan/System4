import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TribeClient as TribeClientType, EmailSendRequest } from '@implementsprint/sdk';

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
        'APICenter is not configured. Set APICENTER_URL, APICENTER_TRIBE_ID, and APICENTER_TRIBE_SECRET to enable shared email delivery.',
      );
      return;
    }

    const TribeClient = await this.loadTribeClient();
    if (!TribeClient) {
      this.logger.warn('APICenter SDK (@implementsprint/sdk) could not be loaded. Email will fall back to SMTP.');
      return;
    }

    const clientInstance = new TribeClient({
      gatewayUrl: this.configService.getOrThrow<string>('APICENTER_URL'),
      tribeId: this.configService.getOrThrow<string>('APICENTER_TRIBE_ID'),
      secret: this.configService.getOrThrow<string>('APICENTER_TRIBE_SECRET'),
    });

    try {
      await clientInstance.authenticate();
      this.client = clientInstance;
      this.logger.log('APICenter auth-service client authenticated — email routing via API Center');
    } catch (err) {
      this.logger.warn(
        `APICenter authentication failed: ${err instanceof Error ? err.message : String(err)}. Email will fall back to SMTP.`,
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('APICENTER_URL')?.trim() &&
        this.configService.get<string>('APICENTER_TRIBE_ID')?.trim() &&
        this.configService.get<string>('APICENTER_TRIBE_SECRET')?.trim(),
    );
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async emailSend(payload: EmailSendRequest): Promise<void> {
    if (!this.client) throw new Error('APICenter client is not ready');
    await this.client.emailSend(payload);
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
