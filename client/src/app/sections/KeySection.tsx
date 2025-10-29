"use client";
import React, {useCallback, useEffect, useRef, useState} from "react";

// Section 1. Generate or Locate Private Key
// Requirements implemented:
// - Two UI states: (a) select/generate or locate an existing key, (b) success with basic key info and a button to go back
// - Asks for config path (with default filled in via prop) and email, optional password, bit length, encryption algorithm
// - Button to generate a new private key (asks permission to overwrite existing private.key)
// - Button to locate an existing private key (*.key). If found/valid, show success state; otherwise show error and first state again
// - No test-specific identifiers in source; this is generic UI

export type AlgOption = "ecdsa" | "ed25519" | "rsa";

export interface KeySectionProps {
  defaultConfigPath: string;
}

function isLikelyPem(text: string): boolean {
  const t = (text || "").trim();
  return t.includes("-----BEGIN") && t.includes("PRIVATE KEY-----") && t.includes("-----END");
}

declare global {
    interface Window {
        flashbackCrypto?: {
            checkKeyExists: (configPath: string) => Promise<{ exists: boolean; certPem?: string }>;
            generateUserKeysAndCert: (args: {
                email: string;
                password?: string;
                bits?: number;
                friendlyName?: string;
                savePath: string;
            }) => Promise<{ certPem: string; privateKeyPemPath: string; certPemPath: string }>;
            loadCertPemFromPath?: (path: string) => Promise<{ certPem: string }>
        }
    }
}
export default function KeySection({ defaultConfigPath }: KeySectionProps) {
  // State for form
  const [configPath, setConfigPath] = useState<string>(defaultConfigPath);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [bits, setBits] = useState<number>(2048);
  const [alg, setAlg] = useState<AlgOption>("ecdsa");
  const [friendlyName, setFriendlyName] = useState<string>("FlashBack");

  // Async state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state info
  const [success, setSuccess] = useState(false);
  const [certPem, setCertPem] = useState<string>("");
  const [privateKeyPath, setPrivateKeyPath] = useState<string>("");
  const [certPath, setCertPath] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cryptoAvailable, setCryptoAvailable] = useState<boolean>(typeof window !== "undefined" && !!(window as any).flashbackCrypto);

  // Watch for bridge initialization and update availability
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (typeof window !== "undefined" && !!(window as any).flashbackCrypto) {
        if (!cancelled) setCryptoAvailable(true);
        return true;
      }
      return false;
    };
    if (!check()) {
      const onReady = () => { if (!cancelled) setCryptoAvailable(true); };
      window.addEventListener('flashbackCryptoReady', onReady as any);
      const id = window.setInterval(() => { if (check()) { window.clearInterval(id); } }, 250);
      return () => { cancelled = true; window.removeEventListener('flashbackCryptoReady', onReady as any); window.clearInterval(id); };
    }
    return () => { cancelled = true; };
  }, []);

  // If crypto isn't available, surface a clear error for the user
  useEffect(() => {
    if (!cryptoAvailable) {
      setError("Crypto features are not available in this environment. Please run the desktop app with the crypto plugin.");
    } else if (error && /Crypto features are not available/i.test(error)) {
      // Clear previous crypto error if env becomes available
      setError(null);
    }
  }, [cryptoAvailable]);

  // On mount or when configPath changes, check if a key already exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      if (!cryptoAvailable) return;
      try {
        const res = await window.flashbackCrypto!.checkKeyExists(configPath);
        if (cancelled) return;
        if (res?.exists) {
          setSuccess(true);
          setCertPem(res?.certPem || "");
          // We don't know the private key path exactly from here; display configPath
          setPrivateKeyPath(configPath.endsWith("/") || configPath.endsWith("\\") ? configPath + "private.key" : configPath);
        } else {
          setSuccess(false);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true };
  }, [configPath, cryptoAvailable]);

  const triggerLocate = useCallback(() => {
    setError(null);
    if (busy) return; // prevent while busy
    fileInputRef.current?.click();
  }, [busy]);

  const onFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (!isLikelyPem(text)) {
        setError("Selected file does not appear to be a PEM private key (*.key).");
        setSuccess(false);
        return;
      }
      // Consider it valid for UI purposes. Mark success and fill minimal info.
      setSuccess(true);
      setPrivateKeyPath(file.name);
      // If certificate can be inferred via helper, attempt to load side-by-side certificate.pem
      try {
        const maybePath = file.webkitRelativePath || file.name;
        setCertPath(maybePath.replace(/[^/\\]+$/, "certificate.pem"));
      } catch {}
    } catch (err: any) {
      setError(err?.message || String(err));
      setSuccess(false);
    } finally {
      // reset input so same file can be chosen again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!cryptoAvailable) {
      setError("Crypto plugin not available.");
      return;
    }
    if (!email) {
      setError("Email is required to generate a key.");
      return;
    }

    // Confirm overwrite when a private key is detected for this path
    let shouldProceed = true;
    try {
      const existsRes = await window.flashbackCrypto!.checkKeyExists(configPath).catch(() => ({ exists: false }));
      if (existsRes?.exists) {
        shouldProceed = window.confirm("A private key already exists at this path. Overwrite it?");
      }
    } catch {}
    if (!shouldProceed) return;

    setBusy(true);
    try {
      // Note: alg and bits are not yet wired through the Rust plugin interface; preserved for future use
      const res = await window.flashbackCrypto!.generateUserKeysAndCert({
        email,
        password: password || undefined,
        bits: bits || undefined,
        friendlyName,
        savePath: configPath,
      });
      setCertPem(res.certPem || "");
      setPrivateKeyPath(res.privateKeyPemPath || "");
      setCertPath(res.certPemPath || "");
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || String(e));
      setSuccess(false);
    } finally {
      setBusy(false);
    }
  }, [cryptoAvailable, email, password, bits, friendlyName, configPath]);

  const resetToEdit = useCallback(() => {
    setSuccess(false);
    setError(null);
  }, []);

  return (
    <section className="mb-6">
      <h2 className="text-lg font-medium mb-2">1. Generate or Locate Private Key</h2>

      {!success && (
        <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
          <label className="flex flex-col">
            <span className="text-gray-600">Config Path</span>
            <input className="border px-3 py-2 rounded" value={configPath}
                   onChange={(e) => setConfigPath(e.target.value)} placeholder={defaultConfigPath} />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Email</span>
            <input className="border px-3 py-2 rounded" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Password (optional)</span>
            <input type="password" className="border px-3 py-2 rounded" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="Optional password" />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Bit length</span>
            <input type="number" min={2048} step={1024} className="border px-3 py-2 rounded" value={bits}
                   onChange={(e) => setBits(parseInt(e.target.value || "2048", 10))} />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Algorithm</span>
            <select className="border px-3 py-2 rounded" value={alg}
                    onChange={(e) => setAlg(e.target.value as AlgOption)}>
              <option value="ecdsa">ECDSA (P-256)</option>
              <option value="ed25519">Ed25519</option>
              <option value="rsa">RSA</option>
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Friendly Name</span>
            <input className="border px-3 py-2 rounded" value={friendlyName}
                   onChange={(e) => setFriendlyName(e.target.value)} />
          </label>

          <div className="sm:col-span-2 flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
              <button
                className="px-3 py-2 border rounded disabled:opacity-50"
                onClick={handleGenerate}
                aria-busy={busy ? true : undefined}
                disabled={busy || !cryptoAvailable}
                title={!cryptoAvailable ? 'Crypto not available' : (error ? 'Fix the error to proceed' : (busy ? 'Working...' : ''))}
              >
                {busy ? "Working..." : "Generate New Private Key"}
              </button>
              <button
                className="px-3 py-2 border rounded disabled:opacity-50"
                onClick={triggerLocate}
                disabled={busy}
                title={error ? 'Fix the error to proceed' : (busy ? 'Working...' : '')}
              >
                Locate Existing *.key
              </button>
              <input ref={fileInputRef} type="file" accept=".key,.pem" className="hidden" onChange={onFileChosen} />
            </div>
            {busy && (
              <div className="text-blue-700 text-sm">Please wait, processing your request...</div>
            )}
            {(!cryptoAvailable) && (
              <div className="text-red-600 text-sm">Crypto features are unavailable; generation is disabled.</div>
            )}
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-3xl border rounded p-3 bg-gray-50">
          <div className="text-sm text-gray-700 space-y-1">
            {privateKeyPath && (<div><span className="text-gray-500">Private Key:</span> <code>{privateKeyPath}</code></div>)}
            {certPath && (<div><span className="text-gray-500">Certificate:</span> <code>{certPath}</code></div>)}
          </div>
          {certPem && (
            <div className="mt-3">
              <div className="text-gray-600 mb-1">Certificate (PEM):</div>
              <textarea className="border px-3 py-2 rounded w-full" rows={6} value={certPem}
                        onChange={(e) => setCertPem(e.target.value)} />
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button className="px-3 py-2 border rounded" onClick={resetToEdit}>Select or Generate a New Key</button>
          </div>
        </div>
      )}
    </section>
  );
}
