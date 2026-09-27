import { config } from "dotenv";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  declareDiscoveryExtension,
  bazaarResourceServerExtension,
} from "@x402-avm/extensions";
import type { ResourceServerExtension } from "@x402/core/types";
import {
  USDC_TESTNET_ASA_ID,
  USDC_MAINNET_ASA_ID,
} from "@x402/avm";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolveLocation } from "./src/location.js";

config();

const avmAddress = process.env.AVM_ADDRESS;
if (!avmAddress) {
  console.error("Missing AVM_ADDRESS environment variable");
  process.exit(1);
}

const facilitatorUrl =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
const networkName = (process.env.X402_NETWORK || "testnet").toLowerCase();
const isMainnet = networkName === "mainnet";

// GoPlausible currently accepts the full Algorand genesis-hash CAIP-2 forms.
// Keep them explicit so TestNet/MainNet use the same facilitator-compatible convention.
const ALGORAND_TESTNET_CAIP2_FULL =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";
const ALGORAND_MAINNET_CAIP2_FULL =
  "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=";
const network = isMainnet
  ? ALGORAND_MAINNET_CAIP2_FULL
  : ALGORAND_TESTNET_CAIP2_FULL;
const usdcAsset = isMainnet ? USDC_MAINNET_ASA_ID : USDC_TESTNET_ASA_ID;
const port = Number(process.env.PORT || 4021);

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactAvmScheme(),
);

server.registerExtension(
  bazaarResourceServerExtension as unknown as ResourceServerExtension,
);

const locationDiscovery = declareDiscoveryExtension({
  bodyType: "json",
  input: {
    query: "col centro vicente guerrero dgo",
  },
  inputSchema: {
    properties: {
      query: {
        type: "string",
        description:
          "A Mexican place/address fragment, including abbreviations, typos, municipality, state or postal code.",
      },
    },
    required: ["query"],
  },
  output: {
    example: {
      country: "Mexico",
      state: "Durango",
      stateCode: "10",
      municipality: "Vicente Guerrero",
      locality: "Vicente Guerrero",
      postalCode: null,
      confidence: 0.9,
      matchedBy: ["state_alias", "municipality_alias"],
    },
  },
});


const publicBaseUrl =
  process.env.PUBLIC_BASE_URL ||
  "https://dollarone-x402-mainnet-production.up.railway.app";

const discoveryDocument = {
  name: "DollarOne Mexico Location Intelligence API",
  description:
    "Turn noisy Mexican location text into deterministic structured fields for routing, CRM cleanup, civic reports, checkout, delivery and agent workflows. Supports all Mexican states plus selected municipality enrichment, with confidence, warnings and provenance.",
  version: "0.4.0",
  bestFor: [
    "User-entered Mexican place names with abbreviations such as DGO, GTO, QRO or CDMX",
    "Routing and triage before a more expensive geocoder or human review",
    "CRM, support, civic-report and checkout workflows that need normalized state codes",
    "Agents that need a cheap deterministic location normalization step"
  ],
  coverage: {
    states: "All 32 Mexican states",
    municipalityEnrichment: "Selected municipalities in Durango in the current MVP",
    postalCode: "5-digit pattern detection; not yet cross-validated"
  },
  homepage: publicBaseUrl,
  health: `${publicBaseUrl}/health`,
  openapi: `${publicBaseUrl}/openapi.json`,
  skill: `${publicBaseUrl}/skill.md`,
  payment: {
    protocol: "x402",
    scheme: "exact",
    price: "0.01 USDC",
    network: isMainnet ? "Algorand MainNet" : "Algorand TestNet",
    assetId: usdcAsset,
  },
  resources: [
    {
      method: "POST",
      path: "/resolve-location",
      url: `${publicBaseUrl}/resolve-location`,
      contentType: "application/json",
      requestExample: { query: "col centro vicente guerrero dgo" },
      responseIncludes: [
        "country",
        "state",
        "stateCode",
        "municipality",
        "locality",
        "postalCode",
        "confidence",
        "matchedBy",
        "warnings",
        "sources"
      ],
      useWhen:
        "You have noisy Mexican location text and need a normalized, machine-readable result before routing, storage, deduplication or follow-up.",
      paid: true,
    },
  ],
};

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "DollarOne Mexico Location Intelligence API",
    version: "0.4.0",
    description:
      "Cheap deterministic x402 tool for software agents that need to normalize noisy Mexican location text before routing, CRM storage, civic-report triage, checkout or delivery. All 32 states are recognized; municipality enrichment is currently strongest in Durango.",
  },
  servers: [{ url: publicBaseUrl }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "Service is healthy" } },
      },
    },
    "/resolve-location": {
      get: {
        summary: "Discovery help for crawlers and agents",
        responses: {
          "200": {
            description:
              "Machine-readable instructions explaining that the paid resource uses POST.",
          },
        },
      },
      post: {
        summary: "Normalize noisy Mexican location text for $0.01",
        description:
          "Use this when an agent has a user-entered Mexican place/address fragment containing abbreviations, punctuation noise, state names or a 5-digit postal-code pattern and needs structured fields before routing, CRM storage, deduplication or follow-up. Deterministic normalization; no API key or account is required. Requires an x402 payment of 0.01 USDC.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    minLength: 3,
                    description: "Messy Mexican place/address fragment.",
                  },
                },
                required: ["query"],
              },
              examples: {
                civicReport: { value: { query: "col centro vicente guerrero dgo" } },
                stateAbbreviation: { value: { query: "leon gto" } },
                postalCodeSignal: { value: { query: "centro durango dgo 34000" } }
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Paid normalized location result",
          },
          "400": { description: "Invalid query" },
          "402": { description: "Payment required via x402" },
        },
      },
    },
  },
};

const app = new Hono();

app.use("/assets/*", serveStatic({ root: "./public" }));
app.get("/tester", serveStatic({ path: "./public/index.html" }));
app.get("/", c => c.redirect("/tester"));

app.get("/health", c =>
  c.json({
    ok: true,
    service: "DollarOne Mexico Location Intelligence API",
    x402Network: isMainnet ? "mainnet" : "testnet",
    paymentAsset: "USDC",
  }),
);

app.get("/.well-known/x402", c => c.json(discoveryDocument));

app.get("/openapi.json", c => c.json(openApiDocument));

app.get("/skill.md", c => {
  c.header("Content-Type", "text/markdown; charset=utf-8");
  return c.body(`# DollarOne Mexico Location Intelligence API

DollarOne is a cheap deterministic normalization step for software agents handling Mexican location text.

## When to buy this call

Use DollarOne when you have noisy user-entered text such as abbreviations, inconsistent punctuation, state names, selected municipalities or a 5-digit postal-code signal and you need structured fields before:

- routing or triage
- CRM/support storage
- civic-report classification
- checkout or delivery workflows
- deduplication or deciding whether a more expensive geocoder is necessary

Current coverage: all 32 Mexican states; selected municipality enrichment is strongest in Durango. Responses include confidence, warnings and provenance so an agent can decide whether to accept the result or escalate.

## Paid resource

- Method: **POST**
- URL: ${publicBaseUrl}/resolve-location
- Content-Type: \`application/json\`
- Price: **0.01 USDC**
- Payment protocol: **x402**
- Network: **${isMainnet ? "Algorand MainNet" : "Algorand TestNet"}**

### Request

\`\`\`json
{"query":"col centro vicente guerrero dgo"}
\`\`\`

The service first returns HTTP 402 with x402 payment requirements. After payment, retry the same POST request with the payment payload and the API returns the normalized result.

## Discovery

- Manifest: ${publicBaseUrl}/.well-known/x402
- OpenAPI: ${publicBaseUrl}/openapi.json
- Health: ${publicBaseUrl}/health

Do not use GET to purchase the resource. GET /resolve-location is discovery-only and returns usage instructions.
`);
});


app.get("/agents.json", c =>
  c.json({
    name: "DollarOne Mexico Location Intelligence API",
    description:
      "Low-cost x402 location-normalization tool for agents working with noisy Mexican location text.",
    homepage: publicBaseUrl,
    capabilities: [
      {
        name: "resolve_location",
        method: "POST",
        url: `${publicBaseUrl}/resolve-location`,
        price: "0.01 USDC",
        protocol: "x402",
        useWhen:
          "Normalize user-entered Mexican location text before routing, CRM storage, civic-report triage, checkout, delivery, deduplication or escalation."
      }
    ],
    discovery: {
      x402: `${publicBaseUrl}/.well-known/x402`,
      openapi: `${publicBaseUrl}/openapi.json`,
      skill: `${publicBaseUrl}/skill.md`
    }
  }),
);

app.get("/llms.txt", c => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.body(`# DollarOne Mexico Location Intelligence API
> Low-cost deterministic x402 tool for normalizing noisy Mexican location text.

Use when: an agent receives messy Mexican place/address text and needs structured state/stateCode, selected municipality enrichment, postal-code signal, confidence, warnings and provenance before routing, CRM storage, civic-report triage, checkout, delivery, deduplication or escalation.

Paid endpoint: POST ${publicBaseUrl}/resolve-location
Price: 0.01 USDC via x402
Network: ${isMainnet ? "Algorand MainNet" : "Algorand TestNet"}
Example body: {"query":"col centro vicente guerrero dgo"}

Coverage: all 32 Mexican states; selected municipality enrichment is currently strongest in Durango.

Discovery:
- ${publicBaseUrl}/.well-known/x402
- ${publicBaseUrl}/openapi.json
- ${publicBaseUrl}/skill.md
`);
});

app.get("/robots.txt", c => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.body(`User-agent: *
Allow: /
`);
});

app.get("/resolve-location", c =>
  c.json({
    ok: true,
    discoveryOnly: true,
    message:
      "This paid resource uses POST, not GET. Read /openapi.json or /skill.md for machine-readable usage instructions.",
    method: "POST",
    endpoint: `${publicBaseUrl}/resolve-location`,
    price: "0.01 USDC",
    paymentProtocol: "x402",
    network: isMainnet ? "Algorand MainNet" : "Algorand TestNet",
    requestExample: { query: "col centro vicente guerrero dgo" },
    whyUseIt:
      "Cheap deterministic normalization before routing, CRM storage, civic-report triage, checkout, delivery, deduplication or a more expensive geocoder.",
    coverage: {
      states: "All 32 Mexican states",
      municipalityEnrichment: "Selected municipalities in Durango in the current MVP"
    },
    openapi: `${publicBaseUrl}/openapi.json`,
    skill: `${publicBaseUrl}/skill.md`,
    manifest: `${publicBaseUrl}/.well-known/x402`,
  }),
);

app.use(
  paymentMiddleware(
    {
      "POST /resolve-location": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network,
            payTo: avmAddress,
            extra: {
              asset: usdcAsset,
              tag: "x402-global-challenge",
            },
          },
        ],
        description:
          "Normalize a messy Mexican location string into structured state, municipality, postal-code signal, confidence, and provenance.",
        mimeType: "application/json",
        extensions: locationDiscovery,
      },
    },
    server,
  ),
);

app.post("/resolve-location", async c => {
  let body: { query?: unknown } = {};

  try {
    body = await c.req.json<{ query?: unknown }>();
  } catch {
    body = {};
  }

  if (typeof body.query !== "string" || body.query.trim().length < 3) {
    return c.json(
      {
        error: "invalid_query",
        message: 'Send JSON like {"query":"col centro vicente guerrero dgo"}',
      },
      400,
    );
  }

  return c.json({
    ...resolveLocation(body.query),
    paidVia: "x402 / USDC / Algorand",
    network: isMainnet ? "mainnet" : "testnet",
    generatedAt: new Date().toISOString(),
  });
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  info => {
    console.log(
      `DollarOne x402 server listening on http://localhost:${info.port} (${isMainnet ? "mainnet" : "testnet"})`,
    );
  },
);
