import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WhatsAppWebhookDto {
  @ApiProperty({
    description: 'Sender phone number',
    example: 'whatsapp:+1234567890',
  })
  @IsString()
  From!: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello',
  })
  @IsString()
  Body!: string;

  @ApiProperty({
    description: 'Message SID',
    example: 'SM1234567890abcdef',
    required: false,
  })
  @IsString()
  MessageSid?: string;

  @ApiProperty({
    description: 'Account SID',
    example: 'AC1234567890abcdef',
    required: false,
  })
  @IsString()
  AccountSid?: string;
}

export class SendWhatsAppMessageDto {
  @ApiProperty({
    description: 'Recipient phone number',
    example: '+1234567890',
  })
  @IsString()
  to!: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello from Fluxt!',
  })
  @IsString()
  message!: string;
}
