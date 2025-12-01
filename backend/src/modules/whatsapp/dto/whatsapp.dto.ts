import { IsString, IsOptional } from 'class-validator';
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
    description: 'WhatsApp ID',
    example: '2348123189656',
    required: false,
  })
  @IsOptional()
  @IsString()
  WaId?: string;

  @ApiProperty({
    description: 'Profile Name',
    example: '0xaplus',
    required: false,
  })
  @IsOptional()
  @IsString()
  ProfileName?: string;

  @ApiProperty({
    description: 'Message SID',
    example: 'SM1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  MessageSid?: string;

  @ApiProperty({
    description: 'SMS Message SID',
    example: 'SM1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  SmsMessageSid?: string;

  @ApiProperty({
    description: 'Account SID',
    example: 'AC1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  AccountSid?: string;

  @ApiProperty({
    description: 'SMS Status',
    example: 'received',
    required: false,
  })
  @IsOptional()
  @IsString()
  SmsStatus?: string;

  @ApiProperty({
    description: 'Recipient number',
    example: 'whatsapp:+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  To?: string;

  @ApiProperty({
    description: 'Number of media',
    example: '0',
    required: false,
  })
  @IsOptional()
  @IsString()
  NumMedia?: string;

  @ApiProperty({
    description: 'Message type',
    example: 'text',
    required: false,
  })
  @IsOptional()
  @IsString()
  MessageType?: string;

  @ApiProperty({
    description: 'Number of segments',
    example: '1',
    required: false,
  })
  @IsOptional()
  @IsString()
  NumSegments?: string;

  @ApiProperty({
    description: 'API Version',
    example: '2010-04-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  ApiVersion?: string;
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

  @ApiProperty({
    description: 'Whether to use WhatsApp template (for business-initiated messages)',
    example: false,
    required: false,
  })
  useTemplate?: boolean;
}
