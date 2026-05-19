import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TribeClient as TribeClientType, EmailSendRequest } from '@implementsprint/sdk';

export type PaymentLineItem = {
  name: string;
  quantity: number;
  amount: { value: number; currency: string };
};

export type PaymentCheckoutPayload = {
  referenceId: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethods?: string[];
  lineItems: PaymentLineItem[];
  idempotencyKey?: string;
};

export type PaymentCheckoutResult = {
  checkoutId: string;
  checkoutUrl: string;
  status: string;
};

export type PaymentCheckoutStatus = {
  checkoutId: string;
  status: string;
  referenceId?: string;
  paidAt?: string;
};

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
        'APICenter is not configured. Set APICENTER_URL, APICENTER_TRIBE_ID, and APICENTER_TRIBE_SECRET to enable shared services.',
      );
      return;
    }

    const TribeClient = await this.loadTribeClient();

    if (!TribeClient) {
      this.logger.warn(
        'APICenter SDK package is not installed yet. Add GitHub Packages auth and run npm install @implementsprint/sdk in order-service.',
      );
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
      this.logger.log('APICenter order-service client authenticated — payment and email routing via API Center');
    } catch (err) {
      this.logger.warn(
        `APICenter authentication failed: ${err instanceof Error ? err.message : JSON.stringify(err)}. Email will fall back to SMTP.`,
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

  getClient(): TribeClientType {
    if (this.client) return this.client;
    throw new Error(
      'APICenter client is not ready. Set APICENTER_URL, APICENTER_TRIBE_ID, APICENTER_TRIBE_SECRET, and install @implementsprint/sdk.',
    );
  }

  async authenticate(): Promise<void> {
    await this.getClient().authenticate();
  }

  async paymentCreateCheckoutSession(payload: PaymentCheckoutPayload): Promise<PaymentCheckoutResult> {
    const result = await this.getClient().paymentCreateCheckoutSession(payload as any);
    return result as unknown as PaymentCheckoutResult; // local type narrows SDK's full PaymentCheckoutSession
  }

  async paymentGetCheckoutStatus(checkoutId: string): Promise<PaymentCheckoutStatus> {
    const result = await this.getClient().paymentGetCheckoutStatus(checkoutId);
    return result as unknown as PaymentCheckoutStatus;
  }

  async emailSend(payload: EmailSendRequest): Promise<void> {
    await this.getClient().emailSend(payload);
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
