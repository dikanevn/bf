// Инструкция 42: Отправка SOL с PDA программы на указанный адрес

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    msg,
};

// Фиксированный адрес получателя
const RECIPIENT_ADDRESS: &str = "GDi7rtknaEdvgGrm9qpXbF54ZGZMGezmXLky2VQac2c6";

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting withdraw_sol...");
    
    // Парсим сумму для отправки из instruction_data
    if instruction_data.len() < 8 {
        msg!("Error: Instruction data must contain amount to send (8 bytes)");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    let amount_to_send = u64::from_le_bytes(
        instruction_data[0..8].try_into().map_err(|_| {
            msg!("Error: Failed to parse amount from instruction data");
            ProgramError::InvalidInstructionData
        })?
    );
    
    msg!("Amount to send: {} lamports", amount_to_send);
    
    let accounts_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let program_authority = next_account_info(accounts_iter)?;
    let recipient = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    
    // Проверяем, что recipient имеет правильный адрес
    let expected_recipient = match Pubkey::try_from(RECIPIENT_ADDRESS) {
        Ok(pubkey) => pubkey,
        Err(_) => {
            msg!("Failed to parse recipient address");
            return Err(ProgramError::InvalidArgument);
        }
    };
    
    if recipient.key != &expected_recipient {
        msg!("Invalid recipient address provided");
        msg!("Expected: {}", expected_recipient);
        msg!("Received: {}", recipient.key);
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем, что program_authority это правильный PDA
    let (expected_authority, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        msg!("Invalid program authority provided");
        return Err(ProgramError::InvalidArgument);
    }

    // Проверяем, что у PDA достаточно средств
    if program_authority.lamports() < amount_to_send {
        msg!("Insufficient funds in program authority PDA");
        msg!("Available: {} lamports", program_authority.lamports());
        msg!("Required: {} lamports", amount_to_send);
        return Err(ProgramError::InsufficientFunds);
    }

    // Создаем authority seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Создаем инструкцию для отправки SOL
    let transfer_instruction = system_instruction::transfer(
        program_authority.key,
        recipient.key,
        amount_to_send
    );

    msg!("Sending {} lamports from {} to {}", 
        amount_to_send, 
        program_authority.key, 
        recipient.key
    );

    // Выполняем инструкцию с подписью PDA
    invoke_signed(
        &transfer_instruction,
        &[
            program_authority.clone(),
            recipient.clone(),
            system_program.clone(),
        ],
        signers,
    )?;

    msg!("Successfully sent {} lamports to {}", amount_to_send, recipient.key);
    Ok(())
} 