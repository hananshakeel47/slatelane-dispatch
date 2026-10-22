# SlateLane Carrier Client Portal

## Scope

The carrier portal is part of the existing SlateLane Dispatch Next.js application. It does not use a separate file-sharing website. Client uploads are stored in the private `carrier-document-vault` Supabase Storage bucket and are connected to `carrier_document_records`, so the existing CRM document vault remains the internal review workspace.

## Client flow

1. An admin opens **Admin → Client Portal Access** and enables access for an existing carrier onboarding. The authorized address is the onboarding's current primary contact email.
2. The carrier opens `/carrier/portal/login` and requests a one-time email code.
3. Codes expire after 10 minutes, are single-use, and are limited to five verification attempts. Requests are rate-limited by a keyed hash of email and client IP.
4. Successful verification creates a random server-side session. The browser receives only an HttpOnly, Secure-in-production, SameSite=Lax cookie; the database stores a keyed hash of the session token.
5. The carrier can see only onboarding records associated with the session email, upload approved PDF document types, download their own submitted documents through five-minute signed links, and view review status.
6. Admins can revoke access at any time. Revocation is checked on every portal API request.

## File handling

- Private storage bucket; no public file URLs and no direct public read policies.
- Signed upload tokens are scoped to one generated object path. A server-side upload intent ties that path to the authenticated email and onboarding.
- PDFs are limited to 15 MB, the actual uploaded object size is checked, and the PDF header is validated before a document record is created.
- File names are sanitized. SHA-256 is stored with the document record.
- Uploads, downloads, sign-ins, and access changes are tracked in portal audit events.
- Admin access remains behind the existing Basic Auth proxy.

## Required environment

Production already uses the existing `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` variables. The Preview environment currently has the isolated Supabase credentials but does not have Preview-scoped `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; email-code login cannot be end-to-end tested in Preview until a Preview-appropriate sender key/address is configured. Do not copy a production email API key into Preview solely for testing.

The Preview environment also does not have Preview-scoped `SLATELANE_ADMIN_USER` and `SLATELANE_ADMIN_PASSWORD`. The existing proxy correctly fails closed when those are absent, so the admin portal page cannot be opened in Preview until separate Preview-only credentials are set.

## Database

- `20261023000000_carrier_client_portal.sql`: carrier portal access, login challenges, sessions, audit events, private bucket settings, and document type additions.
- `20261023000001_carrier_portal_upload_intents.sql`: scoped upload intents for direct-to-private-storage uploads.

These migrations have been applied to the isolated `slatelane-preview` Supabase project only. Production schema, storage, settings, and outreach were not changed during this implementation.
