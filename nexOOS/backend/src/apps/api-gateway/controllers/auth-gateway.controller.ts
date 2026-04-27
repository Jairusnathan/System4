import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SERVICE_URLS } from '../../../shared/http/service-urls';
import { requestDownstream } from '../../../shared/http/request-downstream';
import { applyDownstreamCookies } from './gateway-utils';

@Controller('auth')
export class AuthGatewayController {
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/login',
      method: 'POST',
      body,
    });

    applyDownstreamCookies(response, result.headers);
    response.status(result.status);
    return result.data;
  }

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/register',
      method: 'POST',
      body,
    });

    applyDownstreamCookies(response, result.headers);
    response.status(result.status);
    return result.data;
  }

  @Get('me')
  async me(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/me',
      headers: { authorization },
    });

    response.status(result.status);
    return result.data;
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/refresh',
      method: 'POST',
      headers: { cookie: request.headers.cookie },
    });

    applyDownstreamCookies(response, result.headers);
    response.status(result.status);
    return result.data;
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/logout',
      method: 'POST',
      headers: { cookie: request.headers.cookie },
    });

    applyDownstreamCookies(response, result.headers);
    response.status(result.status);
    return result.data;
  }

  @Post('update-profile')
  async updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/update-profile',
      method: 'POST',
      headers: { authorization },
      body,
    });

    response.status(result.status);
    return result.data;
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/request-password-reset',
      method: 'POST',
      body,
    });

    response.status(result.status);
    return result.data;
  }

  @Post('verify-password-reset-code')
  async verifyPasswordResetCode(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/verify-password-reset-code',
      method: 'POST',
      body,
    });

    response.status(result.status);
    return result.data;
  }

  @Post('update-password')
  async updatePassword(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/update-password',
      method: 'POST',
      body,
    });

    response.status(result.status);
    return result.data;
  }
}
