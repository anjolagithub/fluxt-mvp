import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
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
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
