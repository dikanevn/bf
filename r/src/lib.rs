use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
};

pub mod instructions;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    match instruction_data[0] {
        24 => {
            msg!("Instruction: Create Clean NFT");
            instructions::instruction_24::process_create_clean_nft(program_id, accounts)
        }
        25 => {
            msg!("Instruction: Create Clean NFT and Mint Token");
            instructions::instruction_25::process_create_clean_nft_and_mint(program_id, accounts)
        }
        _ => {
            msg!("Error: Unknown instruction");
            Err(ProgramError::InvalidInstructionData)
        }
    }
}
