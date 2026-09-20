;; sato-sponsor.clar
;; Sato - Bitcoin payment app on Stacks
;; Sponsored-transaction pool: a designated sponsor funds an STX pool
;; that reimburses users' transaction fees, so users can transact
;; without holding STX for gas.
;;
;; Design:
;; - Stacks sponsored transactions are a protocol-level feature (the
;;   sponsor co-signs and pays the miner fee off-chain). A contract
;;   cannot itself pay a miner. This contract instead models the
;;   on-chain accounting side: the sponsor pre-funds an STX pool held
;;   by the contract, and `sponsor-tx` reimburses a user's fee from
;;   that pool while tracking per-user sponsorship counts.
;; - `sponsor-balance` mirrors the STX actually custodied by the
;;   contract: `top-up` moves STX in and increments it; `sponsor-tx`
;;   moves STX out (to the user) and decrements it. The two stay in
;;   sync so the balance check is honest.
;; - Only CONTRACT_OWNER (the sponsor, set at deploy) may sponsor.
;;   Anyone may top up the pool.

;; Error constants
(define-constant ERR_INSUFFICIENT_SPONSOR_BALANCE (err u300))
(define-constant ERR_UNAUTHORIZED (err u301))
(define-constant ERR_INVALID_AMOUNT (err u302))

;; Contract owner (the designated sponsor, set at deploy)
(define-constant CONTRACT_OWNER tx-sender)

;; STX held in the sponsor pool (in micro-STX), mirrors contract custody
(define-data-var sponsor-balance uint u0)

;; Per-user count of sponsored transactions
(define-map sponsored-count principal uint)

;; Read-only: current sponsor pool balance (micro-STX)
(define-read-only (get-sponsor-balance)
  (var-get sponsor-balance)
)

;; Read-only: how many transactions have been sponsored for a user
(define-read-only (get-sponsored-count (user principal))
  (default-to u0 (map-get? sponsored-count user))
)

;; Read-only: the designated sponsor
(define-read-only (get-sponsor)
  CONTRACT_OWNER
)

;; Top up the sponsor pool. Caller sends STX into the contract and the
;; pool balance is credited. Permissionless so anyone can fund gas.
;; - amount: micro-STX to add (must be > u0)
(define-public (top-up (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    ;; Move STX from the caller into the contract's custody
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set sponsor-balance (+ (var-get sponsor-balance) amount))
    (print {event: "sponsor-top-up", contributor: tx-sender, amount: amount, balance: (var-get sponsor-balance)})
    (ok true)
  )
)

;; Sponsor a transaction for a user: reimburse `fee` micro-STX from the
;; pool to the user and record the sponsorship. Sponsor-only.
;; - user: the principal whose fee is being covered
;; - fee: micro-STX to reimburse (must be > u0)
(define-public (sponsor-tx (user principal) (fee uint))
  (let
    (
      (balance (var-get sponsor-balance))
      (new-count (+ (get-sponsored-count user) u1))
    )
    ;; Only the designated sponsor may draw from the pool
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    ;; Fee must be positive
    (asserts! (> fee u0) ERR_INVALID_AMOUNT)
    ;; Pool must be able to cover the fee
    (asserts! (>= balance fee) ERR_INSUFFICIENT_SPONSOR_BALANCE)
    ;; Reimburse the user's fee from the contract-held pool
    (try! (as-contract (stx-transfer? fee tx-sender user)))
    ;; Debit the pool and bump the user's sponsored count
    (var-set sponsor-balance (- balance fee))
    (map-set sponsored-count user new-count)
    (print {event: "sponsor-tx", sponsor: tx-sender, user: user, fee: fee, count: new-count, balance: (- balance fee)})
    (ok true)
  )
)
