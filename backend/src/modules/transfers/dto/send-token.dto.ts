import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTokenDto {
  @ApiProperty({
    description: 'Sender user ID',
    example: 'user123',
  })
  @IsString()
  fromid!: string;

  @ApiProperty({
    description: 'Recipient user ID',
    example: 'user456',
  })
  @IsString()
  toid!: string;

  @ApiProperty({
    description: 'Amount to send',
    example: '50.00',
  })
  @IsString()
  amount!: string;

  @ApiProperty({
    description: 'Token type',
    enum: ['USDC', 'USDT'],
    example: 'USDC',
  })
  @IsEnum(['USDC', 'USDT'])
  token!: 'USDC' | 'USDT';
}
