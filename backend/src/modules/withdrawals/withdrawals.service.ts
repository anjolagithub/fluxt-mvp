import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FxService } from '../fx/fx.service';
import { Withdrawal } from '../../infra/entities/withdrawal.entity';

export interface WithdrawResponse {
  success: boolean;
  message: string;
  status: string;
  estimatedTime: string;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly fx: FxService,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
  ) {}

  /**
   * Initiates a withdrawal from crypto to fiat currency
   */
  async withdraw(
    id: string,
    amount: string,
    token: string,
  ): Promise<WithdrawResponse> {
    // Get current exchange rates
    const rates = await this.fx.getRates();

    // Convert to NGN equivalent
    const ngnEquivalent = this.fx.convert(amount, 'NGN', rates);

    // Save withdrawal record
    await this.withdrawalRepo.save(
      this.withdrawalRepo.create({
        id,
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
