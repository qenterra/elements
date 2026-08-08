# QDS token provenance

`src/qds/qds-tokens.css` is a byte-for-byte pinned copy of the generated QDS CSS package. It is not hand-edited.

| Field       | Value                                                              |
| ----------- | ------------------------------------------------------------------ |
| QDS version | `1.8.1`                                                            |
| QDS commit  | `6552c4e67225495f6b64a9f38efbe0846c138ab0`                         |
| Source      | `packages/css/tokens.css`                                          |
| SHA-256     | `d0fc4ebc8335c75941c6abf459cc72b24768d648c9552a09a31134c8985e7a5b` |

To refresh, copy the generated source file exactly, update every provenance field above, then run `QDS_ROOT=/path/to/design-system npm run qds:doctor`. Its necessary raw token values are explicitly exempted only at `src/qds/qds-tokens.css`. The adapter scopes selectors for Shadow DOM and maps semantic variables; it does not alter generated token values.
