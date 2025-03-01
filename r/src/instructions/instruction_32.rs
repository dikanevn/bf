use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::invoke,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    msg,
    system_instruction,
    sysvar::rent::Rent,
    sysvar::Sysvar,
    hash::hash,
};
use spl_token::{
    instruction::{initialize_mint, mint_to},
    ID as TOKEN_PROGRAM_ID,
};
use mpl_token_metadata::{
    instructions::{CreateV1, CreateV1InstructionArgs, MintV1, MintV1InstructionArgs},
    types::{TokenStandard, PrintSupply},
};

use crate::ALL_MERKLE_ROOTS;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Starting create_and_mint_pnft_with_merkle_proof...");
    
    // Проверяем, что данные имеют правильный формат
    if instruction_data.len() < 1 {
        msg!("Invalid proof data: missing round number");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Получаем номер раунда из первого байта
    let round_number = instruction_data[0] as usize;
    msg!("Using round number: {}", round_number);
    
    // Проверяем, что номер раунда валидный
    if round_number >= ALL_MERKLE_ROOTS.len() {
        msg!("Invalid round number: {}, max is {}", round_number, ALL_MERKLE_ROOTS.len() - 1);
        return Err(ProgramError::InvalidArgument);
    }
    
    // Получаем корень Merkle для указанного раунда
    let merkle_root = ALL_MERKLE_ROOTS[round_number];
    msg!("Using Merkle root for round {}", round_number);
    
    let accounts_iter = &mut accounts.iter();
    
    // Получаем все необходимые аккаунты
    let metadata_account = next_account_info(accounts_iter)?;
    let master_edition_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let spl_token_program = next_account_info(accounts_iter)?;
    let token_owner = next_account_info(accounts_iter)?;
    let token_account = next_account_info(accounts_iter)?;
    let token_record = next_account_info(accounts_iter)?;
    let spl_ata_program = next_account_info(accounts_iter)?;
    let token_metadata_program = next_account_info(accounts_iter)?;
    let rent_sysvar = next_account_info(accounts_iter)?;
    let mint_record_account = next_account_info(accounts_iter)?;
    
    // Проверяем подписи
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
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

    // Проверяем Merkle proof
    msg!("Verifying Merkle proof...");
    
    // Проверяем, что данные доказательства имеют правильный формат
    if (instruction_data.len() - 1) % 32 != 0 {
        msg!("Invalid proof data length");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Преобразуем данные доказательства в вектор 32-байтных массивов
    let mut proof = Vec::new();
    for i in 0..((instruction_data.len() - 1) / 32) {
        let mut node = [0u8; 32];
        node.copy_from_slice(&instruction_data[1 + i * 32..1 + (i + 1) * 32]);
        proof.push(node);
    }
    
    // Вычисляем хеш (лист) для адреса плательщика
    let leaf = hash(payer.key.as_ref()).to_bytes();
    
    // Проверяем доказательство
    if !verify_merkle_proof(leaf, &proof, merkle_root) {
        msg!("Invalid Merkle proof for address: {} in round {}", payer.key, round_number);
        return Err(ProgramError::InvalidArgument);
    }
    
    msg!("Merkle proof verified successfully for round {}!", round_number);

    // Проверяем PDA для отслеживания минтинга
    let (expected_mint_record_address, mint_record_bump) = Pubkey::find_program_address(
        &[
            b"is_minted_ext",
            &[round_number as u8],
            payer.key.as_ref(),
        ],
        program_id
    );
    
    if mint_record_account.key != &expected_mint_record_address {
        msg!("Invalid mint record account address");
        return Err(ProgramError::InvalidArgument);
    }
    
    if !mint_record_account.data_is_empty() && mint_record_account.owner == program_id {
        msg!("User has already minted in round {}", round_number);
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Создаем authority seeds для подписи
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Создаем минт аккаунт
    msg!("Creating mint account...");
    let rent = Rent::get()?;
    let mint_len = 82; // Размер аккаунта Mint в байтах
    let lamports = rent.minimum_balance(mint_len);

    invoke(
        &system_instruction::create_account(
            &payer.key,
            &mint_account.key,
            lamports,
            mint_len as u64,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            mint_account.clone(),
            system_program.clone(),
        ],
    )?;

    // Инициализируем минт
    msg!("Initializing mint...");
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            &mint_account.key,
            &program_authority.key,
            Some(&program_authority.key),
            0,
        )?,
        &[
            mint_account.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    // Создаем метаданные и master edition
    msg!("Creating metadata and master edition...");
    let create_v1 = CreateV1 {
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        mint: (*mint_account.key, true),
        authority: *program_authority.key,
        payer: *payer.key,
        update_authority: (*program_authority.key, true),
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: Some(*spl_token_program.key),
    };

    let create_args = CreateV1InstructionArgs {
        name: "pNFT".to_string(),
        symbol: "PNFT".to_string(),
        uri: "https://example.com/metadata.json".to_string(),
        seller_fee_basis_points: 500,
        creators: None,
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: None,
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Zero),
    };

    invoke_signed(
        &create_v1.instruction(create_args),
        &[
            metadata_account.clone(),
            master_edition_account.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            program_authority.clone(), // update_authority
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
        ],
        signers,
    )?;

    // Создаем ассоциированный токен аккаунт
    msg!("Creating associated token account...");
    invoke(
        &spl_associated_token_account::instruction::create_associated_token_account(
            payer.key,
            token_owner.key,
            mint_account.key,
            &spl_token::id(),
        ),
        &[
            payer.clone(),
            token_account.clone(),
            token_owner.clone(),
            mint_account.clone(),
            system_program.clone(),
            spl_token_program.clone(),
            spl_ata_program.clone(),
            rent_sysvar.clone(),
        ],
    )?;

    // Создаем PDA для расширенного отслеживания минтинга
    msg!("Creating extended mint record PDA...");
    let mint_record_size = 32;
    let mint_record_lamports = rent.minimum_balance(mint_record_size);
    
    let mint_record_signature_seeds = &[
        b"is_minted_ext".as_ref(),
        &[round_number as u8],
        payer.key.as_ref(),
        &[mint_record_bump],
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
    
    let mut data = mint_record_account.try_borrow_mut_data()?;
    data[0..32].copy_from_slice(&mint_account.key.to_bytes());

    // Минтим токен
    msg!("Minting token...");
    let mint_v1 = MintV1 {
        token: *token_account.key,
        token_owner: Some(*token_owner.key),
        metadata: *metadata_account.key,
        master_edition: Some(*master_edition_account.key),
        token_record: Some(*token_record.key),
        mint: *mint_account.key,
        authority: *program_authority.key,
        payer: *payer.key,
        system_program: *system_program.key,
        sysvar_instructions: *sysvar_instructions.key,
        spl_token_program: *spl_token_program.key,
        spl_ata_program: *spl_ata_program.key,
        authorization_rules_program: None,
        authorization_rules: None,
        delegate_record: None,
    };

    let mint_args = MintV1InstructionArgs {
        amount: 1,
        authorization_data: None,
    };

    invoke_signed(
        &mint_v1.instruction(mint_args),
        &[
            token_account.clone(),
            token_owner.clone(),
            metadata_account.clone(),
            master_edition_account.clone(),
            token_record.clone(),
            mint_account.clone(),
            program_authority.clone(),
            payer.clone(),
            system_program.clone(),
            sysvar_instructions.clone(),
            spl_token_program.clone(),
            spl_ata_program.clone(),
            token_metadata_program.clone(),
        ],
        signers,
    )?;

    msg!("pNFT created and minted successfully with Merkle proof verification!");
    Ok(())
}

// Вспомогательная функция для проверки меркл доказательства
fn verify_merkle_proof(leaf: [u8;32], proof: &Vec<[u8;32]>, root: [u8;32]) -> bool {
    let mut computed = leaf;
    for node in proof.iter() {
        let (min, max) = if computed <= *node { (computed, *node) } else { (*node, computed) };
        let mut bytes = [0u8;64];
        bytes[..32].copy_from_slice(&min);
        bytes[32..].copy_from_slice(&max);
        computed = hash(&bytes).to_bytes();
    }
    computed == root
} 