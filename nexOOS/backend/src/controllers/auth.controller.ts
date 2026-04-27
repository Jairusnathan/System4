import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  MAX_SAVED_ADDRESSES,
  normalizeSavedAddresses,
  parseSerializedAddresses,
  stringifyAddresses,
} from '../utils/customer-addresses.util';
import {
  normalizePhilippinePhone,
  PH_PHONE_MESSAGE,
} from '../utils/phone.util';
import {
  AppAuthService,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../services/auth.service';
import { MailerService } from '../services/mailer.service';
import { SupabaseService } from '../services/supabase.service';

@Controller('auth')
export class AuthController {
  private readonly authService: AppAuthService;
  private readonly mailerService: MailerService;
  private readonly supabaseService: SupabaseService;

  constructor(
    authService: AppAuthService,
    mailerService: MailerService,
    supabaseService: SupabaseService,
  ) {
    this.authService = authService;
    this.mailerService = mailerService;
    this.supabaseService = supabaseService;
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    try {
      const email = body?.email?.toLowerCase()?.trim();
      const password = body?.password;

      const { data: user, error } = await this.supabaseService.supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { userId: user.id, email: user.email };
      const token = this.authService.signAccessToken(payload);
      const refreshToken = this.authService.signRefreshToken(payload);
      const { password: _password, ...userWithoutPassword } = user;

      this.authService.setRefreshTokenCookie(response, refreshToken);
      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error('Login error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('register')
  async register(
    @Body() body: any,
    @Res({ passthrough: true }) response: Response,
  ) {
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

      if (!fullName || !email || !phone || !birthday || !gender || !password) {
        throw new BadRequestException('All fields are required');
      }

      if (!normalizedPhone) {
        throw new BadRequestException(PH_PHONE_MESSAGE);
      }

      if (!verificationCode && !this.mailerService.isConfigured()) {
        throw new InternalServerErrorException(
          'Email sending is not configured yet. Add SMTP settings in .env first.',
        );
      }

      const { data: existingUser, error: checkError } =
        await this.supabaseService.supabase
          .from('customers')
          .select('id')
          .eq('email', email)
          .single();

      if (existingUser) {
        throw new BadRequestException('Email already registered');
      }

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

      if (!verificationCode || !registrationToken) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);
        const nextRegistrationToken = jwt.sign(
          {
            full_name: fullName,
            email,
            phone: normalizedPhone,
            birthday,
            gender,
            password: hashedPassword,
            code,
            purpose: 'register',
          },
          jwtSecret,
          { expiresIn: '10m' },
        );

        await this.mailerService.sendRegistrationCodeEmail(email, code);

        return {
          message: 'Verification code sent successfully',
          requiresVerification: true,
          registrationToken: nextRegistrationToken,
        };
      }

      let decoded: any;
      try {
        decoded = jwt.verify(registrationToken, jwtSecret);
      } catch {
        throw new UnauthorizedException(
          'Verification code expired. Please request a new one.',
        );
      }

      if (
        decoded.purpose !== 'register' ||
        decoded.email !== email ||
        decoded.code !== verificationCode ||
        decoded.full_name !== fullName ||
        decoded.phone !== normalizedPhone ||
        decoded.birthday !== birthday ||
        decoded.gender !== gender
      ) {
        throw new UnauthorizedException('Invalid verification code');
      }

      const { data: newUser, error: insertError } =
        await this.supabaseService.supabase
          .from('customers')
          .insert([
            {
              full_name: fullName,
              email,
              phone: normalizedPhone,
              birthday: decoded.birthday,
              gender: decoded.gender,
              password: decoded.password,
            },
          ])
          .select()
          .single();

      if (insertError) {
        throw insertError;
      }

      if (this.mailerService.isConfigured()) {
        try {
          await this.mailerService.sendWelcomeEmail(email, fullName);
        } catch (mailError) {
          console.error('Welcome email error:', mailError);
        }
      }

      const payload = { userId: newUser.id, email };
      const token = this.authService.signAccessToken(payload);
      const refreshToken = this.authService.signRefreshToken(payload);
      const { password: _password, ...userWithoutPassword } = newUser;

      this.authService.setRefreshTokenCookie(response, refreshToken);
      return {
        token,
        user: userWithoutPassword,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      console.error('Registration error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    try {
      const userId = this.authService.requireUserId(authorization);

      const { data: user, error: fetchError } = await this.supabaseService.supabase
        .from('customers')
        .select(
          'id, full_name, email, phone, birthday, gender, address, profile_image',
        )
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        throw new NotFoundException('User not found');
      }

      const { data: addressRows, error: addressesError } =
        await this.supabaseService.supabase
          .from('customer_addresses')
          .select(
            'full_name, phone_number, province, city, postal_code, street_address, label, is_default, sort_order, created_at',
          )
          .eq('customer_id', userId)
          .order('is_default', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

      if (addressesError) {
        console.error('Fetch customer addresses error:', addressesError);
        return user;
      }

      if (addressRows && addressRows.length > 0) {
        return {
          ...user,
          address: stringifyAddresses(
            addressRows.map((entry) => ({
              fullName: entry.full_name || '',
              phoneNumber: entry.phone_number || '',
              province: entry.province || '',
              city: entry.city || '',
              postalCode: entry.postal_code || '',
              streetAddress: entry.street_address || '',
              label: entry.label === 'Work' ? 'Work' : 'Home',
            })),
          ),
        };
      }

      return user;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Me error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('refresh')
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const decoded = this.authService.verifyRefreshToken(refreshToken);
    if (!decoded?.userId || !decoded?.email) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload = {
      userId: decoded.userId as string,
      email: decoded.email as string,
    };

    const nextAccessToken = this.authService.signAccessToken(payload);
    const nextRefreshToken = this.authService.signRefreshToken(payload);

    this.authService.setRefreshTokenCookie(response, nextRefreshToken);
    return { token: nextAccessToken };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    this.authService.clearRefreshTokenCookie(response);
    return { success: true };
  }

  @Post('update-profile')
  async updateProfile(
    @Headers('authorization') authorization?: string,
    @Body() body?: any,
  ) {
    try {
      const userId = this.authService.requireUserId(authorization);
      const { full_name, phone, birthday, gender, address, profile_image } = body;
      const normalizedPhone = phone ? normalizePhilippinePhone(phone) : null;

      if (phone && !normalizedPhone) {
        throw new BadRequestException(PH_PHONE_MESSAGE);
      }

      let serializedAddressValue =
        typeof address === 'string' ? address : undefined;
      let normalizedAddresses: ReturnType<typeof normalizeSavedAddresses> | null =
        null;

      if (typeof address === 'string') {
        const parsedAddresses = parseSerializedAddresses(address, {
          full_name,
          phone: normalizedPhone || phone || '',
        }).filter(
          (entry) =>
            entry.streetAddress ||
            entry.province ||
            entry.city ||
            entry.phoneNumber ||
            entry.fullName,
        );

        if (parsedAddresses.length > MAX_SAVED_ADDRESSES) {
          throw new BadRequestException(
            `You can only save up to ${MAX_SAVED_ADDRESSES} addresses.`,
          );
        }

        normalizedAddresses = normalizeSavedAddresses(parsedAddresses, {
          full_name,
          phone: normalizedPhone || phone || '',
        });

        if (normalizedAddresses.some((entry) => !entry.phoneNumber)) {
          throw new BadRequestException(PH_PHONE_MESSAGE);
        }

        serializedAddressValue = stringifyAddresses(normalizedAddresses);
      }

      const updatePayload: Record<string, string | null | undefined> = {
        full_name,
        phone: normalizedPhone || null,
        birthday: birthday || null,
        gender: gender || null,
      };

      if (Object.prototype.hasOwnProperty.call(body, 'profile_image')) {
        updatePayload.profile_image =
          typeof profile_image === 'string' && profile_image.trim()
            ? profile_image
            : null;
      }

      if (typeof serializedAddressValue !== 'undefined') {
        updatePayload.address = serializedAddressValue || null;
      }

      const { data: updatedUser, error: updateError } =
        await this.supabaseService.supabase
          .from('customers')
          .update(updatePayload)
          .eq('id', userId)
          .select(
            'id, full_name, email, phone, birthday, gender, address, profile_image',
          )
          .single();

      if (updateError) {
        throw updateError;
      }

      if (normalizedAddresses !== null) {
        const { error: deleteAddressesError } =
          await this.supabaseService.supabase
            .from('customer_addresses')
            .delete()
            .eq('customer_id', userId);

        if (deleteAddressesError) {
          throw deleteAddressesError;
        }

        if (normalizedAddresses.length > 0) {
          const { error: insertAddressesError } =
            await this.supabaseService.supabase
              .from('customer_addresses')
              .insert(
                normalizedAddresses.map((entry, index) => ({
                  customer_id: userId,
                  full_name: entry.fullName,
                  phone_number: entry.phoneNumber,
                  province: entry.province,
                  city: entry.city,
                  postal_code: entry.postalCode,
                  street_address: entry.streetAddress,
                  label: entry.label,
                  is_default: index === 0,
                  sort_order: index,
                })),
              );

          if (insertAddressesError) {
            throw insertAddressesError;
          }
        }
      }

      return {
        ...updatedUser,
        address: serializedAddressValue ?? updatedUser.address,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      console.error('Update profile error:', error);
      throw new InternalServerErrorException();
    }
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: any) {
    try {
      const email = body?.email?.toLowerCase()?.trim();
      if (!email) {
        throw new BadRequestException('Email is required');
      }

      if (!this.mailerService.isConfigured()) {
        throw new InternalServerErrorException(
          'Email sending is not configured yet. Add SMTP settings in .env first.',
        );
      }

      const { data: user, error } = await this.supabaseService.supabase
        .from('customers')
        .select('id, email')
        .eq('email', email)
        .single();

      if (error || !user) {
        throw new NotFoundException('No account found with that email address');
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const resetToken = jwt.sign(
        { email, code, purpose: 'password-reset' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10m' },
      );

      await this.mailerService.sendPasswordResetCodeEmail(email, code);

      return {
        message: 'Verification code sent successfully',
        resetToken,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      console.error('Request password reset error:', error);
      throw new InternalServerErrorException(
        'Failed to send verification code',
      );
    }
  }

  @Post('verify-password-reset-code')
  verifyPasswordResetCode(@Body() body: any) {
    try {
      const email = body?.email?.toLowerCase()?.trim();
      const verificationCode = body?.verificationCode;
      const resetToken = body?.resetToken;

      if (!email || !verificationCode || !resetToken) {
        throw new BadRequestException('Missing verification details');
      }

      let decoded: any;
      try {
        decoded = jwt.verify(
          resetToken,
          process.env.JWT_SECRET || 'your-secret-key',
        );
      } catch {
        throw new UnauthorizedException(
          'Verification code expired. Please request a new one.',
        );
      }

      if (
        decoded.purpose !== 'password-reset' ||
        decoded.email !== email ||
        decoded.code !== verificationCode
      ) {
        throw new UnauthorizedException('Invalid verification code');
      }

      return { message: 'Code verified successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      console.error('Verify password reset code error:', error);
      throw new InternalServerErrorException('Failed to verify code');
    }
  }

  @Post('update-password')
  async updatePassword(@Body() body: any) {
    try {
      const newPassword = body?.newPassword;
      const token = body?.token;
      const rawEmail = body?.email;
      const oldPassword = body?.oldPassword;
      const resetToken = body?.resetToken;
      const verificationCode = body?.verificationCode;

      if (!newPassword) {
        throw new BadRequestException('Missing new password');
      }

      let userId: string;

      if (token) {
        const decoded = this.authService.verifyAccessToken(token);
        if (!decoded?.userId) {
          throw new UnauthorizedException('Invalid or expired token');
        }
        userId = decoded.userId as string;
      } else if (resetToken && verificationCode && rawEmail) {
        const email = rawEmail.toLowerCase().trim();
        let decoded: any;

        try {
          decoded = jwt.verify(
            resetToken,
            process.env.JWT_SECRET || 'your-secret-key',
          );
        } catch {
          throw new UnauthorizedException(
            'Verification code expired. Please request a new one.',
          );
        }

        if (
          decoded.purpose !== 'password-reset' ||
          decoded.email !== email ||
          decoded.code !== verificationCode
        ) {
          throw new UnauthorizedException('Invalid verification code');
        }

        const { data: user, error } = await this.supabaseService.supabase
          .from('customers')
          .select('id')
          .eq('email', email)
          .single();

        if (error || !user) {
          throw new NotFoundException('User not found');
        }

        userId = user.id;
      } else if (rawEmail && oldPassword) {
        const email = rawEmail.toLowerCase().trim();
        const { data: user, error } = await this.supabaseService.supabase
          .from('customers')
          .select('*')
          .eq('email', email)
          .single();

        if (error || !user) {
          throw new NotFoundException('User not found');
        }

        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedException('Incorrect old password');
        }

        userId = user.id;
      } else {
        throw new BadRequestException('Missing required credentials');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await this.supabaseService.supabase
        .from('customers')
        .update({ password: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      return { message: 'Password updated successfully' };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Update password error:', error);
      throw new InternalServerErrorException();
    }
  }
}
