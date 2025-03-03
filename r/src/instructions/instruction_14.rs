use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
    system_instruction,
    program::invoke_signed,
    rent::Rent,
    sysvar::Sysvar,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Instruction 14: Manual mint record creation");
    msg!("Instruction data length: {}", instruction_data.len());
    
    if instruction_data.len() != 40 {
        msg!("Invalid instruction data length. Expected 40 bytes, got {}", instruction_data.len());
        return Err(ProgramError::InvalidInstructionData);
    }

    let round = u64::from_le_bytes(instruction_data[0..8].try_into().unwrap());
    let mint_address = Pubkey::new_from_array(instruction_data[8..40].try_into().unwrap());
    
    msg!("Round: {}", round);
    msg!("Mint address: {}", mint_address);
    
    let accounts_iter = &mut accounts.iter();
    
    let mint_record_account = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    // Проверяем подпись payer
    if !payer.is_signer {
        msg!("Ошибка: payer должен быть подписантом");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем, что это правильный PDA для записи о минте
    let seeds = [
        b"minted".as_ref(),
        &round.to_le_bytes(),
        payer.key.as_ref(),
    ];
    let (expected_mint_record_address, bump_seed) = Pubkey::find_program_address(
        &seeds,
        program_id
    );

    if mint_record_account.key != &expected_mint_record_address {
        msg!("Ошибка: Неверный адрес записи о минте");
        msg!("Ожидается: {}", expected_mint_record_address);
        msg!("Получено: {}", mint_record_account.key);
        return Err(ProgramError::InvalidArgument);
    }

    // Создаем PDA для записи о минте
    msg!("Создаем PDA для записи о минте...");
    let mint_record_size = 32;
    let rent = Rent::get()?;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    let mint_record_signature_seeds = &[
        b"minted".as_ref(),
        &round.to_le_bytes(),
        payer.key.as_ref(),
        &[bump_seed],
    ];
    let mint_record_signers = &[&mint_record_signature_seeds[..]];
    
    invoke_signed(
        &system_instruction::create_account(
            &payer.key,
            &expected_mint_record_address,
            mint_record_lamports,
            mint_record_size as u64,
            program_id,
        ),
        &[
            payer.clone(),
            mint_record_account.clone(),
            system_program.clone(),
        ],
        mint_record_signers,
    )?;
    
    // Записываем адрес минта в аккаунт
    let mut data = mint_record_account.try_borrow_mut_data()?;
    data[0..32].copy_from_slice(&mint_address.to_bytes());

    msg!("Запись о минте успешно создана!");
    Ok(())
} 