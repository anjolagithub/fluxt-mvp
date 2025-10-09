import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('withdrawals')
@Controller('withdraw')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate a withdrawal to fiat currency' })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Withdrawal of $100.00 USDC (₦150000.00) initiated',
        },
        status: { type: 'string', example: 'processing' },
        estimatedTime: { type: 'string', example: '2-3 business days' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async withdraw(@Body() body: CreateWithdrawalDto) {
    const { id, amount, token } = body;
    return this.withdrawalsService.withdraw(id, amount, token);
  }
}
