import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

export enum RESPONSE_STATUS_CODE {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  OK = 200,
  CREATED = 201,
  SERVER_ERROR = 500,
}

export enum RESPONSE_STATUS {
  SUCCESS = 'success',
  ERROR = 'error',
}


@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalException');

  constructor() {
    this.setupProcessHandlers();
  }

  private setupProcessHandlers() {
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', (reason: unknown) => {
      this.logger.error('🚨 Unhandled Promise Rejection:', reason);
    });

    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('🔥 Uncaught Exception:', error.message);
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      this.logger.log('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      this.logger.log('SIGINT received, shutting down gracefully');
      process.exit(0);
    });
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = this.getExceptionResponse(
      exception,
      isHttpException,
    );
    const message =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? exceptionResponse.message
        : exceptionResponse;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Internal Server Error:', message);
      return this.sendErrorResponse(
        response,
        500,
        'Unexpected error occurred',
        null,
      );
    }

    if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) {
      this.logger.warn('Validation Error:', message);
      return this.sendErrorResponse(
        response,
        422,
        'Bad input data',
        this.formatValidationErrors(message),
      );
    }

    this.logger.log(`Response: ${message} [${status}]`);

    // If exception response has additional data, include it in the response
    const additionalData = this.extractAdditionalData(exceptionResponse);

    return this.sendErrorResponse(
      response,
      status,
      message,
      null,
      this.isSuccessStatus(status),
      additionalData,
    );
  }

  private getExceptionResponse(
    exception: unknown,
    isHttpException: boolean,
  ): any {
    if (isHttpException) {
      return (exception as HttpException).getResponse();
    }
    return {
      message: (exception as any)?.message || 'Unexpected server error',
    };
  }

  private extractAdditionalData(
    exceptionResponse: any,
  ): Record<string, any> | null {
    if (typeof exceptionResponse !== 'object') {
      return null;
    }

    // Extract all fields except 'message' and 'statusCode'
    const { message, statusCode, ...additionalData } = exceptionResponse;

    return Object.keys(additionalData).length > 0 ? additionalData : null;
  }

  private sendErrorResponse(
    response: Response,
    statusCode: number,
    message: string,
    error: any = null,
    isSuccess = false,
    additionalData: Record<string, any> | null = null,
  ) {
    const responseBody: any = {
      status: isSuccess ? RESPONSE_STATUS.SUCCESS : RESPONSE_STATUS.ERROR,
      message,
      statusCode,
    };

    // Add error field if present
    if (error !== null) {
      responseBody.error = error;
    }

    // Merge additional data into the response (e.g., email, redirect_url, data, etc.)
    if (additionalData) {
      Object.assign(responseBody, additionalData);
    }

    return response.status(statusCode).json(responseBody);
  }

  private formatValidationErrors(errors: string[]): Record<string, string> {
    const errorMap: Record<string, string> = {};
    const fields = new Set(errors.map((err) => err.split(' ')[0]));

    fields.forEach((field) => {
      const matchedError = errors.find((err) => err.startsWith(field));
      if (matchedError) errorMap[field] = matchedError.replace('_', ' ');
    });

    return errorMap;
  }

  private isSuccessStatus(status: number): boolean {
    return [RESPONSE_STATUS_CODE.OK, RESPONSE_STATUS_CODE.CREATED].includes(
      status,
    );
  }
}
