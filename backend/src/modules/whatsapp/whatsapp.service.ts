import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import twilio from 'twilio';

@Injectable()
export class WhatsAppService {
  private twilioClient: twilio.Twilio;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly blockchainService: BlockchainService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      // this.twilioClient = twilio(accountSid, authToken);
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
      console.error('Error onboarding new user:', error);
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

You can now:
💵 Send money
💰 Receive payments
📊 Check your balance

Type *help* to see all available commands.
    `.trim();
  }

  private async handleUserCommand(user: User, body: string): Promise<string> {
    const command = body.trim().toUpperCase();

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

      default:
        return `I received: "${body}"\n\nType "HELP" to see available commands.`;
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
      console.error('Error fetching balance:', error);
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

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.twilioClient) {
      console.warn('Twilio client not configured');
      return;
    }

    try {
      const from = this.config.get<string>('TWILIO_WHATSAPP_NUMBER');
      await this.twilioClient.messages.create({
        from: `whatsapp:${from}`,
        to: `whatsapp:${to}`,
        body: message,
      });
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }
}
