'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useCallback } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import idl from '../../b/target/idl/l.json';

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

export function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [program, setProgram] = useState<anchor.Program | null>(null);

  const initializeProgram = useCallback(async () => {
    if (!window.solana || !publicKey || !signTransaction || !connection) return;

    try {
      const programId = new PublicKey(idl.address);
      
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey,
          signTransaction,
          signAllTransactions: signTransaction,
        },
        { commitment: 'processed' }
      );
      
      anchor.setProvider(provider);
      
      const program = new anchor.Program(idl as anchor.Idl, programId, provider);
      setProgram(program);
    } catch (error) {
      console.error("Ошибка инициализации программы:", error);
    }
  }, [connection, publicKey, signTransaction]);

  useEffect(() => {
    setIsClient(true);
    initializeProgram();
  }, [initializeProgram]);

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

  const onCreateToken = async () => {
    if (!publicKey || !signTransaction || !program) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    try {
      setLoading(true);
      const isInit = await program.methods
        .isInitialized()
        .accounts({})
        .rpc();
      
      alert(`Программа инициализирована: ${isInit}`);
    } catch (error) {
      console.error("Ошибка:", error);
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
            onClick={onCreateToken} 
            disabled={loading || !program}
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