import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { User } from '../../infra/typeorm/entities/user.entity';
import { Transaction } from '../../infra/typeorm/entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Transaction])],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
