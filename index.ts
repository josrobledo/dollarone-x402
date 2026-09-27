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
    "Normalize messy Mexican location strings into structured state, municipality, locality, postal-code signal, confidence and provenance.",
  version: "0.3.0",
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
      paid: true,
    },
  ],
};

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "DollarOne Mexico Location Intelligence API",
    version: "0.3.0",
    description:
      "Paid x402 API for normalizing messy Mexican location strings.",
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
        summary: "Resolve a Mexican location",
        description:
          "Requires an x402 payment of 0.01 USDC before the result is returned.",
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
              example: { query: "col centro vicente guerrero dgo" },
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

DollarOne normalizes messy Mexican location strings for software agents.

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
