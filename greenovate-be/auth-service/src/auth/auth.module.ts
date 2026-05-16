import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AppAuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  controllers: [AuthController],
  providers: [AppAuthService, MailerService, SupabaseService],
})
export class AuthModule {}
