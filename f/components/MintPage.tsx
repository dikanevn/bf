'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';

// Импортируем только PROGRAM_ID из метаплекса
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

// ID нашей программы
const PROGRAM_ID = new PublicKey("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

export function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [mintAddress, setMintAddress] = useState<PublicKey | null>(null);

  const onCreateAndMintToken = async () => {
    if (!publicKey || !signTransaction) {
        alert("Пожалуйста, подключите кошелек!");
        return;
    }

    try {
        setLoading(true);

        const mintKeypair = Keypair.generate();
        const tokenAccountKeypair = Keypair.generate();
        
        // Вычисляем PDA для метадаты
        const [metadataAddress] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBytes(),
                mintKeypair.publicKey.toBytes(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        const transaction = new Transaction();

        // Создание и инициализация токена
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: tokenAccountKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: metadataAddress, isSigner: false, isWritable: true },
            ],
            data: Buffer.from([1]) // Команда для создания токена
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        transaction.partialSign(mintKeypair);
        transaction.partialSign(tokenAccountKeypair);
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        
        console.log("Transaction ID:", txid);
        console.log("Mint address:", mintKeypair.publicKey.toString());
        console.log("Token Account address:", tokenAccountKeypair.publicKey.toString());
        console.log("Metadata address:", metadataAddress.toString());

        await connection.confirmTransaction(txid);
        
        setMintAddress(mintKeypair.publicKey);
        alert(`Токен успешно создан!\nMint: ${mintKeypair.publicKey.toString()}\nMetadata: ${metadataAddress.toString()}`);

    } catch (error) {
        console.error("Ошибка при создании токена:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onSetProgramAsAuthority = async () => {
    if (!publicKey || !signTransaction || !mintAddress) {
        alert("Пожалуйста, подключите кошелек и создайте токен сначала!");
        return;
    }

    try {
        setLoading(true);

        // Получаем PDA программы, которая будет mint authority
        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        const transaction = new Transaction();

        // Установка программы как mint authority
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintAddress, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([2]) // Команда для установки mint authority
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        
        console.log("Transaction ID:", txid);
        console.log("Program Authority (new mint authority):", programAuthority.toString());

        await connection.confirmTransaction(txid);
        
        alert(`Mint authority успешно изменен на программу!\nProgram Authority: ${programAuthority.toString()}`);

    } catch (error) {
        console.error("Ошибка при смене mint authority:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <WalletMultiButton />
      {publicKey && (
        <div className="flex flex-col gap-4">
          <button 
            onClick={onCreateAndMintToken} 
            disabled={loading}
            className="mt-5"
          >
            {loading ? 'Processing...' : 'Создать и минтить токен'}
          </button>
          <button 
            onClick={onSetProgramAsAuthority} 
            disabled={loading || !mintAddress}
            className="mt-5"
          >
            {loading ? 'Processing...' : 'Установить программу как mint authority'}
          </button>
        </div>
      )}
    </div>
  );
}