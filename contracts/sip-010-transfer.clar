;; sip-010-transfer.clar
;; Sato - Bitcoin payment app on Stacks
;; Minimal SIP-010 trait: just the `transfer` entrypoint the pool needs.
;;
;; Kept intentionally to one function so that any conforming SIP-010 token,
;; including the canonical sBTC token, can be passed as a trait argument
;; without a signature mismatch on the metadata getters. The signature here
;; matches sBTC's on testnet
;; (SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token) and the standard
;; SIP-010 definition exactly.

(define-trait sip-010-transfer
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
  )
)
