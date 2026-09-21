;; sato-vault.clar
;; Sato - Bitcoin payment app on Stacks
;; Real sBTC custody vault: users deposit and withdraw the canonical sBTC
;; token via SIP-010 transfers. Unlike sato-transfer / sato-yield, which
;; keep an internal devnet ledger, this contract moves actual sBTC into and
;; out of its own custody with `contract-call?` into the token, so the
;; balances it tracks are backed one-to-one by sBTC the contract really
;; holds.
;;
;; Design:
;; - The sBTC token is passed as a SIP-010 trait argument and pinned: every
;;   deposit/withdraw asserts the passed token equals `sbtc-token-contract`,
;;   so a caller cannot substitute a fake token. That principal defaults to
;;   the testnet sBTC token and is owner-updatable, which lets tests point
;;   it at a local mock and lets mainnet point it at
;;   SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token without a code
;;   change.
;; - `deposit` pulls sBTC from the caller into (as-contract tx-sender), the
;;   vault's own principal. `withdraw` sends it back from the vault under
;;   `as-contract`. Internal state is updated before the transfer
;;   (checks-effects-interactions); a failing transfer reverts the whole
;;   call via `try!`.

(use-trait sip-010 .sip-010-transfer.sip-010-transfer)

;; Error constants (u500 range for this contract)
(define-constant ERR_INVALID_AMOUNT (err u500))
(define-constant ERR_INSUFFICIENT_BALANCE (err u501))
(define-constant ERR_UNAUTHORIZED (err u502))
(define-constant ERR_WRONG_TOKEN (err u503))

;; Contract owner (deployer): may repoint the pinned sBTC token
(define-constant CONTRACT_OWNER tx-sender)

;; The sBTC token this vault accepts. Defaults to the testnet sBTC token;
;; owner-updatable so tests use a mock and mainnet uses the canonical token.
(define-data-var sbtc-token-contract principal 'SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token)

;; Total sBTC held in the vault (in sats), backed by real custody
(define-data-var total-deposited uint u0)

;; Per-user deposited sBTC balance (in sats)
(define-map balances principal uint)

;; Read-only: a user's vault balance
(define-read-only (get-balance (user principal))
  (default-to u0 (map-get? balances user))
)

;; Read-only: total sBTC custodied by the vault
(define-read-only (get-total-deposited)
  (var-get total-deposited)
)

;; Read-only: the sBTC token principal this vault currently accepts
(define-read-only (get-sbtc-token)
  (var-get sbtc-token-contract)
)

;; Repoint the accepted sBTC token. Owner-only.
;; - new-token: the sBTC token principal to accept
(define-public (set-sbtc-token (new-token principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set sbtc-token-contract new-token)
    (print {event: "vault-set-token", owner: tx-sender, token: new-token})
    (ok true)
  )
)

;; Deposit sBTC into the vault. Pulls `amount` sats of the pinned sBTC token
;; from the caller into the vault's custody and credits their balance.
;; - token: the sBTC token contract (must match the pinned principal)
;; - amount: sats to deposit (must be > u0)
(define-public (deposit (token <sip-010>) (amount uint))
  (let ((user tx-sender))
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR_WRONG_TOKEN)
    ;; Pull sBTC from the caller into the vault's own principal
    (try! (contract-call? token transfer amount user (as-contract tx-sender) none))
    (map-set balances user (+ (get-balance user) amount))
    (var-set total-deposited (+ (var-get total-deposited) amount))
    (print {event: "vault-deposit", user: user, amount: amount})
    (ok true)
  )
)

;; Withdraw sBTC from the vault back to the caller.
;; - token: the sBTC token contract (must match the pinned principal)
;; - amount: sats to withdraw (must be > u0 and <= deposited balance)
(define-public (withdraw (token <sip-010>) (amount uint))
  (let
    (
      (user tx-sender)
      (bal (get-balance tx-sender))
    )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (is-eq (contract-of token) (var-get sbtc-token-contract)) ERR_WRONG_TOKEN)
    (asserts! (>= bal amount) ERR_INSUFFICIENT_BALANCE)
    ;; Effects first, then the external transfer (reverts on failure)
    (map-set balances user (- bal amount))
    (var-set total-deposited (- (var-get total-deposited) amount))
    ;; Vault sends sBTC back to the user from its own custody
    (try! (as-contract (contract-call? token transfer amount tx-sender user none)))
    (print {event: "vault-withdraw", user: user, amount: amount})
    (ok true)
  )
)
