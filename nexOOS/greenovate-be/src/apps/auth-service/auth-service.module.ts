import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from '../../controllers/auth.controller';
import { AppAuthService } from '../../services/auth.service';
import { MailerService } from '../../services/mailer.service';
import { SupabaseService } from '../../services/supabase.service';
import { AuthHealthController } from './auth-health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AuthController, AuthHealthController],
  providers: [AppAuthService, MailerService, SupabaseService],
})
export class AuthServiceModule {}
