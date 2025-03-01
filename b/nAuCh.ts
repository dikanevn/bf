import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { setAuthority, AuthorityType } from "@solana/spl-token";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

// Считываем и парсим секретный ключ из переменной окружения PAYER_SECRET_KEY
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY not set in env");
}
const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
const payerSecretKey = new Uint8Array(secretKey);
const payer = Keypair.fromSecretKey(payerSecretKey);

console.log("Payer публичный ключ:", payer.publicKey.toString());

// Фиксированный mint-адрес, определённый в программе (l/programs/lib.rs)
const mintPubkey = new PublicKey("Gqfg2MkuHmMR3JCbjM66ZrFBsNuXfyDiAxWmNigzp2US");

// Новый адрес authority, на который необходимо сменить mint authority
const newAuthority = new PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

async function main() {
  // Создаём соединение с devnet (можно изменить на нужную сеть)
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  console.log("Обновление mint authority для токена:", mintPubkey.toString());
  console.log("Текущая authority (payer):", payer.publicKey.toString());
  console.log("Новая authority:", newAuthority.toString());

  // Вызываем setAuthority для смены mint authority.
  // Здесь AuthorityType.MintTokens означает, что мы обновляем право чеканки токенов.
  const txSignature = await setAuthority(
    connection,
    payer,
    mintPubkey,
    payer.publicKey, // текущая authority (payer)
    AuthorityType.MintTokens,
    newAuthority
  );

  console.log("Transaction signature:", txSignature);
}

main()
  .then(() => console.log("Mint authority обновлена"))
  .catch((err) => console.error("Ошибка при обновлении mint authority:", err)); 