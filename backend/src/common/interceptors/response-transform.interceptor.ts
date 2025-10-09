import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  message?: string;
  statusCode: number;
}

/**
 * Interceptor to transform response data into a consistent format
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // Extract message from data if it exists, then remove it from data
        const message = data?.message || 'Request successful';

        // Remove message property from data to avoid duplication
        const cleanData =
          data && typeof data === 'object' && 'message' in data
            ? Object.fromEntries(
                Object.entries(data).filter(([key]) => key !== 'message')
              )
            : data;

        return {
          data: cleanData,
          message,
          statusCode: response.statusCode,
        };
      })
    );
  }
}
