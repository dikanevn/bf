import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { L } from "../target/types/l"; // Убедитесь, что путь к типам правильный
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { assert } from "chai";

describe("l", () => {
  // Устанавливаем провайдер для использования локального кластера
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.L as Program<L>;

  it("Создает новый токен", async () => {
    const mintKeypair = anchor.web3.Keypair.generate();
    console.log("Создается токен с адресом:", mintKeypair.publicKey.toString());

    await program.methods
      .initializeToken()
      .accounts({
        mint: mintKeypair.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    const mintAccount = await getMint(provider.connection, mintKeypair.publicKey);
    console.log("Mint authority:", mintAccount.mintAuthority?.toString());
  });
}); 