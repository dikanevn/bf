import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { expect } from 'chai';
import * as dotenv from 'dotenv';

dotenv.config();

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe('Instruction 24', function() {
  // Увеличиваем таймаут до 30 секунд
  this.timeout(30000);

  // Подключение к девнет
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Загружаем приватный ключ из .env
  const privateKeyString = process.env.PRIVATE_KEY!;
  const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num));
  const payer = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

  // Создаем кейпару для минта
  const mint = Keypair.generate();

  it('should create a clean NFT 24', async function() {
    // Получаем PDA для mint authority
    const [programAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('mint_authority')],
      new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP')
    );

    // Получаем адрес метадаты
    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

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

    try {
      // Создаем инструкцию
      const instruction = new TransactionInstruction({
        programId: new PublicKey('YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP'),
        keys: [
          { pubkey: metadata, isSigner: false, isWritable: true },
          { pubkey: masterEdition, isSigner: false, isWritable: true },
          { pubkey: mint.publicKey, isSigner: true, isWritable: true },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: programAuthority, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([24]) // Instruction 23
      });

      // Создаем и отправляем транзакцию
      const transaction = new Transaction().add(instruction);
      const signature = await connection.sendTransaction(
        transaction,
        [payer, mint],
        { skipPreflight: true }
      );

      console.log('Transaction signature:', signature);
      
      // Ждем подтверждения
      await connection.confirmTransaction(signature, 'confirmed');

      // Проверяем создание NFT
      const metadataAccount = await connection.getAccountInfo(metadata);
      expect(metadataAccount).to.not.be.null;

      const masterEditionAccount = await connection.getAccountInfo(masterEdition);
      expect(masterEditionAccount).to.not.be.null;

    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  });
}); 