# DollarOne x402

**DollarOne Mexico Location Intelligence API** is the first commercial experiment inside Proyecto $1M.

The goal is simple: prove that an unknown external agent can discover a paid API, pay for one request over x402 on Algorand, receive a useful result, and send real USDC to the project's wallet with minimal human intervention.

## Product #001

`POST /resolve-location`

Input:

```json
{
  "query": "col centro vicente guerrero dgo"
}
```

Paid response (example):

```json
{
  "country": "Mexico",
  "state": "Durango",
  "stateCode": "10",
  "municipality": "Vicente Guerrero",
  "locality": "Vicente Guerrero",
  "postalCode": null,
  "confidence": 0.9,
  "matchedBy": ["state_alias", "municipality_alias"],
  "paidVia": "x402 / USDC / Algorand"
}
```

Price: **$0.01 USDC per request**.

## Why x402

The endpoint is protected by x402 and settles through the GoPlausible facilitator on Algorand. Bazaar discovery metadata is declared in the payment challenge so compatible agents can understand and discover the API.

Challenge tag:

```
x402-global-challenge
```

## Current phase

- [x] Public repository
- [x] x402 resource-server scaffold
- [x] GoPlausible facilitator configuration
- [x] Bazaar discovery declaration
- [x] Free `/health` endpoint
- [x] Paid `/resolve-location` endpoint
- [x] Deterministic normalization MVP
- [x] Unit tests for the first resolver
- [ ] Install dependencies and pass CI
- [ ] TestNet end-to-end payment
- [ ] Nationwide open-data enrichment
- [ ] Deploy public HTTPS endpoint
- [ ] Switch to Algorand MainNet / USDC ASA 31566704
- [ ] First real external payment
- [ ] Bazaar + leaderboard verification
- [ ] Global x402 Challenge submission

## Local setup

Requires Node.js LTS.

```bash
npm install
cp .env.example .env
npm test
npm run typecheck
npm start
```

Environment variables:

```env
AVM_ADDRESS=YOUR_ALGORAND_ADDRESS
FACILITATOR_URL=https://facilitator.goplausible.xyz
X402_NETWORK=testnet
PORT=4021
```

Do not commit wallet seed phrases or private keys. The resource server only needs the public receiving address.

## Test health

```bash
curl http://localhost:4021/health
```

## Test unpaid request

An unpaid request should return HTTP 402 with x402 payment requirements:

```bash
curl -i \
  -X POST http://localhost:4021/resolve-location \
  -H "content-type: application/json" \
  -d '{"query":"col centro vicente guerrero dgo"}'
```

A compatible x402 client can then pay and repeat the request to receive the structured result.

## Data policy

The MVP intentionally starts small while we validate the payment loop. Nationwide enrichment will use public/open datasets whose licenses permit the intended reuse. See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## Competition

DollarOne is being built as a **Standard** entry for the Global x402 Challenge on Algorand.

Success for Proyecto $1M is not "the API exists". Success begins when a wallet that does not belong to us pays DollarOne for a real request.
