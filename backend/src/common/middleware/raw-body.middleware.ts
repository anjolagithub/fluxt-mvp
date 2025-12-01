import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only capture raw body for webhook endpoints
    if (req.path === '/whatsapp/webhook') {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        (req as any).rawBody = rawBody;
        console.log('📄 Raw body captured:', rawBody);
      });
    }
    next();
  }
}