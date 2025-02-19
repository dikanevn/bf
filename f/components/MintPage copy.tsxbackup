'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createTransferInstruction } from '@metaplex-foundation/mpl-token-metadata';
import BN from 'bn.js';
import { publicKey as umiPublicKey, unwrapOptionRecursively } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity as umiWalletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  fetchDigitalAssetWithAssociatedToken,
  findTokenRecordPda,
  TokenStandard,
  transferV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { getMplTokenAuthRulesProgramId } from "@metaplex-foundation/mpl-candy-machine";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import * as anchor from '@coral-xyz/anchor';

const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL в лампортах

// Определяем константу для программы метаданных
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Локальная реализация поиска PDA для метаданных
const findMetadataPda = (mint: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  )[0];
};

// Локальная реализация поиска PDA для Master Edition
const findMasterEditionPda = (mint: PublicKey): PublicKey => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer(), Buffer.from("edition")],
    METADATA_PROGRAM_ID
  )[0];
};

export function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [createdNftMintAddress, setCreatedNftMintAddress] = useState<string | null>(null);
  const [manualMintAddress, setManualMintAddress] = useState<string>('');
  const wallet = useWallet();

  const onTransferSol = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }
    try {
      setLoading(true);

      // Создаем инструкцию для трансфера SOL
      const instruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: RECIPIENT_ADDRESS,
        lamports: TRANSFER_AMOUNT,
      });

      // Создаем транзакцию
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Подписываем и отправляем транзакцию
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

  const onCreatePNFT = async () => {
    if (!publicKey) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }
    try {
      setLoading(true);

      // Инициализируем Metaplex с подключенным кошельком
      const metaplex = Metaplex.make(connection)
        .use(walletAdapterIdentity(wallet));

      // Создаём программируемый NFT (pNFT)
      const { nft } = await metaplex.nfts().create({
        uri: "https://arweave.net/123", // Замените на реальный URI с метаданными
        name: "My Programmable NFT",
        sellerFeeBasisPoints: 500, // 5% роялти
        symbol: "PNFT",
        creators: [
          {
            address: publicKey,
            share: 100,
          },
        ],
        isMutable: true,
        tokenStandard: 4, // TokenStandard.ProgrammableNonFungible
        ruleSet: null, // Можно добавить правила для pNFT
      });

      const mintAddress = nft.address.toString();
      console.log("Created pNFT:", {
        mintAddress,
        name: nft.name,
        symbol: nft.symbol,
        uri: nft.uri,
      });
      setCreatedNftMintAddress(mintAddress);
      alert(`pNFT создан успешно! Mint address: ${mintAddress}`);

    } catch (error) {
      console.error("Ошибка при создании pNFT:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const onTransferNFTByMint = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }
    if (!manualMintAddress) {
      alert("Пожалуйста, введите mint address!");
      return;
    }
    try {
      setLoading(true);

      // Инициализируем Umi на основе текущего connection и интегрируем кошелек Phantom через адаптер
      const umi = createUmi(connection);
      umi.use(umiWalletAdapterIdentity(wallet));

      // Преобразуем введённый mint address в тип Umi publicKey
      const mintId = umiPublicKey(manualMintAddress);

      // Получаем цифровой ассет pNFT с привязанным токен-аккаунтом
      const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
        umi,
        mintId,
        umi.identity.publicKey
      );

      // Используем RECIPIENT_ADDRESS как адрес назначения
      const destinationAddress = umiPublicKey(RECIPIENT_ADDRESS.toString());

      // Вычисляем ATA для адреса назначения
      const destinationTokenAccount = findAssociatedTokenPda(umi, {
        mint: mintId,
        owner: destinationAddress,
      });

      // Вычисляем PDA для Token Record адреса назначения
      const destinationTokenRecord = findTokenRecordPda(umi, {
        mint: mintId,
        token: destinationTokenAccount[0],
      });

      // Передаём pNFT с использованием transferV1
      const { signature } = await transferV1(umi, {
        mint: mintId,
        destinationOwner: destinationAddress,
        destinationTokenRecord: destinationTokenRecord,
        tokenRecord: assetWithToken.tokenRecord?.publicKey,
        tokenStandard: TokenStandard.ProgrammableNonFungible,
        authorizationRules:
          unwrapOptionRecursively(assetWithToken.metadata.programmableConfig)
            ?.ruleSet || undefined,
        authorizationRulesProgram: getMplTokenAuthRulesProgramId(umi),
        authorizationData: undefined,
      }).sendAndConfirm(umi);

      console.log("Signature: ", base58.deserialize(signature));
      alert("pNFT успешно передан. TXID: " + base58.deserialize(signature));
    } catch (error) {
      console.error("Ошибка при передаче pNFT (manual):", error);
      alert(`Ошибка при передаче pNFT (manual): ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Новая функция для создания SPL токена (без использования IDL)
  const onCreateToken = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    // Создаем AnchorProvider для отправки транзакции
    const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });

    // Генерируем новую пару ключей для mint-аккаунта
    const mintKeypair = anchor.web3.Keypair.generate();

    // Дискриминатор для метода create_token (значения из IDL)
    const discriminator = Buffer.from([84, 52, 204, 228, 24, 140, 234, 75]);

    // Собираем вручную набор ключей в том же порядке, как определено в IDL
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se"),
      data: discriminator,
    });

    const tx = new Transaction().add(ix);
    await provider.sendAndConfirm(tx, [mintKeypair]);
    console.log("SPL Token Address:", mintKeypair.publicKey.toString());
    alert("SPL токен создан успешно!");
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
            onClick={onCreatePNFT} 
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white  hover:bg-purple-600 disabled:bg-gray-400"
          >
            {loading ? 'Creating pNFT...' : 'Create pNFT'}
          </button>
          <button 
            onClick={onCreateToken} 
            disabled={loading}
            className="mt-5 px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-400"
          >
            {loading ? 'Создание токена...' : 'Создать SPL токен'}
          </button>
          <div className="flex flex-col gap-2">
            <input 
              type="text"
              placeholder="Введите mint address"
              value={manualMintAddress}
              onChange={(e) => setManualMintAddress(e.target.value)}
              className="px-3 py-2 border border-gray-300 mb-2 w-full"
            />
            <button 
              onClick={onTransferNFTByMint} 
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 disabled:bg-gray-400"
            >
              {loading ? 'Transferring NFT (manual)...' : 'Transfer NFT (manual)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MintPage; 