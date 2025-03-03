import { 
    createMint, 
    getOrCreateAssociatedTokenAccount, 
    mintTo,
    setAuthority,
    AuthorityType
} from "@solana/spl-token";
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    clusterApiUrl 
} from "@solana/web3.js";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

async function createAndSetupToken(newAuthority: string, existingMint?: string) {
    // Подключаемся к devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    
    // Считываем и парсим секретный ключ из переменной окружения
    if (!process.env.PAYER_SECRET_KEY) {
        throw new Error("PAYER_SECRET_KEY не задан в env");
    }
    const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
    const payerSecretKey = new Uint8Array(secretKey);
    const payer = Keypair.fromSecretKey(payerSecretKey);
    console.log("Payer публичный ключ:", payer.publicKey.toString());

    let mint: PublicKey;

    // Если mint адрес не предоставлен, создаем новый
    if (!existingMint) {
        console.log("Создаем новый минт...");
        const mintKeypair = Keypair.generate();
        mint = await createMint(
            connection,
            payer,
            payer.publicKey,
            payer.publicKey,
            0,
            mintKeypair
        );
        console.log("Новый минт создан:", mint.toString());
    } else {
        console.log("Используем существующий минт:", existingMint);
        mint = new PublicKey(existingMint);
    }

    // Создаем или получаем ассоциированный токен-аккаунт
    console.log("Создаем ассоциированный токен-аккаунт...");
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
    );
    console.log("Associated Token Account:", tokenAccount.address.toString());

    // Чеканим 1 токен
    console.log("Чеканим токен...");
    const mintTx = await mintTo(
        connection,
        payer,
        mint,
        tokenAccount.address,
        payer,
        1
    );
    console.log("Mint транзакция:", mintTx);

    // Меняем mint authority
    console.log("Меняем mint authority...");
    const newAuthorityPubkey = new PublicKey(newAuthority);
    const mintAuthTx = await setAuthority(
        connection,
        payer,
        mint,
        payer.publicKey,
        AuthorityType.MintTokens,
        newAuthorityPubkey
    );
    console.log("Mint authority изменен:", mintAuthTx);

    // Меняем freeze authority
    console.log("Меняем freeze authority...");
    const freezeAuthTx = await setAuthority(
        connection,
        payer,
        mint,
        payer.publicKey,
        AuthorityType.FreezeAccount,
        newAuthorityPubkey
    );
    console.log("Freeze authority изменен:", freezeAuthTx);

    return {
        mint: mint.toString(),
        tokenAccount: tokenAccount.address.toString(),
        mintTx,
        mintAuthTx,
        freezeAuthTx
    };
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
if (args.length < 2 || args[0] !== "d") {
    console.error('Использование: ts-node n11_12_mf.ts d <адрес_новой_authority> [существующий_минт]');
    process.exit(1);
}

const newAuthority = args[1];
const existingMint = args[2]; // опционально

createAndSetupToken(newAuthority, existingMint)
    .then((result) => {
        console.log("\nОперация успешно завершена!");
        console.log("Mint адрес:", result.mint);
        console.log("Token Account:", result.tokenAccount);
    })
    .catch((error) => {
        console.error("Ошибка:", error);
        process.exit(1);
    }); 