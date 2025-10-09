import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreatePaylinkDto } from './dto/create-paylink.dto';
import { ReceiveService } from './receive.service';

@ApiTags('receive')
@Controller('receive')
export class ReceiveController {
  constructor(private readonly receiveService: ReceiveService) {}

  @Post()
  @ApiOperation({ summary: 'Create a payment link with QR code' })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
    schema: {
      type: 'object',
      properties: {
        paylink: {
          type: 'string',
          example: 'https://www.usefluxt.com/pay/a1b2c3d4',
        },
        qrCode: {
          type: 'string',
          example: 'data:image/png;base64,iVBORw0KG...',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createPaylink(@Body() body: CreatePaylinkDto) {
    const { userWhatsAppId, amount, token } = body;
    return this.receiveService.createPaylink(userWhatsAppId, amount, token);
  }
}
