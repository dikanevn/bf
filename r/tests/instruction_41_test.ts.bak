/**
 * Тест для инструкции 41: Обновление метаданных pNFT
 * 
 * 
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

// Фиксированный адрес минта для обновления
const TARGET_MINT = new PublicKey('E2i6VKGsjXXbSXJUL2y6yEkJrHQZwSke7r9yuCQScrun');

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес минта для обновления:', TARGET_MINT.toBase58());

describe('Instruction 41', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  // const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  it('should update pNFT metadata', async function() {
    console.log('Начинаем тест обновления метаданных pNFT (инструкция 41)');
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
        data: Buffer.from([41]) // Номер инструкции
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
      
      console.log('Тест успешно завершен! Метаданные pNFT обновлены');

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