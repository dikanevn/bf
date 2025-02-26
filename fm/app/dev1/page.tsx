'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PROGRAM_ID = new PublicKey("YARH5uorBN1qRHXZNHMXnDsqg6hKrEQptPbg1eiQPeP");

interface SearchResult {
  round: number;
  participated: boolean;
  won: boolean;
  date: string;
}

interface D02Data {
  round: number;
  value: string;
  TOTAL_TICKETS: string;
  coefficient: string;
  BITCOIN_BLOCK_NUMBER?: string;
  RewardsOrDeploy?: string;
  winnersCount?: number;
}

const WalletMultiButtonDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

const DevnetWalletProviderDynamic = dynamic(
  () => import('../../components/DevnetWalletProvider'),
  { ssr: false }
);

function DevContent() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null);
  const [tokenAccountKeypair, setTokenAccountKeypair] = useState<Keypair | null>(null);
  const [metadataAddress, setMetadataAddress] = useState<PublicKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ataAddress, setAtaAddress] = useState<PublicKey | null>(null);
  const [winningRounds, setWinningRounds] = useState<SearchResult[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);

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

  const onCreateProgramMint = async () => {
    try {
        if (!publicKey || !sendTransaction) return;
        
        setIsLoading(true);
        const mintKeypair = Keypair.generate();
        
        const createMintIx = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([6])
        });

        const transaction = new Transaction().add(createMintIx);
        
        const signature = await sendTransaction(transaction, connection, {
            signers: [mintKeypair]
        });
        
        await connection.confirmTransaction(signature);
        setMintKeypair(mintKeypair);
        alert('Минт аккаунт успешно создан от имени программы!');
    } catch (error) {
        console.error(error);
        alert('Ошибка при создании минт аккаунта от программы');
    } finally {
        setIsLoading(false);
    }
  };

  const onCreateProgramATA = async () => {
    if (!publicKey || !signTransaction || !mintKeypair) {
        alert("Пожалуйста, подключите кошелек и создайте минт сначала!");
        return;
    }

    try {
        setLoading(true);

        const associatedTokenAccount = await getAssociatedTokenAddress(
            mintKeypair.publicKey,
            publicKey,
            false
        );

        const transaction = new Transaction();
        transaction.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: false, isWritable: false },
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([7])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        setTokenAccountKeypair(null); // Сбрасываем старый токен аккаунт
        setAtaAddress(associatedTokenAccount); // Сохраняем адрес АТА
        alert(`Ассоциированный токен аккаунт создан!\nATA: ${associatedTokenAccount.toString()}`);
    } catch (error) {
        console.error("Ошибка при создании ассоциированного токен аккаунта:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const onMintToken = async () => {
    if (!publicKey || !signTransaction || !mintKeypair || !ataAddress) {
        alert("Пожалуйста, подключите кошелек, создайте минт и АТА сначала!");
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
                { pubkey: ataAddress, isSigner: false, isWritable: true },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([8])
        }));
        
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signedTx = await signTransaction(transaction);
        const txid = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txid);
        
        alert('Токен успешно заминчен!');
    } catch (error) {
        console.error("Ошибка при минтинге токена:", error);
        alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setLoading(false);
    }
  };

  const loadWinningRounds = async (address: string) => {
    try {
      const results: SearchResult[] = [];
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d2.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      setTotalGames(lastFoundRound);

      // Загружаем данные для каждого раунда
      for (let i = 1; i <= lastFoundRound; i++) {
        try {
          const d2 = await import(`../../../b/rounds/${i}/d2.json`);
          const d3 = await import(`../../../b/rounds/${i}/d3.json`);
          const d02 = await import(`../../../b/rounds/${i}/d02.json`);

          const participated = d2.default.some((item: { player: string }) => item.player === address);
          const won = d3.default.some((item: { player: string }) => item.player === address);
          
          if (participated || won) {
            const date = d02.default.find((item: D02Data) => item.round === i)?.RewardsOrDeploy;
            results.push({
              round: i,
              participated,
              won,
              date: date ? new Date(date).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long'
              }) : `Round ${i}`
            });
          }
        } catch {
          continue;
        }
      }

      const wins = results.filter(r => r.won).length;
      const losses = results.filter(r => r.participated && !r.won).length;
      
      setTotalWins(wins);
      setTotalLosses(losses);
      setWinningRounds(results.filter(r => r.won).sort((a, b) => b.round - a.round));
    } catch (error) {
      console.error("Ошибка при загрузке выигрышных раундов:", error);
    }
  };

  useEffect(() => {
    if (publicKey) {
      void loadWinningRounds(publicKey.toString());
    }
  }, [publicKey]);

  return (
    <div className="min-h-screen bg-black overflow-auto">
      <div className="pt-[2vh] px-[2vw] text-gray-400">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Главная
          </Link>
          <WalletMultiButtonDynamic />
        </div>

        {publicKey && (
          <div className="mt-8 break-all">
            <div>Подключенный адрес: {publicKey.toString()}</div>
            {mintKeypair && <div className="mt-2">Mint Address: {mintKeypair.publicKey.toString()}</div>}
            {ataAddress && <div className="mt-2">Associated Token Account: {ataAddress.toString()}</div>}
            {metadataAddress && <div className="mt-2">Metadata Address: {metadataAddress.toString()}</div>}
            
            <div className="mt-4 text-gray-400">
              <div>Всего игр: {totalGames}</div>
              <div>Выиграно: {totalWins}</div>
              <div>Проиграно: {totalLosses}</div>
            </div>

            {winningRounds.length > 0 && (
              <div className="mt-4">
                <h3 className="text-gray-400 mb-2">Выигрышные раунды:</h3>
                {winningRounds.map((result) => (
                  <div key={result.round} className="text-green-400">
                    Раунд {result.round} | {result.date} | Выигрыш подтвержден! ✅
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {publicKey && (
          <div className="flex flex-col gap-4 mt-8">
            <button 
              onClick={onCreateMetadata} 
              disabled={loading || !mintKeypair}
              className="mt-5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : '1. Создать метадату'}
            </button>

            <button 
              onClick={onSetProgramAsAuthority} 
              disabled={loading || !mintKeypair}
              className="mt-5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : '2. Установить программу как mint authority'}
            </button>

            <button 
              onClick={onCreateProgramMint}
              disabled={!publicKey || isLoading}
              className="mt-5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '3. Создать минт от имени программы'}
            </button>

            <button 
              onClick={onCreateProgramATA}
              disabled={loading || !mintKeypair}
              className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : '4. Создать ассоциированный токен аккаунт'}
            </button>

            <button 
              onClick={onMintToken}
              disabled={loading || !mintKeypair || !ataAddress}
              className="mt-5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : '5. Минтить токен'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DevPage() {
  return (
    <DevnetWalletProviderDynamic>
      <DevContent />
    </DevnetWalletProviderDynamic>
  );
} 