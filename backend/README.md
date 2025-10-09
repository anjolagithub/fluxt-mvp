# Fluxt Backend - Custodial Cryptocurrency Wallet API

A production-ready NestJS backend for a custodial cryptocurrency wallet system with WhatsApp integration, enabling seamless USDC/USDT transfers on Base Sepolia testnet.

## 🏗️ Architecture Overview

### Core Concept

Fluxt implements a **hybrid custodial wallet architecture** combining:

1. **Smart Contract Wallets** - User balances tracked on-chain via `FluxtWalletFactory` contract
2. **HD Wallet Deposits** - Unique deposit addresses per user using BIP-44 derivation (m/44'/60'/0'/0/{index})
3. **Automated Sweeping** - Background service monitors deposits and sweeps to hot wallet
4. **WhatsApp Interface** - User interactions via WhatsApp bot (Twilio)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                              │
│  WhatsApp Messages ──► Twilio Webhook ──► WhatsApp Controller  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Wallet     │  │  Transfers   │  │   Receive    │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                         │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Blockchain    │  │  Deposit        │  │  Database       │ │
│  │  Service       │  │  Monitor        │  │  (PostgreSQL)   │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                           │
│   Base Sepolia ──► FluxtWalletFactory ──► USDC/USDT Tokens     │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### 1. **Custodial Wallet Management**
- **Deterministic User Addresses**: Generated from WhatsApp ID using `keccak256(userWhatsAppId)`
- **On-Chain Balance Tracking**: Factory contract maintains internal ledger
- **Automated Wallet Creation**: Wallets created on first user interaction

### 2. **HD Wallet Deposit System**
- **Unique Deposit Addresses**: Each user gets a BIP-44 derived address (m/44'/60'/0'/0/{index})
- **Automated Sweeping**: Background monitor polls for deposits every 12 seconds
- **Auto Gas Funding**: Deposits receive ETH for gas before USDC sweep
- **Hot Wallet Integration**: All funds consolidated in secure hot wallet

### 3. **Deposit Monitoring**
- **Polling-Based Architecture**: Uses `queryFilter()` instead of event listeners (avoids RPC filter expiration)
- **Block Tracking**: Tracks last checked block to prevent duplicate processing
- **Address Refresh**: Updates monitored addresses every 30 seconds
- **Immediate Registration**: New wallets instantly added to monitoring

### 4. **WhatsApp Bot Integration**
- **User Onboarding**: Automatic wallet creation on first message
- **Balance Queries**: Real-time balance checks via WhatsApp
- **Transaction Notifications**: (Ready for implementation)
- **Command Interface**: `BALANCE`, `WALLET`, `HELP` commands

## 📁 Project Structure

```
backend/
├── src/
│   ├── common/                    # Shared utilities
│   │   ├── filters/               # Exception handling
│   │   ├── interceptors/          # Logging, response transformation
│   │   └── validators/            # Custom validators (phone numbers)
│   │
│   ├── infra/                     # Infrastructure layer
│   │   ├── entities/              # TypeORM entities
│   │   │   ├── user.entity.ts
│   │   │   ├── transaction.entity.ts
│   │   │   ├── paylink.entity.ts
│   │   │   └── withdrawal.entity.ts
│   │   └── typeorm/               # Database configuration
│   │
│   ├── modules/                   # Feature modules
│   │   ├── blockchain/            # Smart contract interactions
│   │   │   └── blockchain.service.ts
│   │   │
│   │   ├── deposit/               # HD wallet & monitoring
│   │   │   ├── deposit.service.ts          # HD wallet generation
│   │   │   └── deposit-monitor.service.ts  # Deposit polling
│   │   │
│   │   ├── wallet/                # Wallet operations
│   │   │   ├── wallet.controller.ts
│   │   │   └── wallet.service.ts
│   │   │
│   │   ├── transfers/             # Token transfers
│   │   │   ├── transfers.controller.ts
│   │   │   └── transfers.service.ts
│   │   │
│   │   ├── receive/               # Payment links & QR codes
│   │   │   ├── receive.controller.ts
│   │   │   └── receive.service.ts
│   │   │
│   │   ├── withdrawals/           # Fiat withdrawals
│   │   │   ├── withdrawals.controller.ts
│   │   │   └── withdrawals.service.ts
│   │   │
│   │   ├── whatsapp/              # WhatsApp bot
│   │   │   ├── whatsapp.controller.ts
│   │   │   └── whatsapp.service.ts
│   │   │
│   │   ├── fx/                    # Exchange rates
│   │   │   └── fx.service.ts
│   │   │
│   │   └── users/                 # User management
│   │       ├── users.controller.ts
│   │       └── users.service.ts
│   │
│   ├── scripts/                   # Utility scripts
│   │   ├── check-balance.ts
│   │   ├── send-test-tokens.ts
│   │   └── check-fluxt-wallet.ts
│   │
│   ├── app.module.ts              # Root module
│   └── main.ts                    # Application entry point
│
├── test/                          # E2E tests
├── FluxtWalletFactory.abi.json    # Smart contract ABI
└── package.json
```

## 🔧 Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | NestJS | Backend framework with dependency injection |
| **Language** | TypeScript | Type-safe development |
| **Database** | PostgreSQL | Relational data storage |
| **ORM** | TypeORM | Database abstraction |
| **Blockchain** | Ethers.js v6 | Ethereum interactions |
| **Network** | Base Sepolia | Layer 2 testnet (low gas fees) |
| **Validation** | class-validator | DTO validation |
| **API Docs** | Swagger/OpenAPI | Automatic API documentation |
| **WhatsApp** | Twilio | Messaging integration |
| **QR Codes** | qrcode | Payment link generation |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Base Sepolia RPC endpoint (e.g., Alchemy, Infura)
- Deployed FluxtWalletFactory contract
- Twilio account (for WhatsApp)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb fluxt_db
   
   # TypeORM will auto-sync schema on first run (development)
   ```

4. **Generate HD wallet master mnemonic** (first time only)
   ```bash
   npm run start:dev
   # Check logs for generated mnemonic
   # Add to .env as MASTER_MNEMONIC
   ```

5. **Start development server**
   ```bash
   npm run start:dev
   # Server runs on http://localhost:3000
   # Swagger docs: http://localhost:3000/api
   ```

## 🔑 Environment Configuration

### Critical Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/fluxt_db` |
| `RPC_URL` | Base Sepolia RPC endpoint | `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `PRIVATE_KEY` | Hot wallet private key (64 hex chars) | `0x1234...` |
| `CONTRACT_ADDRESS` | FluxtWalletFactory address | `0x19FE33C3B925a09C3522aB87Bdd56e3faDfa08C1` |
| `MASTER_MNEMONIC` | HD wallet seed phrase | `word1 word2 ... word12` |
| `HOT_WALLET_ADDRESS` | Hot wallet address (derived from PRIVATE_KEY) | `0x1Bd8005439Fc4C8f533A5b2e89165146d6098d30` |
| `USDC_ADDRESS` | USDC token contract address | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `AUTO_START_DEPOSIT_MONITOR` | Enable auto-monitoring | `true` |

### Optional Variables

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` - WhatsApp integration
- `EXCHANGE_RATE_API_KEY` - Fiat exchange rate API
- `PORT` - Server port (default: 3000)

## 💡 How It Works

### User Onboarding Flow

```
1. User sends WhatsApp message
   ↓
2. WhatsApp webhook receives message
   ↓
3. Check if user exists in database
   ↓
4. If new user:
   • Generate deterministic userAddress from phone number
   • Generate HD wallet depositAddress (index = user count)
   • Save user to database
   • Register depositAddress with monitor
   • Send welcome message
   ↓
5. If existing user:
   • Process command (BALANCE, WALLET, etc.)
```

### Deposit Flow

```
1. User receives unique depositAddress (e.g., 0xABC...)
   ↓
2. External sender sends USDC to depositAddress
   ↓
3. DepositMonitorService polls blockchain (every 12s)
   ↓
4. Detects USDC transfer to depositAddress
   ↓
5. Auto-funds depositAddress with ETH for gas
   ↓
6. Sweeps USDC from depositAddress → hotWallet
   ↓
7. Credits user's balance in FluxtWalletFactory contract
   ↓
8. User can now send/receive tokens within Fluxt
```

### Transfer Flow

```
1. User A sends 10 USDC to User B
   ↓
2. Validate User A has sufficient balance
   ↓
3. Call FluxtWalletFactory.sendToken(userA, userB, USDC, 10e6)
   ↓
4. Contract updates internal balances:
   • userA: balance -= 10 USDC
   • userB: balance += 10 USDC
   ↓
5. Transaction saved to database
   ↓
6. Both users notified (optional)
```

## 🔒 Security Considerations

### Private Key Management
- **Hot Wallet**: Store `PRIVATE_KEY` in secure environment variables
- **Master Mnemonic**: Critical! Back up securely (KMS, HSM in production)
- Never commit `.env` file to version control

### Gas Management
- Hot wallet must maintain ETH balance for:
  - Funding deposit addresses (before sweeps)
  - Executing contract transactions
  - Recommended: Monitor balance and alert when low

### Smart Contract Security
- Factory contract controls all user funds (custodial model)
- Only hot wallet can execute transactions
- Users trust Fluxt to manage their assets

## 🛠️ Utility Scripts

Run scripts with `npm run script:<name>`

| Script | Command | Purpose |
|--------|---------|---------|
| `check-balance` | `npm run script:check-balance <address>` | Check ETH and USDC balance |
| `send-tokens` | `npm run script:send-tokens` | Deposit USDC to a user |
| `check-fluxt-wallet` | `npm run script:check-fluxt-wallet <userAddress>` | Check user's Fluxt wallet status |

### Example: Check Balance
```bash
npm run script:check-balance 0x1Bd8005439Fc4C8f533A5b2e89165146d6098d30
```

## 📡 API Endpoints

### Wallet Management
- `POST /wallet/create` - Create new wallet
- `GET /wallet/balance/:userWhatsAppId` - Get wallet balance

### Transfers
- `POST /transfers/send` - Send tokens between users

### Receive
- `POST /receive/paylink` - Generate payment link with QR code

### Withdrawals
- `POST /withdrawals/create` - Initiate withdrawal to fiat

### WhatsApp
- `POST /whatsapp/webhook` - Twilio webhook endpoint
- `POST /whatsapp/send` - Send WhatsApp message

**API Documentation**: Available at `http://localhost:3000/api` (Swagger UI)

## 🐛 Debugging & Troubleshooting

### Common Issues

#### 1. **Deposit Monitor Not Working**
```bash
# Check if monitoring is enabled
AUTO_START_DEPOSIT_MONITOR=true

# Check logs for monitoring status
# Should see: "🚀 Starting deposit monitoring..."
```

#### 2. **RPC Filter Errors**
The system uses polling (`queryFilter()`) instead of event listeners to avoid "filter not found" errors. If you still see errors, increase polling interval in `deposit-monitor.service.ts`.

#### 3. **Insufficient Gas**
```bash
# Check hot wallet ETH balance
npm run script:check-balance <HOT_WALLET_ADDRESS>

# Get testnet ETH from faucet
# https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
```

#### 4. **Database Connection Failed**
```bash
# Verify PostgreSQL is running
pg_isready

# Test connection string
psql $DATABASE_URL
```

### Debug Mode
```bash
npm run start:debug
# Attaches debugger on port 9229
```

## 📈 Performance Optimization

### Database Indexes
- `user.userWhatsAppId` - Unique index for fast lookups
- `user.depositAddress` - Unique index for deposit monitoring
- `transaction.txHash` - Unique index for transaction tracking

### Caching Strategy
- Exchange rates cached (reduce API calls when balance = 0)
- Deposit address list refreshed every 30s (not per-request)

### Polling Intervals
- **Deposit monitoring**: 12s (checks multiple blocks per poll)
- **Address refresh**: 30s (picks up new wallets)
- Adjust based on RPC rate limits

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Manual Testing
1. Create wallet via API
2. Send test USDC to deposit address
3. Watch logs for sweep operation
4. Check balance via API

## 🚀 Production Deployment

### Checklist
- [ ] Use production PostgreSQL database
- [ ] Secure `PRIVATE_KEY` and `MASTER_MNEMONIC` (KMS/HSM)
- [ ] Use production RPC endpoint (Alchemy, Infura)
- [ ] Deploy on Base Mainnet (update contract addresses)
- [ ] Set up monitoring and alerting
- [ ] Configure CORS for production domain
- [ ] Enable rate limiting
- [ ] Set up SSL/TLS
- [ ] Configure backup strategy for database
- [ ] Document disaster recovery procedures

### Environment
```bash
NODE_ENV=production
npm run build
npm run start:prod
```

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Base Network Documentation](https://docs.base.org/)
- [TypeORM Documentation](https://typeorm.io/)
- [BIP-44 HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)

## 🤝 Contributing

1. Create feature branch from `master`
2. Make changes with clear commit messages
3. Test thoroughly
4. Submit pull request

## 📝 License

UNLICENSED - Proprietary Software

---

**Built with ❤️ using NestJS and Ethers.js**
