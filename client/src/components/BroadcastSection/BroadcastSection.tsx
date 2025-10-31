"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getConfig, setConfig } from "../../app/config";
import { RegisterResultData } from "../../apiTypes";

export interface BroadcastSectionProps {
  registeredInfo: RegisterResultData | null;
}

export default function BroadcastSection({
  registeredInfo,
}: BroadcastSectionProps) {
  const cfg = useMemo(() => getConfig(), []);
  const [visible, setVisible] = useState(!!registeredInfo);
  const [broadcastPort, setBroadcastPort] = useState<number>(13337);
  const [localIP, setLocalIP] = useState<string>("127.0.0.1");
  const [remoteIP, setRemoteIP] = useState<string>(
    registeredInfo?.clientIP ? registeredInfo.clientIP : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(
    new Set()
  );
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    setVisible(!!registeredInfo);
    if (registeredInfo) {
      // Pre-fill remote socket using clientIP (port can be edited by user)
      setRemoteIP(`${registeredInfo.clientIP}:0`);
      // Load available Fabric channels
      loadAvailableChannels();
    }
  }, [registeredInfo]);

  async function loadAvailableChannels() {
    setLoadingChannels(true);
    try {
      const api: any = window.flashbackApi;
      if (api && typeof api.fabricGetChannels === "function") {
        const result = await api.fabricGetChannels();
        let channels: string[] = [];
        if (typeof result === "string") {
          channels = JSON.parse(result);
        } else if (Array.isArray(result)) {
          channels = result;
        }
        setAvailableChannels(channels);
      }
    } catch (e: any) {
      console.error("Failed to load channels:", e?.message);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function toggleChannel(channelName: string) {
    const isSubscribed = subscribedChannels.has(channelName);

    if (!isSubscribed) {
      // Subscribe to channel
      try {
        const api: any = window.flashbackApi;
        if (!api || typeof api.fabricSubscribeChannel !== "function") {
          throw new Error("Fabric API bridge unavailable");
        }

        // Subscribe this peer to the channel
        await api.fabricSubscribeChannel(channelName);

        // Add to subscribed channels
        const newChannels = new Set(subscribedChannels);
        newChannels.add(channelName);
        setSubscribedChannels(newChannels);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    } else {
      // Unsubscribe from channel
      try {
        const api: any = window.flashbackApi;
        if (!api || typeof api.fabricUnsubscribeChannel !== "function") {
          throw new Error("Fabric API bridge unavailable");
        }

        // Unsubscribe from the channel
        await api.fabricUnsubscribeChannel(channelName);

        // Remove from subscribed channels
        const newChannels = new Set(subscribedChannels);
        newChannels.delete(channelName);
        setSubscribedChannels(newChannels);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    }
  }

  async function goReady() {
    setError(null);
    setBusy(true);
    try {
      const api: any = window.flashbackApi;
      if (!api || typeof api.apiReady !== "function")
        throw new Error("API bridge unavailable");

      // Pass list of subscribed channels with broadcast info
      const channelNames = Array.from(subscribedChannels);
      const res: string = await api.apiReady(
        localIP,
        remoteIP,
        broadcastPort,
        channelNames
      );
      if (/^READY OK /.test(res)) {
        setOnline(true);
      } else {
        setError(res || "Unknown error");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function goOffline() {
    // Clear the online state
    setOnline(false);
  }

  if (!visible) return null;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-medium mb-2">3. Hyperledger Fabric Configuration</h2>
      {!online && (
        <div className="flex flex-col gap-2 max-w-2xl">
          <label className="flex flex-col">
            <span className="text-gray-600">Local Socket</span>
            <input
              className="border px-3 py-2 rounded"
              value={localIP}
              onChange={(e) => setLocalIP(e.target.value)}
              placeholder="127.0.0.1"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Remote Socket (Relay Tracker)</span>
            <input
              className="border px-3 py-2 rounded"
              value={remoteIP}
              onChange={(e) => setRemoteIP(e.target.value)}
              placeholder="<relay-tracker-ip>"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-gray-600">Broadcast Port</span>
            <input
              className="border px-3 py-2 rounded"
              value={broadcastPort}
              onChange={(e) =>
                setBroadcastPort(parseInt(e.target.value, 10) || 13337)
              }
              placeholder="13337"
            />
          </label>

          <div className="flex flex-col">
            <span className="text-gray-600 mb-2">Subscribed Channels</span>
            <span className="text-xs text-gray-500 mb-2">
              Select which Hyperledger Fabric channels to subscribe to. You will
              only sync entries and comments for subscribed channels.
            </span>
            {loadingChannels && (
              <span className="text-xs text-gray-500">Loading channels...</span>
            )}
            {!loadingChannels && availableChannels.length === 0 && (
              <span className="text-xs text-gray-500">
                No channels available
              </span>
            )}
            {!loadingChannels && availableChannels.length > 0 && (
              <div className="space-y-1 mt-2">
                {availableChannels.map((channel) => (
                  <label key={channel} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={subscribedChannels.has(channel)}
                      onChange={() => toggleChannel(channel)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{channel}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <button
              className="px-3 py-2 border rounded disabled:opacity-50"
              onClick={goReady}
              disabled={
                busy || !localIP || subscribedChannels.size === 0
              }
            >
              {busy ? "Working..." : "Ready!"}
            </button>
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="text-xs text-gray-500">
            This will announce your presence to the relay tracker and begin
            syncing data for subscribed channels.
          </div>
        </div>
      )}
      {online && (
        <div className="max-w-2xl border rounded p-3 bg-gray-50">
          <div className="text-green-700 mb-2">
            Online. Your peer is registered with Fabric network.
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <div>
              <span className="text-gray-500">Local Socket:</span>{" "}
              <code>{localIP}</code>
            </div>
            {remoteIP && (
              <div>
                <span className="text-gray-500">Remote Socket:</span>{" "}
                <code>{remoteIP}</code>
              </div>
            )}
            <div>
              <span className="text-gray-500">Subscribed Channels:</span>{" "}
              <code>{Array.from(subscribedChannels).join(", ")}</code>
            </div>
          </div>
          <div className="mt-2">
            <button
              className="px-3 py-2 border rounded"
              onClick={goOffline}
            >
              Go offline
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
