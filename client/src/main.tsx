import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  WalletManager,
  WalletProvider,
  useWallet,
} from "@txnlab/use-wallet-react";
import { pera } from "@txnlab/use-wallet-pera";
import { x402Client } from "@x402/core/client";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmSigner } from "@x402/avm";
import "./styles.css";

const walletManager = new WalletManager({
  wallets: [pera()],
  defaultNetwork: "testnet",
});

function shortAddress(address: string) {
  return address.slice(0, 7) + "…" + address.slice(-5);
}

function Tester() {
  const { availableWallets, activeAccount, signTransactions } = useWallet();
  const [query, setQuery] = useState("col centro vicente guerrero dgo");
  const [status, setStatus] = useState("Listo para conectar DollarOne Tester.");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const wallet = useMemo(() => availableWallets[0], [availableWallets]);

  const connect = async () => {
    if (!wallet) return;
    try {
      setStatus("Abriendo Pera Wallet…");
      await wallet.connect();
      if (!wallet.isActive) wallet.setActive();
      setStatus("Wallet conectada. Verifica que sea DollarOne Tester en TestNet.");
    } catch (error) {
      setStatus("No se completó la conexión con Pera.");
      console.error(error);
    }
  };

  const pay = async () => {
    if (!activeAccount) {
      setStatus("Primero conecta DollarOne Tester.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      setStatus("Solicitando /resolve-location… DollarOne deberá responder 402.");

      const signer: ClientAvmSigner = {
        address: activeAccount.address,
        signTransactions: async (txns, indexesToSign) =>
          signTransactions(txns, indexesToSign),
      };

      const client = new x402Client({ schemes: [] });
      client.register(
        "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
        new ExactAvmScheme(signer),
      );

      setStatus("Si Pera solicita firma, revisa y aprueba la transacción de 0.01 Test USDC.");

      const response = await client.fetch("/resolve-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const body = await response.json().catch(() => ({
        error: "non_json_response",
        status: response.status,
      }));

      setResult(body);

      if (!response.ok) {
        setStatus("La prueba no terminó correctamente. Revisa el resultado de abajo.");
        return;
      }

      setStatus("✅ Pago x402 confirmado y respuesta recibida.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult({ error: message });
      setStatus("La prueba encontró un error. No vuelvas a pagar hasta revisarlo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">PROYECTO $1M · EXP-001</div>
        <h1>DollarOne x402 Tester</h1>
        <p>
          Prueba segura en <strong>Algorand TestNet</strong>. La transacción usa
          USDC de prueba, sin valor real.
        </p>
      </section>

      <section className="card">
        <div className="step">1</div>
        <div className="content">
          <h2>Conecta Pera</h2>
          {activeAccount ? (
            <>
              <div className="success">✓ Pera conectada</div>
              <code>{shortAddress(activeAccount.address)}</code>
              <p className="hint">
                Debe ser la cuenta <strong>DollarOne Tester</strong>, no la cuenta vendedora.
              </p>
            </>
          ) : (
            <button onClick={connect} disabled={!wallet}>
              Conectar Pera Wallet
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="step">2</div>
        <div className="content">
          <h2>Compra una consulta</h2>
          <label htmlFor="query">Texto de ubicación</label>
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy}
          />
          <div className="price">
            Precio de prueba: <strong>0.01 USDC</strong>
          </div>
          <button
            className="pay"
            onClick={pay}
            disabled={!activeAccount || busy || query.trim().length < 3}
          >
            {busy ? "Procesando…" : "Probar pago x402"}
          </button>
          <p className="hint">
            Pera debe mostrarte la transacción antes de firmarla. No se solicita
            frase de recuperación ni llave privada.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="step">3</div>
        <div className="content">
          <h2>Resultado</h2>
          <div className="status">{status}</div>
          {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <Tester />
    </WalletProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
