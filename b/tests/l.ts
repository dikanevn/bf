import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { L } from "../target/types/l";
import { assert } from "chai";

describe("l", () => {
  // Настраиваем провайдер для тестов
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Получаем программу
  const program = anchor.workspace.L as Program<L>;

  it("Проверяет инициализацию программы", async () => {
    try {
      // Вызываем метод is_initialized
      const isInit = await program.methods
        .isInitialized()
        .accounts({})
        .view();

      // Проверяем что программа вернула true
      assert.isTrue(isInit, "Программа должна быть инициализирована");
      
      console.log("✅ Программа успешно инициализирована");
    } catch (error) {
      console.error("❌ Ошибка при проверке инициализации:", error);
      throw error;
    }
  });

  it("Инициализирует новый токен", async () => {
    try {
      // Генерируем новый keypair для mint аккаунта
      const mintKeypair = anchor.web3.Keypair.generate();

      // Вызываем initialize_token
      await program.methods
        .initializeToken()
        .accounts({
          mint: mintKeypair.publicKey,
          // signer добавится автоматически из provider.wallet
        })
        .signers([mintKeypair])
        .rpc();

      console.log("✅ Токен успешно создан, mint address:", mintKeypair.publicKey.toString());

      // Проверяем что минт действительно инициализирован
      const mintInfo = await provider.connection.getAccountInfo(mintKeypair.publicKey);
      assert.ok(mintInfo !== null, "Mint аккаунт должен существовать");
      assert.ok(mintInfo.owner.equals(anchor.utils.token.TOKEN_PROGRAM_ID), 
        "Владельцем mint аккаунта должна быть токен программа");

    } catch (error) {
      console.error("❌ Ошибка при инициализации токена:", error);
      throw error;
    }
  });
});
