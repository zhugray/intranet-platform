// apps/admin/src/app/(protected)/[deptId]/upload/UploadPageClient.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const CATEGORIES = [
  { value: 'POLICY', label: 'Policy' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'KNOWLEDGE', label: 'Knowledge' },
  { value: 'LIBRARY', label: 'Library' },
];

const ALLOWED_TYPES = ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.md'];
const MAX_SIZE_MB = 50;

export default function UploadPage() {
  const pathname = usePathname();
  const deptId = useMemo(() => pathname?.split('/').filter(Boolean)[0] ?? '', [pathname]);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('POLICY');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');

  const { data: dept } = useQuery({
    queryKey: ['department', deptId],
    queryFn: () => apiClient.get(`/departments/${deptId}`),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please select a file');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('deptId', deptId);
      if (tags) {
        tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => formData.append('tags[]', t));
      }
      return apiClient.upload('/documents', formData);
    },
    onSuccess: () => {
      setFile(null);
      setTitle('');
      setDescription('');
      setTags('');
      setError('');
    },
    onError: (err: any) => {
      setError(err.message || 'Upload failed, please try again');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError('');
    if (rejectedFiles.length > 0) {
      const reason = rejectedFiles[0]?.errors?.[0]?.message;
      setError(reason || 'File does not meet requirements');
      return;
    }
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      if (!title) {
        const name = acceptedFiles[0].name.replace(/\.[^.]+$/, '');
        setTitle(name);
      }
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    maxFiles: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please select a file to upload'); return; }
    if (!title.trim()) { setError('Please enter a document title'); return; }
    uploadMutation.mutate();
  };

  const isSuccess = uploadMutation.isSuccess;
  const isLoading = uploadMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Upload Document</h1>
        <p className="mt-1 text-sm text-gray-500">
          Department: {dept?.name || deptId} · Document will enter review queue after upload
        </p>
      </div>

      {isSuccess ? (
        <div className="rounded-xl bg-green-50 p-8 text-center ring-1 ring-green-200">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900">Upload Successful</h3>
          <p className="mt-1 text-sm text-gray-500">
            Document submitted, pending department admin review before entering the knowledge base
          </p>
          <button
            onClick={() => uploadMutation.reset()}
            className="mt-4 rounded-lg bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700"
          >
            Upload Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <File className="h-8 w-8 text-green-500" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive ? 'Drop to upload' : 'Drag and drop a file here, or click to select'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Supports {ALLOWED_TYPES.join(' / ')} · Max {MAX_SIZE_MB}MB
                </p>
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Document Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of document content"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tags (optional, comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. annual leave, attendance, policy"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading ? 'Uploading...' : 'Submit Document'}
          </button>
        </form>
      )}
    </div>
  );
}
