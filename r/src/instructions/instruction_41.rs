// Обновление метаданных pNFT

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
};
use mpl_token_metadata::{
    instructions::{UpdateV1, UpdateV1InstructionArgs},
    types::{Data, CollectionToggle, RuleSetToggle, CollectionDetailsToggle, UsesToggle},
};

// Фиксированный адрес минта для обновления
const TARGET_MINT: &str = "E2i6VKGsjXXbSXJUL2y6yEkJrHQZwSke7r9yuCQScrun";

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting update_pnft_metadata...");
    
    let accounts_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let token_metadata_program = next_account_info(accounts_iter)?;
    
    // Проверяем подписи
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Проверяем, что mint_account имеет правильный адрес
    let expected_mint = match Pubkey::try_from(TARGET_MINT) {
        Ok(pubkey) => pubkey,
        Err(_) => {
            msg!("Failed to parse target mint address");
            return Err(ProgramError::InvalidArgument);
        }
    };
    
    if mint_account.key != &expected_mint {
        msg!("Invalid mint address provided");
        msg!("Expected: {}", expected_mint);
        msg!("Received: {}", mint_account.key);
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

    // Создаем authority seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Создаем структуру для обновления метаданных
    let update_v1 = UpdateV1 {
        authority: *program_authority.key,
        mint: *mint_account.key,
        metadata: *metadata_account.key,
        payer: *payer.key,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        authorization_rules_program: None,
        authorization_rules: None,
        token: None,
        delegate_record: None,
        edition: None,
    };

    // Создаем новые данные для метаданных
    let data = Data {
        name: "Yapster Infinity 39".to_string(),
        symbol: "YAPI39".to_string(),
        uri: "https://a.b/c.json".to_string(),
        seller_fee_basis_points: 1000,
        creators: None,
    };

    // Создаем аргументы для обновления
    let update_args = UpdateV1InstructionArgs {
        data: Some(data),
        is_mutable: Some(true),
        primary_sale_happened: None,
        new_update_authority: None,
        collection_details: CollectionDetailsToggle::None,
        uses: UsesToggle::None,
        collection: CollectionToggle::None,
        rule_set: RuleSetToggle::None,
        authorization_data: None,
    };

    msg!("Invoking UpdateV1 instruction...");
    invoke_signed(
        &update_v1.instruction(update_args),
        &[
            metadata_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
        ],
        signers,
    )?;

    msg!("pNFT metadata updated successfully!");
    Ok(())
} 