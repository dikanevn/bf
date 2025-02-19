import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, findMetadataPda, fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import * as dotenv from "dotenv";

dotenv.config();

async function fetchMetadataStructure(mintAddress: string) {
  // Создаем UMI instance и подключаем плагин для работы с метаданными
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplTokenMetadata());

  // Читаем секретный ключ из переменной окружения
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY not set in env");
  }
  // Ожидается, что PAYER_SECRET_KEY содержит JSON-массив чисел
  const secretKeyArray = JSON.parse(process.env.PAYER_SECRET_KEY);
  const payerSecretKey = new Uint8Array(secretKeyArray);
  
  // Создаем keypair из секретного ключа
  const payerKeypair = umi.eddsa.createKeypairFromSecretKey(payerSecretKey);
  umi.use(keypairIdentity(payerKeypair));

  // Конвертируем строковый адрес минта в PublicKey
  const mintKey = publicKey(mintAddress);

  // Вычисляем PDA аккаунта метаданных для данного минта
  const metadataPda = findMetadataPda(umi, { mint: mintKey });
  // Извлекаем публичный ключ PDA (первый элемент кортежа)
  const metadataPubKey = metadataPda[0];
  console.log("Metadata PDA адрес:", metadataPubKey.toString());

  // Получаем данные аккаунта с метаданными с блокчейна с использованием fetchMetadata
  try {
    const metadataAccount = await fetchMetadata(umi, metadataPubKey);
    console.log("Данные metadata аккаунта:");
    console.log(metadataAccount);
  } catch (error) {
    console.error("Ошибка при получении данных metadata аккаунта:", error);
  }
}

// Используем тот же mintAddress, для которого ранее создавались метаданные
const mintAddress = "CjrrRQEZb9tKNcnzu3ayg6RftNVWZxSxM1f6t5N7siCP";
fetchMetadataStructure(mintAddress); 