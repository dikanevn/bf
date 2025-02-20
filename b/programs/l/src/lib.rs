extern crate mpl_token_metadata;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_spl::associated_token::AssociatedToken;
//  Импорт CPI‑билдера для создания мастер-эдишн (mpl-token-metadata v5.1.0)
// use mpl_token_metadata::instructions::create_master_edition_v3;

// Определяем константы с жёстко заданными адресами.
pub const MY_SYSTEM_PROGRAM: Pubkey = pubkey!("11111111111111111111111111111111");
pub const MY_TOKEN_PROGRAM: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Жёстко заданный адрес Metaplex Token Metadata программы
pub const METADATA_PROGRAM_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Объявляем идентификатор программы
declare_id!("DZwg4GQrbhX6HjM1LkCePZC3TeoeCtqyWxtpwgQpBtxj");

#[program]
pub mod l {
    use super::*;

    pub fn create_token(ctx: Context<CreateToken>) -> Result<()> {
        msg!("Начало выполнения create_token...");
        // Здесь мы просто создаем токен без выполнения mint_to
        msg!("Токен успешно создан.");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateToken<'info> {
    /// CHECK: Этот аккаунт является плательщиком транзакции и должен подписывать её.
    #[account(mut, signer)]
    pub authority: AccountInfo<'info>,

    // Новый mint токена, который будет создан
    #[account(
        init, 
        payer = authority, 
        mint::decimals = 0, 
        mint::authority = authority, 
        mint::freeze_authority = authority
    )]
    pub mint: Account<'info, Mint>,

    // Системная программа
    pub system_program: Program<'info, System>,
    
    // Программа SPL Token
    pub token_program: Program<'info, Token>,

    // Associated Token Program
    pub associated_token_program: Program<'info, AssociatedToken>,

    // Sysvar rent
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Переданный Metadata аккаунт неверен.")]
    InvalidMetadata,
    #[msg("Переданный MasterEdition аккаунт неверен.")]
    InvalidMasterEdition,
    #[msg("Ошибка сборки инструкции CreateMasterEditionV3.")]
    InstructionBuildError,
}
