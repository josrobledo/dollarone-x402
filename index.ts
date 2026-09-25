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
  ALGORAND_MAINNET_CAIP2,
  USDC_TESTNET_ASA_ID,
  USDC_MAINNET_ASA_ID,
} from "@x402/avm";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
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

// Explicit TestNet CAIP-2 string. The current package constant used in the
// first Railway deploy resolved to a truncated identifier, which caused
// GoPlausible capability negotiation to reject the route.
const ALGORAND_TESTNET_CAIP2_FULL =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";
const network = isMainnet ? ALGORAND_MAINNET_CAIP2 : ALGORAND_TESTNET_CAIP2_FULL;
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

const app = new Hono();

app.get("/health", c =>
  c.json({
    ok: true,
    service: "DollarOne Mexico Location Intelligence API",
    x402Network: isMainnet ? "mainnet" : "testnet",
    paymentAsset: "USDC",
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
