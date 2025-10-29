"use client";
import React from 'react';
import KeySection from "./sections/KeySection";
import { getConfig } from "./config";
import "../integration/flashbackCryptoBridge";

export default function Home() {
  const defaults = getConfig();
  const defaultCertPath = defaults.certificatePath || '~/.relay/';

  return (
    <div className="min-h-screen p-6 text-sm text-gray-900">
      <h1 className="text-2xl font-semibold mb-4">Flashback Client</h1>

      {/* Section 1: Generate or Locate Private Key */}
      <KeySection defaultConfigPath={defaultCertPath} />

      {/* Future sections will be split into their own files like ./sections/ServerRegistration, ./sections/Broadcast, etc. */}
    </div>
  );
}
