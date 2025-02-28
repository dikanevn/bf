import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { expect } from 'chai';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

describe('Instruction 15 Test', function() {
  // Увеличиваем таймаут до 30 секунд
  this.timeout(30000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));

  it('should delete mint record for round 10', async function() {
    console.log('Начинаем тест удаления записи о минтинге (инструкция 15)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());

    // Получаем адрес PDA для расширенного отслеживания минтинга
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('is_minted_ext'),
        Buffer.from([10]), // Используем раунд 10 (соответствует раунду 11 в UI)
        payer.publicKey.toBuffer(),
      ],
      new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP')
    );
    console.log('Mint Record PDA:', mintRecordPDA.toBase58());

    // Создаем буфер данных для инструкции
    const dataBuffer = Buffer.alloc(2);
    dataBuffer[0] = 15; // Инструкция 15
    dataBuffer[1] = 10; // Используем раунд 10 (соответствует раунду 11 в UI)

    try {
      console.log('Создаем инструкцию...');
      const instruction = new TransactionInstruction({
        programId: new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP'),
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
        ],
        data: dataBuffer
      });

      console.log('Создаем транзакцию...');
      const transaction = new Transaction().add(instruction);
      
      console.log('Отправляем транзакцию...');
      const signature = await connection.sendTransaction(
        transaction,
        [payer],
        { skipPreflight: true }
      );

      console.log('Транзакция отправлена. Сигнатура:', signature);
      console.log('Ожидаем подтверждения транзакции...');
      
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log('Статус подтверждения:', confirmation);

      // Добавляем задержку перед проверкой аккаунта
      console.log('Ждем 5 секунд перед проверкой аккаунта...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Проверяем удаление аккаунта...');
      
      // Проверяем, что запись о минтинге была удалена
      const mintRecordAccountInfo = await connection.getAccountInfo(mintRecordPDA);
      console.log('Mint Record аккаунт существует:', mintRecordAccountInfo !== null);
      expect(mintRecordAccountInfo).to.be.null;

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