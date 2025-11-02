'use client';

import React, { useState } from 'react';
import { invokeChaincodeAsync } from '@/lib/api';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface ContentSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingMovies: Array<{ imdb_id: string; title: string }>;
}

const MOVIE_CHANNEL = 'movies-general';
const MOVIE_CHAINCODE = 'flashback_repository';

export default function ContentSubmissionModal({
  isOpen,
  onClose,
  onSuccess,
  existingMovies,
}: ContentSubmissionModalProps) {
  const [formData, setFormData] = useState({
    imdbId: '',
    title: '',
    director: '',
    releaseYear: '',
    genres: '',
    description: '',
    reason: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate IMDb ID (required)
    if (!formData.imdbId.trim()) {
      errors.imdbId = 'IMDb ID is required';
    } else if (!/^tt\d{7,8}$/.test(formData.imdbId)) {
      errors.imdbId = 'Invalid IMDb ID format (e.g., tt0111161)';
    } else if (existingMovies.some((m) => m.imdb_id === formData.imdbId)) {
      errors.imdbId = 'This IMDb ID already exists in the database';
    }

    // Validate title (required)
    if (!formData.title.trim()) {
      errors.title = 'Movie title is required';
    }

    // Validate release year (optional but format if provided)
    if (formData.releaseYear && !/^\d{4}$/.test(formData.releaseYear)) {
      errors.releaseYear = 'Release year must be a 4-digit number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error for this field when user starts editing
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Parse genres if provided
      const genresList = formData.genres
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      // Prepare the submission data
      const submissionData = {
        imdb_id: formData.imdbId,
        title: formData.title,
        director: formData.director || undefined,
        release_year: formData.releaseYear ? parseInt(formData.releaseYear) : undefined,
        genres: genresList.length > 0 ? genresList : undefined,
        description: formData.description || undefined,
        reason: formData.reason || 'User submission',
      };

      // Remove undefined fields to keep clean data
      const cleanData = Object.fromEntries(
        Object.entries(submissionData).filter(([_, v]) => v !== undefined)
      );

      // Call the SubmitContentRequest chaincode function
      const result: any = await invokeChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
        'SubmitContentRequest',
        [JSON.stringify(cleanData)]
      );

      setSuccess('Movie submission successful! Thank you for contributing.');
      
      // Reset form
      setFormData({
        imdbId: '',
        title: '',
        director: '',
        releaseYear: '',
        genres: '',
        description: '',
        reason: '',
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);

      console.log('Submission result:', result);
    } catch (err: any) {
      setError(err.message || 'Failed to submit movie. Please try again.');
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-slate-800 p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Submit Missing Movie</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-green-900 p-4 text-green-200">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-900 p-4 text-red-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* IMDb ID - Required */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              IMDb ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="imdbId"
              value={formData.imdbId}
              onChange={handleInputChange}
              placeholder="e.g., tt0111161"
              disabled={submitting}
              className={`w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:outline-none ${
                validationErrors.imdbId
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-600 focus:border-cyan-400'
              }`}
            />
            {validationErrors.imdbId && (
              <p className="mt-1 text-sm text-red-400">{validationErrors.imdbId}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              IMDb ID format: tt followed by 7-8 digits (e.g., tt0111161)
            </p>
          </div>

          {/* Title - Required */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Movie Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., The Shawshank Redemption"
              disabled={submitting}
              className={`w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:outline-none ${
                validationErrors.title
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-600 focus:border-cyan-400'
              }`}
            />
            {validationErrors.title && (
              <p className="mt-1 text-sm text-red-400">{validationErrors.title}</p>
            )}
          </div>

          {/* Director - Optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Director
            </label>
            <input
              type="text"
              name="director"
              value={formData.director}
              onChange={handleInputChange}
              placeholder="e.g., Frank Darabont"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Release Year - Optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Release Year
            </label>
            <input
              type="text"
              name="releaseYear"
              value={formData.releaseYear}
              onChange={handleInputChange}
              placeholder="e.g., 1994"
              disabled={submitting}
              className={`w-full rounded-lg border bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:outline-none ${
                validationErrors.releaseYear
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-slate-600 focus:border-cyan-400'
              }`}
            />
            {validationErrors.releaseYear && (
              <p className="mt-1 text-sm text-red-400">{validationErrors.releaseYear}</p>
            )}
          </div>

          {/* Genres - Optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Genres (comma-separated)
            </label>
            <input
              type="text"
              name="genres"
              value={formData.genres}
              onChange={handleInputChange}
              placeholder="e.g., Drama, Crime, Thriller"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Description - Optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the movie..."
              disabled={submitting}
              rows={3}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Reason - Optional */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Reason for Submission
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Why should this movie be added? (optional)"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2 font-semibold transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 font-semibold transition-colors hover:bg-cyan-700 disabled:bg-slate-600"
            >
              {submitting ? 'Submitting...' : 'Submit Movie'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-4 rounded-lg bg-slate-900 p-3 text-sm text-slate-300">
          <p>
            <strong>Note:</strong> Your submission will be reviewed by moderators before being added to the database.
          </p>
        </div>
      </div>
    </div>
  );
}
