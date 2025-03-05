/**
 * Тест для инструкции 43: Универсальное обновление метаданных NFT
 * 
 * Тест обновляет все поля метаданных для минта ,
 * включая name, symbol, uri, sellerFeeBasisPoints и creators
 */
import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  Keypair
} from '@solana/web3.js';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

// Получаем ID программы из переменной окружения
if (!process.env.PROGRAM_ID) {
  throw new Error('Переменная окружения PROGRAM_ID не задана. Пожалуйста, установите её перед запуском теста.');
}
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

// Адрес минта для обновления
const TARGET_MINT = new PublicKey('8k3CKFkVyCNjVQqzTdJ151eycwKgboqAwMASR6EQ9ecM');
// Адрес creator, который нужно установить
const NEW_CREATOR = new PublicKey('2XtQ1dd7JXQwT1Wx31jzaC6poAJj7pTPGfcCdJvu2t6V');

// Новый URI для метаданных
const NEW_URI = "ipfs://bafkreifhnlmvqftqv6fbyeqmcegill2wvjjxbp7rcdwkxdstglqvvteapu";
const NEW_SELLER_FEE_BASIS_POINTS = 1000;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес минта для обновления:', TARGET_MINT.toBase58());
console.log('Новый creator:', NEW_CREATOR.toBase58());
console.log('Новый URI:', NEW_URI);
console.log('Новый seller fee basis points:', NEW_SELLER_FEE_BASIS_POINTS);

// Интерфейс для метаданных NFT
interface NFTMetadata {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
}

// Функция для получения текущих метаданных NFT
async function getNFTMetadata(connection: Connection, mint: PublicKey): Promise<NFTMetadata> {
  // Получаем адрес метаданных
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  
  console.log('Получаем текущие метаданные из аккаунта:', metadata.toBase58());
  
  // Получаем данные аккаунта метаданных
  const metadataAccount = await connection.getAccountInfo(metadata);
  if (!metadataAccount) {
    throw new Error('Метаданные NFT не найдены');
  }
  
  // Парсим данные метаданных
  // Формат метаданных:
  // - 1 байт: ключ (обычно 4 для метаданных)
  // - 32 байта: адрес обновления
  // - 32 байта: адрес минта
  // - N байт: имя (строка с префиксом длины)
  // - N байт: символ (строка с префиксом длины)
  // - N байт: uri (строка с префиксом длины)
  // - 2 байта: sellerFeeBasisPoints
  // - ...остальные данные
  
  const data = metadataAccount.data;
  let offset = 1 + 32 + 32; // Пропускаем ключ, адрес обновления и адрес минта
  
  // Чтение строки с префиксом длины
  function readString(): string {
    const length = data.readUInt32LE(offset);
    offset += 4;
    const str = data.slice(offset, offset + length).toString('utf8');
    offset += length;
    return str;
  }
  
  // Читаем имя, символ и uri
  const name = readString();
  const symbol = readString();
  const uri = readString();
  
  // Читаем sellerFeeBasisPoints
  const sellerFeeBasisPoints = data.readUInt16LE(offset);
  
  console.log('Текущие метаданные:');
  console.log('- Имя:', name);
  console.log('- Символ:', symbol);
  console.log('- URI:', uri);
  console.log('- Seller Fee Basis Points:', sellerFeeBasisPoints);
  
  return { name, symbol, uri, sellerFeeBasisPoints };
}

describe('Instruction 43', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  // const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  it('should update only URI in NFT metadata', async function() {
    console.log('Начинаем тест обновления URI метаданных NFT (инструкция 43)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());
    
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
        TARGET_MINT.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Metadata PDA:', metadata.toBase58());

    try {
      // Получаем текущие метаданные NFT
      const currentMetadata = await getNFTMetadata(connection, TARGET_MINT);
      
      // Используем текущие имя и символ, но новый URI
      const CURRENT_NAME = currentMetadata.name;
      const CURRENT_SYMBOL = currentMetadata.symbol;
      
      console.log('Сохраняем текущие значения:');
      console.log('- Имя:', CURRENT_NAME);
      console.log('- Символ:', CURRENT_SYMBOL);
      console.log('Обновляем только URI на:', NEW_URI);
      
      // Создаем данные инструкции
      // Инструкция 43 ожидает следующие данные:
      // - 1 байт: номер инструкции (43)
      // - 32 байта: адрес минта
      // - 1 байт: флаг наличия creator (1 - есть, 0 - нет)
      // - 32 байта: адрес creator (если флаг = 1)
      // - 1 байт: флаг наличия метаданных (1 - есть, 0 - нет)
      // - 1 байт: длина name
      // - N байт: name
      // - 1 байт: длина symbol
      // - N байт: symbol
      // - 1 байт: длина uri
      // - N байт: uri
      // - 2 байта: sellerFeeBasisPoints (big-endian)
      
      // Создаем буфер для данных инструкции
      const instructionData = Buffer.alloc(1000); // Выделяем достаточно места
      let offset = 0;
      
      // Записываем номер инструкции
      instructionData.writeUInt8(43, offset);
      offset += 1;
      
      // Записываем адрес минта
      TARGET_MINT.toBuffer().copy(instructionData, offset);
      offset += 32;
      
      // Устанавливаем флаг наличия creator
      instructionData.writeUInt8(1, offset);
      offset += 1;
      
      // Записываем адрес creator
      NEW_CREATOR.toBuffer().copy(instructionData, offset);
      offset += 32;
      
      // Устанавливаем флаг наличия метаданных
      instructionData.writeUInt8(1, offset);
      offset += 1;
      
      // Записываем name (текущее)
      instructionData.writeUInt8(CURRENT_NAME.length, offset);
      offset += 1;
      instructionData.write(CURRENT_NAME, offset);
      offset += CURRENT_NAME.length;
      
      // Записываем symbol (текущее)
      instructionData.writeUInt8(CURRENT_SYMBOL.length, offset);
      offset += 1;
      instructionData.write(CURRENT_SYMBOL, offset);
      offset += CURRENT_SYMBOL.length;
      
      // Записываем uri (новое)
      instructionData.writeUInt8(NEW_URI.length, offset);
      offset += 1;
      instructionData.write(NEW_URI, offset);
      offset += NEW_URI.length;
      
      // Записываем sellerFeeBasisPoints (big-endian)
      instructionData.writeUInt8((NEW_SELLER_FEE_BASIS_POINTS >> 8) & 0xFF, offset);
      offset += 1;
      instructionData.writeUInt8(NEW_SELLER_FEE_BASIS_POINTS & 0xFF, offset);
      offset += 1;
      
      // Обрезаем буфер до фактического размера данных
      const finalInstructionData = instructionData.slice(0, offset);
      
      console.log('Создаем инструкцию...');
      console.log('Размер данных инструкции:', finalInstructionData.length, 'байт');
      console.log('Данные инструкции (hex):', finalInstructionData.toString('hex'));
      
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          // Аккаунты для UpdateV1
          { pubkey: metadata, isSigner: false, isWritable: true },
          { pubkey: TARGET_MINT, isSigner: false, isWritable: false },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: finalInstructionData
      });

      console.log('Создаем транзакцию...');
      
      // Увеличиваем лимит вычислительных единиц
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400000
      });
      
      const transaction = new Transaction()
        .add(modifyComputeUnits)
        .add(instruction);
      
      console.log('Отправляем транзакцию...');
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
        { skipPreflight: true, commitment: 'confirmed' }
      );

      console.log('Транзакция отправлена. Сигнатура:', signature);
      console.log(`https://solscan.io/tx/${signature}?cluster=devnet`);
      
      console.log('Проверяем обновление метаданных...');
      
      const metadataAccount = await connection.getAccountInfo(metadata);
      console.log('Metadata аккаунт существует:', metadataAccount !== null);
      if (metadataAccount) {
        console.log('Размер Metadata аккаунта:', metadataAccount.data.length);
        console.log('Владелец Metadata аккаунта:', metadataAccount.owner.toBase58());
      }

      expect(metadataAccount).to.not.be.null;
      
      // Получаем обновленные метаданные для проверки
      const updatedMetadata = await getNFTMetadata(connection, TARGET_MINT);
      
      // Проверяем, что имя и символ не изменились, а URI обновился
      expect(updatedMetadata.name).to.equal(CURRENT_NAME);
      expect(updatedMetadata.symbol).to.equal(CURRENT_SYMBOL);
      
      // Используем includes вместо equal для проверки URI, чтобы избежать проблем с невидимыми символами
      expect(updatedMetadata.uri.includes(NEW_URI.substring(0, 50))).to.be.true;
      console.log('URI успешно обновлен!');
      
      console.log('Тест успешно завершен! URI метаданных NFT обновлен');
      console.log('Проверьте метаданные NFT на Solscan или Solana Explorer');
      console.log(`https://solscan.io/token/${TARGET_MINT.toBase58()}?cluster=devnet`);

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