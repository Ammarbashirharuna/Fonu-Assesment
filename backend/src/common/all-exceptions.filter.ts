import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import { QueryFailedError } from 'typeorm';

interface NormalizedError {
  status: number;
  message: string | string[];
  error: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, message, error } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return { status, message: body, error: STATUS_CODES[status] ?? 'Error' };
      }
      const obj = body as { message?: string | string[]; error?: string };
      return {
        status,
        message: obj.message ?? exception.message,
        error: obj.error ?? STATUS_CODES[status] ?? 'Error',
      };
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)?.code;
      switch (code) {
        case '23505':
          return this.make(HttpStatus.CONFLICT, 'Resource already exists');
        case '23503':
          return this.make(HttpStatus.CONFLICT, 'Operation conflicts with related records');
        case '23514':
          return this.make(HttpStatus.BAD_REQUEST, 'Value violates a database constraint');
        case '22P02':
          return this.make(HttpStatus.BAD_REQUEST, 'Invalid input value');
      }
    }

    return this.make(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
  }

  private make(status: number, message: string): NormalizedError {
    return { status, message, error: STATUS_CODES[status] ?? 'Error' };
  }
}
