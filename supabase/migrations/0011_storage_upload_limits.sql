-- 0011 — storage-level upload constraints for the wave file buckets.
--
-- Wave files now upload straight from the browser to Storage (Server Action
-- request bodies are capped at ~4.5 MB on Vercel, far below the 25 MB feature
-- ceiling), so the Server Actions no longer see the bytes. Enforce the 25 MB
-- ceiling (FR-011/FR-012a) and the allowed MIME types at the bucket so the
-- Storage API itself rejects oversized or out-of-policy uploads (defense in
-- depth — the existing RLS policies already confine WHO may write WHERE).

update storage.buckets
set
  file_size_limit = 26214400, -- 25 MB (MAX_FILE_BYTES)
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
where id = 'wave-materials';

update storage.buckets
set
  file_size_limit = 26214400, -- 25 MB (MAX_FILE_BYTES)
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'assignment-submissions';
