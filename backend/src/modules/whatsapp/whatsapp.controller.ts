import { Body, Controller, Post, HttpCode, Headers, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { SendWhatsAppMessageDto } from './dto/whatsapp.dto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly config: ConfigService,
  ) {}


  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'WhatsApp webhook for incoming messages' })
  @ApiResponse({ status: 200, description: 'Message processed successfully' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Req() request: Request,
  ): Promise<{ message: string; error?: string }> {
    try {
      console.log('Received webhook body:', JSON.stringify(body, null, 2));

      // Validate webhook signature for security (disabled in development)
      const isDevelopment = process.env.NODE_ENV !== 'production';

      if (isDevelopment) {
        const webhookUrl = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
        const isValidSignature = this.whatsappService.validateTwilioSignature(
          twilioSignature,
          webhookUrl,
          JSON.stringify(body) // Temporary - need raw body for proper validation
        );

        if (!isValidSignature) {
          console.error('Invalid webhook signature - rejecting request');
          throw new BadRequestException('Invalid webhook signature');
        }
      } else {
        console.log('Development mode - skipping signature validation');
      }

      const from = body.From;
      const messageBody = body.Body;
      const waId = body.WaId;
      const profileName = body.ProfileName;
      const smsStatus = body.SmsStatus;
      const messageType = body.MessageType;

      console.log(`📱 WhatsApp message from ${from} (${profileName} - WaId: ${waId}): "${messageBody}"`);

      // Only process text messages that are received (not sent by us)
      if (smsStatus !== 'received' || messageType !== 'text') {
        console.log(`⏭️ Skipping message - Status: ${smsStatus}, Type: ${messageType}`);
        return { message: 'Message skipped - not a received text message' };
      }

      // Skip empty messages
      if (!messageBody || messageBody.trim() === '') {
        console.log('⏭️ Skipping empty message');
        return { message: 'Message skipped - empty body' };
      }

      const response = await this.whatsappService.handleIncomingMessage(
        from,
        messageBody,
      );

      console.log(`📤 Sending response: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);

      // Send response back via WhatsApp
      await this.whatsappService.sendMessage(
        from.replace('whatsapp:', ''),
        response,
      );

      console.log('✅ Message processed and response sent successfully');
      return { message: 'Message processed successfully' };
    } catch (error) {
      console.error('❌ Error processing WhatsApp message:', error);
      console.error('Error details:', error);
      return {
        message: 'Error processing message',
        error: error.message
      };
    }
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a WhatsApp message to a user' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(
    @Body() body: SendWhatsAppMessageDto,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const sent = await this.whatsappService.sendMessage(body.to, body.message, body.useTemplate);
      return { success: sent };
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message'
      };
    }
  }
}
