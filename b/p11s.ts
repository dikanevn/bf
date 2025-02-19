import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { findMetadataPda, findMasterEditionPda, fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  if (process.argv.length < 3) {
    console.error("Пожалуйста, укажите адрес mint как аргумент.");
    process.exit(1);
  }

  const mintAddress = process.argv[2];
  
  // Создаем UMI instance на devnet
  const umi = await createUmi("https://api.devnet.solana.com" as any);
  
  // Преобразуем mint адрес в PublicKey
  const mintPk = publicKey(mintAddress);
  
  // Вычисляем PDA для метаданных
  const metadataPda = findMetadataPda(umi, { mint: mintPk });
  
  // Вычисляем PDA для master edition (если применимо)
  let masterEditionPda;
  try {
    masterEditionPda = findMasterEditionPda(umi, { mint: mintPk });
  } catch (error) {
    masterEditionPda = null;
  }
  
  // Пытаемся получить данные цифрового актива
  let asset;
  try {
    asset = await fetchDigitalAsset(umi, mintPk);
  } catch (error) {
    asset = null;
  }
  
  console.log("Информация о токене:");
  console.log("Mint:", mintAddress);
  console.log("Metadata PDA:", metadataPda.toString());
  if (masterEditionPda) {
    console.log("Master Edition PDA:", masterEditionPda.toString());
  } else {
    console.log("Master Edition PDA: не найден");
  }
  
  if (asset) {
    console.log("Детали цифрового актива:");
    console.dir(asset, { depth: null, colors: true });
  } else {
    console.log("Данные цифрового актива не получены.");
  }
}

main()
  .then(() => { console.log("Готово."); })
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  }); 