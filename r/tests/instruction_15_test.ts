/**
 * Тест для инструкции 15: Удаление записи о минтинге для раунда 10
 * 
 * Этот тест проверяет функциональность удаления PDA-аккаунта, который отслеживает
 * информацию о минтинге NFT для конкретного пользователя в раунде 10.
 */
import * as assert from 'assert';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Загружаем переменные окружения из .env файла
dotenv.config();

// Получаем ID программы из переменной окружения
if (!process.env.PROGRAM_ID) {
  throw new Error('Переменная окружения PROGRAM_ID не задана. Пожалуйста, установите её перед запуском теста.');
}
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);
console.log('ID программы:', PROGRAM_ID.toBase58());

describe('Instruction 15 Test', function() {
  // Увеличиваем таймаут до 30 секунд
  this.timeout(30000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));

  it('should delete mint record for round 1', async function() {
    console.log('Начинаем тест удаления записи о минтинге (инструкция 15)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());

    // Номер раунда для удаления
    const roundNumber = 1;
    console.log(`Удаляем запись для раунда ${roundNumber}`);

    // Получаем адрес PDA для отслеживания минтинга
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('minted'),
        // Используем 8-байтовое представление для соответствия u64.to_le_bytes() в Rust
        Buffer.concat([Buffer.from([roundNumber]), Buffer.alloc(7)]),
        payer.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    console.log('Mint Record PDA:', mintRecordPDA.toBase58());

    // Проверяем, существует ли аккаунт перед удалением
    const accountInfo = await connection.getAccountInfo(mintRecordPDA);
    if (!accountInfo) {
      console.log(`Аккаунт ${mintRecordPDA.toBase58()} не существует. Нечего удалять.`);
      this.skip();
      return;
    }
    console.log(`Аккаунт ${mintRecordPDA.toBase58()} существует. Размер: ${accountInfo.data.length} байт`);
    console.log(`Владелец аккаунта: ${accountInfo.owner.toBase58()}`);

    // Создаем буфер данных для инструкции
    const dataBuffer = Buffer.alloc(2);
    dataBuffer[0] = 15; // Инструкция 15
    dataBuffer[1] = roundNumber; // Используем раунд 1

    // Создаем инструкцию
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: dataBuffer,
    });

    // Создаем и отправляем транзакцию
    const transaction = new Transaction().add(instruction);
    
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
        { commitment: 'confirmed' }
      );
      console.log('Транзакция успешно выполнена. Сигнатура:', signature);
      
      // Проверяем, что аккаунт был удален
      const accountInfoAfter = await connection.getAccountInfo(mintRecordPDA);
      if (accountInfoAfter) {
        throw new Error(`Аккаунт ${mintRecordPDA.toBase58()} все еще существует после удаления!`);
      }
      console.log(`Аккаунт ${mintRecordPDA.toBase58()} успешно удален.`);
      
    } catch (error) {
      console.error('Ошибка при выполнении транзакции:', error);
      throw error;
    }
  });
}); 