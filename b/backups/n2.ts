import {
    createUmi,
} from '@metaplex-foundation/umi-bundle-defaults';
import {
    createV1,
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
    // Создаем UMI instance
    const umi = createUmi('https://api.devnet.solana.com')
        .use(mplTokenMetadata());

    // Создаем keypair используя значение PAYER_SECRET_KEY из переменной окружения
    if (!process.env.PAYER_SECRET_KEY) {
      throw new Error("PAYER_SECRET_KEY not set in env");
    }
    const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
    const payerSecretKey = new Uint8Array(secretKey);

    // Создаем keypair для UMI
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payerSecretKey);
    umi.use(keypairIdentity(umiKeypair));

    try {
        // Конвертируем строковый адрес в PublicKey
        const mintKey = publicKey(mintAddress);
        console.log("Добавляем метадату для минта:", mintAddress);
        
        const metadata = findMetadataPda(umi, { mint: mintKey });
        console.log("Metadata PDA адрес:", metadata.toString());

        const tx = await createV1(umi, {
            mint: mintKey,    
            name: "TestC",           
            symbol: "TESTC",               
            uri: "https://gist.githubusercontent.com/dikanevn/64e59210ffa54cddfa6b451c800a8863/raw/9a1fea25a23b08801ec97e4b6af381ef2f48d36b/gistfile1.txt",
            sellerFeeBasisPoints: percentAmount(0),    
            tokenStandard: TokenStandard.NonFungible,     
        }).sendAndConfirm(umi);

        console.log("Metadata создана! Signature:", tx);

    } catch (error) {
        console.error("Ошибка:", error);
    }
}

// Подставь адрес минта (не токен аккаунта!) из n1.ts
const mintAddress = "7UpgFi8zcRYB1K7Gtkde7eWX4RScyhy9JCK24nATnHq";
addMetadata(mintAddress); 