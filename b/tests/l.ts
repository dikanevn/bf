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
    // Генерируем новый ключ для mint
    const mintKeypair = anchor.web3.Keypair.generate();
    
    console.log("Создается токен с адресом:", mintKeypair.publicKey.toString());

    // Выполняем инструкцию create_token
    await program.methods
      .createToken()
      .accounts({
        authority: provider.wallet.publicKey,
        mint: mintKeypair.publicKey,
        system_program: SystemProgram.programId,
        token_program: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associated_token_program: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();

    // Проверяем, что токен был создан
    const mintAccount = await getMint(
      provider.connection,
      mintKeypair.publicKey
    );
    
    console.log("Токен успешно создан. Decimals:", mintAccount.decimals);
    console.log("Mint authority:", mintAccount.mintAuthority?.toString());
    console.log("Freeze authority:", mintAccount.freezeAuthority?.toString());
    
    assert.ok(mintAccount.decimals === 0);
  });
}); 