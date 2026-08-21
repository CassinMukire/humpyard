# Curated data files

## aliases.yaml — cross-lingual org/yard name resolution

Spec reference: §12.3 — "Cross-lingual entity resolution v1 = curated alias
table (canonical org → known spellings/transliterations). Auto-merge ONLY on
alias hits; other cross-lingual candidates → queue as 'possible alias of X'.
ASCII-normalization handles diacritics only."

**W34 deliverable**: builder seeds the first ~40 canonical orgs from the
existing `KNOWN_YARDS` and `OPERATOR_KEY_ROLES` tables. Cassin owns ongoing
curation. Edit this file directly; do not regenerate from external data.

### Format

```yaml
- canonical: PKP PLK
  match_key: pkp plk            # ASCII-normalized, used for entity dedupe
  type: authority
  market_ids: [pl]
  aliases:
    - "PKP Polskie Linie Kolejowe"
    - "PKP PLK S.A."
    - "Polskie Linie Kolejowe"
    - "PLK"
- canonical: Kazakhstan Temir Zholy
  match_key: kazakhstan temir zholy
  type: operator
  market_ids: [kz]
  aliases:
    - "KTZ"
    - "Қазақстан Темір Жолы"
    - "Kazakhstan Railways"
    - "KTZ NC"
```

### Cross-lingual rules

- Auto-merge two orgs only when the second one's name is in the first one's
  `aliases` list (after ASCII normalization) OR the user manually confirms.
- Other candidates (e.g. "Polskie Koleje Państwowe" might = "PKP" or might
  refer to a different entity) → land in the review queue as
  "possible alias of <canonical>".
- Diacritics are stripped for match_key; original spelling is preserved on
  the entity record.

### Owner

Cassin (product). Builder can suggest additions, but Cassin approves merges.
