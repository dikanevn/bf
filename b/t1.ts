import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { keypairIdentity, publicKey, unwrapOptionRecursively } from "@metaplex-foundation/umi";

import { getMplTokenAuthRulesProgramId } from "@metaplex-foundation/mpl-candy-machine";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  fetchDigitalAssetWithAssociatedToken,
  findTokenRecordPda,
  TokenStandard,
  transferV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { base58 } from "@metaplex-foundation/umi/serializers";

// Загружаем переменные окружения
dotenv.config();

async function transferProgrammableNFT() {
  try {
    // Подключаемся к Devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Считываем секретный ключ плательщика из переменной окружения
    if (!process.env.PAYER_SECRET_KEY) {
      throw new Error("PAYER_SECRET_KEY не установлен");
    }
    const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
    // Создаем аккаунт плательщика с использованием Keypair из web3.js
    const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log("Payer публичный ключ:", payer.publicKey.toString());

    // Создаем UMI instance (теперь createUmi принимает endpoint)
    const umi = createUmi("https://api.devnet.solana.com");
    // Регистрируем программу splAssociatedToken, приводя объект к any для обхода требований типов.
    umi.programs.add({
      name: "splAssociatedToken",
      publicKey: publicKey(ASSOCIATED_TOKEN_PROGRAM_ID.toString()),
      getErrorFromCode: (code: number) =>
        ({ 
          program: "splAssociatedToken", 
          source: "unknown", 
          getCapitalizedSource: () => "UNKNOWN", 
          getFullSource: () => `UNKNOWN: ${code}` 
        }),
      getErrorFromName: (name: string) =>
        ({ 
          program: "splAssociatedToken", 
          source: "unknown", 
          getCapitalizedSource: () => "UNKNOWN", 
          getFullSource: () => `UNKNOWN: ${name}` 
        }),
      isOnCluster: (cluster: string) => true,
    } as any);

    // Регистрируем программу splToken, требуемую для associated token аккаунтов
    umi.programs.add({
      name: "splToken",
      publicKey: publicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      getErrorFromCode: (code: number) =>
        ({
          program: "splToken",
          source: "unknown",
          getCapitalizedSource: () => "UNKNOWN",
          getFullSource: () => `UNKNOWN: ${code}`
        }),
      getErrorFromName: (name: string) =>
        ({
          program: "splToken",
          source: "unknown",
          getCapitalizedSource: () => "UNKNOWN",
          getFullSource: () => `UNKNOWN: ${name}`
        }),
      isOnCluster: (cluster: string) => true,
    } as any);

    // Генерируем UMI keypair из секретного ключа плательщика с использованием eddsa
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(payer.secretKey);
    // Устанавливаем identity на основе UMI keypair
    umi.use(keypairIdentity(umiKeypair));

    // Задаем идентификатор mNFT (pNFT). Замените этот mint id на реальный, если необходимо.
    const mintId = publicKey("5XriJDmohoW95Y1d8gx4c2AmU2MnTtVkY91LDKXSkwe7");

    // Получаем pNFT Asset с привязанным токен-аккаунтом владельца (текущего identity)
    const assetWithToken = await fetchDigitalAssetWithAssociatedToken(
      umi,
      mintId,
      umi.identity.publicKey
    );

    // Адрес получателя pNFT (целевой адрес)
    const destinationAddress = publicKey("3HE6EtGGxMRBuqqhz2gSs3TDRXebSc8HDDikZd1FYyJj");

    // Вычисляем связанный (associated) токен-аккаунт получателя
    const destinationTokenAccount = findAssociatedTokenPda(umi, {
      mint: mintId,
      owner: destinationAddress,
    });

    // Вычисляем PDA для Token Record аккаунта получателя
    const destinationTokenRecord = findTokenRecordPda(umi, {
      mint: mintId,
      token: destinationTokenAccount[0],
    });

    // Выполняем передачу pNFT с учётом авторизационных правил (если заданы в programmableConfig)
    const { signature } = await transferV1(umi, {
      mint: mintId,
      destinationOwner: destinationAddress,
      destinationTokenRecord: destinationTokenRecord,
      tokenRecord: assetWithToken.tokenRecord?.publicKey,
      tokenStandard: TokenStandard.ProgrammableNonFungible,
      // Если у pNFT установлены авторизационные правила, получаем ruleSet
      authorizationRules:
        unwrapOptionRecursively(assetWithToken.metadata.programmableConfig)
          ?.ruleSet || undefined,
      // ID программы authorisation rules
      authorizationRulesProgram: getMplTokenAuthRulesProgramId(umi),
      // Дополнительные данные для авторизации (если требуются)
      authorizationData: undefined,
    }).sendAndConfirm(umi);

    console.log("Подпись транзакции:", base58.deserialize(signature));
  } catch (error) {
    console.error("Ошибка при передаче pNFT:", error);
  }
}

transferProgrammableNFT(); 