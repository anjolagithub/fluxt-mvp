import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HDNodeWallet, ethers } from 'ethers';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);
  private masterMnemonic: string;

  constructor(private readonly config: ConfigService) {
    // Get master mnemonic from environment (or generate for development)
    const mnemonic = this.config.get<string>('MASTER_MNEMONIC');

    if (!mnemonic) {
      // Development: Generate a new mnemonic (WARNING: This should be stored securely in production!)
      const randomWallet = ethers.Wallet.createRandom() as HDNodeWallet;
      this.masterMnemonic = randomWallet.mnemonic!.phrase;

      this.logger.warn('⚠️  Generated new master mnemonic (DEV MODE):');
      this.logger.warn(`⚠️  ${this.masterMnemonic}`);
      this.logger.warn(
        '⚠️  Add this to .env as MASTER_MNEMONIC for production!',
      );
    } else {
      this.masterMnemonic = mnemonic;
      this.logger.log('✅ Master wallet loaded from mnemonic');
    }
  }

  /**
   * Generates a unique deposit address for a user
   * Uses BIP-44 derivation path: m/44'/60'/0'/0/{index}
   */
  generateDepositAddress(userIndex: number): {
    address: string;
    derivationPath: string;
  } {
    const path = `m/44'/60'/0'/0/${userIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(this.masterMnemonic, path);

    return {
      address: wallet.address,
      derivationPath: path,
    };
  }

  /**
   * Gets the private wallet for a user (for sweeping)
   * CAUTION: Only use this for automated sweeping, never expose to users!
   */
  getWalletForUser(userIndex: number): HDNodeWallet {
    const path = `m/44'/60'/0'/0/${userIndex}`;
    return ethers.HDNodeWallet.fromPhrase(this.masterMnemonic, path);
  }

  /**
   * Sweeps all USDC from a deposit address to the hot wallet
   * Returns transaction hash if successful, null if no balance
   */
  async sweepDeposit(
    userIndex: number,
    hotWalletAddress: string,
    usdcAddress: string,
    provider: ethers.Provider,
    hotWalletPrivateKey: string,
  ): Promise<string | null> {
    try {
      const userWallet = this.getWalletForUser(userIndex).connect(provider);

      // Check USDC balance
      const usdcAbi = [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
      ];
      const usdc = new ethers.Contract(usdcAddress, usdcAbi, userWallet);

      const balance = await usdc.balanceOf(userWallet.address);

      if (balance === 0n) {
        this.logger.log(
          `No USDC balance at ${userWallet.address}, skipping sweep`,
        );
        return null;
      }

      this.logger.log(
        `💰 Sweeping ${ethers.formatUnits(balance, 6)} USDC from ${userWallet.address}`,
      );

      // Check if deposit address has ETH for gas
      const ethBalance = await provider.getBalance(userWallet.address);
      this.logger.log(`   ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

      // If no ETH, send some from hot wallet for gas
      if (ethBalance === 0n) {
        this.logger.log('   📤 Sending ETH for gas from hot wallet...');

        const hotWallet = new ethers.Wallet(hotWalletPrivateKey, provider);

        // Estimate gas for USDC transfer
        const estimatedGas = await usdc.transfer.estimateGas(
          hotWalletAddress,
          balance,
        );

        // Get current gas price
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('0.1', 'gwei');

        // Calculate required ETH (gas * price) with 20% buffer
        const gasRequired = estimatedGas * gasPrice;
        const ethToSend = (gasRequired * 120n) / 100n; // 20% buffer

        this.logger.log(
          `   💸 Sending ${ethers.formatEther(ethToSend)} ETH for gas (${estimatedGas} gas @ ${ethers.formatUnits(gasPrice, 'gwei')} gwei)`,
        );

        // Send ETH from hot wallet to deposit address
        const ethTx = await hotWallet.sendTransaction({
          to: userWallet.address,
          value: ethToSend,
        });

        await ethTx.wait();
        this.logger.log(`   ✅ Gas funded: ${ethTx.hash}`);
      }

      // Transfer all USDC to hot wallet
      this.logger.log('   📤 Transferring USDC to hot wallet...');
      const tx = await usdc.transfer(hotWalletAddress, balance);
      const receipt = await tx.wait();

      this.logger.log(
        `✅ Swept ${ethers.formatUnits(balance, 6)} USDC to hot wallet: ${receipt.hash}`,
      );

      return receipt.hash;
    } catch (error) {
      this.logger.error(`Error sweeping deposit for user ${userIndex}:`, error);
      throw error;
    }
  }

  /**
   * Gets the master wallet address (for reference only)
   */
  getMasterWalletAddress(): string {
    const masterWallet = ethers.HDNodeWallet.fromPhrase(this.masterMnemonic);
    return masterWallet.address;
  }

  /**
   * Gets the master mnemonic (ONLY FOR SECURE BACKUP!)
   * WARNING: Never expose this in production logs or API responses!
   */
  getMasterMnemonic(): string {
    return this.masterMnemonic;
  }
}
