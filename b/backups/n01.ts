import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo, 
  setAuthority, 
  AuthorityType 
} from "@solana/spl-token";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  clusterApiUrl 
} from "@solana/web3.js";
import * as dotenv from "dotenv";

// Загружаем переменные окружения
dotenv.config();

// Здесь нужно указать ваш Program ID
const PROGRAM_ID = new PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

// Считываем и парсим секретный ключ из переменной окружения PAYER_SECRET_KEY
if (!process.env.PAYER_SECRET_KEY) {
  throw new Error("PAYER_SECRET_KEY not set in env");
}
const secretKey = JSON.parse(process.env.PAYER_SECRET_KEY);
const payer = Keypair.fromSecretKey(new Uint8Array(secretKey));

async function createNewToken(): Promise<{
  connection: Connection;
  mint: PublicKey;
  tokenAccountAddress: PublicKey;
}> {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  console.log("Payer публичный ключ:", payer.publicKey.toBase58());

  // Создаем новый токен (mint)
  const mintKeypair = Keypair.generate();
  const mint = await createMint(
    connection,
    payer,              // Оплата создания
    payer.publicKey,    // Mint authority – временно ставим payer
    payer.publicKey,    // Freeze authority
    0,                  // Количество десятичных знаков
    mintKeypair         // Сгенерированный ключ mint
  );
  console.log("Новый mint создан:", mint.toBase58());

  // Создаем ассоциированный токен-аккаунт для payer
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log("Associated Token Account адрес:", tokenAccount.address.toBase58());

  return { connection, mint, tokenAccountAddress: tokenAccount.address };
}

async function mintToken(
  connection: Connection,
  mint: PublicKey,
  tokenAccount: PublicKey
) {
  const amount = 1; // Чеканим 1 токен
  const signature = await mintTo(
    connection,
    payer,
    mint,
    tokenAccount,
    payer,
    amount
  );
  console.log("Mint транзакция signature:", signature);
}

async function computePDA(): Promise<PublicKey> {
  // Seed для вычисления PDA
  const seed = Buffer.from("mint_authority");
  const [pda, bump] = await PublicKey.findProgramAddress([seed], PROGRAM_ID);
  console.log("Computed PDA:", pda.toBase58());
  console.log("Bump:", bump);
  return pda;
}

async function updateMintAuthority(
  connection: Connection,
  mint: PublicKey,
  newAuthority: PublicKey
) {
  // Обновляем право чеканки, меняем mint authority с текущего (payer) на newAuthority
  const txSignature = await setAuthority(
    connection,
    payer,
    mint,
    payer.publicKey, // текущая mint authority
    AuthorityType.MintTokens,
    newAuthority
  );
  console.log("Update mint authority tx signature:", txSignature);
}

async function main() {
  // Создаем новый токен и выводим его mint и связанные с ним адреса
  const { connection, mint, tokenAccountAddress } = await createNewToken();

  // Чеканим 1 токен в ассоциированный токен-аккаунт
  await mintToken(connection, mint, tokenAccountAddress);

  // Вычисляем PDA для нового mint authority (на основе seed "mint_authority" и Program ID)
  const newAuth = await computePDA();

  // Обновляем mint authority токена на вычисленное PDA
  await updateMintAuthority(connection, mint, newAuth);

  console.log("Новый токен создан, токены отчеканены и mint authority обновлен.");
}

main().catch((err) => {
  console.error(err);
}); 