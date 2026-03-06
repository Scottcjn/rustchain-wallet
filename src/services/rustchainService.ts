// RustChain API Service
// Connects to the RustChain node for balance checks, transfers, and status

const RUSTCHAIN_API = import.meta.env.VITE_RUSTCHAIN_API || "https://rustchain.org";

export interface WalletBalance {
  miner_id: string;
  rtc: number;
  pending_in: number;
  pending_out: number;
}

export interface TransferResult {
  ok: boolean;
  pending_id?: number;
  error?: string;
  verified?: boolean;
}

export interface NodeHealth {
  ok: boolean;
  version: string;
  uptime_s: number;
}

export interface EpochInfo {
  epoch: number;
  slot: number;
  time_remaining: number;
}

export interface MinerInfo {
  miner_id: string;
  device_arch: string;
  last_attest: number;
}

export class RustChainService {
  /**
   * Check node health
   */
  static async getHealth(): Promise<NodeHealth> {
    const response = await fetch(`${RUSTCHAIN_API}/health`);
    if (!response.ok) throw new Error("Node unreachable");
    return response.json();
  }

  /**
   * Get current epoch info
   */
  static async getEpoch(): Promise<EpochInfo> {
    const response = await fetch(`${RUSTCHAIN_API}/epoch`);
    if (!response.ok) throw new Error("Failed to fetch epoch");
    return response.json();
  }

  /**
   * Get wallet balance by miner_id or RTC address
   */
  static async getBalance(walletId: string): Promise<WalletBalance> {
    try {
      const response = await fetch(`${RUSTCHAIN_API}/wallet/balance?miner_id=${encodeURIComponent(walletId)}`);
      if (!response.ok) {
        // Wallet may not exist yet - return zero
        return { miner_id: walletId, rtc: 0, pending_in: 0, pending_out: 0 };
      }
      return response.json();
    } catch (error) {
      console.error("Error fetching balance:", error);
      return { miner_id: walletId, rtc: 0, pending_in: 0, pending_out: 0 };
    }
  }

  /**
   * Send a signed transfer (Ed25519)
   */
  static async sendSignedTransfer(
    fromAddress: string,
    toAddress: string,
    amountRtc: number,
    memo: string,
    nonce: number,
    signature: string,
    publicKey: string
  ): Promise<TransferResult> {
    try {
      const response = await fetch(`${RUSTCHAIN_API}/wallet/transfer/signed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_address: fromAddress,
          to_address: toAddress,
          amount_rtc: amountRtc,
          memo,
          nonce,
          signature,
          public_key: publicKey,
        }),
      });
      return response.json();
    } catch (error) {
      console.error("Error sending transfer:", error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get active miners list
   */
  static async getMiners(): Promise<MinerInfo[]> {
    try {
      const response = await fetch(`${RUSTCHAIN_API}/api/miners`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : data.miners || [];
    } catch {
      return [];
    }
  }

  /**
   * Get Hall of Fame leaderboard
   */
  static async getHallOfFame(): Promise<unknown[]> {
    try {
      const response = await fetch(`${RUSTCHAIN_API}/api/hall_of_fame`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  /**
   * Validate RTC address format
   * RTC addresses start with "RTC" followed by 40 hex chars
   * Or can be a named wallet (alphanumeric + hyphens)
   */
  static isValidAddress(address: string): boolean {
    // RTC hex address: RTC + 40 hex chars
    if (/^RTC[0-9a-f]{40}$/i.test(address)) return true;
    // Named wallet: 3-50 chars, alphanumeric + hyphens
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,49}$/.test(address)) return true;
    return false;
  }

  /**
   * Get explorer URL for a wallet
   */
  static getExplorerUrl(walletId: string): string {
    return `${RUSTCHAIN_API}/explorer/#/wallet/${walletId}`;
  }
}
