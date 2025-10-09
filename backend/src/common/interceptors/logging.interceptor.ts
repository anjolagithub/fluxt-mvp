import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Enhanced interceptor for logging HTTP requests and responses with detailed metrics
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const startTime = Date.now();

    // Extract user info if available (from JWT token)
    const user = (request as any).user;
    const userId = user?.id || 'anonymous';

    // Log the incoming request
    this.logger.log(
      `→ ${method} ${originalUrl} - IP: ${ip} - User: ${userId} - Agent: ${userAgent.substring(0, 50)}`
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const { statusCode } = response;

          // Log successful response with color coding based on response time
          const timeColor =
            responseTime > 1000 ? '🔴' : responseTime > 500 ? '🟡' : '🟢';

          this.logger.log(
            `← ${method} ${originalUrl} - ${statusCode} - ${responseTime}ms ${timeColor} - User: ${userId}`
          );
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = error?.status || response.statusCode || 500;

          // Log error response
          this.logger.error(
            `✗ ${method} ${originalUrl} - ${statusCode} - ${responseTime}ms - User: ${userId} - Error: ${error?.message || 'Unknown error'}`
          );
        },
      })
    );
  }
}
