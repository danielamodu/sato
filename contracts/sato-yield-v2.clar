;; sato-yield-v2.clar
;; Sato - Bitcoin payment app on Stacks
;; Flexible-yield lending pool, v2. Supersedes sato-yield with two changes
;; that make earning real on testnet and a faithful foundation for mainnet:
;;
;;   1. Continuous, rate-based accrual. Instead of yield only appearing when
;;      the owner calls `add-yield`, the pool accrues yield every block from a
;;      configurable annual rate (`yield-rate-bps`). `get-yield` grows on its
;;      own between transactions, so a depositor watches earnings tick up in
;;      near-real-time. Standard lending/staking model:
;;      yield = principal * rate * elapsed-blocks / blocks-per-year.
;;
;;   2. Full wallet round-trip. Deposits pull real sBTC out of the caller's
;;      sato-transfer wallet balance into the pool's custody; withdrawals send
;;      principal + earned yield back to that same wallet. No separate
;;      "available" ledger: the money you earn with is the money in your wallet.
;;
;; Custody / mainnet path:
;; - The pool holds sBTC as a balance in the sibling sato-transfer contract
;;   (the app's devnet sBTC ledger). `deposit` calls sato-transfer `send` with
;;   the caller as tx-sender (user -> pool); `withdraw` calls it under
;;   `as-contract` (pool -> user). On mainnet, repoint these two calls at the
;;   canonical sBTC SIP-010 token (see sato-vault.clar for the trait pattern);
;;   the pool accounting below is unchanged.
;;
;; Yield accounting (MasterChef-style, as in v1):
;; - `acc-yield-per-share` is cumulative yield paid per unit of principal,
;;   scaled by SCALE. Each settlement grows it by amount * SCALE / principal,
;;   so a depositor's claim rises in proportion to their stake regardless of
;;   when they joined. `debt` is the index already accounted for; pending yield
;;   is principal * index / SCALE - debt. Increments are floored, so the pool
;;   stays over-collateralized against claims (dust stays in the pool).
;;
;; Solvency (testnet vs mainnet):
;; - Continuous accrual mints yield *claims*; they are payable only if the pool
;;   holds the sBTC to cover them. `fund-reserve` tops up custody with real sBTC
;;   to back accrued yield (`add-yield` does the same while also bumping the
;;   index). On testnet the owner pre-funds a generous reserve; on mainnet the
;;   rate is set to match what the underlying strategy actually earns, so
;;   accrual never outruns custody.

;; Error constants (u400 range for this contract)
(define-constant ERR_INSUFFICIENT_BALANCE (err u400))
(define-constant ERR_INVALID_AMOUNT (err u401))
(define-constant ERR_UNAUTHORIZED (err u402))
(define-constant ERR_EMPTY_POOL (err u403))

;; Contract owner (deployer): may add yield and set the accrual rate
(define-constant CONTRACT_OWNER tx-sender)

;; Fixed-point scale for the yield accumulator (1e12)
(define-constant SCALE u1000000000000)

;; Blocks per year for annualizing the rate (~10-min Bitcoin-anchored blocks).
;; With the exaggerated testnet rate and fast Nakamoto blocks, yield visibly
;; accrues within seconds; mainnet keeps this constant and dials the rate down.
(define-constant BLOCKS_PER_YEAR u52560)

;; Annual yield rate in basis points (1 bp = 0.01%). Owner-settable via
;; `set-rate`. Defaults to an intentionally exaggerated TESTNET value
;; (u2000000 = 20,000% APR) so earnings are visible in near-real-time; set a
;; realistic rate on mainnet.
(define-data-var yield-rate-bps uint u2000000)

;; Stacks block height at which yield was last settled into the accumulator.
(define-data-var last-accrual-height uint u0)

;; Total deposited principal across all users (in sats)
(define-data-var pool-principal uint u0)

;; Total yield accrued to the pool and not yet withdrawn (in sats)
(define-data-var pool-yield uint u0)

;; Cumulative yield paid per unit of principal, scaled by SCALE
(define-data-var acc-yield-per-share uint u0)

;; Per-user pool position:
;; - principal: sats the user currently has deposited
;; - debt:      index baseline already accounted for (principal * index / SCALE)
;; - accrued:   yield harvested into the record by an earlier interaction
;; - height:    stacks-block-height of the user's last deposit (timestamp)
(define-map deposits
  principal
  {principal: uint, debt: uint, accrued: uint, height: uint}
)

;; --- reads ---------------------------------------------------------------

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

;; Read-only: the current (settled) yield accumulator index
(define-read-only (get-acc-yield-per-share)
  (var-get acc-yield-per-share)
)

;; Read-only: the current annual yield rate, in basis points
(define-read-only (get-yield-rate)
  (var-get yield-rate-bps)
)

;; Read-only: the height at which yield was last settled
(define-read-only (get-last-accrual-height)
  (var-get last-accrual-height)
)

;; Read-only: total deposited principal across all users
(define-read-only (get-pool-principal)
  (var-get pool-principal)
)

;; Pure helper: pool-wide yield accrued since the last settlement, by the
;; rate. Zero when the pool is empty or no blocks have passed.
(define-read-only (pending-accrual)
  (let
    (
      (elapsed (- stacks-block-height (var-get last-accrual-height)))
      (prin (var-get pool-principal))
    )
    (if (and (> elapsed u0) (> prin u0))
      (/ (* prin (var-get yield-rate-bps) elapsed) (* BLOCKS_PER_YEAR u10000))
      u0
    )
  )
)
;; Read-only: the live accumulator index -- the settled index plus the
;; increment the pending accrual would add. Reads use this so `get-yield`
;; grows every block without a transaction to settle first.
(define-read-only (live-index)
  (let ((prin (var-get pool-principal)))
    (if (> prin u0)
      (+ (var-get acc-yield-per-share) (/ (* (pending-accrual) SCALE) prin))
      (var-get acc-yield-per-share)
    )
  )
)

;; Read-only: total sBTC owed by the pool (principal + live yield)
(define-read-only (get-pool-total)
  (+ (var-get pool-principal) (var-get pool-yield) (pending-accrual))
)

;; Pure helper: pending (unharvested) yield for a principal/debt pair, using
;; the live index. Safe from underflow: the index only grows and debt was set
;; from the same principal, so the current index term is always >= debt.
(define-read-only (pending-of (principal-amt uint) (debt uint))
  (- (/ (* principal-amt (live-index)) SCALE) debt)
)

;; Read-only: estimated yield earned so far for a user (accrued + pending).
;; Grows every block via the live index.
(define-read-only (get-yield (user principal))
  (let ((rec (get-deposit user)))
    (+ (get accrued rec) (pending-of (get principal rec) (get debt rec)))
  )
)

;; --- accrual -------------------------------------------------------------

;; Settle continuous yield into the accumulator up to the current block, then
;; advance the accrual clock. Called before any operation that changes a
;; position, so stored state is always current. When the pool is empty nothing
;; accrues; the clock still advances so a later deposit does not earn for
;; blocks before it existed.
(define-private (settle)
  (let
    (
      (elapsed (- stacks-block-height (var-get last-accrual-height)))
      (prin (var-get pool-principal))
    )
    (if (and (> elapsed u0) (> prin u0))
      (let ((amount (/ (* prin (var-get yield-rate-bps) elapsed) (* BLOCKS_PER_YEAR u10000))))
        (var-set acc-yield-per-share
          (+ (var-get acc-yield-per-share) (/ (* amount SCALE) prin)))
        (var-set pool-yield (+ (var-get pool-yield) amount))
        (var-set last-accrual-height stacks-block-height)
        true
      )
      (begin
        (var-set last-accrual-height stacks-block-height)
        true
      )
    )
  )
)
;; --- deposit / withdraw --------------------------------------------------

;; Deposit sBTC into the yield pool. Pulls `amount` sats from the caller's
;; sato-transfer wallet balance into the pool's custody and grows their
;; tracked principal. Pending yield is harvested first, so topping up never
;; loses earned yield.
;; - amount: sats to deposit (must be > u0 and <= wallet balance)
(define-public (deposit (amount uint))
  (let
    (
      (user tx-sender)
      (pool (as-contract tx-sender))
    )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    ;; Pull sBTC from the caller's wallet into the pool (reverts on shortfall)
    (try! (contract-call? .sato-transfer send pool amount))
    ;; Bring the accumulator current before we touch this position
    (settle)
    (let
      (
        (rec (get-deposit user))
        (prin (get principal rec))
        (pending (pending-of prin (get debt rec)))
        (new-prin (+ prin amount))
      )
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
)
;; Withdraw deposited principal plus all earned yield, sent back to the
;; caller's sato-transfer wallet. `amount` is the principal to take out; the
;; caller also receives their entire outstanding yield (a withdrawal always
;; harvests). Reverts if the pool's custody cannot cover principal + yield.
;; - amount: principal sats to withdraw (must be > u0 and <= deposited)
(define-public (withdraw (amount uint))
  (let
    (
      (user tx-sender)
    )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    ;; Bring the accumulator current before reading this position
    (settle)
    (let
      (
        (rec (get-deposit user))
        (prin (get principal rec))
        (pending (pending-of prin (get debt rec)))
        (total-yield (+ (get accrued rec) pending))
      )
      (asserts! (>= prin amount) ERR_INSUFFICIENT_BALANCE)
      (let
        (
          (new-prin (- prin amount))
          (payout (+ amount total-yield))
        )
        ;; Effects first (checks-effects-interactions), then the transfer
        (map-set deposits user {
          principal: new-prin,
          debt: (/ (* new-prin (var-get acc-yield-per-share)) SCALE),
          accrued: u0,
          height: (get height rec)
        })
        (var-set pool-principal (- (var-get pool-principal) amount))
        (var-set pool-yield (- (var-get pool-yield) total-yield))
        ;; Pool pays principal + yield from its own custody back to the user
        (try! (as-contract (contract-call? .sato-transfer send user payout)))
        (print {event: "yield-withdraw", user: user, principal-withdrawn: amount, yield-paid: total-yield, payout: payout})
        (ok true)
      )
    )
  )
)
;; --- reserve / yield source ---------------------------------------------

;; Top up the pool's sBTC custody to back accrued yield, without moving the
;; accumulator. Permissionless: anyone (the owner, or on mainnet a strategy
;; contract routing real returns) can fund the reserve. Pulls `amount` sats
;; from the caller's sato-transfer wallet into the pool.
;; - amount: sats to add to the reserve (must be > u0)
(define-public (fund-reserve (amount uint))
  (let
    (
      (funder tx-sender)
      (pool (as-contract tx-sender))
    )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (try! (contract-call? .sato-transfer send pool amount))
    (print {event: "reserve-fund", funder: funder, amount: amount})
    (ok true)
  )
)

;; Add a discrete yield distribution on top of continuous accrual. Owner-only.
;; Pulls `amount` sats from the owner's wallet into the pool (backing it) and
;; bumps the accumulator so every depositor's claim rises pro-rata. Useful for
;; booking a lumpy real-yield event (e.g. a strategy payout) atop the smooth
;; rate.
;; - amount: yield sats to distribute (must be > u0)
(define-public (add-yield (amount uint))
  (let
    (
      (owner tx-sender)
      (pool (as-contract tx-sender))
    )
    (asserts! (is-eq owner CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (> (var-get pool-principal) u0) ERR_EMPTY_POOL)
    ;; Settle continuous accrual first, then layer the discrete distribution
    (settle)
    (try! (contract-call? .sato-transfer send pool amount))
    (var-set acc-yield-per-share
      (+ (var-get acc-yield-per-share) (/ (* amount SCALE) (var-get pool-principal))))
    (var-set pool-yield (+ (var-get pool-yield) amount))
    (print {event: "yield-added", owner: owner, amount: amount, pool-principal: (var-get pool-principal)})
    (ok true)
  )
)

;; Set the annual yield rate (basis points). Owner-only. Settles accrual at the
;; old rate first, so the change is never retroactive.
;; - new-bps: new annual rate in basis points
(define-public (set-rate (new-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (settle)
    (var-set yield-rate-bps new-bps)
    (print {event: "yield-rate-set", owner: tx-sender, rate-bps: new-bps})
    (ok true)
  )
)
