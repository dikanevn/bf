'use client';

import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { L } from "../../b/target/types/l"; // Убедитесь что путь правильный
import idl from "../../b/target/idl/l.json"; // Импортируем IDL как модуль
import { Idl } from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Buffer } from 'buffer';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;

// Добавляем ID нашей программы
const PROGRAM_ID = new PublicKey("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

export function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const wallet = useAnchorWallet();

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

  const onInitializeToken = async () => {
    if (!wallet) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    try {
      setLoading(true);

      // Создаем AnchorProvider с полноценным wallet объектом
      const provider = new AnchorProvider(
        connection,
        wallet,
        {commitment: 'confirmed'}
      );
      
      const program = new Program(
        idl as Idl,
        new PublicKey(idl.metadata.address), // используем metadata.address
        provider as anchor.Provider // явно указываем тип провайдера
      );

      // Генерируем новый keypair для mint аккаунта
      const mintKeypair = anchor.web3.Keypair.generate();

      const txid = await program.methods
        .initializeToken()
        .accounts({
          mint: mintKeypair.publicKey,
        })
        .signers([mintKeypair])
        .rpc();

      console.log("Transaction ID:", txid);
      console.log("Mint address:", mintKeypair.publicKey.toString());

      const confirmation = await connection.confirmTransaction(txid);
      const txInfo = await connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

      if (txInfo?.meta?.logMessages) {
        console.log("Transaction logs:", txInfo.meta.logMessages);
        const resultLog = txInfo.meta.logMessages.find(log => 
          log.includes("Токен успешно создан")
        );
        
        if (resultLog) {
          alert(`Токен успешно создан! Mint address: ${mintKeypair.publicKey.toString()}`);
        } else {
          alert("Транзакция выполнена, но результат не найден в логах");
        }
      }

    } catch (error) {
      console.error("Ошибка при инициализации токена:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const onCheckInitializedRust = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    try {
      setLoading(true);

      // Создаем инструкцию для вызова программы
      const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [], // Пустой массив, так как нам не нужны аккаунты
        data: Buffer.from([0]) // 0 - индекс для инструкции is_initialized
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
          log.includes("Program is initialized!")
        );
        
        if (resultLog) {
          alert("Программа инициализирована!");
        } else {
          alert("Программа не инициализирована или произошла ошибка");
        }
      }

    } catch (error) {
      console.error("Ошибка при проверке инициализации:", error);
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

        // Создаем keypair для нового минта и токен аккаунта
        const mintKeypair = Keypair.generate();
        const tokenAccountKeypair = Keypair.generate();

        // Создаем инструкцию для вызова нашей программы
        const instruction = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                // Mint аккаунт
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                // Mint authority (владелец минта)
                { pubkey: publicKey, isSigner: true, isWritable: false },
                // Payer (платит за создание аккаунта)
                { pubkey: publicKey, isSigner: true, isWritable: true },
                // System Program для создания аккаунта
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                // Token Program для инициализации минта
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                // Rent sysvar для проверки rent exemption
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                // Token Account для хранения токенов
                { pubkey: tokenAccountKeypair.publicKey, isSigner: true, isWritable: true },
            ],
            data: Buffer.from([1]) // индекс 1 для create_and_mint_token инструкции
        });

        const transaction = new Transaction();
        transaction.add(instruction);
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        // Подписываем транзакцию обоими keypair'ами
        transaction.partialSign(mintKeypair);
        transaction.partialSign(tokenAccountKeypair);
        
        // Подписываем транзакцию через wallet adapter
        const signedTx = await signTransaction(transaction);
        
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        
        console.log("Transaction ID:", txid);
        console.log("Mint address:", mintKeypair.publicKey.toString());
        console.log("Token Account address:", tokenAccountKeypair.publicKey.toString());

        // Ждем подтверждения и получаем логи
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
            onClick={onCheckInitialized} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Проверка...' : 'Проверить инициализацию'}
          </button>
          <button 
            onClick={onInitializeToken} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-400"
          >
            {loading ? 'Создание...' : 'Создать токен'}
          </button>
          <button 
            onClick={onCheckInitializedRust} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-red-500 text-white hover:bg-red-600 disabled:bg-gray-400"
          >
            {loading ? 'Проверка...' : 'Проверить инициализацию (Rust)'}
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

export default MintPage;