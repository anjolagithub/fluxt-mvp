import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaylinkDto {
  @ApiProperty({
    description: 'WhatsApp User ID (phone number with country code, no + sign)',
    example: '2348123189656',
  })
  @IsString()
  userWhatsAppId!: string;

  @ApiProperty({
    description: 'Amount to request',
    example: '25.00',
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
