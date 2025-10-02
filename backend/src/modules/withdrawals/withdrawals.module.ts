import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { FxModule } from '../fx/fx.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from '../../infra/typeorm/entities/withdrawal.entity';

@Module({
  imports: [FxModule, TypeOrmModule.forFeature([Withdrawal])],
  controllers: [WithdrawalsController],
})
export class WithdrawalsModule {}
