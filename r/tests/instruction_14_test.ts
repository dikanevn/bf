import { 
  Connection, 
  PublicKey, 
  SystemProgram,
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
  throw new Error('Переменная окружения PROGRAM_ID не задана');
}
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

// Адрес минта для создания записи
const TARGET_MINT = new PublicKey('E2i6VKGsjXXbSXJUL2y6yEkJrHQZwSke7r9yuCQScrun');

// Номер раунда (5 для раунда 6, так как нумерация с 0)
const ROUND_NUMBER = 5;

describe('Instruction 14', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  // const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  // Загружаем приватный ключ из .env
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  it('should create manual mint record for round 6', async function() {
    console.log('Начинаем тест ручного создания записи о минте (инструкция 14)');
    console.log('ID программы:', PROGRAM_ID.toBase58());
    console.log('Адрес минта:', TARGET_MINT.toBase58());
    console.log('Номер раунда:', ROUND_NUMBER, '(соответствует раунду', ROUND_NUMBER + 1, ')');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());
    
    // Получаем PDA для записи о минте
    const roundBytes = Buffer.alloc(8);
    roundBytes.writeBigUInt64LE(BigInt(ROUND_NUMBER));
    
    const [mintRecordAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('minted'),
        roundBytes,
        payer.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    console.log('Mint Record PDA:', mintRecordAccount.toBase58());

    try {
      // Создаем буфер данных для инструкции
      const instructionData = Buffer.alloc(41); // 1 байт для номера инструкции + 8 байт для раунда + 32 байта для минта
      instructionData.writeUInt8(14, 0); // Номер инструкции
      instructionData.writeBigUInt64LE(BigInt(ROUND_NUMBER), 1); // Номер раунда как u64
      const mintBytes = TARGET_MINT.toBuffer();
      instructionData.set(mintBytes, 9); // Адрес минта
      
      console.log('Создаем инструкцию...');
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: mintRecordAccount, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData
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
      
      // Проверяем создание аккаунта
      const mintRecordInfo = await connection.getAccountInfo(mintRecordAccount);
      console.log('Mint Record аккаунт существует:', mintRecordInfo !== null);
      if (mintRecordInfo) {
        console.log('Размер Mint Record аккаунта:', mintRecordInfo.data.length);
        console.log('Владелец Mint Record аккаунта:', mintRecordInfo.owner.toBase58());
        
        // Проверяем записанный адрес минта
        const storedMint = new PublicKey(mintRecordInfo.data.slice(0, 32));
        console.log('Записанный адрес минта:', storedMint.toBase58());
        expect(storedMint.equals(TARGET_MINT)).to.be.true;
      }

      expect(mintRecordInfo).to.not.be.null;
      
      console.log('Тест успешно завершен! Запись о минте создана');

    } catch (err: any) {
      console.error('Произошла ошибка при выполнении теста:');
      console.error('Тип ошибки:', err.constructor.name);
      console.error('Сообщение ошибки:', err.message);
      console.error('Полная ошибка:', err);
      
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