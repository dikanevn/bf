import { mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function mintTokenForExistingMint() {
  // Подключаемся к devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Считываем и парсим секретный ключ из переменной окружения PAYER_SECRET_KEY
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY not set in env");
  }
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
  const payerSecretKey = new Uint8Array(secretKey);
  const payer = Keypair.fromSecretKey(payerSecretKey);
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Укажите здесь адрес mint токена, созданного в n11.ts
  // Например:
  const mintAddress = "5xce3KB4ZpF2ExUm8tSbBGw6heL83iH4i21Ycyk8H7Qk"; // Замените на ваш
  console.log("Используемый mint:", mintAddress);

  // 1. Получаем или создаем ассоциированный токен-аккаунт для payer
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    new PublicKey(mintAddress),
    payer.publicKey
  );
  console.log("Associated Token Account адрес:", tokenAccount.address.toString());

  // 2. Чеканим токены в этот аккаунт (mintTo)
  // Для NFT обычно выпускают 1 токен, для фанджиблов можно задать другое число
  const amount = 1; 
  const mintTx = await mintTo(
    connection,
    payer,
    new PublicKey(mintAddress),
    tokenAccount.address,
    payer,
    amount
  );
  console.log("Mint транзакция signature:", mintTx);
  console.log("Токены отчеканены в аккаунт:", tokenAccount.address.toString());
}

mintTokenForExistingMint(); 