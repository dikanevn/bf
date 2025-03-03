"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
async function createTokenWithMetadata() {
    const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)('devnet'), 'confirmed');
    const payerSecretKey = new Uint8Array([
        170, 97, 193, 219, 129, 39, 25, 207, 56, 119, 15, 231, 19, 35, 186, 165,
        89, 2, 98, 31, 12, 33, 131, 230, 131, 172, 16, 191, 168, 235, 55, 20,
        33, 223, 119, 212, 121, 58, 1, 159, 40, 18, 163, 17, 147, 42, 56, 93,
        221, 70, 55, 97, 162, 189, 148, 101, 178, 131, 97, 147, 248, 87, 27, 156
    ]);
    const payer = web3_js_1.Keypair.fromSecretKey(payerSecretKey);
    try {
        // 1. Создаем минт
        const mintKeypair = web3_js_1.Keypair.generate();
        console.log("Mint публичный ключ:", mintKeypair.publicKey.toString());
        const mint = await (0, spl_token_1.createMint)(connection, payer, payer.publicKey, payer.publicKey, 9 // decimals
        );
        console.log("Токен создан:", mint.toString());
        // 2. Создаем PDA для метадаты
        const [metadataPDA] = web3_js_1.PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            mpl_token_metadata_1.MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ], mpl_token_metadata_1.MPL_TOKEN_METADATA_PROGRAM_ID);
        console.log("Metadata address:", metadataPDA.toString());
        // 3. Создаем инструкцию для создания метадаты
        const tokenMetadata = {
            name: "Test Token",
            symbol: "TEST",
            uri: "https://gist.githubusercontent.com/dikanevn/64e59210ffa54cddfa6b451c800a8863/raw/9a1fea25a23b08801ec97e4b6af381ef2f48d36b/gistfile1.txt",
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null
        };
        const createMetadataInstruction = new mpl_token_metadata_1.CreateMetadataAccountV3({ feePayer: payer.publicKey }, {
            metadata: metadataPDA,
            mint: mint,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
            data: tokenMetadata,
            isMutable: true,
            collectionDetails: null
        }).instruction();
        // 4. Отправляем транзакцию
        const transaction = new web3_js_1.Transaction().add(createMetadataInstruction);
        const signature = await (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [payer]);
        console.log("Metadata создана! Signature:", signature);
        // 5. Создаем ассоциированный токен аккаунт и минтим токены
        const tokenAccount = await (0, spl_token_1.getOrCreateAssociatedTokenAccount)(connection, payer, mint, payer.publicKey);
        await (0, spl_token_1.mintTo)(connection, payer, mint, tokenAccount.address, payer, 1000000000 // 1 токен с 9 decimals
        );
        console.log("Токены отчеканены в аккаунт:", tokenAccount.address.toString());
    }
    catch (error) {
        console.error("Ошибка:", error);
    }
}
createTokenWithMetadata();
