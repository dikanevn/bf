import {
    createUmi,
} from '@metaplex-foundation/umi-bundle-defaults';
import {
    createMetadataAccountV3,
    createMasterEditionV3,
    TokenStandard,
    mplTokenMetadata,
    findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
    generateSigner,
    keypairIdentity,
    percentAmount,
    publicKey
} from '@metaplex-foundation/umi';
import * as dotenv from "dotenv";

dotenv.config();

async function addMetadata(mintAddress: string) {
    // Создаем UMI instance и подключаем плагин для метаданных
    const umi = createUmi('https://api.devnet.solana.com')
        .use(mplTokenMetadata());

    // Получаем секретный ключ из переменной окружения
    if (!process.env.PAYER_SECRET_KEY) {
      throw new Error("PAYER_SECRET_KEY not set in env");
    }
    const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
    const payerSecretKey = new Uint8Array(secretKey);

    // Устанавливаем идентичность для UMI
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payerSecretKey);
    umi.use(keypairIdentity(umiKeypair));

    try {
        // Конвертируем строковый адрес в PublicKey
        const mintKey = publicKey(mintAddress);
        console.log("Создаем коллекционную метадату для минта:", mintAddress);
        
        // Находим PDA метадаты (это можно оставить для логирования)
        const metadata = findMetadataPda(umi, { mint: mintKey });
        console.log("Metadata PDA адрес:", metadata.toString());

        // 1. Создаем metadata account (v3) с флагом isCollection=true.
        // Это эквивалентно createMetadataAccountV3 в новом стандарте.
        const metadataTx = await createMetadataAccountV3(umi, {
            mint: mintKey,    
            name: "TestColectionD",           
            symbol: "TestColD",               
            uri: "https://gist.githubusercontent.com/dikanevn/64e59210ffa54cddfa6b451c800a8863/raw/9a1fea25a23b08801ec97e4b6af381ef2f48d36b/gistfile1.txt",
            sellerFeeBasisPoints: percentAmount(0),    
            tokenStandard: TokenStandard.NonFungible,
            isCollection: true,
            // Для несайзд коллекции можно передать null или свой объект (если требуется sized collection)
            collectionDetails: null,
        }).sendAndConfirm(umi);
        console.log("Metadata создана! Signature (metadata):", metadataTx);

        // 2. Создаем Master Edition для коллекционного NFT.
        // Это действие переводит mintAuthority и freezeAuthority на специальное PDA,
        // что исключает возможность чеканить дополнительные копии.
        const masterEditionTx = await createMasterEditionV3(umi, {
            mint: mintKey,
            // Обычно для NFT коллекций maxSupply равен 0 (не разрешается чеканка дополнительных копий)
            maxSupply: 0,
        }).sendAndConfirm(umi);
        console.log("Master Edition создан! Signature (master edition):", masterEditionTx);

        // Если требуется дальнейшая инициализация (например, mintV2 или initializeV2),
        // добавьте дополнительные инструкции здесь.

    } catch (error) {
        console.error("Ошибка:", error);
    }
}

// Подставьте адрес минта коллекции
const mintAddress = "p1yJNYW5Tn6Mc2HSgmF2ZvCk3KDFgZT3wes9p1W3r5L";
addMetadata(mintAddress); 