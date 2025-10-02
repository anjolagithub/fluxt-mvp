import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './infra/typeorm/entities/user.entity';
import { Transaction } from './infra/typeorm/entities/transaction.entity';
import { Paylink } from './infra/typeorm/entities/paylink.entity';
import { Withdrawal } from './infra/typeorm/entities/withdrawal.entity';
import { FxModule } from './modules/fx/fx.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ReceiveModule } from './modules/receive/receive.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true } },
      },
    }),
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
    TransfersModule,
    ReceiveModule,
    WithdrawalsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
