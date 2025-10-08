import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { UsersModule } from '../users/users.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../infra/entities/transaction.entity';

@Module({
  imports: [
    UsersModule,
    BlockchainModule,
    TypeOrmModule.forFeature([Transaction]),
  ],
  controllers: [TransfersController],
})
export class TransfersModule {}
