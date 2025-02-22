import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

// Проверяем наличие обязательных переменных и параметров командной строки
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY не установлен");
}
if (process.argv.length < 4) {
  throw new Error("Использование: <d|m> <адрес коллекции>");
}

// Новый блок: выбор сети по первому параметру
const networkArg = process.argv[2];
let network: "devnet" | "mainnet-beta";
if (networkArg === "d") {
  network = "devnet";
} else if (networkArg === "m") {
  network = "mainnet-beta";
} else {
  throw new Error("Неверный параметр сети. Используйте 'd' для devnet или 'm' для mainnet");
}

// Получаем адрес коллекции из второго параметра
const collectionAddress = process.argv[3];
const collectionPublicKey = new PublicKey(collectionAddress);

async function mintNFTToCollection() {
  // Парсинг секретного ключа и создание Keypair
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к выбранной сети (используем network переменную)
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Инициализируем Metaplex с keypairIdentity
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Создаём NFT, привязанный к коллекции
  const { nft } = await metaplex.nfts().create({
    uri: "https://a.n/e", // Замените на реальный URI метаданных NFT
    name: "pNFTinColE",
    sellerFeeBasisPoints: 700, // 700=7% роялти (при необходимости измените)
    symbol: "pNFTInColE",
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
    // Привязка NFT к коллекции:
    collection: collectionPublicKey,
  });

  console.log("Создан NFT, привязанный к коллекции:");
  console.log("Mint адрес:", nft.address.toString());
  console.log("Название:", nft.name);
  console.log("Символ:", nft.symbol);
  console.log("URI:", nft.uri);
}

mintNFTToCollection().catch((error) => {
  console.error("Ошибка при создании NFT, привязанного к коллекции:", error);
}); 