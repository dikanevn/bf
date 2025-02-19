import { 
    Keypair, 
    Connection, 
    PublicKey, 
    clusterApiUrl, 
    Transaction,
    sendAndConfirmTransaction
} from "@solana/web3.js";
import { 
    createMint, 
    getOrCreateAssociatedTokenAccount,
    mintTo,
} from "@solana/spl-token";
import { 
    MPL_TOKEN_METADATA_PROGRAM_ID,
    CreateMetadataAccountV3,
    CreateMetadataAccountArgsV3,
    DataV2
} from "@metaplex-foundation/mpl-token-metadata";

async function createTokenWithMetadata() {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    const payerSecretKey = new Uint8Array([
        170, 97, 193, 219, 129, 39, 25, 207, 56, 119, 15, 231, 19, 35, 186, 165,
        89, 2, 98, 31, 12, 33, 131, 230, 131, 172, 16, 191, 168, 235, 55, 20,
        33, 223, 119, 212, 121, 58, 1, 159, 40, 18, 163, 17, 147, 42, 56, 93,
        221, 70, 55, 97, 162, 189, 148, 101, 178, 131, 97, 147, 248, 87, 27, 156
    ]);
    const payer = Keypair.fromSecretKey(payerSecretKey);

    try {
        // 1. Создаем минт
        const mintKeypair = Keypair.generate();
        console.log("Mint публичный ключ:", mintKeypair.publicKey.toString());

        const mint = await createMint(
            connection,
            payer,
            payer.publicKey,
            payer.publicKey,
            9 // decimals
        );

        console.log("Токен создан:", mint.toString());

        // 2. Создаем PDA для метадаты
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            MPL_TOKEN_METADATA_PROGRAM_ID
        );

        console.log("Metadata address:", metadataPDA.toString());

        // 3. Создаем инструкцию для создания метадаты
        const tokenMetadata: DataV2 = {
            name: "Test Token",
            symbol: "TEST",
            uri: "https://gist.githubusercontent.com/dikanevn/64e59210ffa54cddfa6b451c800a8863/raw/9a1fea25a23b08801ec97e4b6af381ef2f48d36b/gistfile1.txt",
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null
        };

        const createMetadataInstruction = new CreateMetadataAccountV3(
            { feePayer: payer.publicKey },
            {
                metadata: metadataPDA,
                mint: mint,
                mintAuthority: payer.publicKey,
                payer: payer.publicKey,
                updateAuthority: payer.publicKey,
                data: tokenMetadata,
                isMutable: true,
                collectionDetails: null
            }
        ).instruction();

        // 4. Отправляем транзакцию
        const transaction = new Transaction().add(createMetadataInstruction);
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer]
        );

        console.log("Metadata создана! Signature:", signature);

        // 5. Создаем ассоциированный токен аккаунт и минтим токены
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            payer.publicKey
        );

        await mintTo(
            connection,
            payer,
            mint,
            tokenAccount.address,
            payer,
            1000000000 // 1 токен с 9 decimals
        );

        console.log("Токены отчеканены в аккаунт:", tokenAccount.address.toString());

    } catch (error) {
        console.error("Ошибка:", error);
    }
}

createTokenWithMetadata();