use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    pubkey::Pubkey,
};

use mpl_token_metadata::{
    instructions::{PrintV1, PrintV1InstructionArgs},
};

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let edition_metadata = next_account_info(accounts_iter)?;
    let edition = next_account_info(accounts_iter)?;
    let master_edition = next_account_info(accounts_iter)?;
    let edition_mint = next_account_info(accounts_iter)?;
    let edition_marker_pda = next_account_info(accounts_iter)?;
    let edition_mint_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let master_token_account_owner = next_account_info(accounts_iter)?;
    let master_token_account = next_account_info(accounts_iter)?;
    let update_authority = next_account_info(accounts_iter)?;
    let master_metadata = next_account_info(accounts_iter)?;
    let token_program = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let spl_token_program = next_account_info(accounts_iter)?;
    let spl_ata_program = next_account_info(accounts_iter)?;

    // Получаем номер издания из instruction_data
    let edition_number = u64::from_le_bytes(instruction_data[..8].try_into().unwrap());

    msg!("Minting edition {} from master edition", edition_number);

    let print_v1 = PrintV1 {
        edition_metadata: *edition_metadata.key,
        edition: *edition.key,
        master_edition: *master_edition.key,
        edition_mint: (*edition_mint.key, true),
        edition_marker_pda: *edition_marker_pda.key,
        edition_mint_authority: *edition_mint_authority.key,
        payer: *payer.key,
        master_token_account_owner: *master_token_account_owner.key,
        master_token_account: *master_token_account.key,
        update_authority: *update_authority.key,
        master_metadata: *master_metadata.key,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        edition_token_account_owner: *payer.key,
        edition_token_account: *payer.key,
        edition_token_record: None,
        spl_token_program: *spl_token_program.key,
        spl_ata_program: *spl_ata_program.key,
    };

    let args = PrintV1InstructionArgs {
        edition_number,
    };

    invoke(
        &print_v1.instruction(args),
        &[
            edition_metadata.clone(),
            edition.clone(),
            master_edition.clone(),
            edition_mint.clone(),
            edition_marker_pda.clone(),
            edition_mint_authority.clone(),
            payer.clone(),
            master_token_account_owner.clone(),
            master_token_account.clone(),
            update_authority.clone(),
            master_metadata.clone(),
            token_program.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
            spl_ata_program.clone(),
        ],
    )?;

    msg!("Successfully minted edition {} from master edition", edition_number);
    Ok(())
} 