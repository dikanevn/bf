/**
 * Тест для инструкции 40: Создание pNFT с использованием стандартного SPL Token, проверкой Merkle и добавлением в фиксированную коллекцию
 * 
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
  ComputeBudgetProgram,
  clusterApiUrl
} from '@solana/web3.js';
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID
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
const COLLECTION_MINT = new PublicKey('YAP8v1Y4aKiM6HEtpCDabXz7VgH9SXxUgTBHbWaN7hg');

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
console.log('Token Program ID в тесте:', TOKEN_PROGRAM_ID.toBase58());
console.log('Token Program ID в виде массива байтов:', Array.from(TOKEN_PROGRAM_ID.toBytes()));
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес коллекции:', COLLECTION_MINT.toBase58());

// Функция для вычисления sha256 хеша
function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

describe('Instruction 45', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);
  
  it('should create a pNFT with standard SPL Token, Merkle proof verification and add to fixed collection', async function() {
    console.log('Начинаем тест создания pNFT с стандартным SPL Token, проверкой Merkle и добавлением в коллекцию (инструкция 45)');
    
    // Используем раунд 2 для теста (или 1, если указан в параметрах)
    const roundNumber = process.env.TEST_ROUND_NUMBER ? parseInt(process.env.TEST_ROUND_NUMBER) : 2;
    console.log(`Используем раунд ${roundNumber} для теста`);
    
    // Индекс в массиве ALL_MERKLE_ROOTS для раунда 2 - это 1 (массив начинается с 0)
    const roundIndex = roundNumber - 1;
    console.log(`Индекс в массиве ALL_MERKLE_ROOTS: ${roundIndex}`);
    
    // Проверяем, что PRIVATE_KEY доступен из переменных окружения
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY не найден в переменных окружения');
    }
    console.log('PRIVATE_KEY найден в переменных окружения');
    
    // Создаем подключение к devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    // Создаем кошелек плательщика из приватного ключа
    // Приватный ключ может быть в формате base58
    const payer = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
    console.log(`Адрес плательщика: ${payer.publicKey.toBase58()}`);
    
    // Создаем новый keypair для минта
    const mint = Keypair.generate();
    console.log(`Адрес минта: ${mint.publicKey.toBase58()}`);
    
    // Загружаем данные указанного раунда
    const roundDataPath = path.join(__dirname, `../../b/rounds/${roundNumber}/d3.json`);
    if (!fs.existsSync(roundDataPath)) {
      throw new Error(`Файл данных для раунда ${roundNumber} не найден: ${roundDataPath}`);
    }
    
    const d3Data = JSON.parse(fs.readFileSync(roundDataPath, 'utf8'));
    
    // Находим NFTnumber для текущего адреса
    const playerData = d3Data.find((item: { player: string, NFTnumber?: number }) => 
      item.player === payer.publicKey.toBase58()
    );
    
    // Если NFTnumber не найден, выдаем ошибку
    if (!playerData || playerData.NFTnumber === undefined) {
      throw new Error(`NFTnumber не найден для адреса ${payer.publicKey.toBase58()} в раунде ${roundNumber}`);
    }
    
    const nftNumber = playerData.NFTnumber;
    console.log(`Найден NFTnumber ${nftNumber} для адреса ${payer.publicKey.toBase58()}`);
    
    // Получаем все адреса и NFTnumber из d3
    const playersData = d3Data.map((item: { player: string, NFTnumber?: number }) => {
      if (item.NFTnumber === undefined) {
        throw new Error(`NFTnumber не определен для игрока ${item.player}`);
      }
      return {
        player: item.player,
        NFTnumber: item.NFTnumber
      };
    });
    
    // Создаем листья для меркл-дерева, включая NFTnumber
    const leaves = playersData.map(({ player, NFTnumber }: { player: string, NFTnumber: number }) => {
      // Создаем буфер из адреса публичного ключа
      const pkBytes = Buffer.from(new PublicKey(player).toBytes());
      
      // Создаем буфер для NFTnumber (2 байта, uint16)
      const nftNumberBuffer = Buffer.alloc(2);
      nftNumberBuffer.writeUInt16LE(NFTnumber, 0);
      
      // Объединяем буферы: сначала адрес, затем NFTnumber
      const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
      
      // Хешируем объединенный буфер
      return sha256(combinedBuffer);
    });
    
    // Сортируем листья для консистентности
    const sortedLeaves = leaves.slice().sort(Buffer.compare);
    
    // Создаем меркл-дерево
    const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
    
    // Вычисляем хеш (лист) для текущего адреса с учетом NFTnumber
    const pkBytes = Buffer.from(payer.publicKey.toBytes());
    const nftNumberBuffer = Buffer.alloc(2);
    nftNumberBuffer.writeUInt16LE(nftNumber, 0);
    const combinedBuffer = Buffer.concat([pkBytes, nftNumberBuffer]);
    const leaf = sha256(combinedBuffer);
    
    // Получаем доказательство для текущего адреса
    const proof = tree.getProof(leaf).map(p => p.data);

    // Проверяем доказательство
    const isValid = tree.verify(proof, leaf, tree.getRoot());
    console.log('Merkle proof валиден:', isValid);
    
    if (!isValid) {
      throw new Error(`Адрес ${payer.publicKey.toBase58()} с NFTnumber ${nftNumber} не найден в списке участников раунда ${roundNumber}`);
    }

    // Проверяем баланс
    const balance = await connection.getBalance(payer.publicKey);
    console.log('Текущий баланс:', balance / 10**9, 'SOL');

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

    // Получаем адрес ассоциированного токен аккаунта с использованием стандартного SPL Token
    const tokenAccount = await PublicKey.findProgramAddressSync(
      [
        payer.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    console.log('Token Account PDA (SPL Token):', tokenAccount.toBase58());

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

    // Получаем адрес метаданных коллекции
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        COLLECTION_MINT.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Collection Metadata PDA:', collectionMetadata.toBase58());

    // Получаем адрес master edition коллекции
    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        COLLECTION_MINT.toBuffer(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Collection Master Edition PDA:', collectionMasterEdition.toBase58());

    // Получаем PDA для отслеживания минтинга
    const [mintRecordAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('minted'),
        Buffer.from([roundIndex]),
        payer.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    console.log('Mint Record PDA:', mintRecordAccount.toBase58());

    // Создаем буфер данных для инструкции
    // [0] - номер инструкции (1 байт)
    // [1] - номер раунда (1 байт)
    // [2-3] - NFTnumber (2 байта, uint16)
    // [4..] - данные доказательства (каждый узел - 32 байта)
    const dataLength = 4 + (proof.length * 32);
    const dataBuffer = Buffer.alloc(dataLength);
    
    // Записываем номер инструкции (45)
    dataBuffer.writeUInt8(45, 0);
    
    // Записываем индекс раунда в массиве ALL_MERKLE_ROOTS (для раунда 2 это 1)
    dataBuffer.writeUInt8(roundIndex, 1);
    
    // Записываем NFTnumber (2 байта, uint16)
    dataBuffer.writeUInt16LE(nftNumber, 2);
    
    // Копируем данные доказательства
    const proofBuffer = Buffer.concat(proof);
    proofBuffer.copy(dataBuffer, 4);

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
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Используем стандартный SPL Token
          
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
          
          // Аккаунты коллекции
          { pubkey: COLLECTION_MINT, isSigner: false, isWritable: false },
          { pubkey: collectionMetadata, isSigner: false, isWritable: true },
          { pubkey: collectionMasterEdition, isSigner: false, isWritable: false },
          { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // collection_authority_record (не используется)
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
      
      // Добавляем логирование для отладки
      console.log('Данные инструкции:');
      console.log('Номер инструкции:', dataBuffer[0]);
      console.log('Индекс раунда:', dataBuffer[1]);
      console.log('NFTnumber:', dataBuffer.readUInt16LE(2));
      console.log('Длина proof:', proof.length);
      console.log('Общая длина данных:', dataBuffer.length);
      
      // Логируем все аккаунты
      console.log('Аккаунты в инструкции:');
      instruction.keys.forEach((key, index) => {
        console.log(`${index}: ${key.pubkey.toBase58()} (signer: ${key.isSigner}, writable: ${key.isWritable})`);
      });
      
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
        console.log('Владелец Token аккаунта - это SPL Token:', tokenAccountInfo.owner.equals(TOKEN_PROGRAM_ID));
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
        console.log('Владелец Mint аккаунта - это SPL Token:', mintInfo.owner.equals(TOKEN_PROGRAM_ID));
      }

      const mintRecordInfo = await connection.getAccountInfo(mintRecordAccount);
      console.log('Mint Record аккаунт существует:', mintRecordInfo !== null);
      if (mintRecordInfo) {
        console.log('Размер Mint Record аккаунта:', mintRecordInfo.data.length);
        console.log('Владелец Mint Record аккаунта:', mintRecordInfo.owner.toBase58());
      }

      expect(metadataAccount).to.not.be.null;
      expect(masterEditionAccount).to.not.be.null;
      expect(tokenAccountInfo).to.not.be.null;
      expect(tokenRecordInfo).to.not.be.null;
      expect(mintInfo).to.not.be.null;
      expect(mintRecordInfo).to.not.be.null;
      
      if (mintInfo) {
        expect(mintInfo.owner.equals(TOKEN_PROGRAM_ID)).to.be.true;
      }

      console.log('Тест успешно завершен! pNFT создан, добавлен в коллекцию и проверен с использованием стандартного SPL Token');

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