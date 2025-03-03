// удаление расширенного PDA 10(11)

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Deleting mint record account for specific round...");
    
    let account_info_iter = &mut accounts.iter();
    
    // Получаем необходимые аккаунты
    let payer = next_account_info(account_info_iter)?;
    let mint_record_account = next_account_info(account_info_iter)?;

    // Проверяем подпись
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем владельца аккаунта
    if mint_record_account.owner != program_id {
        msg!("Mint record account does not belong to the program");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Получаем номер раунда из данных инструкции
    if instruction_data.is_empty() {
        msg!("Invalid instruction data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    let round_number = instruction_data[0] as usize;
    
    // Проверяем только расширенный PDA
    let (expected_extended_mint_record_address, _) = Pubkey::find_program_address(
        &[
            b"minted",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );
    
    // Проверяем, что переданный mint_record_account соответствует ожидаемому адресу
    if mint_record_account.key != &expected_extended_mint_record_address {
        msg!("Invalid mint record account address");
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Deleting extended mint record account");
    
    // Переводим все ламппорты с аккаунта на payer
    let dest_starting_lamports = payer.lamports();
    let mint_record_lamports = mint_record_account.lamports();
    **payer.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(mint_record_lamports)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    **mint_record_account.lamports.borrow_mut() = 0;
    
    // Очищаем данные аккаунта
    let mut data = mint_record_account.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }
    
    msg!("Mint record account for round {} successfully deleted!", round_number);
    Ok(())
} 