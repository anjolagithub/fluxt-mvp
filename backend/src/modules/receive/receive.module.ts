import { Module } from '@nestjs/common';
import { ReceiveController } from './receive.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paylink } from '../../infra/typeorm/entities/paylink.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Paylink])],
  controllers: [ReceiveController],
})
export class ReceiveModule {}
