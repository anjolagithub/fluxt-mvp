import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookDto, SendWhatsAppMessageDto } from './dto/whatsapp.dto';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'WhatsApp webhook for incoming messages' })
  @ApiResponse({ status: 200, description: 'Message processed successfully' })
  async handleWebhook(
    @Body() body: WhatsAppWebhookDto,
  ): Promise<{ message: string }> {
    const from = body.From;
    const messageBody = body.Body;

    console.log(`Received WhatsApp message from ${from}: ${messageBody}`);

    try {
      const response = await this.whatsappService.handleIncomingMessage(
        from,
        messageBody,
      );

      // Send response back via WhatsApp
      await this.whatsappService.sendMessage(
        from.replace('whatsapp:', ''),
        response,
      );

      return { message: 'Message processed successfully' };
    } catch (error) {
      console.error('Error processing WhatsApp message:', error);
      return { message: 'Error processing message' };
    }
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a WhatsApp message to a user' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(
    @Body() body: SendWhatsAppMessageDto,
  ): Promise<{ success: boolean }> {
    try {
      await this.whatsappService.sendMessage(body.to, body.message);
      return { success: true };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false };
    }
  }
}
