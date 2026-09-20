;; sato-transfer.clar
;; Sato - Bitcoin payment app on Stacks
;; Handles sBTC transfers between Stacks principals.
;;
;; Design:
;; - Tracks sBTC balances custodied by this contract in `balances`.
;;   On mainnet, replace `mint`/`deposit` with a real SIP-010
;;   `contract-call?` into the canonical sBTC token contract:
;;   SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
;; - `send` validates amount, self-transfer, and sufficient balance,
;;   executes the transfer, and emits a transfer event via `print`.

;; Error constants
(define-constant ERR_INSUFFICIENT_BALANCE (err u100))
(define-constant ERR_INVALID_AMOUNT (err u101))
(define-constant ERR_SELF_TRANSFER (err u102))

;; Contract owner (deployer)
(define-constant CONTRACT_OWNER tx-sender)

;; Total sBTC custodied by the contract
(define-data-var total-supply uint u0)

;; sBTC balance ledger: principal -> amount (in sats)
(define-map balances principal uint)

;; Read-only: get sBTC balance for a principal
(define-read-only (get-balance (who principal))
  (default-to u0 (map-get? balances who))
)

;; Read-only: get total supply custodied
(define-read-only (get-total-supply)
  (var-get total-supply)
)

;; Test/devnet helper: mint sBTC to a recipient.
;; In production, gate this to CONTRACT_OWNER or remove it and
;; use real sBTC deposits via the SIP-010 transfer.
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (map-set balances recipient (+ (get-balance recipient) amount))
    (var-set total-supply (+ (var-get total-supply) amount))
    (print {event: "sbtc-mint", recipient: recipient, amount: amount})
    (ok true)
  )
)

;; Deposit helper: caller credits their own balance (simulates wrapping sBTC).
(define-public (deposit (amount uint))
  (mint tx-sender amount)
)

;; Send sBTC to another Stacks principal.
;; - recipient: principal receiving sBTC
;; - amount: sats to transfer (must be > u0)
(define-public (send (recipient principal) (amount uint))
  (let
    (
      (sender tx-sender)
      (sender-balance (get-balance sender))
      (recipient-balance (get-balance recipient))
    )
    ;; Validate amount is positive
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    ;; Prevent self-transfer
    (asserts! (not (is-eq sender recipient)) ERR_SELF_TRANSFER)
    ;; Validate sender has sufficient balance
    (asserts! (>= sender-balance amount) ERR_INSUFFICIENT_BALANCE)
    ;; Execute the sBTC transfer
    (map-set balances sender (- sender-balance amount))
    (map-set balances recipient (+ recipient-balance amount))
    ;; Emit transfer event
    (print {event: "sbtc-transfer", sender: sender, recipient: recipient, amount: amount})
    (ok true)
  )
)
