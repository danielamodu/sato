;; mock-sbtc.clar
;; Sato - Bitcoin payment app on Stacks
;; Test-only SIP-010 token used to exercise sato-vault in simnet. It is NOT
;; deployed to testnet or mainnet, where the vault points at the canonical
;; sBTC token. It implements the `transfer` entrypoint the vault calls, plus
;; a `mint` helper and `get-balance` so tests can fund and assert balances.

(impl-trait .sip-010-transfer.sip-010-transfer)

(define-constant ERR_INSUFFICIENT_BALANCE (err u1))
(define-constant ERR_NOT_OWNER (err u2))

(define-fungible-token mock-sbtc)

;; SIP-010 transfer: the sender must be the caller (standard SIP-010 rule).
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR_NOT_OWNER)
    (try! (ft-transfer? mock-sbtc amount sender recipient))
    (match memo m (print m) 0x)
    (ok true)
  )
)

;; Test helper: mint mock sBTC to a recipient.
(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-sbtc amount recipient)
)

;; Read-only balance for test assertions.
(define-read-only (get-balance (who principal))
  (ok (ft-get-balance mock-sbtc who))
)
