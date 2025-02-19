use solana_program::pubkey::Pubkey;
use std::str::FromStr;
use anyhow::Result;

// Импорт вспомогательной функции из библиотеки Raydium
use raydium_library::amm::utils::get_amm_pda_keys;

/// Вычисляет адрес пары (CPMM pair) для двух токенов и AMM конфигурации через прямой вызов find_program_address.
/// Токены сортируются для согласованного порядка.
pub fn compute_cpmm_pair(token_a: &Pubkey, token_b: &Pubkey, amm_config: &Pubkey) -> (Pubkey, u8) {
    let (token0, token1) = if token_a.to_bytes() < token_b.to_bytes() {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    // Используем префикс "cpmm" для вычисления адреса пары
    Pubkey::find_program_address(&[b"cpmm", token0.as_ref(), token1.as_ref()], amm_config)
}

/// «Новая» функция, использующая вспомогательную функцию get_amm_pda_keys для вычисления PDA для пула,
/// в том числе и для адреса @cpmm.
/// Необходимо передать: amm_program, market_program, market, amm_coin_mint и amm_pc_mint.
/// Предполагается, что структура, возвращаемая get_amm_pda_keys, имеет поля `cpmm` и `cpmm_bump`.
pub fn compute_cpmm_pair_with_helper(
    amm_program: &Pubkey,
    market_program: &Pubkey,
    market: &Pubkey,
    amm_coin_mint: &Pubkey,
    amm_pc_mint: &Pubkey,
) -> anyhow::Result<(Pubkey, u8)> {
    // Вспомогательная функция инкапсулирует всю логику вычисления PDA для аккаунтов AMM,
    // включая адрес для @cpmm.
    let amm_keys = get_amm_pda_keys(
        amm_program,
        market_program,
        market,
        amm_coin_mint,
        amm_pc_mint,
    )?;
    // Если в структуре amm_keys адрес для cpmm называется, например, `cpmm` и его bump – `cpmm_bump`
    Ok((amm_keys.cpmm, amm_keys.cpmm_bump))
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::pubkey::Pubkey;
    use std::str::FromStr;

    #[test]
    fn test_compute_cpmm_pair() {
        // Заданные данные:
        // Токен A: 9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf
        // Токен B: So11111111111111111111111111111111111111112
        // AMM Config: G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc
        let token_a = Pubkey::from_str("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf").unwrap();
        let token_b = Pubkey::from_str("So11111111111111111111111111111111111111112").unwrap();
        let amm_config = Pubkey::from_str("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").unwrap();

        let (pair, bump) = compute_cpmm_pair(&token_a, &token_b, &amm_config);

        // Ожидаемый адрес пары, согласно требованиям теста
        let expected_pair = Pubkey::from_str("EPSRjgevLHLm1xp5PNa816LYhmn2VUb9FTpXNsbvFHP").unwrap();
        assert_eq!(pair, expected_pair, "Computed pair address does not match expected");
        println!("Computed CPMM pair: {}, bump: {}", pair, bump);
    }

    // Пример теста для новой функции с использованием helper'а.
    // Для его работы необходимо задать корректные данные для market_program,
    // market, amm_coin_mint и amm_pc_mint.
    #[test]
    fn test_compute_cpmm_pair_with_helper() {
        // Примерные данные (значения нужно заменить на реальные для вашей среды)
        let amm_program = Pubkey::from_str("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8").unwrap();
        let market_program = Pubkey::from_str("SomeMarketProgram1111111111111111111111111").unwrap();
        let market = Pubkey::from_str("SomeMarket1111111111111111111111111111111111").unwrap();
        let amm_coin_mint = Pubkey::from_str("SomeCoinMint11111111111111111111111111111111").unwrap();
        let amm_pc_mint = Pubkey::from_str("SomePCMint111111111111111111111111111111111").unwrap();

        // Вычисляем PDA с использованием helper-функции
        let res = compute_cpmm_pair_with_helper(
            &amm_program,
            &market_program,
            &market,
            &amm_coin_mint,
            &amm_pc_mint,
        );
        match res {
            Ok((cpmm, bump)) => println!("Computed @cpmm address: {}, bump: {}", cpmm, bump),
            Err(err) => panic!("Error computing PDA via helper: {:?}", err),
        }
    }
} 