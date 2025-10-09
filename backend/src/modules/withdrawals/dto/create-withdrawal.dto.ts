import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawalDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user123',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Amount to withdraw',
    example: '100.00',
  })
  @IsString()
  amount!: string;

  @ApiProperty({
    description: 'Token type',
    example: 'USDC',
  })
  @IsString()
  token!: string;
}
