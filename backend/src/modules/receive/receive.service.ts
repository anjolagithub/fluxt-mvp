import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paylink } from '../../infra/entities/paylink.entity';
import * as QRCode from 'qrcode';

export interface CreatePaylinkResponse {
  paylink: string;
  qrCode: string;
}

@Injectable()
export class ReceiveService {
  constructor(
    @InjectRepository(Paylink)
    private readonly paylinkRepo: Repository<Paylink>,
  ) {}

  /**
   * Generates a unique payment link ID
   */
  private generateId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  /**
   * Creates a payment link with QR code for receiving payments
   */
  async createPaylink(
    userWhatsAppId: string,
    amount: string,
    token: string,
  ): Promise<CreatePaylinkResponse> {
    // Generate unique ID for the paylink
    const id = this.generateId();
    const paylink = `https://www.usefluxt.com/pay/${id}`;

    // Save paylink to database
    await this.paylinkRepo.save(
      this.paylinkRepo.create({
        id,
        user: { userWhatsAppId },
        amount,
        token,
        status: 'active',
      }),
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(paylink);

    return { paylink, qrCode };
  }
}
