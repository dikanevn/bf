import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createInitializeMintInstruction,
    MINT_SIZE,
    getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import bs58 from 'bs58';

describe('Instruction 25', () => {
    it('should create a clean NFT and mint token', async () => {
        console.log('Начинаем тест создания чистого NFT и минта токена (инструкция 25)');

        // Подключаемся к devnet
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        // Загружаем приватный ключ из .env
        const privateKeyString = process.env.PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error('Private key not found in .env');
        }

        // Преобразуем строку в массив чисел
        const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num));
        const payer = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        console.log('Адрес плательщика:', payer.publicKey.toBase58());

        // Создаем новый минт
        const mint = Keypair.generate();
        console.log('Адрес минта:', mint.publicKey.toBase58());

        // Находим Program Authority PDA
        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('mint_authority')],
            new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP')
        );
        console.log('Program Authority PDA:', programAuthority.toBase58());

        // Находим Metadata PDA
        const [metadata] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        console.log('Metadata PDA:', metadata.toBase58());

        // Находим Master Edition PDA
        const [masterEdition] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.publicKey.toBuffer(),
                Buffer.from('edition'),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        console.log('Master Edition PDA:', masterEdition.toBase58());

        // Получаем адрес ассоциированного токен аккаунта
        const associatedTokenAccount = await getAssociatedTokenAddress(
            mint.publicKey,
            payer.publicKey
        );
        console.log('Associated Token Account:', associatedTokenAccount.toBase58());

        // Создаем инструкцию для создания минт аккаунта
        console.log('Создаем инструкции...');
        const lamports = await getMinimumBalanceForRentExemptMint(connection);
        const createMintAccountIx = SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
        });

        // Инициализируем минт
        const initializeMintIx = createInitializeMintInstruction(
            mint.publicKey,
            0,
            programAuthority,
            programAuthority,
            TOKEN_PROGRAM_ID
        );

        // Создаем ассоциированный токен аккаунт
        const createAtaIx = createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedTokenAccount,
            payer.publicKey,
            mint.publicKey
        );

        // Создаем инструкцию для нашей программы
        const instruction = {
            keys: [
                { pubkey: metadata, isSigner: false, isWritable: true },
                { pubkey: masterEdition, isSigner: false, isWritable: true },
                { pubkey: mint.publicKey, isSigner: true, isWritable: true },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
            ],
            programId: new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP'),
            data: Buffer.from([25]), // Инструкция 25
        };

        // Создаем транзакцию
        console.log('Создаем транзакцию...');
        const transaction = new Transaction().add(
            createMintAccountIx,
            initializeMintIx,
            createAtaIx,
            instruction
        );

        // Отправляем транзакцию
        console.log('Отправляем транзакцию...');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [payer, mint],
            { commitment: 'confirmed' }
        );
        console.log('Транзакция отправлена. Сигнатура:', signature);

        // Проверяем создание аккаунтов
        console.log('Проверяем создание аккаунтов...');
        const metadataAccount = await connection.getAccountInfo(metadata);
        console.log('Metadata аккаунт существует:', metadataAccount !== null);
        if (metadataAccount) {
            console.log('Размер Metadata аккаунта:', metadataAccount.data.length);
            console.log('Владелец Metadata аккаунта:', metadataAccount.owner.toBase58());
        }

        const masterEditionAccount = await connection.getAccountInfo(masterEdition);
        console.log('Master Edition аккаунт существует:', masterEditionAccount !== null);
        if (masterEditionAccount) {
            console.log('Размер Master Edition аккаунта:', masterEditionAccount.data.length);
            console.log('Владелец Master Edition аккаунта:', masterEditionAccount.owner.toBase58());
        }

        const tokenAccount = await connection.getAccountInfo(associatedTokenAccount);
        console.log('Token аккаунт существует:', tokenAccount !== null);
        if (tokenAccount) {
            console.log('Размер Token аккаунта:', tokenAccount.data.length);
            console.log('Владелец Token аккаунта:', tokenAccount.owner.toBase58());
        }

        console.log('Тест успешно завершен!');
    });
}); 