import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './infra/entities/user.entity';
import { Transaction } from './infra/entities/transaction.entity';
import { Paylink } from './infra/entities/paylink.entity';
import { Withdrawal } from './infra/entities/withdrawal.entity';
import { FxModule } from './modules/fx/fx.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { DepositModule } from './modules/deposit/deposit.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ReceiveModule } from './modules/receive/receive.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [User, Transaction, Paylink, Withdrawal],
        synchronize: true,
        logging: false,
      }),
    }),
    FxModule,
    BlockchainModule,
    UsersModule,
    WalletModule,
    DepositModule,
    TransfersModule,
    ReceiveModule,
    WithdrawalsModule,
    WhatsAppModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
