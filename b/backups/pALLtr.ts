import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Connection, clusterApiUrl, PublicKey as SolanaPublicKey } from "@solana/web3.js";
import { 
  findMetadataPda, 
  TokenRecord,
  TokenState,
  TokenDelegateRole,
  Key,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  fetchTokenRecord,
  findTokenRecordPda
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const logBuffer: string[] = [];

const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(" ");
  logBuffer.push(message);
  originalConsoleLog.apply(console, args);
};

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(" ");
  logBuffer.push(message);
  originalConsoleError.apply(console, args);
};

process.on('exit', () => {
  fs.writeFileSync('pALLtr.txt', logBuffer.join('\n'), 'utf8');
});

async function main() {
  if (process.argv.length < 5) {
    console.error("Использование: ts-node pALLtr.ts <d|m> <адрес владельца> <mint-адрес токена>");
    process.exit(1);
  }

  const networkArg = process.argv[2];
  const network = networkArg === "d" ? "devnet" : "mainnet-beta";
  const ownerAddress = process.argv[3];
  const mintAddress = process.argv[4];

  console.log("Параметры запуска:");
  console.log("  Сеть:", network);
  console.log("  Адрес владельца:", ownerAddress);
  console.log("  Mint-адрес токена:", mintAddress);

  const connection = new Connection(clusterApiUrl(network), "confirmed");
  const umi = createUmi(connection);

  const ownerPk = new SolanaPublicKey(ownerAddress);
  const mintPk = new SolanaPublicKey(mintAddress);

  // Получаем ATA
  const ata = await getAssociatedTokenAddress(mintPk, ownerPk);
  console.log("\n=== Ассоциированный токен-аккаунт (ATA) ===");
  console.log("ATA:", ata.toString());

  // Вычисляем PDA для token record
  const tokenRecordPda = findTokenRecordPda(umi, {
    mint: publicKey(mintPk.toString()),
    token: publicKey(ata.toString())
  });

  console.log("\n=== Token Record PDA ===");
  console.log("Token Record Address:", tokenRecordPda.toString());

  try {
    const tokenRecord = await fetchTokenRecord(umi, tokenRecordPda);
    console.log("\n=== Token Record Data ===");
    if (tokenRecord) {
      console.log("Token Record:");
      console.log("  Key:", tokenRecord.key);
      console.log("  State:", TokenState[tokenRecord.state]);
      console.log("  Rule Set Revision:", tokenRecord.ruleSetRevision.__option === 'Some' ? tokenRecord.ruleSetRevision.value.toString() : null);
      console.log("  Delegate:", tokenRecord.delegate.__option === 'Some' ? tokenRecord.delegate.value : null);
      console.log("  Delegate Role:", tokenRecord.delegateRole.__option === 'Some' ? TokenDelegateRole[tokenRecord.delegateRole.value] : null);
      console.log("  Locked Transfer:", tokenRecord.lockedTransfer.__option === 'Some' ? tokenRecord.lockedTransfer.value : null);
    } else {
      console.log("Token Record не найден - возможно это не pNFT");
    }
  } catch (error) {
    console.error("Ошибка при получении Token Record:", error);
  }
}

main()
  .then(() => console.log("\nЗавершено успешно."))
  .catch((error) => {
    console.error("Ошибка:", error);
    process.exit(1);
  }); 