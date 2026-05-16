import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ServiceUnavailableError } from '../shared/http/request-downstream';

@Catch()
export class GatewayExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    if (exception instanceof ServiceUnavailableError) {
      console.error(`[Gateway] Downstream unavailable Ã¢â‚¬â€ ${request.url}:`, exception.message);
      return response.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'A required service is temporarily unavailable. Please try again shortly.',
      });
    }

    console.error(`[Gateway] Unhandled exception Ã¢â‚¬â€ ${request.url}:`, exception);
    const fallback = new ServiceUnavailableException();
    return response.status(503).json(fallback.getResponse());
  }
}
