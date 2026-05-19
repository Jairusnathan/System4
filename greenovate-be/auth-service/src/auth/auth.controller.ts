import {
  BadRequestException, Body, Controller, Delete, Get, Headers,
  InternalServerErrorException, NotFoundException, Param, Patch, Post,
  Put, Query, Req, Res, UnauthorizedException,
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
      const identifier = (body?.email ?? body?.username ?? '').toLowerCase().trim();
      const password = body?.password;
      const rememberMe = body?.rememberMe === true;
      const db = this.supabaseService.supabase;
      const adminDb = this.tryGetAdmin();

      // ── Check staff table first (by username, then by email) ─────────────
      if (adminDb) {
        let adminUser: Record<string, any> | null = null;
        const { data: byUsername } = await adminDb.from('staff').select('*').eq('username', identifier).maybeSingle();
        if (byUsername) {
          adminUser = byUsername;
        } else {
          const { data: byEmail } = await adminDb.from('staff').select('*').eq('email', identifier).maybeSingle();
          if (byEmail) adminUser = byEmail;
        }

        if (adminUser) {
          const lockedUntil = adminUser.account_locked_until ? new Date(adminUser.account_locked_until) : null;
          if (lockedUntil && lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
            throw new UnauthorizedException(`Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`);
          }
          const valid = await bcrypt.compare(password, adminUser.password);
          if (!valid) {
            const attempts = Number(adminUser.failed_login_attempts ?? 0) + 1;
            const shouldLock = attempts >= 5;
            const upd: Record<string, unknown> = { failed_login_attempts: attempts };
            if (shouldLock) upd.account_locked_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            void (async () => { try { await adminDb.from('staff').update(upd).eq('id', adminUser!.id); } catch {} })();
            throw new UnauthorizedException('Invalid credentials');
          }
          void (async () => { try { await adminDb.from('staff').update({ failed_login_attempts: 0, account_locked_until: null }).eq('id', adminUser!.id); } catch {} })();
          // Block login for inactive staff
          if (adminUser.is_active === false) {
            throw new UnauthorizedException('Your account has been deactivated. Contact your super admin.');
          }
          const staffRole = (adminUser.role ?? 'staff') as string;
          const isOnboarded = adminUser.is_onboarded !== false;
          const fullName = (adminUser.full_name ?? `${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim()) || '';
          const payload = { userId: adminUser.id, email: adminUser.email ?? adminUser.username, isAdmin: true, staffRole, isOnboarded, fullName };
          const token = this.authService.signAccessToken(payload);
          const refreshToken = this.authService.signRefreshToken(payload);
          this.authService.setRefreshTokenCookie(response, refreshToken, rememberMe);
          this.logAction({
            staffId: adminUser.id,
            staffName: adminUser.full_name ?? (`${adminUser.first_name ?? ''} ${adminUser.last_name ?? ''}`.trim() || 'Admin'),
            staffRole,
            action: 'Logged in to admin console',
            category: 'auth',
            details: `Username: @${adminUser.username ?? 'unknown'}; Role: ${staffRole}; Remember me: ${rememberMe ? 'yes' : 'no'}`,
          });
          const { password: _p, ...safeAdmin } = adminUser;
          return { token, rememberMe, isAdmin: true, staffRole, isOnboarded, user: safeAdmin };
        }
      }

      // ── Check customers table ─────────────────────────────────────────────
      const { data: user, error } = await db.from('customers').select('*').eq('email', identifier).single();
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
            const { error: updateErr } = await db.from('customers').update(updateData).eq('id', user.id);
            if (!updateErr && shouldLock && this.mailerService.isConfigured()) await this.mailerService.sendAccountLockedEmail(identifier, user.full_name || 'User');
          } catch { /* ignore */ }
        })();
        throw new UnauthorizedException('Invalid credentials');
      }
      void (async () => { try { await db.from('customers').update({ failed_login_attempts: 0, account_locked_until: null }).eq('id', user.id); } catch {} })();
      const payload = { userId: user.id, email: user.email };
      const token = this.authService.signAccessToken(payload);
      const refreshToken = this.authService.signRefreshToken(payload);
      if (adminDb) {
        try {
          const tokenHash = Buffer.from(refreshToken).toString('base64url').slice(0, 64);
          await adminDb.from('refresh_token_families').insert({ user_id: user.id, token_hash: tokenHash, family_id: crypto.randomUUID(), expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() });
        } catch { /* non-fatal */ }
      }
      const { password: _pw, ...userWithoutPassword } = user;
      this.authService.setRefreshTokenCookie(response, refreshToken, rememberMe);
      return { token, rememberMe, isAdmin: false, user: userWithoutPassword };
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
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Headers('authorization') authorization?: string) {
    this.authService.clearRefreshTokenCookie(response);
    // Best-effort: log logout if token is present
    try {
      const decoded = this.authService.verifyAccessToken(
        this.authService.extractBearerToken(authorization) ?? '',
      );
      if (decoded?.userId && (decoded as any).isAdmin) {
        const admin = this.tryGetAdmin();
        if (admin) {
          const { data: staff } = await admin.from('staff').select('full_name, role').eq('id', decoded.userId).single();
          this.logAction({
            staffId: decoded.userId as string,
            staffName: (staff?.full_name as string | null) ?? 'Admin',
            staffRole: (staff?.role as string | null) ?? (decoded as any).staffRole,
            action: 'Logged out of admin console',
            category: 'auth',
            details: `Role: ${(staff?.role as string | null) ?? (decoded as any).staffRole ?? 'admin'}`,
          });
        }
      }
    } catch { /* non-fatal */ }
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

      let isStaff = false;
      const { data: customer } = await this.supabaseService.supabase.from('customers').select('id').eq('email', email).maybeSingle();
      if (!customer) {
        const adminDb = this.tryGetAdmin();
        if (adminDb) {
          const { data: staff } = await adminDb.from('staff').select('id').eq('email', email).maybeSingle();
          if (!staff) throw new NotFoundException('No account found with that email address');
          isStaff = true;
        } else {
          throw new NotFoundException('No account found with that email address');
        }
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const resetToken = jwt.sign({ email, code, purpose: 'password-reset', isStaff }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '10m' });
      await this.mailerService.sendPasswordResetCodeEmail(email, code);
      return { message: 'Verification code sent successfully', resetToken };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof InternalServerErrorException) throw error;
      console.error('Request password reset error:', error);
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }

  @Post('verify-password-reset-code')
  async verifyPasswordResetCode(@Body() body: any) {
    try {
      const { email: rawEmail, verificationCode, resetToken } = body;
      if (!rawEmail || !verificationCode || !resetToken) throw new BadRequestException('Missing required fields');
      const email = rawEmail.toLowerCase().trim();
      let decoded: any;
      try { decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key'); } catch { throw new UnauthorizedException('Verification code expired.'); }
      if (decoded.purpose !== 'password-reset' || decoded.email !== email || decoded.code !== verificationCode) throw new UnauthorizedException('Invalid verification code');
      if (decoded.isStaff) {
        const adminDb = this.tryGetAdmin();
        if (!adminDb) throw new NotFoundException('No account found with that email address');
        const { data: staff } = await adminDb.from('staff').select('id').eq('email', email).maybeSingle();
        if (!staff) throw new NotFoundException('No account found with that email address');
      } else {
        const { data: user, error } = await this.supabaseService.supabase.from('customers').select('id').eq('email', email).single();
        if (error || !user) throw new NotFoundException('No account found with that email address');
      }
      return { message: 'Code verified successfully' };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
      console.error('Verify password reset code error:', error);
      throw new InternalServerErrorException();
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
        if (decoded.isStaff) {
          const adminDb = this.tryGetAdmin();
          if (!adminDb) throw new NotFoundException('User not found');
          const { data: staff } = await adminDb.from('staff').select('id').eq('email', email).maybeSingle();
          if (!staff) throw new NotFoundException('User not found');
          const hashedPw = await bcrypt.hash(newPassword, 10);
          const { error: updateErr } = await adminDb.from('staff').update({ password: hashedPw }).eq('id', staff.id);
          if (updateErr) throw updateErr;
          return { message: 'Password updated successfully' };
        }
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

  // ─── Admin: Own profile ──────────────────────────────────────────────────────

  @Get('admin/profile')
  async adminGetProfile(@Headers('authorization') authorization?: string) {
    const me = this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) throw new NotFoundException('Profile not found');
    const { data, error } = await admin
      .from('staff')
      .select('id, staff_number, first_name, last_name, full_name, username, email, role, created_at')
      .eq('id', me.userId)
      .single();
    if (error || !data) throw new NotFoundException('Profile not found');
    return data;
  }

  @Put('admin/profile')
  async adminUpdateProfile(
    @Headers('authorization') authorization?: string,
    @Body() body?: { first_name?: string; last_name?: string; full_name?: string },
  ) {
    const me = this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    const { data: currentProfile } = await admin
      .from('staff')
      .select('first_name, last_name, full_name')
      .eq('id', me.userId)
      .single();
    const updates: Record<string, string> = {};
    if (body?.first_name?.trim()) updates.first_name = body.first_name.trim();
    if (body?.last_name?.trim()) updates.last_name = body.last_name.trim();
    if (updates.first_name || updates.last_name) {
      const fn = updates.first_name ?? currentProfile?.first_name ?? '';
      const ln = updates.last_name ?? currentProfile?.last_name ?? '';
      updates.full_name = `${fn} ${ln}`.trim();
    } else if (body?.full_name?.trim()) {
      updates.full_name = body.full_name.trim();
    }
    if (Object.keys(updates).length === 0) throw new BadRequestException('No fields to update');
    const { data, error } = await admin
      .from('staff')
      .update(updates)
      .eq('id', me.userId)
      .select('id, staff_number, first_name, last_name, full_name, username, email, created_at')
      .single();
    if (error) throw new InternalServerErrorException();
    const details: string[] = [];
    if (Object.prototype.hasOwnProperty.call(updates, 'first_name')) {
      details.push(this.formatAuditChange('First name', currentProfile?.first_name, data?.first_name));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'last_name')) {
      details.push(this.formatAuditChange('Last name', currentProfile?.last_name, data?.last_name));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'full_name')) {
      details.push(this.formatAuditChange('Full name', currentProfile?.full_name, data?.full_name));
    }
    this.logAction({
      staffId: me.userId as string,
      staffName: (data?.full_name as string | null) ?? 'Admin',
      staffRole: (me as any).staffRole,
      action: `Updated own profile (${details.length})`,
      category: 'profile',
      details: details.join('; '),
    });
    return data;
  }

  @Post('admin/change-password')
  async adminChangePassword(
    @Headers('authorization') authorization?: string,
    @Body() body?: { currentPassword?: string; newPassword?: string },
  ) {
    const me = this.requireAdmin(authorization);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;
    if (!currentPassword || !newPassword) throw new BadRequestException('currentPassword and newPassword are required');
    if (newPassword.length < 6) throw new BadRequestException('New password must be at least 6 characters');
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    const { data: adminUser } = await admin.from('staff').select('password').eq('id', me.userId).single();
    if (!adminUser) throw new NotFoundException('Admin not found');
    const isValid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 10);
    await admin.from('staff').update({ password: hashed }).eq('id', me.userId);
    const { data: changer } = await admin.from('staff').select('full_name').eq('id', me.userId).single();
    this.logAction({
      staffId: me.userId as string,
      staffName: (changer?.full_name as string | null) ?? 'Admin',
      staffRole: (me as any).staffRole,
      action: 'Changed account password',
      category: 'profile',
      details: 'Updated own password from the admin profile settings',
    });
    return { success: true };
  }

  @Get('public/settings')
  async getPublicSettings() {
    const admin = this.tryGetAdmin();
    if (!admin) return { data: {} };
    const { data } = await admin.from('oos_settings').select('key, value');
    const obj: Record<string, string> = {};
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      obj[row.key] = row.value;
    }
    return { data: obj };
  }

  private formatAuditValue(value: unknown) {
    if (value === null || typeof value === 'undefined') return 'empty';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : 'empty';
    const normalized = String(value).trim();
    return normalized ? normalized : 'empty';
  }

  private formatAuditChange(label: string, previousValue: unknown, nextValue: unknown) {
    return `${label}: ${this.formatAuditValue(previousValue)} -> ${this.formatAuditValue(nextValue)}`;
  }

  // ─── Audit Logging ──────────────────────────────────────────────────────────

  private logAction(opts: {
    staffId?: string | null;
    staffName?: string;
    staffRole?: string;
    action: string;
    category: string;
    details?: string;
    entityId?: string;
  }) {
    void (async () => {
      try {
        const admin = this.tryGetAdmin();
        if (!admin) return;
        await admin.from('audit_logs').insert([{
          staff_id: opts.staffId ?? null,
          staff_name: opts.staffName ?? 'System',
          staff_role: opts.staffRole ?? null,
          action: opts.action,
          category: opts.category,
          details: opts.details ?? null,
          entity_id: opts.entityId ?? null,
        }]);
      } catch { /* non-fatal */ }
    })();
  }

  @Post('admin/audit-log')
  async adminCreateAuditLog(
    @Headers('authorization') authorization?: string,
    @Body() body?: { action?: string; category?: string; details?: string; entityId?: string },
  ) {
    const me = this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { success: false };
    const { data: staff } = await admin.from('staff').select('full_name, role').eq('id', me.userId).single();
    const staffName = (staff?.full_name as string | null) ?? 'Admin';
    this.logAction({
      staffId: me.userId as string,
      staffName,
      staffRole: (me as any).staffRole ?? (staff?.role as string | null),
      action: body?.action ?? 'Unknown action',
      category: body?.category ?? 'general',
      details: body?.details,
      entityId: body?.entityId,
    });
    return { success: true };
  }

  @Get('admin/audit-logs')
  async adminGetAuditLogs(
    @Headers('authorization') authorization?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: [], total: 0 };
    const pageLimit = Math.min(Number(limit ?? 20), 100);
    const pageOffset = Number(offset ?? 0);
    let query = admin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);
    if (category && category !== 'all') query = query.eq('category', category);
    if (from) query = (query as any).gte('created_at', from);
    if (to) query = (query as any).lte('created_at', to);
    if (search?.trim()) {
      const s = search.trim();
      query = query.or(`action.ilike.%${s}%,staff_name.ilike.%${s}%,details.ilike.%${s}%`);
    }
    const { data, error, count } = await query;
    if (error) return { data: [], total: 0 };

    // Also return category counts for the 30-day window
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cats } = await admin
      .from('audit_logs')
      .select('category')
      .gte('created_at', thirtyDaysAgo);
    const catCounts: Record<string, number> = {};
    for (const row of (cats ?? []) as { category: string }[]) {
      catCounts[row.category] = (catCounts[row.category] ?? 0) + 1;
    }
    return { data: data ?? [], total: count ?? 0, categoryCounts: catCounts };
  }

  private requireAdmin(authorization?: string | null) {
    const decoded = this.authService.verifyAccessToken(
      this.authService.extractBearerToken(authorization) ?? '',
    );
    if (!decoded?.userId || !(decoded as any).isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }
    return decoded as typeof decoded & { staffRole?: string };
  }

  // ─── Admin: Customers ───────────────────────────────────────────────────────

  @Get('admin/customers')
  async adminGetCustomers(
    @Headers('authorization') authorization?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: [], total: 0 };
    const pageLimit = Math.min(Number(limit ?? 50), 100);
    const pageOffset = Number(offset ?? 0);
    let query = admin
      .from('customers')
      .select('id, customer_number, full_name, email, phone, birthday, gender, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);
    if (search?.trim()) {
      query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }
    const { data, error, count } = await query;
    if (error) return { data: [], total: 0 };
    return { data: data ?? [], total: count ?? 0 };
  }

  @Get('admin/customers/:id')
  async adminGetCustomer(
    @Headers('authorization') authorization?: string,
    @Param('id') id?: string,
  ) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) throw new NotFoundException('Customer not found');
    const { data, error } = await admin
      .from('customers')
      .select('id, customer_number, full_name, email, phone, birthday, gender, created_at')
      .eq('id', id ?? '')
      .single();
    if (error || !data) throw new NotFoundException('Customer not found');
    return data;
  }

  // ─── Admin: Accounts ────────────────────────────────────────────────────────

  @Get('admin/accounts')
  async adminGetAccounts(@Headers('authorization') authorization?: string) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: [] };
    const { data, error } = await admin
      .from('staff')
      .select('id, staff_number, first_name, last_name, full_name, username, email, role, is_active, is_onboarded, created_at')
      .order('created_at', { ascending: true });
    if (error) return { data: [] };
    return { data: data ?? [] };
  }

  @Post('admin/accounts')
  async adminCreateAccount(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
  ) {
    const meCreate = this.requireAdmin(authorization);
    const firstName = body?.first_name?.trim();
    const lastName = body?.last_name?.trim();
    const username = body?.username?.toLowerCase()?.trim();
    const password = body?.password;
    // Cannot create super_admin accounts — only one allowed
    const role = body?.role === 'admin' ? 'admin' : 'staff';
    if (!firstName || !lastName || !username || !password) throw new BadRequestException('first_name, last_name, username, and password are required');
    const fullName = `${firstName} ${lastName}`;
    const bcryptLib = await import('bcrypt');
    const hashed = await bcryptLib.hash(password, 10);
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    // Check username uniqueness
    const { data: existing } = await admin.from('staff').select('id').eq('username', username).maybeSingle();
    if (existing) throw new BadRequestException('Username already taken');
    const { data, error } = await admin
      .from('staff')
      .insert([{ first_name: firstName, last_name: lastName, full_name: fullName, username, password: hashed, role, is_onboarded: false }])
      .select('id, staff_number, first_name, last_name, full_name, username, role, created_at')
      .single();
    if (error) throw new BadRequestException(error.message);
    const { data: me2 } = await admin.from('staff').select('full_name').eq('id', meCreate.userId).single();
    this.logAction({
      staffId: meCreate.userId as string,
      staffName: (me2?.full_name as string | null) ?? 'Admin',
      staffRole: (meCreate as any).staffRole,
      action: `Created staff account @${username}`,
      category: 'accounts',
      details: `Name: ${fullName}; Role: ${role}; Onboarding: pending`,
      entityId: data?.id,
    });
    return data;
  }

  // ─── Staff onboarding: set email ────────────────────────────────────────────

  @Post('staff/request-email')
  async staffRequestEmail(
    @Headers('authorization') authorization?: string,
    @Body() body?: { email?: string },
  ) {
    const me = this.requireAdmin(authorization);
    const email = body?.email?.toLowerCase()?.trim();
    if (!email) throw new BadRequestException('email is required');
    if (!this.mailerService.isConfigured()) throw new InternalServerErrorException('Email sending is not configured yet.');
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    // Check email not already used
    const { data: existingStaff } = await admin.from('staff').select('id').eq('email', email).maybeSingle();
    if (existingStaff && existingStaff.id !== me.userId) throw new BadRequestException('Email is already associated with another account');
    const { data: existingCustomer } = await this.supabaseService.supabase.from('customers').select('id').eq('email', email).maybeSingle();
    if (existingCustomer) throw new BadRequestException('Email is already registered as a customer account');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const emailToken = jwt.sign({ staffId: me.userId, email, code, purpose: 'staff-onboarding' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '10m' });
    await this.mailerService.sendStaffOnboardingEmail(email, code);
    return { message: 'Verification code sent to your email', emailToken };
  }

  @Post('staff/verify-email')
  async staffVerifyEmail(
    @Headers('authorization') authorization?: string,
    @Body() body?: { email?: string; code?: string; emailToken?: string },
  ) {
    const me = this.requireAdmin(authorization);
    const { email: rawEmail, code, emailToken } = body ?? {};
    const email = rawEmail?.toLowerCase()?.trim();
    if (!email || !code || !emailToken) throw new BadRequestException('email, code, and emailToken are required');
    let decoded: any;
    try { decoded = jwt.verify(emailToken, process.env.JWT_SECRET || 'your-secret-key'); } catch { throw new UnauthorizedException('Verification code expired. Please request a new one.'); }
    if (decoded.purpose !== 'staff-onboarding' || decoded.staffId !== me.userId || decoded.email !== email || decoded.code !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    const { data: staffRow } = await admin.from('staff').select('*').eq('id', me.userId).single();
    if (!staffRow) throw new NotFoundException('Staff account not found');
    await admin.from('staff').update({ email, is_onboarded: true }).eq('id', me.userId);
    this.logAction({
      staffId: me.userId as string,
      staffName: (staffRow.full_name as string | null) ?? 'Admin',
      staffRole: (me as any).staffRole ?? (staffRow.role as string | null),
      action: 'Completed staff onboarding',
      category: 'accounts',
      details: `Email: ${email}; Onboarded: no -> yes`,
      entityId: me.userId as string,
    });
    // Issue a new token with isOnboarded: true
    const staffRole = (staffRow.role ?? 'staff') as string;
    const payload = { userId: me.userId, email, isAdmin: true, staffRole, isOnboarded: true };
    const newToken = this.authService.signAccessToken(payload);
    return { success: true, token: newToken };
  }

  @Delete('admin/accounts/:id')
  async adminDeleteAccount(
    @Headers('authorization') authorization?: string,
    @Param('id') id?: string,
  ) {
    const me = this.requireAdmin(authorization);
    if ((me as any).staffRole !== 'super_admin') throw new UnauthorizedException('Only super admin can delete accounts');
    if (me.userId === id) throw new BadRequestException('Cannot remove your own account');
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    // Cannot delete super_admin
    const { data: target } = await admin.from('staff').select('full_name, username, email, role').eq('id', id ?? '').single();
    if (target?.role === 'super_admin') throw new BadRequestException('Cannot delete the super admin account');
    const { error } = await admin.from('staff').delete().eq('id', id ?? '');
    if (error) throw new InternalServerErrorException();
    const { data: deleter } = await admin.from('staff').select('full_name').eq('id', me.userId).single();
    this.logAction({
      staffId: me.userId as string,
      staffName: (deleter?.full_name as string | null) ?? 'Admin',
      staffRole: (me as any).staffRole,
      action: `Deleted staff account @${target?.username ?? id}`,
      category: 'accounts',
      details: `Name: ${target?.full_name ?? 'Unknown'}; Role: ${target?.role ?? 'Unknown'}; Email: ${this.formatAuditValue(target?.email)}`,
      entityId: id ?? undefined,
    });
    return { success: true };
  }

  @Patch('admin/accounts/:id/toggle-active')
  async adminToggleActive(
    @Headers('authorization') authorization?: string,
    @Param('id') id?: string,
  ) {
    const meToggle = this.requireAdmin(authorization);
    if (meToggle.userId === id) throw new BadRequestException('Cannot deactivate your own account');
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    // Cannot deactivate super_admin
    const { data: target } = await admin.from('staff').select('full_name, username, role, is_active').eq('id', id ?? '').single();
    if (!target) throw new NotFoundException('Account not found');
    if (target.role === 'super_admin') throw new BadRequestException('Cannot deactivate the super admin account');
    // (meToggle used below for logging)
    const newActive = !target.is_active;
    const { error } = await admin.from('staff').update({ is_active: newActive }).eq('id', id ?? '');
    if (error) throw new InternalServerErrorException();
    const { data: toggler } = await admin.from('staff').select('full_name').eq('id', meToggle.userId).single();
    this.logAction({
      staffId: meToggle.userId as string,
      staffName: (toggler?.full_name as string | null) ?? 'Admin',
      staffRole: (meToggle as any).staffRole,
      action: `Updated staff account status @${target.username ?? id}`,
      category: 'accounts',
      details: `Name: ${target.full_name ?? 'Unknown'}; Role: ${target.role}; ${this.formatAuditChange('Status', target.is_active ? 'active' : 'inactive', newActive ? 'active' : 'inactive')}`,
      entityId: id ?? undefined,
    });
    return { success: true, is_active: newActive };
  }

  // ─── Admin: OOS Settings ────────────────────────────────────────────────────

  @Get('admin/settings')
  async adminGetSettings(@Headers('authorization') authorization?: string) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: {} };
    const { data, error } = await admin.from('oos_settings').select('key, value');
    if (error) return { data: {} };
    const obj: Record<string, string> = {};
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      obj[row.key] = row.value;
    }
    return { data: obj };
  }

  @Put('admin/settings')
  async adminUpdateSettings(
    @Headers('authorization') authorization?: string,
    @Body() body?: Record<string, string>,
  ) {
    const meSettings = this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) throw new InternalServerErrorException();
    const entries = Object.entries(body ?? {});
    if (entries.length === 0) return { success: true };

    const settingLabels: Record<string, string> = {
      delivery_fee: 'delivery fee',
      free_delivery_min: 'free delivery minimum',
      min_order_amount: 'minimum order amount',
      max_order_items: 'maximum order items',
      order_cutoff_time: 'order cutoff time',
      contact_email: 'contact email',
      contact_phone: 'contact phone',
      oos_enabled: 'store status',
    };

    const { data: existingRows } = await admin.from('oos_settings').select('key, value');
    const existing = new Map<string, string>();
    for (const row of (existingRows ?? []) as { key: string; value: string }[]) {
      existing.set(row.key, String(row.value ?? ''));
    }

    const changedKeys = entries
      .filter(([key, value]) => existing.get(key) !== String(value))
      .map(([key]) => key);

    if (changedKeys.length === 0) return { success: true };

    const formatSettingValue = (key: string, value: string | undefined) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) return 'empty';
      if (key === 'oos_enabled') {
        return normalized === 'true' ? 'enabled' : 'disabled';
      }
      return normalized;
    };

    const changeDetails = changedKeys.map((key) => {
      const label = settingLabels[key] ?? key.replace(/_/g, ' ');
      const previousValue = formatSettingValue(key, existing.get(key));
      const nextValue = formatSettingValue(
        key,
        entries.find(([entryKey]) => entryKey === key)?.[1],
      );
      return this.formatAuditChange(label, previousValue, nextValue);
    });

    for (const [key, value] of entries) {
      await admin
        .from('oos_settings')
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    const { data: setter } = await admin.from('staff').select('full_name').eq('id', meSettings.userId).single();
    this.logAction({
      staffId: meSettings.userId as string,
      staffName: (setter?.full_name as string | null) ?? 'Admin',
      staffRole: (meSettings as any).staffRole,
      action: `Updated OOS settings (${changedKeys.length})`,
      category: 'settings',
      details: changeDetails.join('; '),
    });
    return { success: true };
  }

  // ─── Admin: Analytics ───────────────────────────────────────────────────────

  @Get('admin/analytics/searches')
  async adminGetSearchAnalytics(
    @Headers('authorization') authorization?: string,
    @Query('limit') limit?: string,
    @Query('from')  from?: string,
    @Query('to')    to?: string,
  ) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: [] };
    const pageLimit = Math.min(Number(limit ?? 50), 200);

    // Fetch raw rows — table stores individual rows per search (no count column)
    let q = admin
      .from('search_analytics')
      .select('query, searched_at')
      .order('searched_at', { ascending: false });
    if (from) q = (q as any).gte('searched_at', from);
    if (to)   q = (q as any).lte('searched_at', to);
    const { data, error } = await q.limit(pageLimit * 20);

    if (error || !data) return { data: [] };

    // Aggregate counts in memory
    const map = new Map<string, { count: number; last_searched_at: string }>();
    for (const row of data as { query: string; searched_at: string }[]) {
      const q = row.query.toLowerCase().trim();
      if (!q) continue;
      if (!map.has(q)) {
        map.set(q, { count: 0, last_searched_at: row.searched_at });
      }
      map.get(q)!.count += 1;
    }

    return {
      data: [...map.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, pageLimit)
        .map(([query, { count, last_searched_at }]) => ({ query, count, last_searched_at })),
    };
  }

  @Get('admin/analytics/product-views')
  async adminGetProductViewAnalytics(
    @Headers('authorization') authorization?: string,
    @Query('limit') limit?: string,
    @Query('from')  from?: string,
    @Query('to')    to?: string,
  ) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { data: [] };
    const pageLimit = Math.min(Number(limit ?? 50), 200);
    let q = admin
      .from('browsing_history')
      .select('product_id, category, view_count, viewed_at')
      .order('view_count', { ascending: false });
    if (from) q = (q as any).gte('viewed_at', from);
    if (to)   q = (q as any).lte('viewed_at', to);
    const { data, error } = await q.limit(pageLimit * 5);
    if (error) return { data: [] };
    // Aggregate by product_id
    const map = new Map<string, { product_id: string; category: string; total_views: number }>();
    for (const row of (data ?? []) as { product_id: string; category: string; view_count: number }[]) {
      const existing = map.get(row.product_id);
      if (existing) {
        existing.total_views += Number(row.view_count) || 0;
      } else {
        map.set(row.product_id, { product_id: row.product_id, category: row.category, total_views: Number(row.view_count) || 0 });
      }
    }
    return {
      data: [...map.values()].sort((a, b) => b.total_views - a.total_views).slice(0, pageLimit),
    };
  }

  @Get('admin/stats')
  async adminGetStats(@Headers('authorization') authorization?: string) {
    this.requireAdmin(authorization);
    const admin = this.tryGetAdmin();
    if (!admin) return { totalCustomers: 0, newToday: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [totalResult, todayResult] = await Promise.all([
      admin.from('customers').select('id', { count: 'exact', head: true }),
      admin.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    ]);
    return {
      totalCustomers: totalResult.count ?? 0,
      newToday: todayResult.count ?? 0,
    };
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
