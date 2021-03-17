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
    use ink_env::{call::*, DefaultEnvironment};
    use ink_prelude::vec::Vec;
    use ink_storage::collections::HashMap as StorageHashMap;

    #[derive(Debug, PartialEq, Eq, scale::Encode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        DuplicateTokenError,
        TokenIsntWhitelistError,
        InsufficientBalanceError,
        RemoteCallError,
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
        pub fn approved_tokens(&self) -> Result<Vec<TokenId>> {
            Ok(self
                .token_whitelist
                .iter()
                .filter(|&(_, &v)| v == true)
                .map(|(k, _)| k)
                .cloned()
                .collect::<Vec<TokenId>>())
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

            self._transfer_from_to(token_id, caller, self.env().account_id(), value)?;

            let caller_balance = self.balance_of(token_id, caller);
            self.token_balances
                .insert((token_id, caller), caller_balance + value);

            self.env().emit_event(Deposit { token_id, value });

            Ok(())
        }

        #[ink(message)]
        pub fn withdraw(&mut self, token_id: TokenId, value: Balance) -> Result<()> {
            let from = self.env().caller();
            let to = self.env().account_id();
            let from_balance = self.balance_of(token_id, from);

            ensure!(
                self.is_whitelisted(token_id),
                Error::TokenIsntWhitelistError
            );
            ensure!(from_balance >= value, Error::InsufficientBalanceError);

            self._transfer_from_to(
                token_id,
                self.env().caller(),
                self.env().account_id(),
                value,
            )?;

            self.token_balances
                .insert((token_id, from), from_balance - value);
            let to_balance = self.balance_of(token_id, to);
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
            let result = build_call::<DefaultEnvironment>()
                .callee(token_id)
                .exec_input(
                    ExecutionInput::new(Selector::new([0xDE, 0xAD, 0xBE, 0xEF]))
                        // from
                        .push_arg(from)
                        // to
                        .push_arg(to)
                        // value
                        .push_arg(value),
                )
                .returns::<()>()
                .fire();

            if result.is_err() {
                Err(Error::RemoteCallError)
            } else {
                Ok(())
            }
        }
    }
}
