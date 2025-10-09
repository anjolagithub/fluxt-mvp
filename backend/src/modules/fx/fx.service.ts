import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';

export type FxRates = { NGN: number; GBP: number };

@Injectable()
export class FxService {
  private cache?: { rates: FxRates; fetchedAt: number };

  constructor(private readonly http: HttpService) {}

  async getRates(): Promise<FxRates> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < 5 * 60 * 1000)
      return this.cache.rates;

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      : 'https://api.exchangerate.host/latest?base=USD';

    const data = await firstValueFrom(
      this.http.get(url).pipe(map((r) => r.data)),
    );

    const ratesSource = data.rates ?? data.conversion_rates;
    console.log('Fetched FX rates:', ratesSource);
    const rates: FxRates = {
      NGN: Number(ratesSource?.NGN),
      GBP: Number(ratesSource?.GBP),
    };
    this.cache = { rates, fetchedAt: now };
    return rates;
  }

  convert(
    amountUsd: string | number,
    target: keyof FxRates,
    rates: FxRates,
  ): string {
    const usd =
      typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd;
    return (usd * rates[target]).toFixed(2);
  }
}
