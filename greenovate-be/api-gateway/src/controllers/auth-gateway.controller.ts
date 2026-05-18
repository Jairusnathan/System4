import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SERVICE_URLS } from '../shared/http/service-urls';
import { requestDownstream } from '../shared/http/request-downstream';
import { applyDownstreamCookies } from './gateway-utils';

@Controller('auth')
export class AuthGatewayController {
  @Post('login')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  async me(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/me',
      headers: { authorization },
    });

    response.status(result.status);
    return result.data;
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  async logout(
    @Req() request: Request,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/logout',
      method: 'POST',
      headers: { cookie: request.headers.cookie, authorization },
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
  async requestPasswordReset(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  async verifyPasswordResetCode(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  async updatePassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/update-password',
      method: 'POST',
      body,
    });

    response.status(result.status);
    return result.data;
  }

  @Post('product-view')
  async recordProductView(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/product-view',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('category-interests')
  async getCategoryInterests(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/category-interests',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('product-interests')
  async getProductInterests(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/product-interests',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('browsing-history')
  async getBrowsingHistory(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/browsing-history',
      headers: { authorization },
    });

    response.status(result.status);
    return result.data;
  }

  @Post('browsing-history')
  async saveBrowsingHistory(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/browsing-history',
      method: 'POST',
      headers: { authorization },
      body,
    });

    response.status(result.status);
    return result.data;
  }

  @Get('admin/profile')
  async adminGetProfile(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({ baseUrl: SERVICE_URLS.auth, path: '/auth/admin/profile', headers: { authorization } });
    response.status(result.status); return result.data;
  }

  @Put('admin/profile')
  async adminUpdateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({ baseUrl: SERVICE_URLS.auth, path: '/auth/admin/profile', method: 'PUT', headers: { authorization }, body });
    response.status(result.status); return result.data;
  }

  @Post('admin/change-password')
  async adminChangePassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({ baseUrl: SERVICE_URLS.auth, path: '/auth/admin/change-password', method: 'POST', headers: { authorization }, body });
    response.status(result.status); return result.data;
  }

  @Post('staff/request-email')
  async staffRequestEmail(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/staff/request-email',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Post('staff/verify-email')
  async staffVerifyEmail(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/staff/verify-email',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('public/settings')
  async getPublicSettings(@Res({ passthrough: true }) response: Response) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/public/settings',
    });
    response.status(result.status);
    return result.data;
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/customers')
  async adminGetCustomers(
    @Headers('authorization') authorization: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/customers${suffix}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/customers/:id')
  async adminGetCustomer(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/customers/${encodeURIComponent(id)}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/accounts')
  async adminGetAccounts(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/accounts',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Post('admin/accounts')
  async adminCreateAccount(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/accounts',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Patch('admin/accounts/:id/toggle-active')
  async adminToggleActive(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({ baseUrl: SERVICE_URLS.auth, path: `/auth/admin/accounts/${encodeURIComponent(id)}/toggle-active`, method: 'PATCH', headers: { authorization } });
    response.status(result.status); return result.data;
  }

  @Delete('admin/accounts/:id')
  async adminDeleteAccount(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/accounts/${encodeURIComponent(id)}`,
      method: 'DELETE',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Post('admin/audit-log')
  async adminCreateAuditLog(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/audit-log',
      method: 'POST',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/audit-logs')
  async adminGetAuditLogs(
    @Headers('authorization') authorization: string | undefined,
    @Query('category') category: string | undefined,
    @Query('search') search: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parts: string[] = [];
    if (category) parts.push(`category=${encodeURIComponent(category)}`);
    if (search)   parts.push(`search=${encodeURIComponent(search)}`);
    if (from)     parts.push(`from=${encodeURIComponent(from)}`);
    if (to)       parts.push(`to=${encodeURIComponent(to)}`);
    if (limit)    parts.push(`limit=${encodeURIComponent(limit)}`);
    if (offset)   parts.push(`offset=${encodeURIComponent(offset)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/audit-logs${qs}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/settings')
  async adminGetSettings(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/settings',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Put('admin/settings')
  async adminUpdateSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/settings',
      method: 'PUT',
      headers: { authorization },
      body,
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/stats')
  async adminGetAuthStats(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: '/auth/admin/stats',
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/analytics/searches')
  async adminGetSearchAnalytics(
    @Headers('authorization') authorization: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('from')  from:  string | undefined,
    @Query('to')    to:    string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parts: string[] = [];
    if (limit) parts.push(`limit=${encodeURIComponent(limit)}`);
    if (from)  parts.push(`from=${encodeURIComponent(from)}`);
    if (to)    parts.push(`to=${encodeURIComponent(to)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/analytics/searches${qs}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }

  @Get('admin/analytics/product-views')
  async adminGetProductViewAnalytics(
    @Headers('authorization') authorization: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('from')  from:  string | undefined,
    @Query('to')    to:    string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parts: string[] = [];
    if (limit) parts.push(`limit=${encodeURIComponent(limit)}`);
    if (from)  parts.push(`from=${encodeURIComponent(from)}`);
    if (to)    parts.push(`to=${encodeURIComponent(to)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    const result = await requestDownstream<unknown>({
      baseUrl: SERVICE_URLS.auth,
      path: `/auth/admin/analytics/product-views${qs}`,
      headers: { authorization },
    });
    response.status(result.status);
    return result.data;
  }
}
