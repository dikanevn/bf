'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { useState } from 'react';
import DevnetWalletProvider from '../../components/DevnetWalletProvider';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PROGRAM_ID = new PublicKey("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

function DevContent() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null);
  const [tokenAccountKeypair, setTokenAccountKeypair] = useState<Keypair | null>(null);
  const [metadataAddress, setMetadataAddress] = useState<PublicKey | null>(null);

  const onCreateMint = async () => {
    if (!publicKey || !signTransaction) {
        alert("Пожалуйста, подключите кошелек!");
        return;
    }

    try {
        setLoading(true);
        const newMintKeypair = Keypair.generate();
        setMintKeypair(newMintKeypair);

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newMintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([1])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.partialSign(newMintKeypair);
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        alert(`Mint аккаунт создан!\nMint: ${newMintKeypair.publicKey.toString()}`);
    } catch (error) {
        console.error("Ошибка при создании mint аккаунта:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onCreateTokenAccount = async () => {
    if (!publicKey || !signTransaction || !mintKeypair) {
        alert("Пожалуйста, подключите кошелек и создайте mint сначала!");
        return;
    }

    try {
        setLoading(true);
        const newTokenAccountKeypair = Keypair.generate();
        setTokenAccountKeypair(newTokenAccountKeypair);

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newTokenAccountKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([2])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.partialSign(newTokenAccountKeypair);
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        alert(`Токен аккаунт создан!\nToken Account: ${newTokenAccountKeypair.publicKey.toString()}`);
    } catch (error) {
        console.error("Ошибка при создании токен аккаунта:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onMintToken = async () => {
    if (!publicKey || !signTransaction || !mintKeypair || !tokenAccountKeypair) {
        alert("Пожалуйста, создайте mint и токен аккаунт сначала!");
        return;
    }

    try {
        setLoading(true);

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: tokenAccountKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([3])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        alert(`Токен успешно отминчен!`);
    } catch (error) {
        console.error("Ошибка при минте токена:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onCreateMetadata = async () => {
    if (!publicKey || !signTransaction || !mintKeypair) {
        alert("Пожалуйста, подключите кошелек и создайте токен сначала!");
        return;
    }

    try {
        setLoading(true);

        const [newMetadataAddress] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBytes(),
                mintKeypair.publicKey.toBytes(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        setMetadataAddress(newMetadataAddress);

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newMetadataAddress, isSigner: false, isWritable: true },
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([4])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        alert(`Метадата создана!\nMetadata: ${newMetadataAddress.toString()}`);
    } catch (error) {
        console.error("Ошибка при создании метадаты:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onSetProgramAsAuthority = async () => {
    if (!publicKey || !signTransaction || !mintKeypair) {
        alert("Пожалуйста, подключите кошелек и создайте токен сначала!");
        return;
    }

    try {
        setLoading(true);

        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([5])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
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
    <div className="min-h-screen bg-black overflow-auto">
      <div className="pt-[2vh] px-[2vw] text-gray-400">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Главная
          </Link>
          <WalletMultiButton />
        </div>

        {publicKey && (
          <div className="mt-8 break-all">
            <div>Подключенный адрес: {publicKey.toString()}</div>
            {mintKeypair && <div className="mt-2">Mint Address: {mintKeypair.publicKey.toString()}</div>}
            {tokenAccountKeypair && <div className="mt-2">Token Account: {tokenAccountKeypair.publicKey.toString()}</div>}
            {metadataAddress && <div className="mt-2">Metadata Address: {metadataAddress.toString()}</div>}
          </div>
        )}

        {publicKey && (
          <div className="flex flex-col gap-4 mt-8">
            <button 
              onClick={onCreateMint} 
              disabled={loading}
              className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : '1. Создать mint аккаунт'}
            </button>
            
            <button 
              onClick={onCreateTokenAccount} 
              disabled={loading || !mintKeypair}
              className="mt-5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : '2. Создать токен аккаунт'}
            </button>

            <button 
              onClick={onMintToken} 
              disabled={loading || !mintKeypair || !tokenAccountKeypair}
              className="mt-5 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : '3. Минтить токен'}
            </button>

            <button 
              onClick={onCreateMetadata} 
              disabled={loading || !mintKeypair}
              className="mt-5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : '4. Создать метадату'}
            </button>

            <button 
              onClick={onSetProgramAsAuthority} 
              disabled={loading || !mintKeypair}
              className="mt-5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Processing...' : '5. Установить программу как mint authority'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DevPage() {
  return (
    <DevnetWalletProvider>
      <DevContent />
    </DevnetWalletProvider>
  );
} 