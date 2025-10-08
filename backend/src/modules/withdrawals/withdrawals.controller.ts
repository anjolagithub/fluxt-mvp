import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { FxService } from '../fx/fx.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Withdrawal } from '../../infra/entities/withdrawal.entity';

const WithdrawDto = z.object({
  userId: z.string(),
  amount: z.string(),
  token: z.string(),
});

@Controller('withdraw')
export class WithdrawalsController {
  constructor(
    private readonly fx: FxService,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
  ) {}

  @Post()
  async withdraw(@Body() body: unknown) {
    const { userId, amount, token } = WithdrawDto.parse(body);
    const rates = await this.fx.getRates();
    const ngnEquivalent = this.fx.convert(amount, 'NGN', rates);
    await this.withdrawalRepo.save(
      this.withdrawalRepo.create({
        userId,
        amount,
        token,
        ngnEquivalent,
        status: 'processing',
      }),
    );
    return {
      success: true,
      message: `Withdrawal of $${amount} ${token} (₦${ngnEquivalent}) initiated`,
      status: 'processing',
      estimatedTime: '2-3 business days',
    };
  }
}
