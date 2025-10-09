import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { UsersModule } from '../users/users.module';
import { FxModule } from '../fx/fx.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DepositModule } from '../deposit/deposit.module';

@Module({
  imports: [UsersModule, FxModule, BlockchainModule, DepositModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
