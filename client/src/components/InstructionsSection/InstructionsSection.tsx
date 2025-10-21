import React from "react";

export default function InstructionsSection() {
    return (
        <section id="instructions" className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-2">Instructions</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                <li>Make sure the server is running (cargo run in the server directory)</li>
                <li>Enter the server IP and port (default: 127.0.0.1:8080)</li>
                <li>Your client IP and port will be auto-generated</li>
                <li>Click "Connect to Server" to join</li>
                <li>Open multiple client instances to chat with each other</li>
                <li>Messages are broadcast to all connected clients (not stored on server)</li>
            </ol>
        </section>
    )
}