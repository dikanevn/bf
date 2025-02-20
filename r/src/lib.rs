use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
};

// Объявляем точку входа для программы
entrypoint!(process_instruction);

// Основная функция обработки инструкций
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    // Выводим сообщение в лог
    msg!("Program is initialized!");
    
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_initialize() {
        // Базовый тест
        let program_id = Pubkey::default();
        let accounts = [];
        let instruction_data = [];
        
        let result = process_instruction(&program_id, &accounts, &instruction_data);
        assert_eq!(result, Ok(()));
    }
}
