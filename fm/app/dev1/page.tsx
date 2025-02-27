'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from 'buffer';
import { useState, useEffect } from 'react';
import { sha256 as jsSha256 } from 'js-sha256';
import { MerkleTree } from 'merkletreejs';

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

// Вспомогательная функция для хеширования
function sha256(data: Buffer): Buffer {
    // Используем тот же формат, что и в контракте
    const hashHex = jsSha256(data);
    return Buffer.from(hashHex, 'hex');
}

// Константа с корнем меркл-дерева из контракта
const MERKLE_ROOT = Buffer.from([
    0x90, 0x60, 0xf8, 0xcb, 0xf8, 0xce, 0xa8, 0xa4,
    0x8c, 0xb4, 0x69, 0x7c, 0x62, 0xe8, 0xaa, 0x4f,
    0x10, 0x4c, 0x9a, 0x22, 0x69, 0xb4, 0x6f, 0xc6,
    0x9b, 0x49, 0x74, 0x92, 0x3c, 0xff, 0x1b, 0x13
]);

// Функция для проверки меркл-доказательства
function verifyMerkleProof(proof: Buffer[], leaf: Buffer, root: Buffer): boolean {
    let computedHash = leaf;
    
    for (const proofElement of proof) {
        if (Buffer.compare(computedHash, proofElement) < 0) {
            computedHash = sha256(Buffer.concat([computedHash, proofElement]));
        } else {
            computedHash = sha256(Buffer.concat([proofElement, computedHash]));
        }
    }
    
    return computedHash.equals(root);
}

function DevContent() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [mintKeypair, setMintKeypair] = useState<Keypair | null>(null);
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

  const onCreateMintAndToken = async () => {
    try {
        if (!publicKey || !sendTransaction) {
            alert("Пожалуйста, подключите кошелек!");
            return;
        }
        
        setIsLoading(true);
        const newMintKeypair = Keypair.generate();
        
        const associatedTokenAccount = await getAssociatedTokenAddress(
            newMintKeypair.publicKey,
            publicKey,
            false
        );

        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        const createAllIx = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newMintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([9])
        });

        const transaction = new Transaction();
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        transaction.add(createAllIx);
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;

        try {
            const signature = await sendTransaction(transaction, connection, {
                signers: [newMintKeypair]
            });
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });

            setMintKeypair(newMintKeypair);
            setAtaAddress(associatedTokenAccount);
            alert('Минт создан, ATA создан и токен заминчен успешно!');
        } catch (sendError) {
            console.error("Ошибка при отправке транзакции:", sendError);
            alert(`Ошибка при отправке транзакции: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
        }
    } catch (error) {
        console.error("Общая ошибка:", error);
        alert(`Общая ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsLoading(false);
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

  const calculateLastRoundMerkleRoot = async () => {
    try {
      setLoading(true);
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d3.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      if (lastFoundRound === 0) {
        alert('Раунды не найдены');
        return;
      }

      // Загружаем d3.json последнего раунда
      const d3 = await import(`../../../b/rounds/${lastFoundRound}/d3.json`);
      
      // Получаем все адреса из d3
      const addresses = d3.default.map((item: { player: string }) => item.player);
      
      // Создаем листья для меркл-дерева
      const leaves = addresses.map((addr: string) => {
        const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
        return sha256(pkBytes);
      });
      
      // Сортируем листья для консистентности
      const sortedLeaves = leaves.slice().sort(Buffer.compare);
      
      // Создаем меркл-дерево
      const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
      
      // Получаем корень в виде байтов
      const root = tree.getRoot();
      
      // Преобразуем байты в hex строку с форматом 0xXX
      const rootHexBytes = Array.from(root).map(b => `0x${b.toString(16).padStart(2, '0')}`);
      const formattedRoot = `[\n    ${rootHexBytes.join(', ')}\n]`;
      
      console.log("Merkle Root в байтах:", formattedRoot);
      alert(`Merkle Root последнего раунда (${lastFoundRound}):\n${formattedRoot}`);
    } catch (error) {
      console.error("Ошибка при вычислении Merkle Root:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllRoundsMerkleRoots = async () => {
    try {
      setLoading(true);
      
      // Находим последний раунд
      let currentRound = 1;
      let lastFoundRound = 0;
      
      while (true) {
        try {
          await import(`../../../b/rounds/${currentRound}/d3.json`);
          lastFoundRound = currentRound;
          currentRound++;
        } catch {
          break;
        }
      }

      if (lastFoundRound === 0) {
        alert('Раунды не найдены');
        return;
      }

      let allRootsInfo = [];

      // Обрабатываем каждый раунд
      for (let round = 1; round <= lastFoundRound; round++) {
        try {
          // Загружаем d3.json текущего раунда
          const d3 = await import(`../../../b/rounds/${round}/d3.json`);
          
          // Получаем все адреса из d3
          const addresses = d3.default.map((item: { player: string }) => item.player);
          
          // Создаем листья для меркл-дерева
          const leaves = addresses.map((addr: string) => {
            const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
            return sha256(pkBytes);
          });
          
          // Сортируем листья для консистентности
          const sortedLeaves = leaves.slice().sort(Buffer.compare);
          
          // Создаем меркл-дерево
          const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
          
          // Получаем корень в виде байтов
          const root = tree.getRoot();
          
          // Преобразуем байты в hex строку с форматом 0xXX
          const rootHexBytes = Array.from(root).map(b => `0x${b.toString(16).padStart(2, '0')}`);
          const formattedRoot = `[\n    ${rootHexBytes.join(', ')}\n]`;
          
          allRootsInfo.push(`Раунд ${round}:\n${formattedRoot}`);
        } catch (error) {
          console.error(`Ошибка при обработке раунда ${round}:`, error);
          allRootsInfo.push(`Раунд ${round}: Ошибка обработки`);
        }
      }

      // Выводим все корни
      const fullMessage = `Merkle Roots для всех раундов:\n\n${allRootsInfo.join('\n\n')}`;
      console.log(fullMessage);
      alert(fullMessage);
    } catch (error) {
      console.error("Ошибка при вычислении Merkle Roots:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const onCreateMintAndTokenWithMerkle = async () => {
    if (!publicKey || !sendTransaction) {
        alert('Пожалуйста, подключите кошелек!');
        return;
    }

    try {
        setIsLoading(true);

        // Проверяем баланс
        const balance = await connection.getBalance(publicKey);
        if (balance < LAMPORTS_PER_SOL) {
            alert('Недостаточно SOL на балансе. Нужно минимум 1 SOL.');
            return;
        }

        console.log('Создаем keypair для минта...');
        const mintKeypair = Keypair.generate();
        
        // Получаем последний раунд и создаем меркл-дерево
        console.log('Получаем данные последнего раунда...');
        let currentRound = 1;
        let lastRound = 0;
        
        while (true) {
            try {
                await import(`../../../b/rounds/${currentRound}/d3.json`);
                lastRound = currentRound;
                currentRound++;
            } catch {
                break;
            }
        }

        if (lastRound === 0) {
            alert('Раунды не найдены');
            return;
        }

        // Загружаем адреса из последнего раунда
        const d3 = await import(`../../../b/rounds/${lastRound}/d3.json`);
        const addresses = d3.default.map((item: { player: string }) => item.player);
        
        if (!addresses.includes(publicKey.toBase58())) {
            alert('Ваш адрес не находится в вайтлисте!');
            return;
        }

        console.log('Создаем меркл-дерево...');
        const leaves = addresses.map((addr: string) => {
            const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
            return sha256(pkBytes);
        });
        const sortedLeaves = leaves.slice().sort(Buffer.compare);
        const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
        
        // Получаем свой лист и доказательство
        const authorityBytes = Buffer.from(publicKey.toBytes());
        const authorityLeaf = sha256(authorityBytes);
        const proofObjects = tree.getProof(authorityLeaf);

        if (!proofObjects || proofObjects.length === 0) {
            alert('Ошибка: не удалось получить меркл-доказательство!');
            return;
        }

        // Проверяем доказательство локально перед отправкой
        const root = tree.getRoot();
        const merkleProofBuffers = proofObjects.map(p => p.data);
        const isValid = verifyMerkleProof(merkleProofBuffers, authorityLeaf, root);
        
        if (!isValid) {
            console.error('Локальная проверка меркл-доказательства не прошла!');
            console.log('Root:', root.toString('hex'));
            console.log('Leaf:', authorityLeaf.toString('hex'));
            console.log('Proof:', merkleProofBuffers.map(b => b.toString('hex')));
            alert('Ошибка: локальная проверка меркл-доказательства не прошла!');
            return;
        }

        console.log('Локальная проверка меркл-доказательства успешна');
        console.log('Отправляем транзакцию...');

        // Получаем PDA для program authority
        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        // Вычисляем адрес ATA
        const ata = await getAssociatedTokenAddress(
            mintKeypair.publicKey,
            publicKey
        );

        // Получаем последний блокхеш
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

        // Создаем инструкцию
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: ata, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: Buffer.concat([
                Buffer.from([10]), // Instruction discriminator
                Buffer.from([merkleProofBuffers.length]), // Proof length
                ...merkleProofBuffers // Proof elements
            ])
        });

        const transaction = new Transaction();
        transaction.add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = publicKey;

        // Подписываем транзакцию mint keypair'ом
        transaction.partialSign(mintKeypair);
        
        // Отправляем транзакцию
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false
        });

        const signature = await sendTransaction(transaction, connection, {
            skipPreflight: false,
            preflightCommitment: 'processed',
            maxRetries: 5
        });

        // Ждем подтверждения
        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
        }, 'confirmed');

        if (confirmation.value.err) {
            throw new Error(`Ошибка подтверждения: ${confirmation.value.err}`);
        }

        console.log('Транзакция успешно выполнена:', signature);
        alert('Минт успешно создан! Signature: ' + signature);

    } catch (error: unknown) {
        console.error('Ошибка:', error);
        if (error && typeof error === 'object' && 'logs' in error) {
            console.error('Логи программы:', (error as { logs: string[] }).logs);
        }
        const message = error instanceof Error ? error.message : String(error);
        alert(`Ошибка: ${message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const onCreateMintAndTokenWithMerkleHack = async () => {
    try {
        if (!publicKey || !sendTransaction) {
            alert("Пожалуйста, подключите кошелек!");
            return;
        }
        
        setIsLoading(true);
        const newMintKeypair = Keypair.generate();
        
        const associatedTokenAccount = await getAssociatedTokenAddress(
            newMintKeypair.publicKey,
            publicKey,
            false
        );

        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        // Создаем фейковое меркл-дерево только с нашим адресом
        const pkBytes = Buffer.from(publicKey.toBytes());
        const leaf = sha256(pkBytes);
        const tree = new MerkleTree([leaf], sha256, { sortPairs: true });
        const proof = tree.getProof(leaf);
        
        console.log("Хакерское меркл-дерево создано");
        console.log("Root:", tree.getRoot().toString('hex'));
        console.log("Leaf (наш адрес):", leaf.toString('hex'));
        console.log("Доказательство:", proof);

        // Преобразуем доказательство в массив байтов
        const proofBuffers = proof.map(p => p.data);

        // Формируем данные инструкции: [1 байт - номер инструкции][1 байт - длина proof][N * 32 байт - элементы proof]
        const dataLength = 2 + (proofBuffers.length * 32);
        const instructionData = Buffer.alloc(dataLength);
        
        instructionData[0] = 11; // Номер инструкции для хака
        instructionData[1] = proofBuffers.length; // Длина proof
        
        // Записываем элементы proof
        for (let i = 0; i < proofBuffers.length; i++) {
            proofBuffers[i].copy(instructionData, 2 + (i * 32));
        }

        const createAllIx = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newMintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
            ],
            data: instructionData
        });

        const transaction = new Transaction();
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        transaction.add(createAllIx);
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;

        try {
            console.log("Отправка хакерской транзакции...");
            const signature = await sendTransaction(transaction, connection, {
                signers: [newMintKeypair]
            });
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });

            setMintKeypair(newMintKeypair);
            setAtaAddress(associatedTokenAccount);
            alert('Хак успешен! Минт создан без проверки белого списка!');
        } catch (sendError) {
            console.error("Ошибка при отправке транзакции:", sendError);
            alert(`Ошибка при отправке транзакции: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
        }
    } catch (error) {
        console.error("Общая ошибка:", error);
        alert(`Общая ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsLoading(false);
    }
  };

  const onCreateMintAndTokenWithMerkleByRound = async () => {
    try {
        if (!publicKey || !sendTransaction) {
            alert("Пожалуйста, подключите кошелек!");
            return;
        }
        
        setIsLoading(true);
        const newMintKeypair = Keypair.generate();
        
        const associatedTokenAccount = await getAssociatedTokenAddress(
            newMintKeypair.publicKey,
            publicKey,
            false
        );

        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );

        // Запрашиваем номер раунда у пользователя
        const roundStr = prompt("Введите номер раунда (1-21):");
        if (!roundStr) return;
        
        const round = parseInt(roundStr);
        if (isNaN(round) || round < 1 || round > 21) {
            alert("Неверный номер раунда. Пожалуйста, введите число от 1 до 21.");
            return;
        }

        // Создаем листья для меркл-дерева из адресов выбранного раунда
        const d3 = await import(`../../../b/rounds/${round}/d3.json`);
        
        // Получаем все адреса из d3
        const addresses = d3.default.map((item: { player: string }) => item.player);
        
        // Создаем листья для меркл-дерева
        const leaves = addresses.map((addr: string) => {
            const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
            return sha256(pkBytes);
        });
        
        // Сортируем листья для консистентности
        const sortedLeaves = leaves.slice().sort(Buffer.compare);
        
        // Создаем меркл-дерево
        const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
        
        // Получаем доказательство для текущего адреса
        const currentLeaf = sha256(Buffer.from(publicKey.toBytes()));
        const proof = tree.getProof(currentLeaf);

        if (!proof || proof.length === 0) {
            alert("Ваш адрес не найден в белом списке раунда " + round + "!");
            return;
        }

        // Преобразуем доказательство в массив байтов
        const proofBuffers = proof.map(p => p.data);

        // Формируем данные инструкции: [1 байт - номер инструкции][1 байт - номер раунда][1 байт - длина proof][N * 32 байт - элементы proof]
        const dataLength = 3 + (proofBuffers.length * 32);
        const instructionData = Buffer.alloc(dataLength);
        
        instructionData[0] = 12; // Номер инструкции
        instructionData[1] = round; // Номер раунда
        instructionData[2] = proofBuffers.length; // Длина proof
        
        // Записываем элементы proof
        for (let i = 0; i < proofBuffers.length; i++) {
            proofBuffers[i].copy(instructionData, 3 + (i * 32));
        }

        console.log("Данные инструкции:", {
            instructionNumber: instructionData[0],
            round: instructionData[1],
            proofLength: instructionData[2],
            proofData: proofBuffers.map(b => b.toString('hex'))
        });

        const createAllIx = new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: newMintKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: associatedTokenAccount, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
            ],
            data: instructionData
        });

        const transaction = new Transaction();
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        
        transaction.add(createAllIx);
        transaction.feePayer = publicKey;
        transaction.recentBlockhash = blockhash;

        try {
            console.log("Отправка транзакции для раунда " + round + "...");
            const signature = await sendTransaction(transaction, connection, {
                signers: [newMintKeypair]
            });
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });

            setMintKeypair(newMintKeypair);
            setAtaAddress(associatedTokenAccount);
            alert('Минт создан, ATA создан и токен заминчен успешно с проверкой меркл-дерева для раунда ' + round + '!');
        } catch (sendError) {
            console.error("Ошибка при отправке транзакции:", sendError);
            alert(`Ошибка при отправке транзакции: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
        }
    } catch (error) {
        console.error("Общая ошибка:", error);
        alert(`Общая ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      void loadWinningRounds(publicKey.toString());
    }
  }, [publicKey]);

  return (
    <div className="min-h-screen bg-black">
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
          <div className="flex flex-col gap-2 mt-8">
            <button 
              onClick={onCreateMetadata} 
              disabled={loading || !mintKeypair}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '1. Создать метадату'}
            </button>

            <button 
              onClick={onSetProgramAsAuthority} 
              disabled={loading || !mintKeypair}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '2. Установить программу как mint authority'}
            </button>

            <button 
              onClick={onCreateProgramMint}
              disabled={!publicKey || isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '3. Создать минт от имени программы'}
            </button>

            <button 
              onClick={onCreateProgramATA}
              disabled={loading || !mintKeypair}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '4. Создать ассоциированный токен аккаунт'}
            </button>

            <button 
              onClick={onMintToken}
              disabled={loading || !mintKeypair || !ataAddress}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '5. Минтить токен'}
            </button>

            <button 
              onClick={onCreateMintAndToken}
              disabled={!publicKey || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '6. Создать минт, ATA и минтить токен (Всё сразу)'}
            </button>

            <button 
              onClick={calculateLastRoundMerkleRoot}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Вычисление...' : '7. Посчитать Merkle Root последнего раунда'}
            </button>

            <button 
              onClick={calculateAllRoundsMerkleRoots}
              disabled={loading}
              className="bg-yellow-800 hover:bg-yellow-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Вычисление...' : '8. Посчитать Merkle Root всех раундов'}
            </button>

            <button 
              onClick={onCreateMintAndTokenWithMerkle}
              disabled={!publicKey || isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '10. Создать минт, ATA и минтить токен с проверкой меркл-дерева'}
            </button>

            <button 
              onClick={onCreateMintAndTokenWithMerkleHack}
              disabled={!publicKey || isLoading}
              className="bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '11. ХАКЕРСКАЯ АТАКА - Создать минт без проверки белого списка'}
            </button>

            <button 
              onClick={onCreateMintAndTokenWithMerkleByRound}
              disabled={!publicKey || isLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : '12. Создать минт с проверкой меркл-дерева для выбранного раунда'}
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