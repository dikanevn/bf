'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

// ID нашей программы
const PROGRAM_ID = new PublicKey("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

export function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  const onTransferSol = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }
    try {
      setLoading(true);

      const instruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: RECIPIENT_ADDRESS,
        lamports: TRANSFER_AMOUNT,
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      
      console.log("Transaction ID:", txid);
      alert("Транзакция отправлена. TXID: " + txid);

    } catch (error) {
      console.error("Ошибка при отправке SOL:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const onCreateTokenRust = async () => {
    if (!publicKey || !signTransaction) {
        alert("Пожалуйста, подключите кошелек!");
        return;
    }

    try {
        setLoading(true);

        const mintKeypair = Keypair.generate();
        const tokenAccountKeypair = Keypair.generate();

        const instruction = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: tokenAccountKeypair.publicKey, isSigner: true, isWritable: true },
            ],
            data: Buffer.from([1])
        });

        const transaction = new Transaction();
        transaction.add(instruction);
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        transaction.partialSign(mintKeypair);
        transaction.partialSign(tokenAccountKeypair);
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        
        console.log("Transaction ID:", txid);
        console.log("Mint address:", mintKeypair.publicKey.toString());
        console.log("Token Account address:", tokenAccountKeypair.publicKey.toString());

        const confirmation = await connection.confirmTransaction(txid);
        const txInfo = await connection.getTransaction(txid, {
            maxSupportedTransactionVersion: 0,
        });

        if (txInfo?.meta?.logMessages) {
            console.log("Transaction logs:", txInfo.meta.logMessages);
            const resultLog = txInfo.meta.logMessages.find(log => 
                log.includes("Token mint and account created successfully!")
            );
            
            if (resultLog) {
                alert(`Токен успешно создан!\nMint address: ${mintKeypair.publicKey.toString()}\nToken Account: ${tokenAccountKeypair.publicKey.toString()}`);
            } else {
                alert("Транзакция выполнена, но результат не найден в логах");
            }
        }

    } catch (error) {
        console.error("Ошибка при создании токена:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <WalletMultiButton className="rounded-none bg-purple-700 text-white shadow-xl" />
      {publicKey && (
        <div className="flex flex-col gap-4">
          <button 
            onClick={onTransferSol} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Send 0.001 SOL'}
          </button>
          <button 
            onClick={onCreateTokenRust} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-400"
          >
            {loading ? 'Создание...' : 'Создать токен (Rust)'}
          </button>
        </div>
      )}
    </div>
  );
}