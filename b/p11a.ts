import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

async function createPNFT() {
  // Проверка наличия секретного ключа в переменных окружения
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY не установлен");
  }

  // Парсинг секретного ключа и создание Keypair
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к сети Devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Инициализируем Metaplex аналогично тому, как это делается в MintPage.tsx
  // (на клиенте используется walletAdapterIdentity, а здесь keypairIdentity)
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Создаем pNFT с параметрами, аналогичными параметрам из MintPage.tsx
  const { nft } = await metaplex.nfts().create({
    uri: "https://arweave.net/123", // Замените на реальный URI метаданных
    name: "ProgNFTa",
    sellerFeeBasisPoints: 500, // 5% роялти (значение в базисных пунктах)
    symbol: "PNFTa",
    creators: [
      {
        address: payer.publicKey,
        share: 100,
      },
    ],
    isMutable: true,
    // Значение 4 соответствует ProgrammableNonFungible (TokenStandard)
    tokenStandard: 4,
    ruleSet: null,
  });

  console.log("Создан pNFT:");
  console.log("Mint адрес:", nft.address.toString());
  console.log("Название:", nft.name);
  console.log("Символ:", nft.symbol);
  console.log("URI:", nft.uri);
}

createPNFT().catch((error) => {
  console.error("Ошибка при создании pNFT:", error);
}); 