import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createV1,
  TokenStandard,
  mplTokenMetadata,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { keypairIdentity, percentAmount, publicKey } from '@metaplex-foundation/umi';
import * as dotenv from "dotenv";

dotenv.config();

async function addMetadata(mintAddress: string) {
  // Создаем UMI instance и подключаем плагин для работы с метаданными
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplTokenMetadata());

  // Читаем секретный ключ из переменной окружения
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY not set in env");
  }
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
  const payerSecretKey = new Uint8Array(secretKey);

  // Создаем keypair для UMI
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payerSecretKey);
  umi.use(keypairIdentity(umiKeypair));

  try {
    // Конвертируем строковое значение в PublicKey
    const mintKey = publicKey(mintAddress);
    console.log("Добавляем метадату для NFT токена:", mintAddress);

    const metadata = findMetadataPda(umi, { mint: mintKey });
    console.log("Metadata PDA адрес:", metadata.toString());

    // Создаем метадату для NFT и привязываем к коллекции
    const tx = await createV1(umi, {
      mint: mintKey,
      name: "NFT ItemD1",         // Название NFT
      symbol: "NFTD1",            // Символ NFT
      uri: "https://gist.githubusercontent.com/dikanevn/64e59210ffa54cddfa6b451c800a8863/raw/nft.json", // Адрес, где расположены метаданные NFT
      sellerFeeBasisPoints: percentAmount(0),
      tokenStandard: TokenStandard.NonFungible,
      collection: {
        key: publicKey("Hor8zhRfLxtvSUAcGsgtBH5F3gxtrE5wHaVvZKVeNUmm"), // mint коллекции
        verified: false, // Привязка не верифицирована (ее можно подтвердить отдельно)
      },
    }).sendAndConfirm(umi);

    console.log("Metadata создана! Signature:", tx);
  } catch (error) {
    console.error("Ошибка:", error);
  }
}

// Адрес токена, для которого создаём метадату и привязываем к коллекции
const mintAddress = "Hor8zhRfLxtvSUAcGsgtBH5F3gxtrE5wHaVvZKVeNUmm";
addMetadata(mintAddress); 