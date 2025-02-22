import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Скрипт ожидает два аргумента:
  // 1. Адрес владельца (wallet)
  // 2. Mint-адрес токена
  if (process.argv.length < 4) {
    console.error("Пожалуйста, укажите адрес владельца и mint-адрес токена в аргументах.");
    process.exit(1);
  }

  const ownerAddress = process.argv[2];
  const mintAddress = process.argv[3];

  // Создаем UMI instance на Devnet (используется для консистентности, даже если не требуется для вычисления ATA)
  const umi = await createUmi("https://api.devnet.solana.com");

  // Преобразуем переданные строки в PublicKey из @solana/web3.js
  const ownerPk = new PublicKey(ownerAddress);
  const mintPk = new PublicKey(mintAddress);

  // Приводим тип ownerPk к типу PublicKey для устранения ошибки TS2345,
  // возникающей из-за несовместимости типов между @solana/web3.js и @solana/spl-token.
  const ata = await getAssociatedTokenAddress(mintPk, ownerPk as unknown as PublicKey);

  console.log("ATA для владельца:", ownerAddress);
  console.log("Mint-адрес токена:", mintAddress);
  console.log("Associated Token Account (ATA):", ata.toString());
}

main()
  .then(() => { console.log("Готово."); })
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  }); 