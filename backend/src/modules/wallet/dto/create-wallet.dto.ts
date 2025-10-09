import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsWhatsAppPhoneNumber } from '../../../common/validators/phone-number.validator';

export class CreateWalletDto {
  @ApiProperty({
    description: 'WhatsApp User ID (phone number with country code, no + sign)',
    example: '2348123189656',
    minLength: 10,
    maxLength: 15,
  })
  @IsString()
  @IsWhatsAppPhoneNumber()
  userWhatsAppId!: string;
}
