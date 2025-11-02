'use client';

import React, { useState, useEffect } from 'react';
import { queryChaincodeAsync, invokeChaincodeAsync } from '@/lib/api';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface ContentRequest {
  request_id: string;
  imdb_id: string;
  title: string;
  director?: string;
  release_year?: number;
  genres?: string[];
  description?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_by: string;
}

const MOVIE_CHANNEL = 'movies-general';
const MOVIE_CHAINCODE = 'flashback_repository';

export default function ModerationDashboard() {
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load pending requests on mount
  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call GetRequestHistory to get all content requests
      const result: any = await queryChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
        'GetRequestHistory',
        []
      );

      // Handle different response formats
      let requestList: ContentRequest[] = [];
      if (result?.data && Array.isArray(result.data)) {
        requestList = result.data;
      } else if (Array.isArray(result)) {
        requestList = result;
      } else if (result?.results && Array.isArray(result.results)) {
        requestList = result.results;
      }

      // Sort by submitted_at descending (newest first)
      requestList.sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );

      setRequests(requestList);
      console.log(`Loaded ${requestList.length} content requests`);
    } catch (err: any) {
      setError(err.message || 'Failed to load content requests');
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: ContentRequest) => {
    if (!request.request_id) return;

    setProcessingId(request.request_id);
    try {
      // Call ApproveContentRequest chaincode function
      const result: any = await invokeChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
        'ApproveContentRequest',
        [request.request_id]
      );

      console.log('Approval result:', result);

      // Update request status locally
      setRequests((prev) =>
        prev.map((r) =>
          r.request_id === request.request_id ? { ...r, status: 'approved' } : r
        )
      );
    } catch (err: any) {
      setError(err.message || `Failed to approve request ${request.request_id}`);
      console.error('Approval error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: ContentRequest) => {
    if (!request.request_id) return;

    setProcessingId(request.request_id);
    try {
      // Call RejectContentRequest chaincode function
      const result: any = await invokeChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
        'RejectContentRequest',
        [request.request_id]
      );

      console.log('Rejection result:', result);

      // Update request status locally
      setRequests((prev) =>
        prev.map((r) =>
          r.request_id === request.request_id ? { ...r, status: 'rejected' } : r
        )
      );
    } catch (err: any) {
      setError(err.message || `Failed to reject request ${request.request_id}`);
      console.error('Rejection error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(
    (r) => filterStatus === 'all' || r.status === filterStatus
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 rounded-full bg-yellow-900 px-3 py-1 text-sm font-semibold text-yellow-200">
            <Clock className="h-4 w-4" />
            Pending
          </div>
        );
      case 'approved':
        return (
          <div className="flex items-center gap-2 rounded-full bg-green-900 px-3 py-1 text-sm font-semibold text-green-200">
            <CheckCircle className="h-4 w-4" />
            Approved
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 rounded-full bg-red-900 px-3 py-1 text-sm font-semibold text-red-200">
            <XCircle className="h-4 w-4" />
            Rejected
          </div>
        );
      default:
        return <span className="text-slate-400">{status}</span>;
    }
  };

  const getStatusCount = (status: string): number => {
    if (status === 'all') return requests.length;
    return requests.filter((r) => r.status === status).length;
  };

  return (
    <div className="space-y-6 rounded-lg bg-slate-800 p-6">
      {/* Header */}
      <div>
        <h2 className="mb-2 text-3xl font-bold">Moderation Dashboard</h2>
        <p className="text-slate-300">Review and approve/reject submitted movie requests</p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setFilterStatus('all')}
          className={`rounded-lg p-4 text-left transition-colors ${
            filterStatus === 'all'
              ? 'bg-cyan-900 text-cyan-100'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <p className="text-sm font-semibold">All Requests</p>
          <p className="text-2xl font-bold">{getStatusCount('all')}</p>
        </button>
        <button
          onClick={() => setFilterStatus('pending')}
          className={`rounded-lg p-4 text-left transition-colors ${
            filterStatus === 'pending'
              ? 'bg-yellow-900 text-yellow-100'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <p className="text-sm font-semibold">Pending</p>
          <p className="text-2xl font-bold">{getStatusCount('pending')}</p>
        </button>
        <button
          onClick={() => setFilterStatus('approved')}
          className={`rounded-lg p-4 text-left transition-colors ${
            filterStatus === 'approved'
              ? 'bg-green-900 text-green-100'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <p className="text-sm font-semibold">Approved</p>
          <p className="text-2xl font-bold">{getStatusCount('approved')}</p>
        </button>
        <button
          onClick={() => setFilterStatus('rejected')}
          className={`rounded-lg p-4 text-left transition-colors ${
            filterStatus === 'rejected'
              ? 'bg-red-900 text-red-100'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <p className="text-sm font-semibold">Rejected</p>
          <p className="text-2xl font-bold">{getStatusCount('rejected')}</p>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg bg-red-900 p-4 text-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-lg bg-slate-700 p-8 text-center">
          <p className="text-slate-300">Loading content requests...</p>
        </div>
      )}

      {/* Requests List */}
      {!loading && (
        <div className="space-y-4">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <div
                key={request.request_id}
                className="rounded-lg border border-slate-600 bg-slate-900 p-4"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold">{request.title}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.director && (
                      <p className="mt-1 text-sm text-slate-400">
                        Director: {request.director}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">IMDb ID</p>
                    <p className="font-mono text-cyan-400">{request.imdb_id}</p>
                  </div>
                  {request.release_year && (
                    <div>
                      <p className="text-slate-400">Release Year</p>
                      <p>{request.release_year}</p>
                    </div>
                  )}
                  {request.genres && request.genres.length > 0 && (
                    <div>
                      <p className="text-slate-400">Genres</p>
                      <p>{request.genres.join(', ')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-400">Submitted</p>
                    <p>
                      {new Date(request.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {request.description && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-400">Description</p>
                    <p className="mt-1 text-slate-300">{request.description}</p>
                  </div>
                )}

                {request.reason && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-400">Reason for Submission</p>
                    <p className="mt-1 text-slate-300">{request.reason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {request.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.request_id}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold transition-colors hover:bg-green-700 disabled:bg-slate-600"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      disabled={processingId === request.request_id}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold transition-colors hover:bg-red-700 disabled:bg-slate-600"
                    >
                      <XCircle className="h-5 w-5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-slate-700 p-8 text-center">
              <p className="text-slate-400">
                {filterStatus === 'all'
                  ? 'No content requests yet'
                  : `No ${filterStatus} requests`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={loadRequests}
        disabled={loading}
        className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold transition-colors hover:bg-cyan-700 disabled:bg-slate-600"
      >
        {loading ? 'Refreshing...' : 'Refresh Requests'}
      </button>
    </div>
  );
}
