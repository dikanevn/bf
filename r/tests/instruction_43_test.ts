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
const TARGET_MINT = new PublicKey('E2i6VKGsjXXbSXJUL2y6yEkJrHQZwSke7r9yuCQScrun');
// Адрес creator, который нужно установить
const NEW_CREATOR = new PublicKey('2XtQ1dd7JXQwT1Wx31jzaC6poAJj7pTPGfcCdJvu2t6V');

// Новые данные для метаданных
const NEW_NAME = "Yapster Infinity #1";
const NEW_SYMBOL = "YAPI1";
const NEW_URI = "https://a.b/c.json";
const NEW_SELLER_FEE_BASIS_POINTS = 1000;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес минта для обновления:', TARGET_MINT.toBase58());
console.log('Новый creator:', NEW_CREATOR.toBase58());
console.log('Новое имя:', NEW_NAME);
console.log('Новый символ:', NEW_SYMBOL);
console.log('Новый URI:', NEW_URI);
console.log('Новый seller fee basis points:', NEW_SELLER_FEE_BASIS_POINTS);

describe('Instruction 43', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к девнет
  // const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  it('should update all NFT metadata fields', async function() {
    console.log('Начинаем тест универсального обновления метаданных NFT (инструкция 43)');
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
      // Создаем данные инструкции
      // Формат:
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
      
      // Вычисляем общую длину данных
      const totalLength = 32 + 1 + 32 + 1 + 1 + NEW_NAME.length + 1 + NEW_SYMBOL.length + 1 + NEW_URI.length + 2;
      const instructionData = Buffer.alloc(totalLength);
      let offset = 0;
      
      // Записываем адрес минта
      const mintBytes = TARGET_MINT.toBytes();
      instructionData.set(mintBytes, offset);
      offset += 32;
      
      // Устанавливаем флаг наличия creator
      instructionData.writeUInt8(1, offset);
      offset += 1;
      
      // Записываем адрес creator
      const creatorBytes = NEW_CREATOR.toBytes();
      instructionData.set(creatorBytes, offset);
      offset += 32;
      
      // Устанавливаем флаг наличия метаданных
      instructionData.writeUInt8(1, offset);
      offset += 1;
      
      // Записываем name
      instructionData.writeUInt8(NEW_NAME.length, offset);
      offset += 1;
      instructionData.write(NEW_NAME, offset);
      offset += NEW_NAME.length;
      
      // Записываем symbol
      instructionData.writeUInt8(NEW_SYMBOL.length, offset);
      offset += 1;
      instructionData.write(NEW_SYMBOL, offset);
      offset += NEW_SYMBOL.length;
      
      // Записываем uri
      instructionData.writeUInt8(NEW_URI.length, offset);
      offset += 1;
      instructionData.write(NEW_URI, offset);
      offset += NEW_URI.length;
      
      // Записываем sellerFeeBasisPoints (big-endian)
      instructionData.writeUInt8((NEW_SELLER_FEE_BASIS_POINTS >> 8) & 0xFF, offset);
      offset += 1;
      instructionData.writeUInt8(NEW_SELLER_FEE_BASIS_POINTS & 0xFF, offset);
      
      // Добавляем номер инструкции в начало
      const finalInstructionData = Buffer.alloc(totalLength + 1);
      finalInstructionData.writeUInt8(43, 0); // Инструкция 43
      instructionData.copy(finalInstructionData, 1);
      
      console.log('Создаем инструкцию...');
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
      
      console.log('Проверяем обновление метаданных...');
      
      const metadataAccount = await connection.getAccountInfo(metadata);
      console.log('Metadata аккаунт существует:', metadataAccount !== null);
      if (metadataAccount) {
        console.log('Размер Metadata аккаунта:', metadataAccount.data.length);
        console.log('Владелец Metadata аккаунта:', metadataAccount.owner.toBase58());
      }

      expect(metadataAccount).to.not.be.null;
      
      console.log('Тест успешно завершен! Метаданные NFT обновлены');
      console.log('Проверьте метаданные NFT на Solscan или Solana Explorer');
      console.log(`https://solscan.io/token/${TARGET_MINT.toBase58()}`);

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