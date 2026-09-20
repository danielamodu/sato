;; sato-names.clar
;; Sato - Bitcoin payment app on Stacks
;; Lightweight username registry (BNS-style) linking a human-readable
;; name to a Stacks principal, so payments can target `@alice` instead
;; of a raw principal.
;;
;; Design:
;; - `names`  maps username -> principal (forward resolution).
;; - `owners` maps principal -> username (reverse lookup).
;;   Both maps are kept in sync so lookups are O(1) in either direction.
;; - A username is unique across the registry, and each principal may
;;   hold at most one username. Registration is permissionless: the
;;   caller (tx-sender) registers a name for themselves.
;; - On mainnet this can be layered on top of, or replaced by, the
;;   canonical BNS contract; this keeps the app self-contained for
;;   devnet/testnet and Sato-specific handles.

;; Error constants
(define-constant ERR_ALREADY_REGISTERED (err u200))
(define-constant ERR_NOT_FOUND (err u201))
(define-constant ERR_UNAUTHORIZED (err u202))
(define-constant ERR_INVALID_NAME (err u203))

;; Contract owner (deployer)
(define-constant CONTRACT_OWNER tx-sender)

;; Forward resolution: username -> principal
(define-map names (string-ascii 32) principal)

;; Reverse lookup: principal -> username
(define-map owners principal (string-ascii 32))

;; Read-only: resolve a username to its principal (none if unregistered)
(define-read-only (resolve-name (name (string-ascii 32)))
  (map-get? names name)
)

;; Read-only: look up the username a principal has registered (none if any)
(define-read-only (get-name (owner principal))
  (map-get? owners owner)
)

;; Read-only: is a username available to register?
(define-read-only (is-name-available (name (string-ascii 32)))
  (is-none (map-get? names name))
)

;; Register a username for the caller (tx-sender).
;; - name: the username to claim (1-32 ascii chars)
;; Fails if the name is empty, already taken, or the caller already
;; holds a username.
(define-public (register-name (name (string-ascii 32)))
  (let
    (
      (owner tx-sender)
    )
    ;; Reject empty names
    (asserts! (> (len name) u0) ERR_INVALID_NAME)
    ;; Username must not already be taken
    (asserts! (is-none (map-get? names name)) ERR_ALREADY_REGISTERED)
    ;; Caller must not already hold a username
    (asserts! (is-none (map-get? owners owner)) ERR_ALREADY_REGISTERED)
    ;; Link name <-> principal in both directions
    (map-set names name owner)
    (map-set owners owner name)
    ;; Emit registration event
    (print {event: "name-register", name: name, owner: owner})
    (ok true)
  )
)

;; Transfer a username to a new principal.
;; - name: the username to transfer (must exist)
;; - recipient: the principal receiving the name
;; Only the current owner may transfer, and the recipient must not
;; already hold a username. Updates both maps atomically.
(define-public (transfer-name (name (string-ascii 32)) (recipient principal))
  (let
    (
      (current-owner (unwrap! (map-get? names name) ERR_NOT_FOUND))
    )
    ;; Only the current owner may transfer the name
    (asserts! (is-eq tx-sender current-owner) ERR_UNAUTHORIZED)
    ;; No-op self-transfer would clear the entry we just set; reject it
    (asserts! (not (is-eq recipient current-owner)) ERR_UNAUTHORIZED)
    ;; Recipient must not already hold a username
    (asserts! (is-none (map-get? owners recipient)) ERR_ALREADY_REGISTERED)
    ;; Re-point the name to the recipient
    (map-set names name recipient)
    ;; Clear the old owner's reverse entry, set the new one
    (map-delete owners current-owner)
    (map-set owners recipient name)
    ;; Emit transfer event
    (print {event: "name-transfer", name: name, from: current-owner, to: recipient})
    (ok true)
  )
)
