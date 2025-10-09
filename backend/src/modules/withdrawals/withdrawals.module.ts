import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { FxModule } from '../fx/fx.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from '../../infra/entities/withdrawal.entity';

@Module({
  imports: [FxModule, TypeOrmModule.forFeature([Withdrawal])],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
