import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Настраиваем провайдер из переменных окружения (Anchor тест использует локальный валидатор)
anchor.setProvider(anchor.AnchorProvider.env());

describe("l", () => {
  // Получаем клиент программы из workspace
  const program = anchor.workspace.l as anchor.Program;

  // Фиксированные адреса (как заданы в Rust-коде)
  const mintPubkey = new PublicKey("BNW1SZibkGWT8qMgcigzTq7gW2vsXH6Dbpk1Pvqph2Jm");
  const tokenAccountPubkey = new PublicKey("9NVsATCUsiWvcTvimFfQJhvPd2ffaTNetqxwAUj8vUCt");

  it("mintOne successfully mints 1 token", async () => {
    try {
      // Вызываем инструкцию mintOne
      const txSignature = await program.methods.mintOne()
        .accounts({
          mint: mintPubkey,
          tokenAccount: tokenAccountPubkey,
          authority: program.provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("Transaction signature:", txSignature);
    } catch (err) {
      console.error("Ошибка при выполнении mintOne:", err);
      throw err; // Перебрасываем ошибку, чтобы тест провалился
    }
  });
});
