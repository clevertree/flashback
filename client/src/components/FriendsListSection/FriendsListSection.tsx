"use client";
import React, { useEffect, useState } from "react";
import { RegisterResultData, ClientInfo } from "../../apiTypes";

export interface FriendsListSectionProps {
    registeredInfo: RegisterResultData | null;
    onFriendVisit?: (friend: ClientInfo) => void;
}

// TODO: Remove hardcoded friend entries once user account search feature is implemented
const DEFAULT_FRIENDS: ClientInfo[] = [
    { email: 'ari@asu.edu' },
    { email: 'test@test.com' },
];

export default function FriendsListSection({ registeredInfo, onFriendVisit }: FriendsListSectionProps) {
    const [visible, setVisible] = useState(!!registeredInfo);
    const [friends, setFriends] = useState<ClientInfo[]>(DEFAULT_FRIENDS);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState<string | null>(null); // Track which friend is being loaded
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setVisible(!!registeredInfo);
    }, [registeredInfo]);

    async function handleVisitFriend(friend: ClientInfo) {
        if (!friend.email) return;
        
        setError(null);
        setLoading(friend.email);
        
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiLookup !== 'function') {
                throw new Error('API bridge unavailable');
            }
            
            // Lookup friend by email to get latest socket info and public certificate
            // IMPORTANT: Public certificates MUST ONLY come from the relay tracker server.
            // The relay tracker verifies certificate ownership and ensures secure data transfer.
            const result = await api.apiLookup(friend.email);
            
            // Parse the result (assuming it returns JSON string or object)
            let lookupData: any;
            if (typeof result === 'string') {
                lookupData = JSON.parse(result);
            } else {
                lookupData = result;
            }
            
            // Validate that certificate was returned by the relay tracker
            const publicCertificate = lookupData.publicCertificate || lookupData.certificate;
            if (!publicCertificate) {
                throw new Error('No public certificate received from relay tracker. Cannot establish secure connection.');
            }
            
            // Create updated friend info with socket data and certificate
            // The certificate is verified to come from the relay tracker server
            const updatedFriend: ClientInfo = {
                ...friend,
                ip: lookupData.ip || lookupData.clientIP,
                port: lookupData.port,
                remote_ip: lookupData.remote_ip || lookupData.ip || lookupData.clientIP,
                publicCertificate: publicCertificate,
                peer_status: 'online',
            };
            
            // Note: RemoteHouse is for connecting to friend servers only
            // For browsing repositories, use RepoBrowser with Fabric channels
            if (onFriendVisit) {
                onFriendVisit(updatedFriend);
            }
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setLoading(null);
        }
    }

    function handleAddFriend() {
        const email = newEmail.trim();
        if (!email) {
            setError('Please enter a valid email address');
            return;
        }
        
        // Check if friend already exists
        if (friends.some(f => f.email === email)) {
            setError('Friend already exists in your list');
            return;
        }
        
        setFriends([...friends, { email }]);
        setNewEmail('');
        setError(null);
    }

    function handleRemoveFriend(email: string) {
        setFriends(friends.filter(f => f.email !== email));
    }

    if (!visible) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-medium mb-4">3. Friends List</h2>

            {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

            {/* Add Friend Form */}
            <div className="mb-4 flex gap-2 max-w-2xl">
                <input
                    type="email"
                    className="flex-1 border px-3 py-2 rounded text-gray-900"
                    placeholder="friend@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleAddFriend();
                        }
                    }}
                />
                <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                    onClick={handleAddFriend}
                >
                    Add Friend
                </button>
            </div>

            {/* Friends List */}
            {friends.length === 0 ? (
                <div className="text-gray-400 text-sm">
                    No friends in your list. Add a friend to get started.
                </div>
            ) : (
                <div className="space-y-2 max-w-2xl">
                    {friends.map((friend) => (
                        <div
                            key={friend.email}
                            className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded"
                        >
                            <div className="flex-1">
                                <div className="text-sm font-medium text-gray-100">
                                    {friend.email}
                                </div>
                                {friend.peer_status && (
                                    <div className="text-xs text-gray-400">
                                        Status: {friend.peer_status}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                                    onClick={() => handleVisitFriend(friend)}
                                    disabled={loading === friend.email}
                                >
                                    {loading === friend.email ? 'Loading...' : 'Visit'}
                                </button>
                                <button
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                                    onClick={() => handleRemoveFriend(friend.email)}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 text-xs text-gray-400">
                Click "Visit" to connect to a friend's shared files. The app will lookup their latest connection info from the server.
            </div>
        </section>
    );
}
