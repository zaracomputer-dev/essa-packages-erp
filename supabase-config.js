// Local fallback only. On Netlify, /.netlify/functions/supabase-config
// injects the production values from environment variables before this file loads.
// Keep only a public anon/publishable key here. Never use a service_role key.
window.EISSA_SUPABASE_CONFIG = window.EISSA_SUPABASE_CONFIG || {
  url: "",
  anonKey: ""
};
