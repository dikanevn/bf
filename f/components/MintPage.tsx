'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js';
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
import idl from '../idl/l.json';

const PROGRAM_ID = new PublicKey("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");
const RECIPIENT_ADDRESS = new PublicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");
const TRANSFER_AMOUNT = 0.001 * LAMPORTS_PER_SOL;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

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

  const onCreatePNFT = async () => {
    if (!publicKey) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }
    try {
      setLoading(true);

      const metaplex = Metaplex.make(connection)
        .use(walletAdapterIdentity(wallet));

      const { nft } = await metaplex.nfts().create({
        uri: "https://arweave.net/123",
        name: "My Programmable NFT",
        sellerFeeBasisPoints: 500,
        symbol: "PNFT",
        creators: [
          {
            address: publicKey,
            share: 100,
          },
        ],
        isMutable: true,
        tokenStandard: 4,
        ruleSet: null,
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

      const umi = createUmi(connection);
      umi.use(umiWalletAdapterIdentity(wallet));

      const mintId = umiPublicKey(manualMintAddress);

      const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
        umi,
        mintId,
        umi.identity.publicKey
      );

      const destinationAddress = umiPublicKey(RECIPIENT_ADDRESS.toString());

      const destinationTokenAccount = findAssociatedTokenPda(umi, {
        mint: mintId,
        owner: destinationAddress,
      });

      const destinationTokenRecord = findTokenRecordPda(umi, {
        mint: mintId,
        token: destinationTokenAccount[0],
      });

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

  const onCreateToken = async () => {
    if (!publicKey || !signTransaction) {
      alert("Пожалуйста, подключите кошелек!");
      return;
    }

    try {
      setLoading(true);

      // Создаем провайдер для Anchor
      const provider = new anchor.AnchorProvider(
        connection,
        wallet,
        { preflightCommitment: 'processed' }
      );
      anchor.setProvider(provider);

      // Создаем программу напрямую с IDL
      const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);

      // Генерируем keypair для mint аккаунта
      const mintKeypair = anchor.web3.Keypair.generate();

      // Получаем PDA для metadata и master edition
      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      const [masterEditionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
          Buffer.from("edition"),
        ],
        METADATA_PROGRAM_ID
      );

      // Получаем ATA для authority
      const [ata] = await PublicKey.findProgramAddress(
        [
          publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
      );

      // Создаем инструкцию для create_token
      const tx = await program.methods
        .createToken()
        .accounts({
          authority: publicKey,
          mint: mintKeypair.publicKey,
          ata: ata,
          metadata: metadataPda,
          masterEdition: masterEditionPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([mintKeypair])
        .rpc();

      console.log("SPL Token создан! TXID:", tx);
      alert(`SPL Token создан успешно! TXID: ${tx}`);

    } catch (error) {
      console.error("Ошибка при создании SPL токена:", error);
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
            onClick={onCreatePNFT} 
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-400"
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