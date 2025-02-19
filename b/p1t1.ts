import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import type { Signer } from "@metaplex-foundation/umi";
import { transferV1 } from "@metaplex-foundation/mpl-token-metadata";
import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { getAssociatedTokenAddress } from "@solana/spl-token";

dotenv.config();

async function transferProgrammableNFT() {
  // Проверяем наличие аргументов: mint-адрес и адрес получателя
  if (process.argv.length < 4) {
    console.error("Использование: ts-node p1t1.ts <MINT_ADDRESS> <RECIPIENT_PUBLIC_KEY>");
    process.exit(1);
  }
  const mintAddressInput = process.argv[2];
  const recipientAddressInput = process.argv[3];

  // Проверяем наличие PAYER_SECRET_KEY в окружении
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY не установлен");
  }
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));

  // Создаем UMI instance с endpoint Devnet (при необходимости замените)
  const umi = createUmi(clusterApiUrl("devnet"));
  // Для identity приводим payer к типу, ожидаемому UMI (из @metaplex-foundation/umi)
  umi.use(keypairIdentity(payer as unknown as import("@metaplex-foundation/umi").Keypair));

  // Преобразуем входные аргументы в PublicKey (из web3.js)
  const mint = new PublicKey(mintAddressInput);
  const recipient = new PublicKey(recipientAddressInput);

  // Автоматически вычисляем ассоциированные токен-аккаунты (ATA)
  const senderAta = await getAssociatedTokenAddress(mint, payer.publicKey);
  const recipientAta = await getAssociatedTokenAddress(mint, recipient);

  // Приводим вычисленные адреса к UMI‑типу
  const umiMint = umiPublicKey(mint.toString());
  const umiSenderAta = umiPublicKey(senderAta.toString());
  const umiRecipientAta = umiPublicKey(recipientAta.toString());

  // Передаём authority и исправляем названия полей:
  const { signature } = await transferV1(umi, {
    mint: umiMint,
    authority: payer as unknown as Signer,
    token: umiSenderAta,
    destination: umiRecipientAta,
  }).sendAndConfirm(umi);

  console.log("Транзакция перевода pNFT отправлена, signature:", signature);
}

transferProgrammableNFT().catch((err) =>
  console.error("Ошибка при переводе pNFT:", err)
); 