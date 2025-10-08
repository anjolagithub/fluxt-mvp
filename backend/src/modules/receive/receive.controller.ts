import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paylink } from '../../infra/entities/paylink.entity';
import QRCode from 'qrcode';

const ReceiveDto = z.object({
  userId: z.string(),
  amount: z.string(),
  token: z.string(),
});

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

@Controller('receive')
export class ReceiveController {
  constructor(
    @InjectRepository(Paylink)
    private readonly paylinkRepo: Repository<Paylink>,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const { userId, amount, token } = ReceiveDto.parse(body);
    const id = generateId();
    const paylink = `https://fluxt.app/pay/${id}`;

    await this.paylinkRepo.save(
      this.paylinkRepo.create({ id, userId, amount, token, status: 'active' }),
    );

    const qrCode = await QRCode.toDataURL(paylink);
    return { paylink, qrCode };
  }
}
