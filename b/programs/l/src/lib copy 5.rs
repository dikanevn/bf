use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token};
use anchor_spl::associated_token::AssociatedToken;


// Фиксированный адрес mint токена
pub const FIXED_MINT: Pubkey = pubkey!("91aT1KmqDzdBD6ZvJVFx79wdLv7WsgYQLkqXYv2Gxqpk");

declare_id!("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

//Computed PDA TOKEN_PROGRAM_ID: "8farn8gh39nC9oRJvB3qcTEZN1krydmrJFn3LBBMWb5S"

#[program]
pub mod l {
    use super::*;
    
    // Функция mint_one вызывает mint_to через CPI и чеканит 1 токен
    // с использованием зашитых адресов для mint и ассоциированного токен-аккаунта.
    pub fn mint_one(ctx: Context<MintOne>) -> Result<()> {
        // Ассоциированный токен-аккаунт теперь вычисляется автоматически благодаря аннотации associated_token.

        msg!("Запуск инструкции mint_one");
        msg!("Mint аккаунт: {:?}", ctx.accounts.mint.key());
        msg!("Token аккаунт: {:?}", ctx.accounts.token_account.key());
        msg!("PDA mint_authority: {:?}", ctx.accounts.mint_authority.key());
        
        // Используем PDA минт-авторитета вместо аккаунта вызывающего для подписания CPI.
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Приводим фиксированный массив с bump к срезу типа &[&[u8]]
        let authority_bump = ctx.bumps.mint_authority;
        let authority_seeds: &[&[u8]] = &[b"mint_authority", &[authority_bump][..]];
        let signer: &[&[&[u8]]] = &[authority_seeds];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        msg!("Перед вызовом token::mint_to");

        // Чеканим 1 токен
        msg!("Перед вызовом mint_to");
        token::mint_to(cpi_ctx, 1)?;
        msg!("Чеканка 1 токена выполнена успешно");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintOne<'info> {
    /// Плательщик за создание ассоциированного токен-аккаунта (и владелец).
    #[account(mut, signer)]
    pub authority: Signer<'info>,

    /// Аккаунт mint, фиксированный константой.
    #[account(mut, address = FIXED_MINT)]
    pub mint: Account<'info, anchor_spl::token::Mint>,

    /// Ассоциированный токен-аккаунт владельца, вычисляемый автоматически.
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority
    )]
    pub token_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,

    // Токен-программа.
    pub token_program: Program<'info, Token>,
    // Программа для ассоциированных токен-аккаунтов.
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    // Системная программа.
    pub system_program: Program<'info, System>,
    // Системная переменная rent.
    pub rent: Sysvar<'info, Rent>,

    // mint_authority (PDA), используемый для чеканки токенов.
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    /// CHECK: Этот аккаунт является PDA mint authority.
    pub mint_authority: AccountInfo<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Неверный ассоциированный токен-аккаунт для данного владельца")]
    InvalidTokenAccount,
}