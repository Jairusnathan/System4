import {
  BadRequestException, Body, Controller, Get, Headers,
  InternalServerErrorException, NotFoundException, Post,
  Req, Res, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { MAX_SAVED_ADDRESSES, normalizeSavedAddresses, parseSerializedAddresses, stringifyAddresses } from '../utils/customer-addresses.util';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '../utils/phone.util';
import { AppAuthService, REFRESH_TOKEN_COOKIE_NAME } from './auth.service';
import { MailerService } from './mailer.service';
import { SupabaseService } from './supabase.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AppAuthService,
    private readonly mailerService: MailerService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private tryGetAdmin() {
    try { return this.supabaseService.supabaseAdmin; } catch { return null; }
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    try {
      const email = body?.email?.toLowerCase()?.trim();
      const password = body?.password;
      const rememberMe = body?.rememberMe === true;
      const { data: user, error } = await this.supabaseService.supabase.from('customers').select('*').eq('email', email).single();
      if (error || !user) throw new UnauthorizedException('Invalid credentials');
      const lockedUntil = user.account_locked_until ? new Date(user.account_locked_until) : null;
      if (lockedUntil && lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
        throw new UnauthorizedException(`Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`);
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        const attempts = Number(user.failed_login_attempts ?? 0) + 1;
        const shouldLock = attempts >= 5;
        const updateData: Record<string, unknown> = { failed_login_attempts: attempts };
        if (shouldLock) updateData.account_locked_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        void (async () => {
          try {
            const { error: updateErr } = await this.supabaseService.supabase.from('customers').update(updateData).eq('id', user.id);
            if (!updateErr && shouldLock && this.mailerService.isConfigured()) await this.mailerService.sendAccountLockedEmail(email, user.full_name || 'User');
          } catch { /* ignore */ }
        })();
        throw new UnauthorizedException('Invalid credentials');
      }
      void (async () => { try { await this.supabaseService.supabase.from('customers').update({ failed_login_attempts: 0, account_locked_until: null }).eq('id', user.id); } catch { /* ignore */ } })();
      const payload = { userId: user.id, email: user.email };
      const token = this.authService.signAccessToken(payload);
      const refreshToken = this.authService.signRefreshToken(payload);
      const admin = this.tryGetAdmin();
      if (admin) {
        try {
          const tokenHash = Buffer.from(refreshToken).toString('base64url').slice(0, 64);
          await admin.from('refresh_token_families').insert({ user_id: user.id, token_hash: tokenHash, family_id: crypto.randomUUID(), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
        } catch { /* non-fatal */ }
      }
      const userWithoutPassword = { ...user };
      delete userWithoutPassword.password;
      this.authService.setRefreshTokenCookie(response, refreshToken, rememberMe);
      return { token, rememberMe, user: userWithoutPassword };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Login error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    try {
      const fullName = body?.full_name;
      const email = body?.email?.toLowerCase()?.trim();
      const phone = body?.phone;
      const birthday = body?.birthday;
      const gender = body?.gender;
      const password = body?.password;
      const verificationCode = body?.verificationCode;
      const registrationToken = body?.registrationToken;
      const normalizedPhone = normalizePhilippinePhone(phone ?? '');
      if (!fullName || !email || !phone || !birthday || !gender || !password) throw new BadRequestException('All fields are required');
      if (!normalizedPhone) throw new BadRequestException(PH_PHONE_MESSAGE);
      if (!verificationCode && !this.mailerService.isConfigured()) throw new InternalServerErrorException('Email sending is not configured yet. Add SMTP settings in .env first.');
      const { data: existingUser, error: checkError } = await this.supabaseService.supabase.from('customers').select('id').eq('email', email).single();
      if (existingUser) throw new BadRequestException('Email already registered');
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      if (!verificationCode || !registrationToken) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);
        const nextRegistrationToken = jwt.sign({ full_name: fullName, email, phone: normalizedPhone, birthday, gender, password: hashedPassword, code, purpose: 'register' }, jwtSecret, { expiresIn: '10m' });
        await this.mailerService.sendRegistrationCodeEmail(email, code);
        return { message: 'Verification code sent successfully', requiresVerification: true, registrationToken: nextRegistrationToken };
      }
      let decoded: any;
      try { decoded = jwt.verify(registrationToken, jwtSecret); } catch { throw new UnauthorizedException('Verification code expired. Please request a new one.'); }
      if (decoded.purpose !== 'register' || decoded.email !== email || decoded.code !== verificationCode || decoded.full_name !== fullName || decoded.phone !== normalizedPhone || decoded.birthday !== birthday || decoded.gender !== gender) throw new UnauthorizedException('Invalid verification code');
      const { data: newUser, error: insertError } = await this.supabaseService.supabase.from('customers').insert([{ full_name: fullName, email, phone: normalizedPhone, birthday: decoded.birthday, gender: decoded.gender, password: decoded.password }]).select().single();
      if (insertError) throw insertError;
      if (this.mailerService.isConfigured()) { try { await this.mailerService.sendWelcomeEmail(email, fullName); } catch (mailError) { console.error('Welcome email error:', mailError); } }
      const payload = { userId: newUser.id, email };
      const token = this.authService.signAccessToken(payload);
      const refreshToken = this.authService.signRefreshToken(payload);
      const userWithoutPassword = { ...newUser };
      delete userWithoutPassword.password;
      this.authService.setRefreshTokenCookie(response, refreshToken);
      return { token, user: userWithoutPassword };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof InternalServerErrorException) throw error;
      console.error('Registration error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const { data: user, error: fetchError } = await this.supabaseService.supabase.from('customers').select('id, full_name, email, phone, birthday, gender, address, profile_image').eq('id', userId).single();
      if (fetchError || !user) throw new NotFoundException('User not found');
      const { data: addressRows, error: addressesError } = await this.supabaseService.supabase.from('customer_addresses').select('full_name, phone_number, province, city, postal_code, street_address, label, is_default, sort_order, created_at').eq('customer_id', userId).order('is_default', { ascending: false }).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      if (addressesError) { console.error('Fetch customer addresses error:', addressesError); return user; }
      if (addressRows && addressRows.length > 0) {
        return { ...user, address: stringifyAddresses(addressRows.map((entry) => ({ fullName: entry.full_name || '', phoneNumber: entry.phone_number || '', province: entry.province || '', city: entry.city || '', postalCode: entry.postal_code || '', streetAddress: entry.street_address || '', label: entry.label === 'Work' ? 'Work' : 'Home' }))) };
      }
      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
      console.error('Me error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const decoded = this.authService.verifyRefreshToken(refreshToken);
    if (!decoded?.userId || !decoded?.email) { this.authService.clearRefreshTokenCookie(response); throw new UnauthorizedException('Invalid or expired refresh token'); }
    const payload = { userId: decoded.userId as string, email: decoded.email as string };
    const nextAccessToken = this.authService.signAccessToken(payload);
    const nextRefreshToken = this.authService.signRefreshToken(payload);
    this.authService.setRefreshTokenCookie(response, nextRefreshToken);
    return { token: nextAccessToken };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.authService.clearRefreshTokenCookie(response);
    return { success: true };
  }

  @Post('update-profile')
  async updateProfile(@Headers('authorization') authorization?: string, @Body() body?: any) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const { full_name, phone, birthday, gender, address, profile_image } = body;
      const normalizedPhone = phone ? normalizePhilippinePhone(phone) : null;
      if (phone && !normalizedPhone) throw new BadRequestException(PH_PHONE_MESSAGE);
      let serializedAddressValue = typeof address === 'string' ? address : undefined;
      let normalizedAddresses: ReturnType<typeof normalizeSavedAddresses> | null = null;
      if (typeof address === 'string') {
        const parsedAddresses = parseSerializedAddresses(address, { full_name, phone: normalizedPhone || phone || '' }).filter((entry) => entry.streetAddress || entry.province || entry.city || entry.phoneNumber || entry.fullName);
        if (parsedAddresses.length > MAX_SAVED_ADDRESSES) throw new BadRequestException(`You can only save up to ${MAX_SAVED_ADDRESSES} addresses.`);
        normalizedAddresses = normalizeSavedAddresses(parsedAddresses, { full_name, phone: normalizedPhone || phone || '' });
        if (normalizedAddresses.some((entry) => !entry.phoneNumber)) throw new BadRequestException(PH_PHONE_MESSAGE);
        serializedAddressValue = stringifyAddresses(normalizedAddresses);
      }
      const updatePayload: Record<string, string | null | undefined> = { full_name, phone: normalizedPhone || null, birthday: birthday || null, gender: gender || null };
      if (Object.prototype.hasOwnProperty.call(body, 'profile_image')) updatePayload.profile_image = typeof profile_image === 'string' && profile_image.trim() ? profile_image : null;
      if (typeof serializedAddressValue !== 'undefined') updatePayload.address = serializedAddressValue || null;
      const { data: updatedUser, error: updateError } = await this.supabaseService.supabase.from('customers').update(updatePayload).eq('id', userId).select('id, full_name, email, phone, birthday, gender, address, profile_image').single();
      if (updateError) throw updateError;
      return { ...updatedUser, address: serializedAddressValue ?? updatedUser.address };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) throw error;
      console.error('Update profile error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: any) {
    try {
      const email = body?.email?.toLowerCase()?.trim();
      if (!email) throw new BadRequestException('Email is required');
      if (!this.mailerService.isConfigured()) throw new InternalServerErrorException('Email sending is not configured yet.');
      const { data: user, error } = await this.supabaseService.supabase.from('customers').select('id, email').eq('email', email).single();
      if (error || !user) throw new NotFoundException('No account found with that email address');
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const resetToken = jwt.sign({ email, code, purpose: 'password-reset' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '10m' });
      await this.mailerService.sendPasswordResetCodeEmail(email, code);
      return { message: 'Verification code sent successfully', resetToken };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      console.error('Request password reset error:', error);
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }

  @Post('update-password')
  async updatePassword(@Body() body: any) {
    try {
      const { newPassword, token, email: rawEmail, oldPassword, resetToken, verificationCode } = body;
      if (!newPassword) throw new BadRequestException('Missing new password');
      let userId: string;
      if (token) {
        const decoded = this.authService.verifyAccessToken(token);
        if (!decoded?.userId) throw new UnauthorizedException('Invalid or expired token');
        userId = decoded.userId as string;
      } else if (resetToken && verificationCode && rawEmail) {
        const email = rawEmail.toLowerCase().trim();
        let decoded: any;
        try { decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key'); } catch { throw new UnauthorizedException('Verification code expired.'); }
        if (decoded.purpose !== 'password-reset' || decoded.email !== email || decoded.code !== verificationCode) throw new UnauthorizedException('Invalid verification code');
        const { data: user, error } = await this.supabaseService.supabase.from('customers').select('id').eq('email', email).single();
        if (error || !user) throw new NotFoundException('User not found');
        userId = user.id;
      } else if (rawEmail && oldPassword) {
        const email = rawEmail.toLowerCase().trim();
        const { data: user, error } = await this.supabaseService.supabase.from('customers').select('*').eq('email', email).single();
        if (error || !user) throw new NotFoundException('User not found');
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) throw new UnauthorizedException('Incorrect old password');
        userId = user.id;
      } else { throw new BadRequestException('Missing required credentials'); }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await this.supabaseService.supabase.from('customers').update({ password: hashedPassword }).eq('id', userId);
      if (updateError) throw updateError;
      return { message: 'Password updated successfully' };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
      console.error('Update password error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('browsing-history')
  async getBrowsingHistory(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const admin = this.tryGetAdmin();
      if (!admin) return { data: [] };

      const { data, error } = await admin
        .from('browsing_history')
        .select('product_id, category, viewed_at')
        .eq('customer_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(60);

      if (error) return { data: [] };
      return { data: data ?? [] };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { data: [] };
    }
  }

  @Post('browsing-history')
  async saveBrowsingHistory(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const admin = this.tryGetAdmin();
      if (!admin) return { success: false };

      const items: { productId: string; category: string; viewedAt: number }[] =
        Array.isArray(body?.items) ? body.items : [];
      if (items.length === 0) return { success: true };

      const rows = items
        .filter((item) => item.productId && item.category)
        .slice(0, 60)
        .map((item) => ({
          customer_id: userId,
          product_id: String(item.productId),
          category: String(item.category),
          viewed_at: new Date(item.viewedAt).toISOString(),
        }));

      await admin
        .from('browsing_history')
        .upsert(rows, { onConflict: 'customer_id,product_id' });

      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { success: false };
    }
  }

  @Post('product-view')
  async recordProductView(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const admin = this.tryGetAdmin();
      if (!admin) return { success: false };

      const productId = String(body?.productId ?? '').trim();
      const category = String(body?.category ?? '').trim();
      if (!productId || !category) return { success: false };

      await admin.rpc('increment_product_view', {
        p_customer_id: userId,
        p_product_id: productId,
        p_category: category,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { success: false };
    }
  }

  @Get('product-interests')
  async getProductInterests(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const admin = this.tryGetAdmin();
      if (!admin) return { data: [] };

      const { data, error } = await admin
        .from('browsing_history')
        .select('product_id, view_count')
        .eq('customer_id', userId)
        .order('view_count', { ascending: false })
        .limit(60);

      if (error) return { data: [] };
      return { data: data ?? [] };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { data: [] };
    }
  }

  @Get('category-interests')
  async getCategoryInterests(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const admin = this.tryGetAdmin();
      if (!admin) return { data: [] };

      const { data, error } = await admin
        .from('browsing_history')
        .select('category, view_count')
        .eq('customer_id', userId);

      if (error || !data) return { data: [] };

      // Aggregate view counts per category
      const scores = new Map<string, number>();
      for (const row of data as { category: string; view_count: number }[]) {
        const cat = row.category?.trim();
        if (!cat) continue;
        scores.set(cat, (scores.get(cat) ?? 0) + (Number(row.view_count) || 1));
      }

      const result = [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, score]) => ({ category, score }));

      return { data: result };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return { data: [] };
    }
  }
}
