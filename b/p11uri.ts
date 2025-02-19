import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

// Проверяем наличие ключа плательщика и обязательных аргументов командной строки
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY не установлен");
}
if (process.argv.length < 4) {
  throw new Error("Использование: ts-node p11u.ts <d|m> <mint адрес NFT>");
}

// Выбор сети по первому параметру
const networkArg = process.argv[2];
let network: "devnet" | "mainnet-beta";
if (networkArg === "d") {
  network = "devnet";
} else if (networkArg === "m") {
  network = "mainnet-beta";
} else {
  throw new Error("Неверный параметр сети. Используйте 'd' для devnet или 'm' для mainnet");
}

// Получаем адрес mint из второго параметра
const nftMintAddress = process.argv[3];
const mintPublicKey = new PublicKey(nftMintAddress);

async function updateNFTUri() {
  // Создаем Keypair плательщика из секретного ключа
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к выбранной сети
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Инициализируем Metaplex с использованием keypairIdentity
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Загружаем NFT по mint адресу
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintPublicKey });
  console.log("Текущий URI NFT:", nft.uri);

  // Формируем новый URI: вместо добавления "x", задаем значение "abc"
  const newUri = "https://a.n/x"; 

  // Выполняем обновление метаданных NFT с новым URI
  const updatedNft = await metaplex.nfts().update({
    nftOrSft: nft,
    uri: newUri,
  });
  // Приводим результат к типу any для доступа к полю uri
  console.log("Обновленный URI NFT:", (updatedNft as any).uri);
}

updateNFTUri().catch((error) => {
  console.error("Ошибка при обновлении URI NFT:", error);
}); 