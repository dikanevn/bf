import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

async function main() {
  // Создаём кошелёк из заданного секретного ключа
  const secretKey = Uint8Array.from([
    13, 55, 88, 172, 167, 254, 203, 27, 243, 163, 143, 31, 139, 149, 255, 39,
    174, 41, 35, 207, 98, 31, 24, 76, 24, 180, 171, 102, 32, 70, 87, 193,
    226, 32, 196, 37, 25, 8, 93, 195, 8, 110, 205, 76, 126, 199, 23, 125,
    159, 79, 71, 63, 153, 203, 81, 31, 116, 124, 80, 95, 160, 28, 244, 127
  ]);
  const walletKeypair = Keypair.fromSecretKey(secretKey);

  // Устанавливаем соединение с локальным кластером (можно изменить на нужную вам сеть)
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Инициализируем провайдер Anchor с нашим кошельком
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(walletKeypair),
    { preflightCommitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Адрес программы, как указан в declare_id! в Rust-коде
  const programId = new PublicKey("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

  // Минимальный IDL, содержащий только инструкцию mintOne
  const idl = {
    version: "0.0.0",
    name: "l",
    instructions: [
      {
        name: "mintOne",
        accounts: [
          { name: "mint", isMut: true, isSigner: false },
          { name: "tokenAccount", isMut: true, isSigner: false },
          { name: "authority", isMut: false, isSigner: true },
          { name: "tokenProgram", isMut: false, isSigner: false },
        ],
        args: [],
      },
    ],
  };

  // Инициализируем объект программы с указанным IDL и ID
  const program = new anchor.Program<any>(idl, provider, programId as anchor.Address);

  // Задаём фиксированные адреса аккаунтов (как заданы в Rust-коде)
  const mintPubkey = new PublicKey("BNW1SZibkGWT8qMgcigzTq7gW2vsXH6Dbpk1Pvqph2Jm");
  const tokenAccountPubkey = new PublicKey("9NVsATCUsiWvcTvimFfQJhvPd2ffaTNetqxwAUj8vUCt");

  console.log("Отправка транзакции (вызов mintOne)...");

  try {
    const txSignature = await (program as any).methods.mintOne()
      .accounts({
        mint: mintPubkey,
        tokenAccount: tokenAccountPubkey,
        authority: walletKeypair.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("Транзакция успешно выполнена. Signature:", txSignature);
  } catch (err) {
    console.error("Ошибка при выполнении транзакции:", err);
  }
}

main()
  .then(() => console.log("Скрипт завершён"))
  .catch((err) => console.error(err));
