use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token};


// Фиксированные адреса (константы)
pub const FIXED_MINT: Pubkey = pubkey!("BNW1SZibkGWT8qMgcigzTq7gW2vsXH6Dbpk1Pvqph2Jm");
pub const FIXED_TOKEN_ACCOUNT: Pubkey =
    pubkey!("9NVsATCUsiWvcTvimFfQJhvPd2ffaTNetqxwAUj8vUCt");

declare_id!("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

#[program]
pub mod l {
    use super::*;
    
    // Функция mint_one вызывает mint_to через CPI и чеканит 1 токен
    // с использованием зашитых адресов для mint и ассоциированного токен-аккаунта.
    pub fn mint_one(ctx: Context<MintOne>) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // Чеканим 1 токен
        token::mint_to(cpi_ctx, 1)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintOne<'info> {
    // Фиксированный аккаунт mint
    /// CHECK: Этот аккаунт является зафиксированным mint-аккаунтом и предполагается валидным — дополнительных проверок не требуется.
    #[account(mut, address = FIXED_MINT)]
    pub mint: AccountInfo<'info>,

    // Фиксированный ассоциированный токен-аккаунт
    /// CHECK: Этот аккаунт является фиксированным ассоциированным token-аккаунтом и предполагается валидным — дополнительных проверок не требуется.
    #[account(mut, address = FIXED_TOKEN_ACCOUNT)]
    pub token_account: AccountInfo<'info>,

    // Аккаунт вызывающего (подписанта)
    /// CHECK: Этот аккаунт отвечает за подпись транзакции, и его безопасность обеспечивается атрибутом #[account(signer)].
    /// Дополнительные проверки не требуются.
    #[account(signer)]
    pub authority: AccountInfo<'info>,

    // Программа SPL Token (точка входа в spl-token)
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("В транзакции не переданы фиксированные аккаунты mint и token account")]
    MissingAccounts,
    #[msg("Передан неверный аккаунт mint")]
    InvalidMint,
    #[msg("Передан неверный ассоциированный токен-аккаунт")]
    InvalidTokenAccount,
}