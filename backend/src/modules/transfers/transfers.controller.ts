import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SendTokenDto } from './dto/send-token.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@Controller()
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send tokens from one user to another' })
  @ApiResponse({
    status: 201,
    description: 'Transfer initiated successfully',
    schema: {
      type: 'object',
      properties: {
        txHash: { type: 'string', example: '0x1234567890abcdef...' },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async send(@Body() body: SendTokenDto) {
    const { fromid, toid, amount, token } = body;
    return this.transfersService.sendToken(fromid, toid, amount, token);
  }
}
