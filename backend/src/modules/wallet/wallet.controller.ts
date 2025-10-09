import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('create-wallet')
  @ApiOperation({ summary: 'Create a new wallet for a user' })
  @ApiResponse({
    status: 201,
    description: 'Wallet created successfully',
    schema: {
      type: 'object',
      properties: {
        userAddress: {
          type: 'string',
          description: 'Deterministic user address for smart contract wallet',
          example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        },
        depositAddress: {
          type: 'string',
          description: 'HD wallet address for receiving external deposits',
          example: '0x1234567890abcdef1234567890abcdef12345678',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createWallet(@Body() body: CreateWalletDto) {
    return this.walletService.createWallet(body.userWhatsAppId);
  }

  @Get('balance/:userWhatsAppId')
  @ApiOperation({ summary: 'Get wallet balance for a user' })
  @ApiParam({
    name: 'userWhatsAppId',
    description: 'WhatsApp User ID (phone number)',
    example: '2348123189656',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        tokens: {
          type: 'object',
          properties: {
            USDC: {
              type: 'object',
              properties: {
                amount: { type: 'string', example: '100.00' },
                usd: { type: 'string', example: '100.00' },
                ngn: { type: 'string', example: '150000.00' },
              },
            },
            USDT: {
              type: 'object',
              properties: {
                amount: { type: 'string', example: '50.00' },
                usd: { type: 'string', example: '50.00' },
                ngn: { type: 'string', example: '75000.00' },
              },
            },
          },
        },
        total: {
          type: 'object',
          properties: {
            usd: { type: 'string', example: '150.00' },
            ngn: { type: 'string', example: '225000.00' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getBalance(@Param('userWhatsAppId') userWhatsAppId: string) {
    return this.walletService.getBalance(userWhatsAppId);
  }
}
