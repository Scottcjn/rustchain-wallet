import React, { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as bip39 from "bip39";
import { ethers } from "ethers";
import { loadFromChromeStorage, saveToBrowserStorage, clearBrowserStorage } from "../lib/utils";

/**
 * RustChain address derivation:
 * 1. Generate BIP39 mnemonic (24 words)
 * 2. Derive HD wallet using m/44'/429'/0'/0 path
 * 3. Take public key bytes
 * 4. SHA256 hash the public key
 * 5. Address = "RTC" + first 40 hex chars of SHA256
 *
 * This matches the server-side Ed25519 address format.
 * Note: Full Ed25519 signing requires nacl/tweetnacl library.
 * For now we use ethers secp256k1 keys with RTC address format.
 */
function deriveRTCAddress(publicKey: string): string {
  // Remove 0x prefix if present, and the 04 uncompressed prefix
  const cleanKey = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;
  const hash = ethers.sha256("0x" + cleanKey);
  // RTC + first 40 hex chars of SHA256 hash (without 0x prefix)
  return "RTC" + hash.slice(2, 42);
}

interface WalletContextProps { 
  mnemonic: string | null;
  privKey: string | null;
  address: string | null;
  token: string | null;
  password: string | null;
  setMnemonicState: (mnemonic: string | null) => void;
  setPrivKeyState: (privKey: string | null) => void;
  newWallet: () => void;
  importWallet: (mnemonic: string) => void;
  setTokenState: () => void;
  clearTokenState: () => void;
  setPasswordState: (password: string) => void;
  clearStorage: () => void;
}

const WalletContext = createContext<WalletContextProps | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [privKey, setPrivKey] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const newWallet = async (): Promise<void> => {
    try {
      const mnemonic = bip39.generateMnemonic();
      const rootNode = ethers.HDNodeWallet.fromPhrase(mnemonic, "", "m/44'/429'/0'/0");
      const childNode = rootNode.deriveChild(0);
      const rtcAddress = deriveRTCAddress(childNode.publicKey);
      const privateKey = childNode.privateKey;
      
      setMnemonicState(mnemonic);
      setPrivKeyState(privateKey);
      setAddressState(rtcAddress);
      
    } catch (error) {
      console.log("Error creating new wallet:", error);
    }
  };

  const importWallet = async (mnemonic: string): Promise<void> => {
    try {
      const rootNode = ethers.HDNodeWallet.fromPhrase(mnemonic, "", "m/44'/429'/0'/0");
      const childNode = rootNode.deriveChild(0);
      const rtcAddress = deriveRTCAddress(childNode.publicKey);
      const privateKey = childNode.privateKey;
      
      setMnemonicState(mnemonic);
      setPrivKeyState(privateKey);
      setAddressState(rtcAddress);
      
    } catch (error) {
      console.log("Error importing wallet:", error);
    }
  };

  const setTokenState = (): void => {
    const token = Date.now() + 5 * 60 * 1000;
    setToken(token.toString());
    saveToBrowserStorage("token", token.toString());
  };

  const clearTokenState = (): void => {
    setToken("0");
    saveToBrowserStorage("token", "0");
  };

  const setPasswordState = (password: string): void => {
    setPassword(password);
    saveToBrowserStorage("password", password);
  };

  const setMnemonicState = (mnemonic: string | null): void => {
    setMnemonic(mnemonic);
    saveToBrowserStorage("mnemonic", mnemonic);
  };

  const setPrivKeyState = (privKey: string | null): void => {
    setPrivKey(privKey);
    saveToBrowserStorage("privKey", privKey);
  };

  const setAddressState = (address: string | null): void => {
    setAddress(address);
    saveToBrowserStorage("address", address);
  };

  const clearStorage = async (): Promise<void> => {
    try {
      await clearBrowserStorage();
      setMnemonic(null);
      setPrivKey(null);
      setAddress(null);
      setToken(null);
      setPassword(null);
      console.log("All wallet data cleared successfully");
    } catch (error) {
      console.error("Error clearing wallet storage:", error);
    }
  };

  useEffect(() => {
    loadFromChromeStorage("mnemonic", setMnemonic);
    loadFromChromeStorage("privKey", setPrivKey);
    loadFromChromeStorage("password", setPassword);
    loadFromChromeStorage("token", setToken);
    loadFromChromeStorage("address", setAddress);
  }, []);

  return (
    <WalletContext.Provider
      value={
        { 
          mnemonic, 
          privKey, 
          address, 
          token, 
          password, 
          setMnemonicState, 
          setPrivKeyState,
          newWallet, 
          importWallet, 
          setTokenState, 
          clearTokenState, 
          setPasswordState, 
          clearStorage 
        }
      }
    >
      {children}
    </WalletContext.Provider>
  );
}

export default WalletContext;
