import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PING_TIMEOUT_MS = 3_000;
const SCOPED_SUPABASE_URL_SUFFIX = '_SUPABASE_URL';
const SCOPED_SUPABASE_SECRET_SUFFIXES = [
  '_SUPABASE_SECRET_KEY',
  '_SUPABASE_SERVICE_ROLE_KEY',
] as const;

interface ScopedSupabaseConfig {
  prefix: string;
  url: string;
  secret: string;
}

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;
  private publicClient: SupabaseClient | null = null;
  private secondClient: SupabaseClient | null = null;
  private secondAdminClient: SupabaseClient | null = null;
  private readonly scopedClients = new Map<string, SupabaseClient>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.initializeDefaultClient();
    this.initializeLegacyClients();
    this.initializeScopedClients(process.env);
  }

  getClient(): SupabaseClient | null { return this.client; }

  get supabase(): SupabaseClient {
    return this.ensureClient(this.publicClient, 'SUPABASE_URL + SUPABASE_ANON_KEY');
  }

  get supabaseAdmin(): SupabaseClient {
    return this.ensureClient(this.client, 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }

  get secondSupabase(): SupabaseClient {
    return this.secondClient !== null ? this.secondClient : this.supabase;
  }

  get secondSupabaseAdmin(): SupabaseClient {
    return this.secondAdminClient !== null ? this.secondAdminClient : this.supabaseAdmin;
  }

  getClientForService(serviceName: string): SupabaseClient | null {
    const prefix = this.normalizeServiceName(serviceName);
    if (!prefix) return null;
    return this.scopedClients.get(prefix) ?? null;
  }

  listConfiguredServices(): string[] {
    return Array.from(this.scopedClients.keys()).sort((a, b) => a.localeCompare(b));
  }

  async ping(serviceName?: string): Promise<boolean> {
    const client = serviceName ? this.getClientForService(serviceName) : this.client;
    if (client === null) return false;
    const attempt = async (): Promise<boolean> => {
      try {
        const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
        return error === null;
      } catch { return false; }
    };
    let timerId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<boolean>((resolve) => { timerId = setTimeout(() => resolve(false), PING_TIMEOUT_MS); });
    return Promise.race([attempt(), timeout]).finally(() => clearTimeout(timerId));
  }

  private initializeDefaultClient(): void {
    const url = this.configService.get<string>('OOS_CATALOG_SUPABASE_URL')?.trim();
    const key = this.configService.get<string>('OOS_CATALOG_SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const anonKey = this.configService.get<string>('OOS_CATALOG_SUPABASE_ANON_KEY')?.trim();
    if (url && anonKey) this.publicClient = this.buildClient(url, anonKey, false);
    if (!url || !key) { this.logger.warn('OOS_CATALOG_SUPABASE_URL or OOS_CATALOG_SUPABASE_SERVICE_ROLE_KEY is not set.'); return; }
    this.client = this.buildClient(url, key);
  }

  private initializeLegacyClients(): void {
    const secondUrl = this.configService.get<string>('OOS_CATALOG_SECOND_SUPABASE_URL')?.trim();
    const secondAnonKey = this.configService.get<string>('OOS_CATALOG_SECOND_SUPABASE_ANON_KEY')?.trim();
    const secondServiceRoleKey = this.configService.get<string>('OOS_CATALOG_SECOND_SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? secondAnonKey;
    if (secondUrl && secondAnonKey) this.secondClient = this.buildClient(secondUrl, secondAnonKey, false);
    if (secondUrl && secondServiceRoleKey) this.secondAdminClient = this.buildClient(secondUrl, secondServiceRoleKey);
  }

  private initializeScopedClients(env: Record<string, string | undefined>): void {
    const configs = this.resolveScopedConfigs(env);
    for (const config of configs) this.scopedClients.set(config.prefix, this.buildClient(config.url, config.secret));
    if (configs.length > 0) this.logger.log(`Configured ${configs.length} service-scoped Supabase client(s): ${configs.map((c) => c.prefix).join(', ')}`);
  }

  private resolveScopedConfigs(env: Record<string, string | undefined>): ScopedSupabaseConfig[] {
    const urlByPrefix = new Map<string, string>();
    const secretByPrefix = new Map<string, string>();
    for (const [key, raw] of Object.entries(env)) {
      const value = raw?.trim();
      if (!value) continue;
      const urlPrefix = this.extractPrefix(key, SCOPED_SUPABASE_URL_SUFFIX);
      if (urlPrefix) urlByPrefix.set(urlPrefix, value);
      const secretPrefix = this.getScopedSecretPrefix(key);
      if (secretPrefix) secretByPrefix.set(secretPrefix, value);
    }
    const prefixes = new Set<string>([...urlByPrefix.keys(), ...secretByPrefix.keys()]);
    const configs: ScopedSupabaseConfig[] = [];
    for (const prefix of prefixes) {
      const url = urlByPrefix.get(prefix);
      const secret = secretByPrefix.get(prefix);
      if (url && secret) configs.push({ prefix, url, secret });
    }
    return configs;
  }

  private extractPrefix(key: string, suffix: string): string | null {
    if (!key.endsWith(suffix)) return null;
    const prefix = key.slice(0, -suffix.length);
    return prefix || null;
  }

  private getScopedSecretPrefix(key: string): string | null {
    for (const suffix of SCOPED_SUPABASE_SECRET_SUFFIXES) {
      const prefix = this.extractPrefix(key, suffix);
      if (prefix) return prefix;
    }
    return null;
  }

  private buildClient(url: string, key: string, serviceRole = true): SupabaseClient {
    return createClient(url, key, { auth: { autoRefreshToken: !serviceRole, persistSession: !serviceRole } });
  }

  private ensureClient(client: SupabaseClient | null, configName: string): SupabaseClient {
    if (client !== null) return client;
    throw new Error(`Supabase client '${configName}' is not configured for this environment.`);
  }

  private normalizeServiceName(serviceName: string): string {
    let result = serviceName.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_');
    while (result.startsWith('_')) result = result.slice(1);
    while (result.endsWith('_')) result = result.slice(0, -1);
    return result;
  }

  getDefaultOrServiceClient(serviceName?: string): SupabaseClient | null {
    if (!serviceName) return this.client;
    return this.getClientForService(serviceName);
  }
}
