# RustChain Wallet

A web-based HD wallet for the **RustChain** network (RTC tokens).

Built with React + TypeScript + Vite. Supports BIP39 seed phrases, Ed25519 signing, and connects to the RustChain node API.

> **Status:** WIP — balance checking works, signed transfers in progress.

## Features

- BIP39 24-word seed phrase generation & recovery
- Ed25519 keypair-based wallet addresses
- RTC balance checking via RustChain node API
- Signed transfers (Ed25519)
- Lock screen with session timeout
- Browser extension compatible (Chrome storage API)

## Quick Start

```bash
npm install
cp .env.sample .env
npm run dev
```

Then open http://localhost:5173

## Configuration

Edit `.env`:
```
VITE_RUSTCHAIN_API=https://rustchain.org
VITE_APP_ENCRYPTION_KEY=your-secret-key
```

## RustChain API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Node health check |
| `GET /epoch` | Current epoch/slot info |
| `GET /api/miners` | Active miners list |
| `GET /wallet/balance?miner_id=X` | Wallet balance |
| `POST /wallet/transfer/signed` | Ed25519 signed transfer |
| `GET /api/hall_of_fame` | Leaderboard |

## Address Formats

- **Named wallet**: `my-wallet-name` (alphanumeric + hyphens, 3-50 chars)
- **RTC hex address**: `RTC` + 40 hex chars (e.g., `RTCa1b2c3d4e5f6...`)

## Original Credit

Originally built by [@cryptodj413](https://github.com/cryptodj413) as an Ergo-based wallet.
Forked and adapted by [@Scottcjn](https://github.com/Scottcjn) for the RustChain network.

## License

MIT
