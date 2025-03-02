// с нуля pNFT без проверок

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    pubkey::Pubkey,
    program_error::ProgramError,
};

use mpl_token_metadata::{
    instructions::{CreateV1, CreateV1InstructionArgs, MintV1, MintV1InstructionArgs},
    types::{TokenStandard, PrintSupply},
};

pub fn process_create_and_mint_pnft(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Starting create_and_mint_pnft...");
    
    let accounts_iter = &mut accounts.iter();
    
    // Get accounts for CreateV1
    let metadata_account = next_account_info(accounts_iter)?;
    let master_edition_account = next_account_info(accounts_iter)?;
    let mint_account = next_account_info(accounts_iter)?;
    let program_authority = next_account_info(accounts_iter)?;
    let payer = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;
    let sysvar_instructions = next_account_info(accounts_iter)?;
    let spl_token_program = next_account_info(accounts_iter)?;
    
    // Get additional accounts for MintV1
    let token_owner = next_account_info(accounts_iter)?;
    let token_account = next_account_info(accounts_iter)?;
    let token_record = next_account_info(accounts_iter)?;
    let spl_ata_program = next_account_info(accounts_iter)?;
    let token_metadata_program = next_account_info(accounts_iter)?;
    
    // Verify signatures
    if !mint_account.is_signer {
        msg!("Mint account must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer {
        msg!("Payer must be a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program_authority PDA
    let (expected_authority, bump_seed) = Pubkey::find_program_address(
        &[b"mint_authority"],
        program_id
    );
    if program_authority.key != &expected_authority {
        msg!("Invalid program authority provided");
        return Err(ProgramError::InvalidArgument);
    }

    // Create authority seeds for signing
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Step 1: Create pNFT with CreateV1
    msg!("Step 1: Creating pNFT with CreateV1...");
    
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

    // Step 2: Mint token with MintV1
    msg!("Step 2: Minting token with MintV1...");
    
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

    msg!("pNFT created and minted successfully!");
    Ok(())
} 