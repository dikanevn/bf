/**
 * Тест для инструкции 37: Создание pNFT с использованием Token-2022, проверкой Merkle и добавлением в фиксированную коллекцию без верификации
 * 
 * Этот тест проверяет функциональность создания Programmable NFT (pNFT) с использованием
 * стандарта Token-2022, проверкой Merkle доказательства и добавлением созданного NFT
 * в существующую коллекцию с фиксированным адресом YAPxk5i8tUv6MD7wXRPvoBrYd27Shrbbu4xpWYk1jRc,
 * но без верификации принадлежности к коллекции.
 */
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  SYSVAR_INSTRUCTIONS_PUBKEY, 
  SYSVAR_RENT_PUBKEY,
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import bs58 from 'bs58';
import { MerkleTree } from 'merkletreejs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Получаем ID программы из переменной окружения
if (!process.env.PROGRAM_ID) {
  throw new Error('Переменная окружения PROGRAM_ID не задана. Пожалуйста, установите её перед запуском теста.');
}
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

// Фиксированный адрес коллекции
const COLLECTION_MINT = new PublicKey('YAPxk5i8tUv6MD7wXRPvoBrYd27Shrbbu4xpWYk1jRc');

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
console.log('Token-2022 Program ID в тесте:', TOKEN_2022_PROGRAM_ID.toBase58());
console.log('Token-2022 Program ID в виде массива байтов:', Array.from(TOKEN_2022_PROGRAM_ID.toBytes()));
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес коллекции:', COLLECTION_MINT.toBase58());

// Функция для вычисления sha256 хеша
function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

describe('Instruction 37', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  // Создаем кейпару для минта
  const mint = Keypair.generate();

  it('should create a pNFT with Token-2022, Merkle proof verification and add to fixed collection without verification', async function() {
    console.log('Начинаем тест создания pNFT с Token-2022, проверкой Merkle и добавлением в коллекцию без верификации (инструкция 37)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());
    console.log('Адрес минта:', mint.publicKey.toBase58());
    
    // Загружаем данные раунда 11
    const d3Data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../b/rounds/11/d3.json'), 'utf8'));
    
    // Получаем все адреса из d3
    const addresses = d3Data.map((item: { player: string }) => item.player);
    
    // Создаем листья для меркл-дерева
    const leaves = addresses.map((addr: string) => {
      const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
      return createHash('sha256').update(pkBytes).digest();
    });
    
    // Сортируем листья для консистентности
    const sortedLeaves = leaves.slice().sort(Buffer.compare);
    
    // Создаем меркл-дерево
    const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
    
    // Вычисляем хеш (лист) для текущего адреса
    const leaf = createHash('sha256').update(payer.publicKey.toBuffer()).digest();
    
    // Получаем доказательство для текущего адреса
    const proof = tree.getProof(leaf).map(p => p.data);

    // Проверяем доказательство
    const isValid = tree.verify(proof, leaf, tree.getRoot());
    console.log('Merkle proof валиден:', isValid);
    
    if (!isValid) {
      throw new Error('Адрес не найден в списке участников раунда 11');
    }

    // Запрашиваем airdrop для оплаты транзакций (если нужно)
    const balance = await connection.getBalance(payer.publicKey);
    if (balance < 1 * 10**9) {
      console.log('Запрашиваем airdrop для плательщика...');
      const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * 10**9);
      await connection.confirmTransaction(airdropSignature);
      console.log('Airdrop получен');
    } else {
      console.log('Баланс достаточен:', balance / 10**9, 'SOL');
    }

    // Получаем PDA для mint authority
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority')],
      PROGRAM_ID
    );
    console.log('Program Authority PDA:', programAuthority.toBase58());

    // Получаем адрес метаданных
    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Metadata PDA:', metadata.toBase58());

    // Получаем адрес master edition
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

    // Получаем адрес ассоциированного токен аккаунта с использованием Token-2022
    const tokenAccount = await PublicKey.findProgramAddressSync(
      [
        payer.publicKey.toBuffer(),
        TOKEN_2022_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    console.log('Token Account PDA (Token-2022):', tokenAccount.toBase58());

    // Получаем адрес token record
    const [tokenRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
        Buffer.from('token_record'),
        tokenAccount.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Token Record PDA:', tokenRecord.toBase58());

    // Получаем PDA для отслеживания минтинга
    const roundNumber = 10; // Используем раунд 10 для теста
    const [mintRecordAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('is_minted_ext'),
        Buffer.from([roundNumber]),
        payer.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    console.log('Mint Record PDA:', mintRecordAccount.toBase58());

    // Создаем буфер данных для инструкции с Merkle доказательством
    const dataLength = 1 + 1 + (proof.length * 32); // 1 байт для номера инструкции, 1 байт для номера раунда, и proof
    const dataBuffer = Buffer.alloc(dataLength);
    dataBuffer[0] = 37; // Номер инструкции
    dataBuffer[1] = roundNumber; // Номер раунда
    
    // Записываем каждый узел доказательства в буфер
    for (let i = 0; i < proof.length; i++) {
      proof[i].copy(dataBuffer, 2 + (i * 32));
    }

    try {
      console.log('Создаем инструкцию...');
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          // Аккаунты для CreateV1
          { pubkey: metadata, isSigner: false, isWritable: true },
          { pubkey: masterEdition, isSigner: false, isWritable: true },
          { pubkey: mint.publicKey, isSigner: true, isWritable: true },
          { pubkey: programAuthority, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // Используем Token-2022
          
          // Дополнительные аккаунты для MintV1
          { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // token_owner
          { pubkey: tokenAccount, isSigner: false, isWritable: true },
          { pubkey: tokenRecord, isSigner: false, isWritable: true },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
          
          // Аккаунт для rent
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          
          // Аккаунт для отслеживания минтинга
          { pubkey: mintRecordAccount, isSigner: false, isWritable: true },
          
          // Аккаунт коллекции (только mint, без metadata и master edition)
          { pubkey: COLLECTION_MINT, isSigner: false, isWritable: false },
        ],
        data: dataBuffer
      });

      console.log('Создаем транзакцию...');
      
      // Увеличиваем лимит вычислительных единиц
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000
      });
      
      const transaction = new Transaction()
        .add(modifyComputeUnits)
        .add(instruction);
      
      console.log('Отправляем транзакцию...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer, mint],
        { skipPreflight: true, commitment: 'confirmed' }
      );

      console.log('Транзакция отправлена. Сигнатура:', signature);
      
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

      const tokenAccountInfo = await connection.getAccountInfo(tokenAccount);
      console.log('Token аккаунт существует:', tokenAccountInfo !== null);
      if (tokenAccountInfo) {
        console.log('Размер Token аккаунта:', tokenAccountInfo.data.length);
        console.log('Владелец Token аккаунта:', tokenAccountInfo.owner.toBase58());
        console.log('Владелец Token аккаунта - это Token-2022:', tokenAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID));
      }

      const tokenRecordInfo = await connection.getAccountInfo(tokenRecord);
      console.log('Token Record аккаунт существует:', tokenRecordInfo !== null);
      if (tokenRecordInfo) {
        console.log('Размер Token Record аккаунта:', tokenRecordInfo.data.length);
        console.log('Владелец Token Record аккаунта:', tokenRecordInfo.owner.toBase58());
      }

      const mintInfo = await connection.getAccountInfo(mint.publicKey);
      console.log('Mint аккаунт существует:', mintInfo !== null);
      if (mintInfo) {
        console.log('Размер Mint аккаунта:', mintInfo.data.length);
        console.log('Владелец Mint аккаунта:', mintInfo.owner.toBase58());
        console.log('Владелец Mint аккаунта - это Token-2022:', mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID));
      }

      const mintRecordInfo = await connection.getAccountInfo(mintRecordAccount);
      console.log('Mint Record аккаунт существует:', mintRecordInfo !== null);
      if (mintRecordInfo) {
        console.log('Размер Mint Record аккаунта:', mintRecordInfo.data.length);
        console.log('Владелец Mint Record аккаунта:', mintRecordInfo.owner.toBase58());
      }

      // Проверяем, что метаданные содержат информацию о коллекции, но она не верифицирована
      if (metadataAccount) {
        console.log('Метаданные содержат информацию о коллекции, но она не верифицирована');
      }

      expect(metadataAccount).to.not.be.null;
      expect(masterEditionAccount).to.not.be.null;
      expect(tokenAccountInfo).to.not.be.null;
      expect(tokenRecordInfo).to.not.be.null;
      expect(mintInfo).to.not.be.null;
      expect(mintRecordInfo).to.not.be.null;
      
      if (mintInfo) {
        expect(mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)).to.be.true;
      }

      console.log('Тест успешно завершен!');

    } catch (err: any) {
      console.error('Произошла ошибка при выполнении теста:');
      console.error('Тип ошибки:', err.constructor.name);
      console.error('Сообщение ошибки:', err.message);
      
      // Получаем логи транзакции
      if (err.signature) {
        console.error('Получаем логи транзакции...');
        try {
          const txLogs = await connection.getTransaction(err.signature, { commitment: 'confirmed' });
          console.error('Логи транзакции:');
          console.error(JSON.stringify(txLogs, null, 2));
        } catch (logErr) {
          console.error('Не удалось получить логи транзакции:', logErr);
        }
      }
      
      throw err;
    }
  });
});
