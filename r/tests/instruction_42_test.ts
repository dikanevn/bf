/**
 * Тест для инструкции 42: Отправка SOL с PDA программы на указанный адрес
 * 
 */
import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL
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

// Фиксированный адрес получателя
const RECIPIENT_ADDRESS = new PublicKey('GDi7rtknaEdvgGrm9qpXbF54ZGZMGezmXLky2VQac2c6');
console.log('ID программы:', PROGRAM_ID.toBase58());
console.log('Адрес получателя:', RECIPIENT_ADDRESS.toBase58());

describe('Instruction 42', function() {
  // Увеличиваем таймаут до 60 секунд
  this.timeout(60000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  
  it('should withdraw SOL from program PDA to recipient', async function() {
    console.log('Начинаем тест отправки SOL с PDA программы (инструкция 42)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());
    
    // Находим PDA программы
    const [programAuthority, _bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority')],
      PROGRAM_ID
    );
    console.log('Program Authority PDA:', programAuthority.toBase58());

    // Сумма для отправки в лампортах (0.01 SOL = 10_000_000 лампортов)
    const amountToSend = 30_000_000;
    console.log(`Сумма для отправки: ${amountToSend / LAMPORTS_PER_SOL} SOL (${amountToSend} lamports)`);

    // Проверяем баланс получателя до транзакции
    const recipientBalanceBefore = await connection.getBalance(RECIPIENT_ADDRESS);
    console.log(`Баланс получателя до транзакции: ${recipientBalanceBefore / LAMPORTS_PER_SOL} SOL`);

    // Проверяем баланс PDA до транзакции
    const pdaBalanceBefore = await connection.getBalance(programAuthority);
    console.log(`Баланс PDA до транзакции: ${pdaBalanceBefore / LAMPORTS_PER_SOL} SOL`);

    // Если у PDA недостаточно средств, отправляем немного SOL на PDA
    if (pdaBalanceBefore < 0.02 * LAMPORTS_PER_SOL) {
      console.log('У PDA недостаточно средств, отправляем 0.05 SOL на PDA');
      
      const fundPdaTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: programAuthority,
          lamports: 0.05 * LAMPORTS_PER_SOL
        })
      );
      
      const fundPdaSignature = await sendAndConfirmTransaction(
        connection,
        fundPdaTx,
        [payer]
      );
      
      console.log(`PDA пополнен, сигнатура: ${fundPdaSignature}`);
      
      // Проверяем обновленный баланс PDA
      const pdaBalanceAfterFunding = await connection.getBalance(programAuthority);
      console.log(`Баланс PDA после пополнения: ${pdaBalanceAfterFunding / LAMPORTS_PER_SOL} SOL`);
    }

    // Создаем инструкцию для вызова нашей программы
    console.log('Создаем инструкцию...');
    
    // Создаем буфер с данными инструкции
    // Первый байт - номер инструкции (42)
    // Следующие 8 байт - сумма для отправки в лампортах (little-endian)
    const instructionData = Buffer.alloc(9);
    instructionData.writeUInt8(42, 0); // Инструкция 42
    instructionData.writeBigUInt64LE(BigInt(amountToSend), 1); // Сумма для отправки
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: programAuthority, isSigner: false, isWritable: true },
        { pubkey: RECIPIENT_ADDRESS, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      programId: PROGRAM_ID,
      data: instructionData
    });

    // Добавляем инструкцию увеличения бюджета вычислений
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 300000
    });

    // Создаем транзакцию
    console.log('Создаем транзакцию...');
    const transaction = new Transaction()
      .add(modifyComputeUnits)
      .add(instruction);

    // Отправляем транзакцию
    console.log('Отправляем транзакцию...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer]
    );
    console.log('Транзакция отправлена. Сигнатура:', signature);

    // Проверяем баланс получателя после транзакции
    const recipientBalanceAfter = await connection.getBalance(RECIPIENT_ADDRESS);
    console.log(`Баланс получателя после транзакции: ${recipientBalanceAfter / LAMPORTS_PER_SOL} SOL`);

    // Проверяем баланс PDA после транзакции
    const pdaBalanceAfter = await connection.getBalance(programAuthority);
    console.log(`Баланс PDA после транзакции: ${pdaBalanceAfter / LAMPORTS_PER_SOL} SOL`);

    // Проверяем, что баланс получателя увеличился на указанную сумму (с учетом погрешности)
    const expectedIncrease = amountToSend;
    const actualIncrease = recipientBalanceAfter - recipientBalanceBefore;
    
    console.log(`Ожидаемое увеличение: ${expectedIncrease / LAMPORTS_PER_SOL} SOL`);
    console.log(`Фактическое увеличение: ${actualIncrease / LAMPORTS_PER_SOL} SOL`);
    
    // Допускаем небольшую погрешность из-за комиссий и округлений
    expect(Math.abs(actualIncrease - expectedIncrease)).to.be.lessThan(100000); // погрешность до 0.0001 SOL
    
    console.log('Тест успешно завершен! SOL успешно отправлен с PDA программы на указанный адрес');
  });
}); 