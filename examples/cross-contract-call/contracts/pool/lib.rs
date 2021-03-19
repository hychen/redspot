#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

macro_rules! ensure {
    ($cond:expr, $err:expr $(,)?) => {
        if !$cond {
            return core::result::Result::Err($err);
        }
    };
}

#[ink::contract]
mod pool {
    use erc20::{Erc20, Error as Erc20Error, Result as Errc20Result};
    use ink_env::call::FromAccountId;
    use ink_prelude::vec::Vec;
    use ink_storage::collections::HashMap as StorageHashMap;

    #[derive(Debug, PartialEq, Eq, scale::Encode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        DuplicateTokenError,
        TokenIsntWhitelistError,
        InsufficientBalanceError,
        TransferError(Erc20Error),
    }

    pub type Result<T> = core::result::Result<T, Error>;

    type TokenId = AccountId;

    #[ink(event)]
    pub struct AddToWhiteList {
        #[ink(topic)]
        token_id: TokenId,
    }

    #[ink(event)]
    pub struct RemoveFromWhiteList {
        #[ink(topic)]
        token_id: TokenId,
    }

    #[ink(event)]
    pub struct Deposit {
        #[ink(topic)]
        token_id: TokenId,
        value: Balance,
    }

    #[ink(event)]
    pub struct Withdraw {
        #[ink(topic)]
        token_id: TokenId,
        value: Balance,
    }

    #[derive(Default)]
    #[ink(storage)]
    pub struct Pool {
        token_balances: StorageHashMap<(TokenId, AccountId), Balance>,
        token_whitelist: StorageHashMap<TokenId, bool>,
    }

    impl Pool {
        #[ink(constructor)]
        pub fn new(_approved_tokens: Vec<TokenId>) -> Self {
            let mut instance = Self::default();
            for i in _approved_tokens.iter() {
                assert!(instance.add_to_whitelist(*i).is_ok(), "instance fail.");
            }
            instance
        }

        #[ink(message)]
        pub fn approved_tokens(&self) -> Vec<TokenId> {
            self.token_whitelist
                .iter()
                .filter(|&(_, &v)| v == true)
                .map(|(k, _)| k)
                .cloned()
                .collect::<Vec<TokenId>>()
        }

        #[ink(message)]
        pub fn add_to_whitelist(&mut self, token_id: TokenId) -> Result<()> {
            ensure!(!self.is_whitelisted(token_id), Error::DuplicateTokenError);
            self.token_whitelist.insert(token_id, true);
            self.env().emit_event(AddToWhiteList { token_id });
            Ok(())
        }

        #[ink(message)]
        pub fn remove_from_whitelist(&mut self, token_id: TokenId) -> Result<()> {
            ensure!(
                self.is_whitelisted(token_id),
                Error::TokenIsntWhitelistError
            );
            self.token_whitelist.insert(token_id, false);
            self.env().emit_event(RemoveFromWhiteList { token_id });
            Ok(())
        }

        #[ink(message)]
        pub fn is_whitelisted(&self, token_id: TokenId) -> bool {
            *self.token_whitelist.get(&token_id).unwrap_or(&false)
        }

        #[ink(message)]
        pub fn deposit(&mut self, token_id: TokenId, value: Balance) -> Result<()> {
            ensure!(
                self.is_whitelisted(token_id),
                Error::TokenIsntWhitelistError
            );

            let caller = self.env().caller();
            let mut token: Erc20 = FromAccountId::from_account_id(token_id);
            let result = token.transfer_from(caller, self.env().account_id(), value);
            if !result.is_ok() {
                return Err(Error::TransferError(result.err().unwrap()));
            };

            let caller_balance = self.balance_of(token_id, caller);
            self.token_balances
                .insert((token_id, caller), caller_balance + value);

            self.env().emit_event(Deposit { token_id, value });

            Ok(())
        }

        #[ink(message)]
        pub fn withdraw(&mut self, token_id: TokenId, value: Balance) -> Result<()> {
            let from = self.env().account_id();
            let to = self.env().caller();
            let to_balance = self.balance_of(token_id, to);
            let mut token: Erc20 = FromAccountId::from_account_id(token_id);

            ensure!(
                self.is_whitelisted(token_id),
                Error::TokenIsntWhitelistError
            );
            ensure!(to_balance >= value, Error::InsufficientBalanceError);
            assert!(token.approve(from, value).is_ok());
            self._transfer_from_to(token_id, from, to, value)?;

            self.token_balances
                .insert((token_id, to), to_balance - value);

            self.env().emit_event(Withdraw { token_id, value });

            Ok(())
        }

        #[ink(message)]
        pub fn balance_of(&self, token_id: TokenId, account_id: AccountId) -> Balance {
            self.token_balances
                .get(&(token_id, account_id))
                .copied()
                .unwrap_or(0)
        }

        fn _transfer_from_to(
            &mut self,
            token_id: TokenId,
            from: AccountId,
            to: AccountId,
            value: Balance,
        ) -> Result<()> {
            let result: Errc20Result<()> = ink_env::call::build_call::<ink_env::DefaultEnvironment>()
                .callee(token_id)
                .exec_input(
                    ink_env::call::ExecutionInput::new(ink_env::call::Selector::new([0xDE, 0xAD, 0xBE, 0xEF]))
                        // from
                        .push_arg(from)
                        // to
                        .push_arg(to)
                        // value
                        .push_arg(value),
                )
                .returns::<ink_env::call::utils::ReturnType<Errc20Result<()>>>()
                .fire()
                .unwrap();

            if result.is_err() {
                Err(Error::TransferError(result.err().unwrap()))
            } else {
                Ok(())
            }
        }
    }
}
