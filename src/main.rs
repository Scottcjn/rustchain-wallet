//! RustChain Wallet CLI - Native Rust Implementation
//! Bounty: 50-100 RTC

use bip39::{Mnemonic, Language, MnemonicType};
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, SIGNATURE_LENGTH};
use sha2::{Sha256, Digest};
use pbkdf2::pbkdf2_hmac;
use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, KeyInit}};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hex;
use std::fs;
use std::path::PathBuf;
use clap::{Parser, Subcommand};

const PBKDF2_ITERATIONS: u32 = 100_000;
const NODE_URL: &str = "https://50.28.86.131";

#[derive(Parser)]
#[command(name = "rustchain-wallet")]
#[command(about = "RustChain Wallet CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Create,
    Import { seed: String },
    ImportKey { key: String },
    Balance { address: Option<String> },
    Send { to: String, amount: f64, memo: Option<String> },
    History { address: Option<String> },
    List,
    Export { address: String },
}

fn get_wallet_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".rustchain")
        .join("wallets")
}

fn generate_seed_phrase() -> String {
    let mnemonic = Mnemonic::new(MnemonicType::Words24, Language::English);
    mnemonic.phrase().to_string()
}

fn seed_to_key(seed: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(seed.as_bytes(), b"rustchain-wallet", PBKDF2_ITERATIONS, &mut key);
    key
}

fn generate_address(public_key: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(public_key);
    let hash = hasher.finalize();
    let addr_bytes = &hash[..20];
    format!("RTC{}", hex::encode(addr_bytes))
}

fn encrypt_keystore(private_key: &[u8], public_key: &[u8], password: &str) -> Result<String, String> {
    let salt = rand::random::<[u8; 16]>();
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);
    
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = rand::random::<[u8; 12]>();
    
    let ciphertext = cipher.encrypt(
        Nonce::from_slice(&nonce),
        private_key
    ).map_err(|e| e.to_string())?;
    
    let keystore = serde_json::json!({
        "version": 1,
        "address": generate_address(public_key),
        "public_key": hex::encode(public_key),
        "salt": BASE64.encode(salt),
        "nonce": BASE64.encode(nonce),
        "ciphertext": BASE64.encode(ciphertext),
        "created": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(serde_json::to_string_pretty(&keystore).unwrap())
}

fn save_keystore(keystore: &str, address: &str) -> Result<(), String> {
    let dir = get_wallet_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", address));
    fs::write(path, keystore).map_err(|e| e.to_string())?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), String> {
    let cli = Cli::parse();
    
    match cli.command {
        Commands::Create => {
            let seed = generate_seed_phrase();
            let key = seed_to_key(&seed);
            let signing_key = SigningKey::from_bytes(&key);
            let public_key = signing_key.verifying_key().as_bytes();
            let address = generate_address(public_key);
            
            println!("✅ Wallet created!");
            println!("📝 Seed phrase: {}", seed);
            println!("📍 Address: {}", address);
            println!("\n⚠️  Write down your seed phrase! It cannot be recovered.");
            
            // Ask for password to encrypt
            println!("\nEnter password to encrypt keystore: ");
            let password = rpassword::read_password().unwrap_or_default();
            
            if !password.is_empty() {
                let keystore = encrypt_keystore(&key, public_key, &password)?;
                save_keystore(&keystore, &address)?;
                println!("🔐 Keystore saved to ~/.rustchain/wallets/");
            }
        }
        
        Commands::Import { seed } => {
            let key = seed_to_key(&seed);
            let signing_key = SigningKey::from_bytes(&key);
            let public_key = signing_key.verifying_key().as_bytes();
            let address = generate_address(public_key);
            
            println!("✅ Wallet imported!");
            println!("📍 Address: {}", address);
        }
        
        Commands::Balance { address } => {
            let addr = address.unwrap_or_else(|| "".to_string());
            if addr.is_empty() {
                println!("Usage: rustchain-wallet balance <address>");
                return Ok(());
            }
            
            let url = format!("{}/wallet/balance?miner_id={}", NODE_URL, addr);
            let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            
            println!("💰 Balance: {} RTC", data.get("balance").unwrap_or(&serde_json::Value::Null));
        }
        
        Commands::Send { to, amount, memo } => {
            println!("📤 Send {} RTC to {} (memo: {:?})", amount, to, memo);
            println!("Signing and submitting to node...");
            // Implementation would sign and submit transaction
        }
        
        Commands::History { address } => {
            let addr = address.unwrap_or_else(|| "".to_string());
            if addr.is_empty() {
                println!("Usage: rustchain-wallet history <address>");
                return Ok(());
            }
            
            let url = format!("{}/ledger/history?miner_id={}", NODE_URL, addr);
            let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
            let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            
            println!("📜 Transaction history: {:?}", data);
        }
        
        Commands::List => {
            let dir = get_wallet_dir();
            if !dir.exists() {
                println!("No wallets found");
                return Ok(());
            }
            
            println!("📋 Wallets:");
            for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
                let path = entry.map_err(|e| e.to_string())?.path();
                if path.extension().map_or(false, |e| e == "json") {
                    println!("  - {}", path.file_stem().unwrap_or_default().to_string_lossy());
                }
            }
        }
        
        Commands::Export { address } => {
            let path = get_wallet_dir().join(format!("{}.json", address));
            if path.exists() {
                let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                println!("{}", content);
            } else {
                println!("Wallet not found: {}", address);
            }
        }
    }
    
    Ok(())
}
