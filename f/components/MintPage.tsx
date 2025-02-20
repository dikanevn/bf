'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { L } from "../../b/target/types/l"; // Убедитесь что путь правильный
import idl from "../../b/target/idl/l.json"; // Импортируем IDL как модуль

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

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

  const onCheckInitialized = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    try {
      setLoading(true);

      const programId = new PublicKey(idl.address);
      
      const isInitializedIx = idl.instructions.find(ix => ix.name === 'is_initialized');
      if (!isInitializedIx || !isInitializedIx.discriminator) {
        throw new Error("Инструкция is_initialized не найдена в IDL");
      }

      const data = Buffer.from(isInitializedIx.discriminator);

      const instruction = new TransactionInstruction({
        programId: programId,
        keys: [],
        data: data
      });

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      
      console.log("Transaction ID:", txid);

      // Ждем подтверждения и получаем логи
      const confirmation = await connection.confirmTransaction(txid);
      const txInfo = await connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

      if (txInfo?.meta?.logMessages) {
        console.log("Transaction logs:", txInfo.meta.logMessages);
        
        // Ищем результат в логах
        const resultLog = txInfo.meta.logMessages.find(log => 
          log.includes("Program log: Проверка инициализации программы...")
        );
        
        if (resultLog) {
          alert(`Транзакция выполнена. Результат: ${resultLog}`);
        } else {
          alert("Транзакция выполнена, но результат не найден в логах");
        }
      }

    } catch (error) {
      console.error("Ошибка при проверке инициализации:", error);
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
            onClick={onCheckInitialized} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Проверка...' : 'Проверить инициализацию'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MintPage;