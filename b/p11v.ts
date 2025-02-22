import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

// Проверка обязательной переменной окружения
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY не установлен");
}
// Теперь требуется три аргумента: параметр сети, mint-адрес NFT и mint-адрес коллекции.
if (process.argv.length < 5) {
  throw new Error("Использование: <d|m> <mint адрес NFT> <mint адрес коллекции>");
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

// Получаем mint-адреса из аргументов командной строки
const nftMintAddress = process.argv[3];
const collectionMintAddress = process.argv[4];

const nftMintPublicKey = new PublicKey(nftMintAddress);
const collectionMintPublicKey = new PublicKey(collectionMintAddress);

async function verifyNFTCollection() {
  // Парсинг секретного ключа и создание Keypair
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к выбранной сети (используем network переменную)
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Инициализируем Metaplex с использованием keypairIdentity
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Проверяем, что NFT уже имеет установленную коллекцию и она соответствует указанной.
  const nftBefore = await metaplex.nfts().findByMint({ mintAddress: nftMintPublicKey });
  if (!nftBefore.collection) {
    throw new Error("NFT не имеет коллекционной информации");
  }
  if (nftBefore.collection.address.toString() !== collectionMintPublicKey.toString()) {
    throw new Error("Коллекция NFT не соответствует указанной коллекции");
  }
  console.log("NFT до верификации:", {
    mint: nftBefore.address.toString(),
    collection: nftBefore.collection.address.toString(),
    verified: nftBefore.collection.verified,
  });

  // Вызываем метод верификации коллекции.
  await metaplex.nfts().verifyCollection({ 
    mintAddress: nftMintPublicKey, 
    collectionMintAddress: collectionMintPublicKey 
  });

  // Запрашиваем обновлённые данные NFT для проверки статуса верификации.
  const updatedNft = await metaplex.nfts().findByMint({ mintAddress: nftMintPublicKey });
  console.log("NFT после верификации:");
  console.log("Mint адрес NFT:", updatedNft.address.toString());
  console.log("Коллекция:", updatedNft.collection?.address.toString());
  console.log("Верифицирован:", updatedNft.collection?.verified);
}

verifyNFTCollection().catch((error) => {
  console.error("Ошибка при верификации коллекции:", error);
}); 