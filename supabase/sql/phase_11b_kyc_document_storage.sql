-- Phase 11B: Secure KYC document storage (private bucket + RLS on storage.objects).
-- Depends on: phase_11a_kyc_foundation.sql, public.tc_is_admin().
-- Idempotent: safe to re-run.
--
-- MANUAL SETUP (Supabase Dashboard → Storage):
--   1. Create bucket named "kyc-documents".
--   2. Set bucket to PRIVATE (Public bucket = OFF).
--   3. Do NOT add any public or anonymous policies.
--   4. Run this SQL to attach authenticated + admin policies.
--
-- Object path convention: {auth.uid()}/{documentSlot}.{ext}
--   documentSlot: document_front | document_back | selfie
-- Store paths (not public URLs) in kyc_profiles.document_*_url columns.
-- Serve documents only via short-lived signed URLs from the client SDK.

-- ---------------------------------------------------------------------------
-- Storage policies (storage.objects)
-- ---------------------------------------------------------------------------

drop policy if exists "kyc_documents_insert_own" on storage.objects;
create policy "kyc_documents_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_documents_select_own" on storage.objects;
create policy "kyc_documents_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_documents_update_own" on storage.objects;
create policy "kyc_documents_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_documents_delete_own" on storage.objects;
create policy "kyc_documents_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_documents_select_admin" on storage.objects;
create policy "kyc_documents_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and public.tc_is_admin()
  );

drop policy if exists "kyc_documents_update_admin" on storage.objects;
create policy "kyc_documents_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'kyc-documents'
    and public.tc_is_admin()
  )
  with check (
    bucket_id = 'kyc-documents'
    and public.tc_is_admin()
  );
