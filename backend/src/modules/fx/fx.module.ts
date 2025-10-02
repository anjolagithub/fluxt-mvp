import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FxService } from './fx.service';

@Module({
  imports: [HttpModule],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
