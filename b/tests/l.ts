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
});
