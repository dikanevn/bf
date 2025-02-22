import { Connection, clusterApiUrl } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import * as dotenv from "dotenv";
// Импортируем UMI-функции и типы из @metaplex-foundation/umi-bundle-defaults
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, generateSigner, Amount, publicKey } from "@metaplex-foundation/umi";
// Импортируем актуальные инструкции и константы из mpl-token-metadata
import { createV1, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Загружаем переменные окружения
dotenv.config();

async function createProgrammableNFT() {
  try {
    // Подключаемся к Devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    
    // Считываем и парсим секретный ключ из переменной окружения PAYER_SECRET_KEY
    if (!process.env.PAYER_SECRET_KEY) {
      throw new Error("PAYER_SECRET_KEY не установлен");
    }
    const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
    const payer = web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log("Payer публичный ключ:", payer.publicKey.toString());

    // Создаем UMI instance, передавая URL-адрес вместо соединения
    const umi = createUmi("https://api.devnet.solana.com" as any);
    
    // Создаем UMI keypair из секретного ключа и устанавливаем identity
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payer.secretKey);
    umi.use(keypairIdentity(umiKeypair));

    // Генерируем новый mint для pNFT
    const mint = generateSigner(umi);
    console.log("Генерируем новый mint для pNFT:", mint.publicKey.toString());

    // Создаем программируемую NFT (pNFT) с использованием createV1
    const nftResponse = await createV1(umi, {
      mint,
      name: "My Programmable NFT",
      uri: "https://example.com/my-programmable-nft.json",
      // Комиссия 5.5% задается в базисных пунктах (5.5% = 550)
      sellerFeeBasisPoints: 550 as unknown as Amount<"%", 2>,
      // Преобразуем TOKEN_2022_PROGRAM_ID в UMI-compatible publicKey
      splTokenProgram: publicKey(TOKEN_2022_PROGRAM_ID.toString()),
      tokenStandard: TokenStandard.ProgrammableNonFungible,
    }).sendAndConfirm(umi);

    console.log("Программируемая NFT успешно создана!");
    console.log("Ответ создания NFT:", nftResponse);
  } catch (error) {
    console.error("Ошибка при создании программируемой NFT:", error);
  }
}

createProgrammableNFT(); 