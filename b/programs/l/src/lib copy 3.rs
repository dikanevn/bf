use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo, Token};


// Фиксированные адреса (константы)
pub const FIXED_MINT: Pubkey = pubkey!("4hT14RdMbtyRnU8zEdNKV4kSYYUPpoVLEduWMY8hS7dC");
pub const FIXED_TOKEN_ACCOUNT: Pubkey =
    pubkey!("5ok2ErMGKRyeZW9yXXRMrNx44uEgTySvgseayqXCU5G4");

declare_id!("2BESDrxqXxBWYwhiuzC4SgsoCmqoMiiEGwZ1en6gT4Se");

//Computed PDA TOKEN_PROGRAM_ID: "8farn8gh39nC9oRJvB3qcTEZN1krydmrJFn3LBBMWb5S"

#[program]
pub mod l {
    use super::*;
    
    // Функция mint_one вызывает mint_to через CPI и чеканит 1 токен
    // с использованием зашитых адресов для mint и ассоциированного токен-аккаунта.
    pub fn mint_one(ctx: Context<MintOne>) -> Result<()> {
        msg!("Запуск инструкции mint_one");
        msg!("Mint аккаунт: {:?}", ctx.accounts.mint.key);
        msg!("Token аккаунт: {:?}", ctx.accounts.token_account.key);
        msg!("PDA mint_authority: {:?}", ctx.accounts.mint_authority.key);
        
        // Используем PDA минт-авторитета вместо аккаунта вызывающего для подписания CPI.
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Приводим фиксированный массив с bump к срезу типа &[&[u8]]
        let authority_seeds: &[&[u8]] = &[b"mint_authority", &[ctx.bumps.mint_authority][..]];
        let signer: &[&[&[u8]]] = &[authority_seeds];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        msg!("Перед вызовом token::mint_to");

        // Чеканим 1 токен
        token::mint_to(cpi_ctx, 1)?;
        msg!("Чеканка 1 токена выполнена успешно");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintOne<'info> {
    // FIXED_MINT: 
    // Это аккаунт токена (mint account), фиксированный константой. 
    // Он содержит информацию о самом токене (например, общее предложение, десятичные знаки и т.д.)
    /// CHECK: Этот аккаунт является зафиксированным mint-аккаунтом и считается валидным — дополнительных проверок не требуется.
    #[account(mut, address = FIXED_MINT)]
    pub mint: AccountInfo<'info>,

    // FIXED_TOKEN_ACCOUNT:
    // Это аккаунт, связанный с токеном, куда будут зачисляться сгенерированные токены.
    // Его адрес также фиксирован, что означает, что операция происходит только с этим конкретным токен-аккаунтом.
    /// CHECK: Этот аккаунт является фиксированным ассоциированным token-аккаунтом и считается валидным — дополнительных проверок не требуется.
    #[account(mut, address = FIXED_TOKEN_ACCOUNT)]
    pub token_account: AccountInfo<'info>,

    // token_program:
    // Это ссылка на стандартную программу SPL Token, которая реализует логику работы с токенами.
    // При вызове функции mint_to используется именно эта программа.
    pub token_program: Program<'info, Token>,

    // mint_authority:
    // Это PDA (program-derived address), которая получена с использованием фиксированного семени (seed).
    // В mint-аккаунте этот PDA должен быть установлен как authority для чекана токенов.
    // Именно от этого аккаунта (PDA) происходит подпись для вызова CPI (через new_with_signer).
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    /// CHECK: Этот аккаунт является PDA mint authority, выводится с использованием семени `[b"mint_authority"]` и соответствующего bump. Дополнительных проверок не производится.
    pub mint_authority: AccountInfo<'info>,
}