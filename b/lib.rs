use solana_program::pubkey::Pubkey;
use std::str::FromStr;

/// Вычисляет адрес пары (CPMM pair) для двух токенов и AMM конфигурации.
/// Токены сортируются по возрастанию их байтового представления, чтобы обеспечить согласованный порядок.
/// Затем адрес пары вычисляется через `Pubkey::find_program_address`, используя seed "cpmm".
pub fn compute_cpmm_pair(token_a: &Pubkey, token_b: &Pubkey, amm_config: &Pubkey) -> (Pubkey, u8) {
    let (token0, token1) = if token_a.to_bytes() < token_b.to_bytes() {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    // Используем префикс "cpmm" для вычисления адреса пары
    Pubkey::find_program_address(&[b"cpmm", token0.as_ref(), token1.as_ref()], amm_config)
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

    #[test]
    fn test_print_cpmm_pair() {
        let token_a = Pubkey::from_str("9aGQqWqHSeyVtQXNkPuTUZ3aW288fjeRLQcMmjniivEf").unwrap();
        let token_b = Pubkey::from_str("So11111111111111111111111111111111111111112").unwrap();
        let amm_config = Pubkey::from_str("G95xxie3XbkCqtE39GgQ9Ggc7xBC8Uceve7HFDEFApkc").unwrap();

        let (pair, bump) = compute_cpmm_pair(&token_a, &token_b, &amm_config);
        println!(
            "CPMM Pair address for tokens:\n  {}\n  {}\nis:\n  {}\nwith bump: {}",
            token_a, token_b, pair, bump
        );
    }
} 