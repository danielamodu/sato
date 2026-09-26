;; sato-yield-v3.clar
;; Sato - Bitcoin payment app on Stacks.
;; A YIELD-BEARING LEDGER: the money you hold earns, with no deposit step.
;;
;; Supersedes sato-transfer as the app's sBTC ledger. Every balance in
;; `accounts` accrues yield continuously at `base-rate-bps`, so simply holding
;; sBTC in Sato grows it. "You earn automatically" is a property of the ledger,
;; provable on-chain: there is no per-user deposit transaction anywhere.
;;
;; Two tiers -- a sat is liquid OR locked, never both, so nothing double-earns:
;;   - Liquid balance  : spendable any time, earns the base rate. The default.
;;   - Locked position : committed until an unlock height, earns the higher
;;                       boost rate. This is the optional "deposit".
;;
;; Accrual (simple interest between touches, per account):
;;   yield = balance * rate-bps * elapsed-blocks / (BLOCKS_PER_YEAR * 10000)
;; Every balance-changing op "settles" first -- folds accrued yield into the
;; balance and resets the account's block checkpoint -- so stored state is
;; always current and reads show the balance ticking up every block.
;;
;; Custody / solvency (testnet vs mainnet):
;;   On testnet this ledger mints its own sBTC (faucet money); settling simply
;;   mints accrued yield into the balance -- honest for testnet, where funds are
;;   not real. On mainnet the ledger custodies canonical sBTC and yield must be
;;   backed by a reserve the underlying strategy tops up, with the rate set to
;;   what the strategy actually earns. That backing is the mainnet work; the
;;   accounting below is unchanged.

;; --- constants -----------------------------------------------------------

;; Error constants (u500 range for this contract)
(define-constant ERR_INSUFFICIENT_BALANCE (err u500))
(define-constant ERR_INVALID_AMOUNT (err u501))
(define-constant ERR_SELF_TRANSFER (err u502))
(define-constant ERR_UNAUTHORIZED (err u503))
(define-constant ERR_LOCKED (err u504))       ;; lock term not elapsed yet
(define-constant ERR_LOCK_EXISTS (err u505))  ;; already has an active lock
(define-constant ERR_NO_LOCK (err u506))      ;; no lock to claim

;; Contract owner (deployer): may set the rates.
(define-constant CONTRACT_OWNER tx-sender)

;; Blocks per year for annualizing the rate (mirrors sato-yield-v2).
(define-constant BLOCKS_PER_YEAR u52560)

;; --- state ---------------------------------------------------------------

;; Annual rates in basis points (1 bp = 0.01%), owner-settable. Defaults are
;; intentionally exaggerated TESTNET values so growth is visible in seconds;
;; dial down for mainnet. boost > base is the reward for locking.
(define-data-var base-rate-bps uint u2000000)   ;; 20,000% APR (liquid)
(define-data-var boost-rate-bps uint u4000000)  ;; 40,000% APR (locked)

;; Total realized sBTC in liquid balances (grows as yield is settled).
(define-data-var total-supply uint u0)
;; Lifetime yield minted into balances, for transparency.
(define-data-var total-yield-paid uint u0)

;; Liquid, yield-bearing balances.
;;  balance: realized (settled) sats;  height: block of last settlement.
(define-map accounts principal {balance: uint, height: uint})

;; Optional locked position (the "deposit" tier); one active lock per user.
;;  amount: principal locked;  height: accrual checkpoint;  unlock: claimable at.
(define-map locks principal {amount: uint, height: uint, unlock: uint})

;; --- reads ---------------------------------------------------------------

(define-read-only (get-account (who principal))
  (default-to {balance: u0, height: u0} (map-get? accounts who)))

;; Pure helper: simple-interest yield on `bal` held `elapsed` blocks at `rate` bps.
(define-read-only (accrued (bal uint) (elapsed uint) (rate uint))
  (if (and (> bal u0) (> elapsed u0))
    (/ (* bal (* rate elapsed)) (* BLOCKS_PER_YEAR u10000))
    u0))

;; Pending (unrealized) base yield on a liquid balance, live at this block.
(define-read-only (pending-balance-yield (who principal))
  (let ((rec (get-account who)))
    (accrued (get balance rec)
             (- stacks-block-height (get height rec))
             (var-get base-rate-bps))))

;; Live liquid balance = realized + pending; grows every block. `send` settles
;; first, so what a wallet shows is always what it can actually spend.
(define-read-only (get-balance (who principal))
  (+ (get balance (get-account who)) (pending-balance-yield who)))

(define-read-only (get-total-supply) (var-get total-supply))
(define-read-only (get-total-yield-paid) (var-get total-yield-paid))
(define-read-only (get-base-rate) (var-get base-rate-bps))
(define-read-only (get-boost-rate) (var-get boost-rate-bps))

(define-read-only (get-lock (who principal))
  (default-to {amount: u0, height: u0, unlock: u0} (map-get? locks who)))

;; Pending (unrealized) boost yield on a locked position, live at this block.
(define-read-only (pending-lock-yield (who principal))
  (let ((lk (get-lock who)))
    (accrued (get amount lk)
             (- stacks-block-height (get height lk))
             (var-get boost-rate-bps))))

;; What a lock is worth right now: locked principal + boost yield.
(define-read-only (get-lock-value (who principal))
  (+ (get amount (get-lock who)) (pending-lock-yield who)))

;; --- internal: settle a liquid balance up to the current block -----------

;; Fold accrued base yield into the stored balance and reset the checkpoint.
;; Returns the settled balance. Called before every op that changes a position,
;; so stored state is always current. New/empty accounts accrue nothing (their
;; checkpoint just advances), so no one earns for blocks before they held sats.
(define-private (settle (who principal))
  (let ((rec (get-account who))
        (y (pending-balance-yield who)))
    (let ((nb (+ (get balance rec) y)))
      (map-set accounts who {balance: nb, height: stacks-block-height})
      (if (> y u0)
        (begin
          (var-set total-supply (+ (var-get total-supply) y))
          (var-set total-yield-paid (+ (var-get total-yield-paid) y))
          (print {event: "yield-settled", who: who, amount: y})
          true)
        true)
      nb)))

;; --- faucet / ledger -----------------------------------------------------

;; Testnet faucet: mint sBTC to a recipient. On mainnet, replace with a real
;; sBTC deposit (SIP-010 transfer in) or gate this to CONTRACT_OWNER.
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (settle recipient)
    (map-set accounts recipient
      {balance: (+ (get balance (get-account recipient)) amount),
       height: stacks-block-height})
    (var-set total-supply (+ (var-get total-supply) amount))
    (print {event: "sbtc-mint", recipient: recipient, amount: amount})
    (ok true)))

;; Deposit helper: caller credits their own balance (simulates wrapping sBTC).
(define-public (deposit (amount uint))
  (mint tx-sender amount))

;; Send sBTC to another principal. Settles both sides first so balances (and the
;; accrual clock) are current, then moves realized sats.
(define-public (send (recipient principal) (amount uint))
  (let ((sender tx-sender))
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (not (is-eq sender recipient)) ERR_SELF_TRANSFER)
    (settle sender)
    (settle recipient)
    (let ((sbal (get balance (get-account sender)))
          (rbal (get balance (get-account recipient))))
      (asserts! (>= sbal amount) ERR_INSUFFICIENT_BALANCE)
      (map-set accounts sender {balance: (- sbal amount), height: stacks-block-height})
      (map-set accounts recipient {balance: (+ rbal amount), height: stacks-block-height})
      (print {event: "sbtc-transfer", sender: sender, recipient: recipient, amount: amount})
      (ok true))))

;; --- lock tier (optional "deposit" for a higher rate) --------------------

;; Move `amount` from the liquid balance into a locked position earning the
;; boost rate until `term-blocks` from now. Locked sats leave the liquid supply
;; (they no longer earn the base rate), so nothing double-earns. One lock at a
;; time -- claim the current one before opening another.
(define-public (lock (amount uint) (term-blocks uint))
  (let ((user tx-sender))
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (> term-blocks u0) ERR_INVALID_AMOUNT)
    (asserts! (is-eq (get amount (get-lock user)) u0) ERR_LOCK_EXISTS)
    (settle user)
    (let ((bal (get balance (get-account user))))
      (asserts! (>= bal amount) ERR_INSUFFICIENT_BALANCE)
      (map-set accounts user {balance: (- bal amount), height: stacks-block-height})
      (var-set total-supply (- (var-get total-supply) amount))
      (map-set locks user
        {amount: amount, height: stacks-block-height, unlock: (+ stacks-block-height term-blocks)})
      (print {event: "yield-lock", user: user, amount: amount,
              unlock: (+ stacks-block-height term-blocks)})
      (ok true))))

;; Claim a matured lock: returns locked principal + accrued boost yield to the
;; liquid balance. Reverts until the unlock height.
(define-public (claim-lock)
  (let ((user tx-sender)
        (lk (get-lock tx-sender)))
    (asserts! (> (get amount lk) u0) ERR_NO_LOCK)
    (asserts! (>= stacks-block-height (get unlock lk)) ERR_LOCKED)
    (settle user)
    (let ((y (pending-lock-yield user)))
      (let ((payout (+ (get amount lk) y)))
        (map-set accounts user
          {balance: (+ (get balance (get-account user)) payout),
           height: stacks-block-height})
        (var-set total-supply (+ (var-get total-supply) payout))
        (var-set total-yield-paid (+ (var-get total-yield-paid) y))
        (map-delete locks user)
        (print {event: "yield-claim", user: user, principal: (get amount lk), yield: y})
        (ok true)))))

;; --- admin ---------------------------------------------------------------

;; Set the liquid (base) rate. Owner-only. Note: accrual is per-account simple
;; interest since each account's last touch, so a rate change re-prices the
;; not-yet-settled interval for every account. Fine on testnet; on mainnet a
;; global settle-then-set (or an index) would make the change non-retroactive.
(define-public (set-base-rate (new-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set base-rate-bps new-bps)
    (print {event: "base-rate-set", rate-bps: new-bps})
    (ok true)))

;; Set the locked (boost) rate. Owner-only. Same retroactive caveat as above.
(define-public (set-boost-rate (new-bps uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set boost-rate-bps new-bps)
    (print {event: "boost-rate-set", rate-bps: new-bps})
    (ok true)))
