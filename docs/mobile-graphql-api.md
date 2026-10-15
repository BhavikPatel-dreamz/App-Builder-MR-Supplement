# Mobile GraphQL API

Base URL:

```text
https://appbuilder.dreamzapps.com/graphql
```

The app does not send a Shopify token. The server adds the Storefront token. Responses are normal Shopify GraphQL JSON:

```json
{
  "data": {},
  "errors": [{ "message": "..." }]
}
```

CORS allows any origin. `GET` responses can be cached. `POST` responses are not cached.

## Flow

1. Register the GraphQL document once.
2. Save the `sha256` the server returns.
3. Later requests send only that hash and the variables.

The hash is SHA-256 of the exact query string, as 64 lowercase hex characters. Spaces, newlines, and field order are part of the string. A formatting change produces a new hash. Variables are not part of the hash.

```text
sha256 = SHA-256(UTF-8 bytes of the query string)
```

Swift:

```swift
import CryptoKit

let hash = SHA256.hash(data: Data(query.utf8))
    .map { String(format: "%02x", $0) }
    .joined()
```

Kotlin:

```kotlin
val hash = MessageDigest.getInstance("SHA-256")
    .digest(query.toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it) }
```

The device hash and the server hash match only when both sides hash the same string, including whitespace.

## 1. Register a query

`POST` is the safe way. The query stays in the body.

```http
POST https://appbuilder.dreamzapps.com/graphql
Content-Type: application/json

{
  "register": true,
  "query": "query GetProductByHandle($handle: String!) { productByHandle(handle: $handle) { id title } }"
}
```

Response:

```json
{
  "ok": true,
  "sha256": "…64 hex characters…",
  "get": "/graphql?sha256=…&variables={}"
}
```

Save `sha256` in the app (build config or remote config).

The same registration works as `GET`. URL-encode the query:

```text
GET /graphql?register=1&query=<url-encoded query>
```

Registration does not run the query. It only stores the text and returns the hash. Stored queries last about 30 days in Redis.

Optional `sha256` on the register request stores the same query under an extra hash. Use this only when an already-shipped app hash must keep working after the document text changes. The response still returns the hash of the exact string.

## 2. Call it the next time

Do not send the query again.

```http
GET https://appbuilder.dreamzapps.com/graphql?sha256=<saved hash>&variables=<url-encoded JSON>
```

`variables` before encoding:

```json
{ "handle": "whey-protein" }
```

Full example:

```text
GET /graphql?sha256=05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215&variables=%7B%22handle%22%3A%22whey-protein%22%7D
```

Change `variables` for another product, collection, page, or filter. Keep the same hash.

If the hash is unknown, the HTTP status is 200 and the body is:

```json
{ "errors": [{ "message": "PersistedQueryNotFound" }] }
```

Register the query again, or use a hash from the catalog below.

## 3. Pass the query directly on GET

Yes. Put the GraphQL text in `query` and the variables in `variables`. Both values must be URL-encoded.

```http
GET https://appbuilder.dreamzapps.com/graphql?query=<url-encoded query>&variables=<url-encoded JSON>
```

Example:

```text
GET /graphql?query=query%20GetProductByHandle(%24handle%3A%20String!)%20%7B%20productByHandle(handle%3A%20%24handle)%20%7B%20id%20title%20%7D%20%7D&variables=%7B%22handle%22%3A%22whey-protein%22%7D
```

This runs the query and returns GraphQL JSON. A successful response also stores the query, so the next call can use `?sha256=` instead of the full text.

Limits:

| Limit | Default |
|---|---|
| Full URL | 16,000 characters |
| Query text | 12,000 characters |
| Variables JSON | see server `GRAPHQL_MAX_VARIABLES_JSON_LENGTH` |

Catalog documents are long. Register those with `POST`. Use direct `GET ?query=` for short documents only.

`POST` can also run a query in one step (this also registers it after a successful Shopify response):

```http
POST https://appbuilder.dreamzapps.com/graphql
Content-Type: application/json

{
  "query": "query GetProductByHandle($handle: String!) { productByHandle(handle: $handle) { id title } }",
  "variables": { "handle": "whey-protein" }
}
```

## 4. Hashes already registered

```text
GET https://appbuilder.dreamzapps.com/graphql?catalog=1
```

Response shape:

```json
{
  "operations": [
    { "op": "productsByCollectionId", "name": "ProductsByCollectionId", "sha256": "…" }
  ]
}
```

Current hashes:

| Operation | `op` value | Hash |
|---|---|---|
| Products by collection id | `productsByCollectionId` | `7ef76e636792c00c1ca9d1cc4c4d20afa85e140b4930337758a5441adfff2871` |
| Products by collection handle | `productsByCollectionHandle` | `5857d1f281469b9b3923f81d15e41d5a72790d847e074d9e0f0d6d690f76a279` |
| Product by id | `productById` | `2c8cbf5948d3e5560c38b9b866bd79b56eaf795e7e56a6f302ff58301ac5cc93` |
| Product by handle | `productByHandle` | `05f53f406858a1e025dac342c9769d20da451daf4071b4ee3117164e5c356215` |
| Products by ids | `productsByIds` | `3dee64be90e676c413abe7f1660366826e8296c1866f584aade05fbd8fee5ab3` |

Named calls, no hash required:

```text
GET /graphql?op=productByHandle&variables={"handle":"whey-protein"}
GET /graphql?op=productById&variables={"id":"gid://shopify/Product/123"}
GET /graphql?op=productsByCollectionHandle&variables={"handle":"protein","first":20}
GET /graphql?op=productsByCollectionId&variables={"id":"gid://shopify/Collection/123","first":20}
GET /graphql?op=productsByIds&variables={"ids":["gid://shopify/Product/123"]}
```

URL-encode the `variables` value. `POST` accepts the same `op` plus a `variables` object.

These `op` aliases also work: `collection`, `collectionId`, `collectionHandle`, `productsByCollection`, `product`, `getProductByHandle`, `getProductsByIds`, `ids`.

## 5. What to keep in the app

1. Register on a developer machine, or once at startup when the hash is not saved yet.
2. Store `sha256` next to the query.
3. Every screen request is `GET /graphql?sha256=...&variables=...`.
4. If the GraphQL document changes, register again and ship the new hash.

Older hashes stay valid only while the server still has that older text. After a document change, keep calling with the hash that matches the text you registered.
