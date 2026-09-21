;; sato-yield.clar
;; Sato - Bitcoin payment app on Stacks
;; Flexible-yield lending pool: users deposit sBTC and earn a share of
;; yield the pool receives, distributed pro-rata to their deposited
;; principal.
;;
;; Design (v1, simplified):
;; - Like sato-transfer.clar, this contract keeps its own internal sBTC
;;   ledger (`sbtc-balances`) for devnet. `fund-sbtc` credits a caller so
;;   tests and demos have sBTC to deposit. On mainnet, replace the ledger
;;   and its debits/credits with real SIP-010 `contract-call?`s into the
;;   canonical sBTC token contract:
;;   SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
;;   (deposit -> transfer sBTC to (as-contract tx-sender); withdraw ->
;;   transfer it back), leaving the pool accounting below unchanged.
;; - Yield is distributed with an accumulator index, `acc-yield-per-share`.
;;   It holds cumulative yield paid per unit of deposited principal, scaled
;;   by SCALE for precision. When the owner calls `add-yield`, the index
;;   grows by amount * SCALE / pool-principal, so every depositor's claim
;;   grows in proportion to their principal, regardless of when they joined.
;; - A user's record stores their `principal`, a `debt` baseline (the index
;;   value already accounted for), any `accrued` yield harvested by an
;;   earlier interaction, and the `height` of their last deposit. Pending
;;   yield is principal * index / SCALE - debt; total yield is accrued plus
;;   pending. Because the index only grows and debt is always set from the
;;   current principal, pending is never negative.
;; - `add-yield` floors the index increment, so a sub-unit remainder of a
;;   yield deposit may stay in the pool undistributed. This is deliberate:
;;   the pool is always over-collateralized against outstanding claims, so
;;   no withdrawal can be starved. Dust stays in the pool.

;; Error constants (u400 range for this contract)
(define-constant ERR_INSUFFICIENT_BALANCE (err u400))
(define-constant ERR_INVALID_AMOUNT (err u401))
(define-constant ERR_UNAUTHORIZED (err u402))
(define-constant ERR_EMPTY_POOL (err u403))

;; Contract owner (deployer): the only principal that may add yield
(define-constant CONTRACT_OWNER tx-sender)

;; Fixed-point scale for the yield accumulator (1e12)
(define-constant SCALE u1000000000000)

;; Total deposited principal across all users (in sats)
(define-data-var pool-principal uint u0)

;; Total yield added to the pool and not yet withdrawn (in sats)
(define-data-var pool-yield uint u0)

;; Cumulative yield paid per unit of principal, scaled by SCALE
(define-data-var acc-yield-per-share uint u0)

;; Internal sBTC ledger: principal -> balance (in sats). Devnet stand-in
;; for the canonical sBTC token; see the design note above.
(define-map sbtc-balances principal uint)

;; Per-user pool position:
;; - principal: sats the user currently has deposited
;; - debt:      index baseline already accounted for (principal * index / SCALE)
;; - accrued:   yield harvested into the record by an earlier interaction
;; - height:    stacks-block-height of the user's last deposit (timestamp)
(define-map deposits
  principal
  {principal: uint, debt: uint, accrued: uint, height: uint}
)

;; Read-only: a user's internal sBTC ledger balance
(define-read-only (get-sbtc-balance (who principal))
  (default-to u0 (map-get? sbtc-balances who))
)

;; Read-only: a user's full pool record (defaults for a new user)
(define-read-only (get-deposit (user principal))
  (default-to
    {principal: u0, debt: u0, accrued: u0, height: u0}
    (map-get? deposits user)
  )
)

;; Read-only: a user's current deposited balance (principal only)
(define-read-only (get-balance (user principal))
  (get principal (get-deposit user))
)

;; Read-only: stacks-block-height of a user's last deposit
(define-read-only (get-deposit-height (user principal))
  (get height (get-deposit user))
)

;; Read-only: the current yield accumulator index
(define-read-only (get-acc-yield-per-share)
  (var-get acc-yield-per-share)
)

;; Read-only: total sBTC held by the pool (principal + undistributed yield)
(define-read-only (get-pool-total)
  (+ (var-get pool-principal) (var-get pool-yield))
)

;; Read-only: total deposited principal across all users
(define-read-only (get-pool-principal)
  (var-get pool-principal)
)

;; Pure helper: pending (unharvested) yield for a principal/debt pair.
;; Safe from underflow: the index only grows and debt was set from the
;; same principal, so the current index term is always >= debt.
(define-read-only (pending-of (principal-amt uint) (debt uint))
  (- (/ (* principal-amt (var-get acc-yield-per-share)) SCALE) debt)
)

;; Read-only: estimated yield earned so far for a user (accrued + pending)
(define-read-only (get-yield (user principal))
  (let ((rec (get-deposit user)))
    (+ (get accrued rec) (pending-of (get principal rec) (get debt rec)))
  )
)

;; Devnet/test helper: credit the caller's internal sBTC ledger so they
;; have sBTC to deposit. On mainnet remove this and fund positions with
;; real sBTC transfers into the contract.
;; - amount: sats to credit (must be > u0)
(define-public (fund-sbtc (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (map-set sbtc-balances tx-sender (+ (get-sbtc-balance tx-sender) amount))
    (print {event: "sbtc-fund", user: tx-sender, amount: amount})
    (ok true)
  )
)

;; Deposit sBTC into the yield pool. Moves `amount` from the caller's sBTC
;; ledger into the pool and grows their tracked principal. Any yield already
;; pending is harvested into the record first, so growing the position never
;; loses earned yield.
;; - amount: sats to deposit (must be > u0)
(define-public (deposit (amount uint))
  (let
    (
      (user tx-sender)
      (sbtc (get-sbtc-balance user))
      (rec (get-deposit user))
      (prin (get principal rec))
      (pending (pending-of prin (get debt rec)))
      (new-prin (+ prin amount))
    )
    ;; Validate amount and available sBTC
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (>= sbtc amount) ERR_INSUFFICIENT_BALANCE)
    ;; Move sBTC from the caller's ledger into the pool's custody
    (map-set sbtc-balances user (- sbtc amount))
    ;; Harvest pending yield, grow principal, reset debt against new principal
    (map-set deposits user {
      principal: new-prin,
      debt: (/ (* new-prin (var-get acc-yield-per-share)) SCALE),
      accrued: (+ (get accrued rec) pending),
      height: stacks-block-height
    })
    (var-set pool-principal (+ (var-get pool-principal) amount))
    (print {event: "yield-deposit", user: user, amount: amount, principal: new-prin, height: stacks-block-height})
    (ok true)
  )
)

;; Withdraw deposited principal plus all earned yield. `amount` is the
;; principal to take out; the caller also receives their entire outstanding
;; yield (a withdrawal always harvests). The payout is credited to the
;; caller's sBTC ledger.
;; - amount: principal sats to withdraw (must be > u0 and <= deposited)
(define-public (withdraw (amount uint))
  (let
    (
      (user tx-sender)
      (rec (get-deposit user))
      (prin (get principal rec))
      (pending (pending-of prin (get debt rec)))
      (total-yield (+ (get accrued rec) pending))
    )
    ;; Validate amount and sufficient deposited principal. These run before
    ;; the subtraction below, which is why new-prin lives in a nested let:
    ;; Clarity evaluates all let bindings eagerly, so computing (- prin
    ;; amount) up here would underflow before the guard could reject it.
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (>= prin amount) ERR_INSUFFICIENT_BALANCE)
    (let
      (
        (new-prin (- prin amount))
        (payout (+ amount total-yield))
      )
      ;; Reduce principal, fully harvest yield, reset debt against new principal
      (map-set deposits user {
        principal: new-prin,
        debt: (/ (* new-prin (var-get acc-yield-per-share)) SCALE),
        accrued: u0,
        height: (get height rec)
      })
      ;; Pool accounting: principal leaves, harvested yield leaves
      (var-set pool-principal (- (var-get pool-principal) amount))
      (var-set pool-yield (- (var-get pool-yield) total-yield))
      ;; Credit the caller's sBTC ledger with principal + harvested yield
      (map-set sbtc-balances user (+ (get-sbtc-balance user) payout))
      (print {event: "yield-withdraw", user: user, principal-withdrawn: amount, yield-paid: total-yield, payout: payout})
      (ok true)
    )
  )
)

;; Add yield to the pool for pro-rata distribution to depositors. Owner-only.
;; The owner funds the yield from their own sBTC ledger; the accumulator
;; index grows so every depositor's claim rises in proportion to principal.
;; - amount: yield sats to distribute (must be > u0)
(define-public (add-yield (amount uint))
  (let
    (
      (owner tx-sender)
      (principal-total (var-get pool-principal))
      (sbtc (get-sbtc-balance owner))
    )
    ;; Only the owner may add yield
    (asserts! (is-eq owner CONTRACT_OWNER) ERR_UNAUTHORIZED)
    ;; Amount must be positive
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    ;; Cannot distribute into an empty pool (no principal to divide by)
    (asserts! (> principal-total u0) ERR_EMPTY_POOL)
    ;; Owner must hold enough sBTC to fund the yield
    (asserts! (>= sbtc amount) ERR_INSUFFICIENT_BALANCE)
    ;; Move the yield sBTC from the owner into the pool
    (map-set sbtc-balances owner (- sbtc amount))
    ;; Grow the accumulator (floored) and the pool's yield reserve
    (var-set acc-yield-per-share
      (+ (var-get acc-yield-per-share) (/ (* amount SCALE) principal-total)))
    (var-set pool-yield (+ (var-get pool-yield) amount))
    (print {event: "yield-added", owner: owner, amount: amount, pool-principal: principal-total})
    (ok true)
  )
)
