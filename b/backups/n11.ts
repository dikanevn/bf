import { createMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function createTokenWithoutMint() {
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

  // 1. Создаем новый mint (токен) через SPL
  // Указываем:
  // - mintAuthority: payer.publicKey (можно изменить)
  // - freezeAuthority: payer.publicKey (можно изменить или задать null)
  // - decimals: 0 (для NFT или целых токенов)
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,              // Тот, кто оплачивает создание
    payer.publicKey,    // Mint authority
    payer.publicKey,    // Freeze authority
    0,                  // Количество десятичных знаков
    mintKeypair         // Передаем сгенерированный mint keypair
  );
  console.log("Новый mint создан:", mint.toString());

  // 2. Создаем ассоциированный токен-аккаунт для payer
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,          // Кто платит за создание
    mint,           // Адрес mint токена
    payer.publicKey // Владелец аккаунта
  );
  console.log("Создан Associated Token Account адрес:", tokenAccount.address.toString());

  // Обратите внимание: здесь мы НЕ вызываем mintTo, поэтому никаких токенов не выпускаем.
}

createTokenWithoutMint(); 