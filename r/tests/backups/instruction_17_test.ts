/**
 * Тест для инструкции 17: Создание NFT с проверкой Merkle-доказательства
 * 
 * Этот тест проверяет функциональность создания "чистого" NFT и минтинга токена
 * с верификацией через Merkle-дерево. Используются данные из раунда 11 для
 * построения Merkle-дерева и проверки, что адрес пользователя находится в списке
 * разрешенных для минтинга.
 */
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { expect } from 'chai';
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
console.log('ID программы:', PROGRAM_ID.toBase58());

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Функция для вычисления sha256 хеша
function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

describe('Instruction 17', function() {
  // Увеличиваем таймаут до 30 секунд
  this.timeout(30000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));

  // Создаем кейпару для минта
  const mint = Keypair.generate();

  it('should create a clean NFT and mint a token with Merkle proof verification', async function() {
    console.log('Начинаем тест создания NFT с Merkle proof (инструкция 17)');
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

    // Получаем адрес ассоциированного токен аккаунта
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      payer.publicKey,
      false
    );
    console.log('Адрес ассоциированного токен аккаунта:', associatedTokenAccount.toBase58());

    // Получаем PDA для mint authority
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority')],
      PROGRAM_ID
    );
    console.log('Program Authority PDA:', programAuthority.toBase58());

    // Получаем адрес PDA для расширенного отслеживания минтинга
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('is_minted_ext'),
        Buffer.from([10]), // Используем раунд 10 (соответствует раунду 11 в UI)
        payer.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    console.log('Mint Record PDA:', mintRecordPDA.toBase58());

    // Получаем адрес метаданных
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Metadata address:', metadataAddress.toBase58());

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
    console.log('Master Edition address:', masterEdition.toBase58());

    // Создаем буфер данных для инструкции
    const dataLength = 2 + (proof.length * 32);
    const dataBuffer = Buffer.alloc(dataLength);
    dataBuffer[0] = 17; // Инструкция 17
    dataBuffer[1] = 10; // Используем раунд 10 (соответствует раунду 11 в UI)
    
    // Записываем каждый узел доказательства в буфер
    for (let i = 0; i < proof.length; i++) {
      proof[i].copy(dataBuffer, 2 + (i * 32));
    }

    try {
      console.log('Создаем инструкцию...');
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: mint.publicKey, isSigner: true, isWritable: true },
          { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
          { pubkey: metadataAddress, isSigner: false, isWritable: true },
          { pubkey: masterEdition, isSigner: false, isWritable: true },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: dataBuffer
      });

      console.log('Создаем транзакцию...');
      const transaction = new Transaction().add(instruction);
      
      console.log('Отправляем транзакцию...');
      const signature = await connection.sendTransaction(
        transaction,
        [payer, mint],
        { skipPreflight: true }
      );

      console.log('Транзакция отправлена. Сигнатура:', signature);
      console.log('Ожидаем подтверждения транзакции...');
      
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log('Статус подтверждения:', confirmation);

      // Добавляем задержку перед проверкой аккаунтов
      console.log('Ждем 5 секунд перед проверкой аккаунтов...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Проверяем создание аккаунтов...');
      
      // Проверяем, что токен был создан
      const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAccount);
      console.log('Баланс токен аккаунта:', tokenAccount.value.uiAmount);
      expect(tokenAccount.value.uiAmount).to.equal(1);

      // Проверяем, что метаданные были созданы
      const metadataAccountInfo = await connection.getAccountInfo(metadataAddress);
      console.log('Metadata аккаунт существует:', metadataAccountInfo !== null);
      if (metadataAccountInfo) {
        console.log('Размер Metadata аккаунта:', metadataAccountInfo.data.length);
        console.log('Владелец Metadata аккаунта:', metadataAccountInfo.owner.toBase58());
      }
      expect(metadataAccountInfo).to.not.be.null;

      // Проверяем, что master edition был создан
      const masterEditionAccountInfo = await connection.getAccountInfo(masterEdition);
      console.log('Master Edition аккаунт существует:', masterEditionAccountInfo !== null);
      if (masterEditionAccountInfo) {
        console.log('Размер Master Edition аккаунта:', masterEditionAccountInfo.data.length);
        console.log('Владелец Master Edition аккаунта:', masterEditionAccountInfo.owner.toBase58());
      }
      expect(masterEditionAccountInfo).to.not.be.null;

      // Проверяем, что запись о минтинге была создана
      const mintRecordAccountInfo = await connection.getAccountInfo(mintRecordPDA);
      console.log('Mint Record аккаунт существует:', mintRecordAccountInfo !== null);
      if (mintRecordAccountInfo) {
        console.log('Размер Mint Record аккаунта:', mintRecordAccountInfo.data.length);
      }
      expect(mintRecordAccountInfo).to.not.be.null;
      expect(mintRecordAccountInfo!.data.length).to.equal(32);

      console.log('Тест успешно завершен!');

    } catch (err: any) {
      console.error('Произошла ошибка при выполнении теста:');
      console.error('Тип ошибки:', err.constructor.name);
      console.error('Сообщение ошибки:', err.message);
      if (err.logs) {
        console.error('Логи программы:');
        err.logs.forEach((log: string, index: number) => {
          console.error(`${index + 1}:`, log);
        });
      }
      throw err;
    }
  });
}); 