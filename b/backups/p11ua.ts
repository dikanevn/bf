import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as dotenv from "dotenv";

dotenv.config();

// Проверяем наличие ключа плательщика и обязательных аргументов командной строки
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY не установлен");
}
// Добавляем обработку параметра "info"
if (process.argv[2] === "info") {
  console.info("Пример использования: ts-node p11ua.ts <d|m> <mint адрес NFT> <новый updateAuthority адрес>");
  process.exit(0);
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

// Получаем адрес mint и новый update authority из аргументов командной строки
const nftMintAddress = process.argv[3];
const newUpdateAuthorityAddress = process.argv[4];
const mintPublicKey = new PublicKey(nftMintAddress);
const newUpdateAuthPublicKey = new PublicKey(newUpdateAuthorityAddress);

async function updateNFTUpdateAuthority() {
  // Создаем Keypair плательщика из секретного ключа
  const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY) as number[];
  const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log("Payer публичный ключ:", payer.publicKey.toString());

  // Подключаемся к выбранной сети
  const connection = new Connection(clusterApiUrl(network), "confirmed");

  // Инициализируем Metaplex с keypairIdentity
  const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

  // Загружаем NFT по mint адресу
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintPublicKey });
  console.log("Текущий updateAuthority NFT:", (nft as any).updateAuthority);

  // Выполняем обновление update authority NFT с новым значением
  const updatedNft = await metaplex.nfts().update({
    nftOrSft: nft,
    newUpdateAuthority: newUpdateAuthPublicKey,
  });
  // Приводим результат к типу any для доступа к полю updateAuthority
  console.log("Новый updateAuthority NFT:", (updatedNft as any).updateAuthority);
}

updateNFTUpdateAuthority().catch((error) => {
  console.error("Ошибка при обновлении updateAuthority NFT:", error);
}); 