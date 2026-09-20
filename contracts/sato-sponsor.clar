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
;; - Each user has a per-window cap on the micro-STX that may be
;;   sponsored for them (`per-user-cap`). The cap resets every
;;   `window-length` blocks: a user's spend is tracked against the
;;   current window (stacks-block-height / window-length), and the
;;   first sponsorship of a new window starts their spend from zero.
;;   This makes the cap a rate limit rather than a lifetime ceiling.
;;   The sponsor can adjust both the cap and the window length.

;; Error constants
(define-constant ERR_INSUFFICIENT_SPONSOR_BALANCE (err u300))
(define-constant ERR_UNAUTHORIZED (err u301))
(define-constant ERR_INVALID_AMOUNT (err u302))
(define-constant ERR_CAP_EXCEEDED (err u303))

;; Contract owner (the designated sponsor, set at deploy)
(define-constant CONTRACT_OWNER tx-sender)

;; Default per-user per-window sponsorship cap (micro-STX): 10 STX
(define-constant DEFAULT_PER_USER_CAP u10000000)

;; Default window length in blocks (~1 day at ~10 min Stacks blocks)
(define-constant DEFAULT_WINDOW_LENGTH u144)

;; STX held in the sponsor pool (in micro-STX), mirrors contract custody
(define-data-var sponsor-balance uint u0)

;; Micro-STX that may be sponsored per user within a single window
(define-data-var per-user-cap uint DEFAULT_PER_USER_CAP)

;; Length of a cap window, in blocks
(define-data-var window-length uint DEFAULT_WINDOW_LENGTH)

;; Per-user lifetime count of sponsored transactions
(define-map sponsored-count principal uint)

;; Per-user spend within a window: which window it applies to, and how
;; much has been sponsored so far in that window. A stored `window`
;; older than the current one means the spend has effectively reset.
(define-map window-spend principal {window: uint, spent: uint})

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

;; Read-only: the current cap window index (advances every window-length blocks)
(define-read-only (get-current-window)
  (/ stacks-block-height (var-get window-length))
)

;; Read-only: micro-STX sponsored for a user in the *current* window.
;; Returns u0 if their last spend was in an earlier (now-reset) window.
(define-read-only (get-window-spend (user principal))
  (match (map-get? window-spend user)
    entry (if (is-eq (get window entry) (get-current-window))
            (get spent entry)
            u0)
    u0
  )
)

;; Read-only: the current per-user per-window cap (micro-STX)
(define-read-only (get-per-user-cap)
  (var-get per-user-cap)
)

;; Read-only: the current window length in blocks
(define-read-only (get-window-length)
  (var-get window-length)
)

;; Read-only: remaining micro-STX sponsorable for a user in this window
(define-read-only (get-remaining-allowance (user principal))
  (let
    (
      (cap (var-get per-user-cap))
      (used (get-window-spend user))
    )
    (if (>= used cap) u0 (- cap used))
  )
)

;; Update the per-user per-window cap. Sponsor-only.
;; - new-cap: new per-window limit in micro-STX
(define-public (set-per-user-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set per-user-cap new-cap)
    (print {event: "sponsor-cap-update", sponsor: tx-sender, cap: new-cap})
    (ok true)
  )
)

;; Update the cap window length. Sponsor-only.
;; - new-length: window length in blocks (must be > u0)
(define-public (set-window-length (new-length uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (asserts! (> new-length u0) ERR_INVALID_AMOUNT)
    (var-set window-length new-length)
    (print {event: "sponsor-window-update", sponsor: tx-sender, window-length: new-length})
    (ok true)
  )
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
      (window (get-current-window))
      (new-count (+ (get-sponsored-count user) u1))
      ;; get-window-spend already returns u0 for a stale window, so this
      ;; naturally resets a user's spend when a new window begins
      (new-spend (+ (get-window-spend user) fee))
    )
    ;; Only the designated sponsor may draw from the pool
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    ;; Fee must be positive
    (asserts! (> fee u0) ERR_INVALID_AMOUNT)
    ;; This sponsorship must not push the user past their per-window cap
    (asserts! (<= new-spend (var-get per-user-cap)) ERR_CAP_EXCEEDED)
    ;; Pool must be able to cover the fee
    (asserts! (>= balance fee) ERR_INSUFFICIENT_SPONSOR_BALANCE)
    ;; Reimburse the user's fee from the contract-held pool
    (try! (as-contract (stx-transfer? fee tx-sender user)))
    ;; Debit the pool, bump the lifetime count, record window spend
    (var-set sponsor-balance (- balance fee))
    (map-set sponsored-count user new-count)
    (map-set window-spend user {window: window, spent: new-spend})
    (print {event: "sponsor-tx", sponsor: tx-sender, user: user, fee: fee, count: new-count, window: window, window-spent: new-spend, balance: (- balance fee)})
    (ok true)
  )
)
