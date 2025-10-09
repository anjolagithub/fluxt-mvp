import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositService } from './deposit.service';
import { DepositMonitorService } from './deposit-monitor.service';
import { User } from '../../infra/entities/user.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), BlockchainModule],
  providers: [DepositService, DepositMonitorService],
  exports: [DepositService, DepositMonitorService],
})
export class DepositModule {}
