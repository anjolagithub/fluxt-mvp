import { Module } from '@nestjs/common';
import { ReceiveController } from './receive.controller';
import { ReceiveService } from './receive.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paylink } from '../../infra/entities/paylink.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Paylink])],
  controllers: [ReceiveController],
  providers: [ReceiveService],
  exports: [ReceiveService],
})
export class ReceiveModule {}
