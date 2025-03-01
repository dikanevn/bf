import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { expect } from 'chai';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import bs58 from 'bs58';

dotenv.config();

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Instruction 26', function() {
  // Увеличиваем таймаут до 30 секунд
  this.timeout(30000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env в формате base58
  const privateKeyString = process.env.PRIVATE_KEY!;
  const payer = Keypair.fromSecretKey(bs58.decode(privateKeyString));

  // Создаем кейпару для минта
  const mint = Keypair.generate();

  it('should create NFT metadata with Merkle proof verification', async function() {
    console.log('Начинаем тест создания NFT metadata с Merkle proof V1 (инструкция 26)');
    console.log('Адрес плательщика:', payer.publicKey.toBase58());
    console.log('Адрес минта:', mint.publicKey.toBase58());

    // Создаем простой Merkle proof для теста
    const roundNumber = 0;
    const leaf = Buffer.from(payer.publicKey.toBytes());
    const proof = [
      Buffer.from("11111111111111111111111111111111", "hex"),
      Buffer.from("22222222222222222222222222222222", "hex"),
    ];

    // Получаем PDA для mint authority
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority')],
      new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP')
    );
    console.log('Program Authority PDA:', programAuthority.toBase58());

    // Получаем адрес PDA для расширенного отслеживания минтинга
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('is_minted_ext'),
        Buffer.from([roundNumber]),
        payer.publicKey.toBytes(),
      ],
      new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP')
    );
    console.log('Mint Record PDA:', mintRecordPDA.toBase58());

    // Получаем адрес метаданных
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBytes(),
        mint.publicKey.toBytes(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Metadata address:', metadataAddress.toBase58());

    // Получаем адрес master edition
    const [masterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBytes(),
        mint.publicKey.toBytes(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log('Master Edition address:', masterEdition.toBase58());

    // Создаем буфер данных для инструкции
    const dataLength = 2 + (proof.length * 32);
    const dataBuffer = Buffer.alloc(dataLength);
    dataBuffer[0] = 26; // Инструкция 26
    dataBuffer[1] = roundNumber; // Используем раунд 0
    
    // Записываем каждый узел доказательства в буфер
    for (let i = 0; i < proof.length; i++) {
      proof[i].copy(dataBuffer, 2 + (i * 32));
    }

    try {
      console.log('Создаем инструкцию...');
      const instruction = new TransactionInstruction({
        programId: new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP'),
        keys: [
          { pubkey: mint.publicKey, isSigner: true, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
          { pubkey: metadataAddress, isSigner: false, isWritable: true },
          { pubkey: masterEdition, isSigner: false, isWritable: true },
          { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
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