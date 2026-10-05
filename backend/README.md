# Backend image storage

Uploaded event photos are stored in Supabase Storage rather than on the
backend container's local filesystem. Create a bucket in Supabase and make it
public so the public event pages can load image URLs without exposing the
service-role key.

Set these environment variables on the backend service (for example, in
Render's environment settings):

- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_STORAGE_BUCKET`: the name of the public storage bucket.
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key.

Keep the service-role key only in the backend environment; never put it in the
Netlify frontend or source control. No Supabase configuration is needed in
Netlify. The backend uses the key to upload, list, and delete objects, and
returns public object URLs to the admin and event gallery pages.

Previously uploaded files in the backend's local `uploads/` directory are not
copied automatically. If any are still available, migrate them to the matching
category folders in the bucket before removing the old backend files.
