use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    pubkey::Pubkey,
    program_error::ProgramError,
};

use mpl_token_metadata::{
    instructions::CreateV1,
    instructions::CreateV1InstructionArgs,
    types::{TokenStandard, PrintSupply},
};

pub fn process_create_limited_nft(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    msg!("Starting create_limited_nft...");
    
    // Get accounts
    let metadata_account = &accounts[0];
    let master_edition_account = &accounts[1];
    let mint_account = &accounts[2];
    let program_authority = &accounts[3];
    let payer = &accounts[4];
    let system_program = &accounts[6];
    let sysvar_instructions = &accounts[7];
    let spl_token_program = &accounts[8];
    
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

    // Create CreateV1 instruction
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

    let args = CreateV1InstructionArgs {
        name: "NFT".to_string(),
        symbol: "NFT".to_string(),
        uri: "".to_string(),
        seller_fee_basis_points: 700,
        creators: None,
        primary_sale_happened: false,
        is_mutable: true,
        token_standard: TokenStandard::ProgrammableNonFungible,
        collection: None,
        uses: None,
        collection_details: None,
        rule_set: None,
        decimals: Some(0),
        print_supply: Some(PrintSupply::Limited(1)),
    };

    // Create seeds for signing
    let authority_signature_seeds = &[
        b"mint_authority".as_ref(),
        &[bump_seed],
    ];
    let signers = &[&authority_signature_seeds[..]];

    // Call CreateV1 instruction
    invoke_signed(
        &create_v1.instruction(args),
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

    msg!("Limited NFT created successfully with print supply 1!");
    Ok(())
} 