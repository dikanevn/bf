'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction, Keypair, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
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
  extendedMinted?: boolean;
  mintAddress?: string;
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

// Функция для вычисления SHA-256 хеша
function sha256(data: Buffer): Buffer {
  const hashHex = jsSha256(data);
  return Buffer.from(hashHex, 'hex');
}

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
  const [manualRoundNumber, setManualRoundNumber] = useState<string>("1");

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
            data: Buffer.from([1])
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
    try {
        if (!publicKey || !signTransaction) {
            alert("Пожалуйста, подключите кошелек!");
            return;
        }
        
        if (!mintKeypair) {
            alert("Сначала создайте минт!");
            return;
        }
        
        setLoading(true);
        
        // Получаем PDA для mint authority
        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority")],
            PROGRAM_ID
        );
        
        // Создаем инструкцию для установки программы как mint authority
        const transaction = new Transaction().add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: publicKey, isSigner: true, isWritable: false },
                { pubkey: programAuthority, isSigner: false, isWritable: false },
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

  const onDeleteMintRecordForRound = async () => {
    if (!publicKey || !sendTransaction) {
      alert("Пожалуйста, подключите кошелек");
      return;
    }

    setIsLoading(true);

    try {
      // Проверяем, что номер раунда валидный
      const roundNumber = parseInt(manualRoundNumber);
      if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 21) {
        alert("Пожалуйста, введите корректный номер раунда (1-21)");
        return;
      }

      // Получаем адрес PDA для обычного отслеживания минтинга
      const [standardMintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("is_minted"),
          Buffer.from([roundNumber - 1]), // В контракте индексация с 0
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      console.log("Standard mint record PDA:", standardMintRecordPDA.toBase58());
      
      // Получаем адрес PDA для расширенного отслеживания минтинга
      const [extendedMintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("is_minted_ext"),
          Buffer.from([roundNumber - 1]), // В контракте индексация с 0
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      console.log("Extended mint record PDA:", extendedMintRecordPDA.toBase58());
      
      // Проверяем существование обоих типов аккаунтов
      const standardAccountInfo = await connection.getAccountInfo(standardMintRecordPDA);
      const extendedAccountInfo = await connection.getAccountInfo(extendedMintRecordPDA);
      
      // Выбираем аккаунт для удаления
      let mintRecordPDA;
      if (extendedAccountInfo !== null && extendedAccountInfo.owner.equals(PROGRAM_ID)) {
        console.log("Найден расширенный аккаунт отслеживания, будет удален он");
        mintRecordPDA = extendedMintRecordPDA;
      } else if (standardAccountInfo !== null && standardAccountInfo.owner.equals(PROGRAM_ID)) {
        console.log("Найден стандартный аккаунт отслеживания, будет удален он");
        mintRecordPDA = standardMintRecordPDA;
      } else {
        console.error("Не найдено аккаунтов отслеживания для этого раунда");
        alert("Не найдено аккаунтов отслеживания для раунда " + roundNumber);
        setIsLoading(false);
        return;
      }

      // Создаем транзакцию для удаления аккаунта отслеживания минтинга
      const transaction = new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from([15, roundNumber - 1]) // Инструкция 15 + номер раунда (индексация с 0)
        })
      );

      // Отправляем транзакцию
      const signature = await sendTransaction(transaction, connection);
      
      // Ждем подтверждения транзакции
      await connection.confirmTransaction(signature, 'confirmed');
      
      alert(`Аккаунт отслеживания минтинга для раунда ${roundNumber} успешно удален!\nТранзакция: ${signature}`);
      
      // Обновляем данные о выигрышных раундах
      if (publicKey) {
        loadWinningRounds(publicKey.toString());
      }
      
    } catch (error) {
      console.error("Ошибка при удалении аккаунта отслеживания минтинга:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const onCreateMintAndTokenWithRoundSpecificMerkleProofTrackedExtended = async () => {
    if (!publicKey || !sendTransaction) {
      alert("Пожалуйста, подключите кошелек");
      return;
    }

    setIsLoading(true);

    try {
      // Проверяем, что номер раунда валидный
      const roundNumber = parseInt(manualRoundNumber);
      if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 21) {
        alert("Пожалуйста, введите корректный номер раунда (1-21)");
        return;
      }

      // Проверяем существование раунда и загружаем данные
      let d3Data;
      try {
        d3Data = await import(`../../../b/rounds/${roundNumber}/d3.json`);
      } catch {
        alert(`Раунд ${roundNumber} не найден!`);
        setIsLoading(false);
        return;
      }
      
      // Получаем все адреса из d3
      const addresses = d3Data.default.map((item: { player: string }) => item.player);
      
      // Создаем листья для меркл-дерева
      const leaves = addresses.map((addr: string) => {
        const pkBytes = Buffer.from(new PublicKey(addr).toBytes());
        return sha256(pkBytes);
      });
      
      // Сортируем листья для консистентности
      const sortedLeaves = leaves.slice().sort(Buffer.compare);
      
      // Создаем меркл-дерево
      const tree = new MerkleTree(sortedLeaves, sha256, { sortPairs: true });
      
      // Вычисляем хеш (лист) для текущего адреса
      const leaf = sha256(Buffer.from(publicKey.toBytes()));
      
      // Получаем доказательство для текущего адреса
      const proof = tree.getProof(leaf);
      
      if (!proof || proof.length === 0) {
        alert(`Ваш адрес не найден в списке участников раунда ${roundNumber}!`);
        setIsLoading(false);
        return;
      }
      
      // Преобразуем доказательство в массив байтов
      const proofBuffers = proof.map(p => p.data);
      
      // Проверяем доказательство вручную
      if (!verifyMerkleProof(proofBuffers, leaf, tree.getRoot())) {
        alert('Ошибка: Merkle proof не прошел локальную проверку!');
        setIsLoading(false);
        return;
      }

      // Создаем новый keypair для mint аккаунта
      const newMintKeypair = Keypair.generate();
      
      // Получаем адрес ассоциированного токен аккаунта
      const associatedTokenAccount = await getAssociatedTokenAddress(
        newMintKeypair.publicKey,
        publicKey,
        false
      );

      // Получаем адрес PDA для расширенного отслеживания минтинга
      const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("is_minted_ext"),
          Buffer.from([roundNumber - 1]), // В контракте индексация с 0
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      console.log("Extended Mint record PDA:", mintRecordPDA.toBase58());

      // Получаем PDA для mint authority
      const [programAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority")],
        PROGRAM_ID
      );

      // Создаем буфер данных для инструкции
      // [0] - номер инструкции (16)
      // [1] - номер раунда (0-20)
      // [2..] - данные доказательства (каждый узел - 32 байта)
      const dataLength = 2 + (proofBuffers.length * 32);
      const dataBuffer = Buffer.alloc(dataLength);
      dataBuffer[0] = 16; // Инструкция 16
      dataBuffer[1] = roundNumber - 1; // Номер раунда (0-based в контракте)
      
      // Записываем каждый узел доказательства в буфер
      for (let i = 0; i < proofBuffers.length; i++) {
        proofBuffers[i].copy(dataBuffer, 2 + (i * 32));
      }

      // Создаем инструкцию
      const createWithMerkleTrackedExtendedIx = new TransactionInstruction({
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
          { pubkey: mintRecordPDA, isSigner: false, isWritable: true },
        ],
        data: dataBuffer
      });

      // Создаем транзакцию
      const transaction = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      transaction.add(createWithMerkleTrackedExtendedIx);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = blockhash;

      try {
        const signature = await sendTransaction(transaction, connection, {
          signers: [newMintKeypair]
        });
        
        console.log("Transaction sent:", signature);
        await connection.confirmTransaction({
          blockhash,
          lastValidBlockHeight,
          signature
        });
        
        console.log("Transaction confirmed");
        setMintKeypair(newMintKeypair);
        setAtaAddress(associatedTokenAccount);
        alert(`Минт и токен успешно созданы с расширенным отслеживанием для раунда ${roundNumber}!`);
      } catch (error) {
        console.error("Error sending transaction:", error);
        alert(`Ошибка при отправке транзакции: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
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

      // Проверяем минтинг для каждого раунда, если кошелек подключен
      if (publicKey) {
        // Создаем копию результатов для асинхронного обновления
        const updatedResults = [...results];
        
        // Проверяем каждый раунд на минтинг
        for (let i = 0; i < updatedResults.length; i++) {
          // Проверяем только расширенное отслеживание минтинга
          const mintAddress = await checkIfMintedInRoundExtended(updatedResults[i].round);
          if (mintAddress) {
            updatedResults[i].extendedMinted = true;
            updatedResults[i].mintAddress = mintAddress;
          } else {
            updatedResults[i].extendedMinted = false;
          }
        }
        
        // Обновляем результаты с информацией о минтинге
        results.length = 0;
        results.push(...updatedResults);
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

      const allRootsInfo = [];

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

  // Функция для проверки расширенного отслеживания минтинга и получения адреса минта
  const checkIfMintedInRoundExtended = async (roundNumber: number): Promise<string | null> => {
    if (!publicKey) return null;
    
    try {
      // Получаем адрес PDA для расширенного отслеживания минтинга
      const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("is_minted_ext"),
          Buffer.from([roundNumber - 1]), // В контракте индексация с 0
          publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      
      // Проверяем существование аккаунта
      const accountInfo = await connection.getAccountInfo(mintRecordPDA);
      
      // Если аккаунт существует и принадлежит программе
      if (accountInfo !== null && accountInfo.owner.equals(PROGRAM_ID)) {
        console.log(`Найден аккаунт расширенного отслеживания для раунда ${roundNumber}:`, mintRecordPDA.toString());
        console.log(`Размер данных аккаунта: ${accountInfo.data.length} байт`);
        
        // Проверяем размер данных
        if (accountInfo.data.length < 32) {
          console.error(`Недостаточный размер данных: ${accountInfo.data.length} байт`);
          return "Ошибка: недостаточный размер данных";
        }
        
        // Выводим сырые данные для отладки
        const rawData = Buffer.from(accountInfo.data).toString('hex');
        console.log(`Сырые данные аккаунта: ${rawData}`);
        
        // Извлекаем адрес минта из данных аккаунта
        try {
          const mintAddress = new PublicKey(accountInfo.data.slice(0, 32));
          console.log(`Успешно прочитан адрес минта: ${mintAddress.toString()}`);
          return mintAddress.toString();
        } catch (error) {
          console.error("Ошибка при чтении адреса минта:", error);
          return "Ошибка чтения адреса";
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Ошибка при проверке расширенного минтинга для раунда ${roundNumber}:`, error);
      return null;
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
                    {result.extendedMinted !== undefined && (
                      <span className={result.extendedMinted ? "text-purple-400 ml-2" : "text-gray-400 ml-2"}>
                        {result.extendedMinted ? "Расширенный минт выполнен ✓" : "Расширенный минт не выполнен ✗"}
                      </span>
                    )}
                    {result.mintAddress && (
                      <div className="text-xs text-gray-400 ml-4 mt-1">
                        Минт: {result.mintAddress}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {publicKey && (
          <div className="flex flex-col gap-2 mt-8">
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="21"
                value={manualRoundNumber}
                onChange={(e) => setManualRoundNumber(e.target.value)}
                className="bg-gray-800 text-white px-3 py-1.5 text-sm border border-gray-700 rounded w-20"
                placeholder="Раунд"
                disabled={isLoading}
              />
            <button 
                onClick={onDeleteMintRecordForRound}
                disabled={!publicKey || isLoading}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 text-sm disabled:opacity-50 flex-1"
              >
                {isLoading ? 'Processing...' : '15. Удалить аккаунт отслеживания минтинга'}
            </button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="21"
                value={manualRoundNumber}
                onChange={(e) => setManualRoundNumber(e.target.value)}
                className="bg-gray-800 text-white px-3 py-1.5 text-sm border border-gray-700 rounded w-20"
                placeholder="Раунд"
                disabled={isLoading}
              />
            <button 
                onClick={onCreateMintAndTokenWithRoundSpecificMerkleProofTrackedExtended}
                disabled={!publicKey || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm disabled:opacity-50 flex-1"
              >
                {isLoading ? 'Processing...' : '16. Создать минт и токен с расширенным отслеживанием'}
            </button>
            </div>

            <button 
              onClick={calculateAllRoundsMerkleRoots}
              disabled={loading}
              className="bg-yellow-800 hover:bg-yellow-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Вычисление...' : '8. Посчитать Merkle Root всех раундов'}
            </button>

            <button 
              onClick={calculateLastRoundMerkleRoot}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Вычисление...' : '7. Посчитать Merkle Root последнего раунда'}
            </button>

            <button 
              onClick={onSetProgramAsAuthority} 
              disabled={loading || !mintKeypair}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '2. Установить программу как mint authority'}
            </button>

            <button 
              onClick={onCreateMetadata} 
              disabled={loading || !mintKeypair}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '1. Создать метадату'}
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