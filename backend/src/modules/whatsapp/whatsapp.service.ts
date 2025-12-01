import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransfersService } from '../transfers/transfers.service';
import { ReceiveService } from '../receive/receive.service';
import * as twilio from 'twilio';
import * as crypto from 'crypto';


@Injectable()
export class WhatsAppService {
  private logger = new Logger(WhatsAppService.name);
  private twilioClient: twilio.Twilio;
  private templates: any;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly blockchainService: BlockchainService,
    private readonly transfersService: TransfersService,
    private readonly receiveService: ReceiveService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    }

    // Initialize templates with config values
    this.templates = {
      welcome: {
        sid: this.config.get<string>('WHATSAPP_WELCOME_TEMPLATE'),
        name: 'welcome_message'
      },
      transaction_sent: {
        sid: this.config.get<string>('WHATSAPP_TRANSACTION_SENT_TEMPLATE'),
        name: 'transaction_sent'
      },
      transaction_received: {
        sid: this.config.get<string>('WHATSAPP_TRANSACTION_RECEIVED_TEMPLATE'),
        name: 'transaction_received'
      },
      payment_request: {
        sid: this.config.get<string>('WHATSAPP_PAYMENT_REQUEST_TEMPLATE'),
        name: 'payment_request'
      }
    };
  }


    /**
     * Validates Twilio webhook signature to ensure request authenticity
     */
    validateTwilioSignature(
      signature: string,
      url: string,
      rawBody: string
    ): boolean {
      const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
  
      if (!authToken) {
        console.warn('⚠️  TWILIO_AUTH_TOKEN not configured - skipping signature validation');
        return true; // Allow in development if auth token not set
      }
  
      if (!signature) {
        console.error('❌ No X-Twilio-Signature header provided');
        return false;
      }
  
      try {
        // Create the signature validation string: URL + raw body
        const validationString = url + rawBody;
  
        console.log('🔍 Signature validation debug:');
        console.log('URL:', url);
        console.log('Raw body:', rawBody);
        console.log('Validation string:', validationString);
  
        // Generate expected signature using HMAC-SHA1
        const expectedSignature = crypto
          .createHmac('sha1', authToken)
          .update(validationString, 'utf-8')
          .digest('base64');
  
        const isValid = signature === expectedSignature;
  
        if (!isValid) {
          console.error('❌ Webhook signature validation failed');
          console.error('Expected:', expectedSignature);
          console.error('Received:', signature);
        } else {
          console.log('✅ Webhook signature validated successfully');
        }
  
        return isValid;
      } catch (error) {
        console.error('❌ Error validating webhook signature:', error);
        return false;
      }
    }

  async handleIncomingMessage(from: string, body: string): Promise<string> {
    // Extract phone number (remove whatsapp: prefix and + sign if present)
    // Twilio format: "whatsapp:+1234567890" → "1234567890"
    const phoneNumber = from.replace('whatsapp:', '').replace('+', '');

    // Check if user already exists
    let user = await this.userRepo.findOne({
      where: { userWhatsAppId: phoneNumber },
    });

    // If new user, create account and wallet
    if (!user) {
      return await this.onboardNewUser(phoneNumber);
    }

    // Handle commands for existing users
    return await this.handleUserCommand(user, body);
  }

  private async onboardNewUser(phoneNumber: string): Promise<string> {
    try {
      // Generate deterministic user address (required by contract)
      const userAddress =
        await this.blockchainService.getOrGenerateWalletAddress(phoneNumber);

      // Create user in database with userAddress
      // walletAddress will be updated when wallet is actually created on-chain
      await this.usersService.create(phoneNumber, userAddress);

      // Return welcome message with wallet details
      // Note: Wallet is NOT created on-chain yet! We'll create it when they receive first payment
      return this.formatWelcomeMessage(phoneNumber, userAddress);
    } catch (error) {
      this.logger.error('Error onboarding new user:', error);
      return '❌ Sorry, there was an error creating your wallet. Please try again later.';
    }
  }

  private formatWelcomeMessage(
    userWhatsAppId: string,
    userAddress: string,
  ): string {
    return `
🎉 *Welcome to Fluxt!*

Your wallet has been created successfully!

*Wallet Details:*
━━━━━━━━━━━━━━━━━━━━
      • WhatsApp ID: ${userWhatsAppId}
      • User Address: ${userAddress}
━━━━━━━━━━━━━━━━━━━━

📱 *Available Commands:*

💰 *BALANCE* - Check your wallet balance
💼 *WALLET* - View your wallet details
💸 *SEND* - Send money to another user
📥 *RECEIVE* - Generate payment link
🏦 *WITHDRAW* - Withdraw to bank account
❓ *HELP* - Show commands anytime

*Example:*
• Type "BALANCE" to check your balance
• Type "SEND +1234567890 10 USDC" to send $10
• Type "RECEIVE 25 USDC" to request $25

Ready to send and receive money! 🚀
    `.trim();
  }

  private async handleUserCommand(user: User, body: string): Promise<string> {
    const input = body.trim();
    const parts = input.split(' ');
    const command = parts[0].toUpperCase();

    switch (command) {
      case 'BALANCE':
        return this.getBalanceMessage(user);

      case 'HELP':
        return this.getHelpMessage();

      case 'WALLET':
        const depositInfo = user.depositAddress
          ? `\n• Deposit Address: ${user.depositAddress}`
          : '\n• Deposit Address: Not yet generated';
        return `💼 *Your Wallet Details:*\n• WhatsApp ID: ${user.userWhatsAppId}\n• User Address: ${user.userAddress}${depositInfo}`;

      case 'SEND':
        return this.handleSendCommand(user, parts);

      case 'RECEIVE':
        return this.handleReceiveCommand(user, parts);

      default:
        return this.handlePossibleAIMessage(user, input);
    }
  }

  private async getBalanceMessage(user: User): Promise<string> {
    try {
      const usdcAddr = process.env.USDC_ADDRESS ?? '';
      const usdtAddr = process.env.USDT_ADDRESS ?? '';

      // Check balance on user's smart contract wallet (userAddress)
      const [usdcBal, usdtBal] = await Promise.all([
        this.blockchainService.getBalance(user.userAddress, usdcAddr),
        this.blockchainService.getBalance(user.userAddress, usdtAddr),
      ]);

      const usdcAmount = parseFloat(usdcBal.toString()) / 1e6;
      const usdtAmount = parseFloat(usdtBal.toString()) / 1e6;
      const total = usdcAmount + usdtAmount;

      return `💰 *Your Wallet Balance:*

USDC: $${usdcAmount.toFixed(2)}
USDT: $${usdtAmount.toFixed(2)}

Total: $${total.toFixed(2)} USD

Type "HELP" for more options.`;
    } catch (error) {
      this.logger.error('Error fetching balance:', error);
      return '❌ Error fetching balance. Please try again later.';
    }
  }

  private getHelpMessage(): string {
    return `📱 *Fluxt Commands:*

💰 BALANCE - Check your wallet balance
💼 WALLET - View your wallet details
💸 SEND - Send tokens to another user
📥 RECEIVE - Generate payment link
🏦 WITHDRAW - Withdraw to bank account
❓ HELP - Show this message

Need assistance? Contact support!`;
  }

  private async handleSendCommand(user: User, parts: string[]): Promise<string> {
    try {
      // Expected format: SEND +1234567890 10 USDC
      if (parts.length !== 4) {
        return `❌ *Invalid format!*

*Correct format:*
SEND +1234567890 10 USDC

*Example:*
SEND +1234567890 25.50 USDC
SEND +1234567890 10 USDT

💡 *Tip:* Make sure to include the country code (+1, +234, etc.)`;
      }

      const [, toPhoneNumber, amount, token] = parts;

      // Validate token
      if (!['USDC', 'USDT'].includes(token.toUpperCase())) {
        return `❌ Unsupported token: ${token}\n\nSupported tokens: USDC, USDT`;
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return `❌ Invalid amount: ${amount}\n\nPlease enter a valid positive number.`;
      }

      // Clean phone number (remove + if present, we'll add it in users service)
      const cleanPhoneNumber = toPhoneNumber.replace('+', '');

      // Check if recipient exists, if not suggest they join
      let recipient;
      try {
        recipient = await this.usersService.getByWhatsAppId(cleanPhoneNumber);
      } catch (error) {
        return `❌ *Recipient not found!*

The user ${toPhoneNumber} doesn't have a Fluxt wallet yet.

💡 *Ask them to:*
1. Send any message to this number
2. Their wallet will be created automatically
3. Then you can send them money!`;
      }

      // Send the transfer
      const result = await this.transfersService.sendToken(
        user.userWhatsAppId,
        recipient.userWhatsAppId,
        amount,
        token.toUpperCase() as 'USDC' | 'USDT'
      );

      // Notify recipient
      await this.notifyTransactionReceived(recipient.userWhatsAppId, user.userWhatsAppId, amount, token);

      return `✅ *Transfer Successful!*

💸 Sent: $${amount} ${token}
📞 To: ${toPhoneNumber}
🔗 Transaction: ${result.txHash.slice(0, 10)}...

The recipient has been notified! 🎉`;

    } catch (error) {
      this.logger.error('Error in SEND command:', error);
      return `❌ *Transfer failed!*

${error.message || 'Please try again or contact support.'}

💡 *Make sure you have sufficient balance.*`;
    }
  }

  private async handleReceiveCommand(user: User, parts: string[]): Promise<string> {
    try {
      // Expected format: RECEIVE 10 USDC
      if (parts.length !== 3) {
        return `❌ *Invalid format!*

*Correct format:*
RECEIVE 25 USDC

*Example:*
RECEIVE 10.50 USDC
RECEIVE 50 USDT`;
      }

      const [, amount, token] = parts;

      // Validate token
      if (!['USDC', 'USDT'].includes(token.toUpperCase())) {
        return `❌ Unsupported token: ${token}\n\nSupported tokens: USDC, USDT`;
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return `❌ Invalid amount: ${amount}\n\nPlease enter a valid positive number.`;
      }

      // Generate payment link
      const paylink = await this.receiveService.createPaylink(
        user.userWhatsAppId,
        amount,
        token.toUpperCase()
      );

      return `💳 *Payment Request Created!*

💰 Amount: $${amount} ${token}
🔗 Payment Link: ${paylink.paylink}

📱 *Share this link to receive payment:*
"Send me $${amount} ${token}: ${paylink.paylink}"

QR Code has been generated for easy sharing! 📲`;

    } catch (error) {
      this.logger.error('Error in RECEIVE command:', error);
      return `❌ *Failed to create payment request!*

Please try again or contact support.`;
    }
  }

  private async handlePossibleAIMessage(user: User, input: string): Promise<string> {
    // This will be enhanced with AI later
    // For now, provide helpful guidance

    // Check if it looks like a send attempt
    if (input.toLowerCase().includes('send') && input.includes('$')) {
      return `💡 *Looks like you want to send money!*

*Use this format:*
SEND +1234567890 10 USDC

*What you wrote:* "${input}"

Need help? Type "HELP" for all commands.`;
    }

    // Check if it looks like a receive attempt
    if (input.toLowerCase().includes('receive') || input.toLowerCase().includes('request')) {
      return `💡 *Want to request money?*

*Use this format:*
RECEIVE 25 USDC

*What you wrote:* "${input}"

Type "HELP" to see all commands.`;
    }

    return `I received: "${input}"

💡 *Available commands:*
• BALANCE - Check balance
• SEND +phone amount TOKEN
• RECEIVE amount TOKEN
• HELP - Show all commands

*Example:* SEND +1234567890 10 USDC`;
  }

  private async notifyTransactionReceived(recipientWhatsAppId: string, senderWhatsAppId: string, amount: string, token: string): Promise<void> {
    try {
      const message = `💰 *Money Received!*

✅ You received $${amount} ${token}
📞 From: +${senderWhatsAppId}

Type "BALANCE" to check your wallet!`;

      await this.sendMessage(`+${recipientWhatsAppId}`, message, false, 'transaction_received', {
        "1": amount,
        "2": token,
        "3": `+${senderWhatsAppId}`
      });
    } catch (error) {
      this.logger.error('Failed to notify recipient:', error);
    }
  }

  async sendMessage(to: string, message: string, useTemplate: boolean = false, templateType?: string, templateVars?: any): Promise<boolean> {
    if (!this.twilioClient) {
      this.logger.warn('Twilio client not configured');
      return false;
    }

    const from = this.config.get<string>('TWILIO_WHATSAPP_NUMBER');

    if (!from) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is not configured in environment variables');
    }

    // Ensure phone numbers have the + prefix for E.164 format
    const fromNumber = from?.startsWith('+') ? from : `+${from}`;
    const toNumber = to?.startsWith('+') ? to : `+${to}`;

    try {

      this.logger.debug(`Sending WhatsApp message from ${fromNumber} to ${toNumber}`);

      // Check if we're using sandbox (contains "14155238886")
      const isUsingSandbox = fromNumber.includes('14155238886');

      if (useTemplate && !isUsingSandbox) {
        // Use specific template based on templateType or fall back to generic
        const template = templateType && this.templates[templateType]
          ? this.templates[templateType]
          : { sid: this.config.get<string>('WHATSAPP_TEMPLATE_SID') };

        if (!template.sid) {
          this.logger.warn('No WhatsApp template configured, falling back to freeform message');
          throw new Error(`No approved template available for type: ${templateType || 'default'}`);
        }

        // Use template variables if provided, otherwise default structure
        const variables = templateVars || { "1": message };

        await this.twilioClient.messages.create({
          from: `whatsapp:${fromNumber}`,
          to: `whatsapp:${toNumber}`,
          contentSid: template.sid,
          contentVariables: JSON.stringify(variables),
        });
      } else {
        // Send freeform message (works in sandbox or within 24-hour window)
        await this.twilioClient.messages.create({
          from: `whatsapp:${fromNumber}`,
          to: `whatsapp:${toNumber}`,
          body: message,
        });
      }

      return true;
    } catch (error) {
      if (error.code === 63016) {
        this.logger.error(
          `Error 63016: Outside messaging window. Need to use approved template. ` +
          'Consider using sandbox for testing or get templates approved for production.',
        );

        // Retry with template if first attempt failed
        if (!useTemplate) {
          this.logger.log('Retrying with template...');
          return this.sendMessage(to, message, true);
        }
      } else if (error.code === 63007) {
        this.logger.error(
          `WhatsApp Channel not found for number ${from}. ` +
          'Please ensure this number is enabled for WhatsApp in Twilio Console or use the WhatsApp Sandbox number.',
        );
      }
      this.logger.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }
}
