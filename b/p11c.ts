import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

// Новый блок: выбор сети по аргументу командной строки
if (process.argv.length < 3) {
  throw new Error("Укажите параметр сети: 'd' для devnet или 'm' для mainnet");
}
const networkArg = process.argv[2];
let network: "devnet" | "mainnet-beta";
if (networkArg === "d") {
  network = "devnet";
} else if (networkArg === "m") {
  network = "mainnet-beta";
} else {
  throw new Error("Неверный параметр сети. Используйте 'd' для devnet или 'm' для mainnet");
}

async function createCollectionPNFT() {
  // Проверка наличия секретного ключа в переменных окружения
  if (!process.env.PAYER_SECRET_KEY) {
    throw new Error("PAYER_SECRET_KEY не установлен");
  }

  // Парсинг секретного ключа и создание Keypair
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к выбранной сети (используем network переменную)
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Инициализируем Metaplex (здесь используем keypairIdentity как и ранее)
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Создаём программируемый NFT, который будет коллекцией.
  // Важно: для коллекционного NFT устанавливаем параметр isCollection в true
  const { nft } = await metaplex.nfts().create({
    uri: "https://arweave.net/collection_metadata", // Замените на реальный URI метаданных для коллекции
    name: "PCollnNFTb",
    sellerFeeBasisPoints: 0, // Обычно для коллекций роялти не применяют, но настройте по необходимости
    symbol: "PCOLLb",
    creators: [
      {
        address: payer.publicKey,
        share: 100,
      },
    ],
    isMutable: true,
    // Значение 4 соответствует ProgrammableNonFungible (pNFT)
    tokenStandard: 4,
    ruleSet: null,
    // Специфичные параметры для коллекционного NFT:
    isCollection: true, // отмечает, что NFT выступает в роли коллекции
  });

  console.log("Создан коллекционный pNFT:");
  console.log("Mint адрес:", nft.address.toString());
  console.log("Название:", nft.name);
  console.log("Символ:", nft.symbol);
  console.log("URI:", nft.uri);
}

createCollectionPNFT().catch((error) => {
  console.error("Ошибка при создании коллекционного pNFT:", error);
}); 