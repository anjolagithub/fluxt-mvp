import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { UsersModule } from '../users/users.module';
import { FxModule } from '../fx/fx.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [UsersModule, FxModule, BlockchainModule],
  controllers: [WalletController],
})
export class WalletModule {}
