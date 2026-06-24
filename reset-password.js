function normalizeSupabaseUrl(url) {
  const value = String(url || "").trim().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value) ? value : "";
}

function initPasswordResetClient() {
  const config = window.EISSA_SUPABASE_CONFIG || {};
  const url = normalizeSupabaseUrl(config.url);
  const anonKey = String(config.anonKey || "").trim();

  if (!url || !anonKey || !window.supabase) return null;

  return window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

const statusBox = document.querySelector("#resetStatus");
const form = document.querySelector("#resetPasswordForm");
const client = initPasswordResetClient();

async function finishRecoverySession() {
  if (!client) {
    statusBox.textContent = "Password reset is not configured on this deployment.";
    form.querySelector("button").disabled = true;
    return;
  }

  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      statusBox.textContent = `Password reset link is invalid or expired: ${error.message}`;
      form.querySelector("button").disabled = true;
    }
  }
}

finishRecoverySession();

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!client) {
    statusBox.textContent = "Password reset is not configured on this deployment.";
    return;
  }

  const data = formData(form);
  const password = String(data.password || "");
  const confirmPassword = String(data.confirmPassword || "");

  if (password.length < 6) {
    statusBox.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirmPassword) {
    statusBox.textContent = "Passwords do not match.";
    return;
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    statusBox.textContent = `Password update failed: ${error.message}`;
    return;
  }

  statusBox.textContent = "Password updated. You can now log in with your new password.";
  await client.auth.signOut();
  setTimeout(() => {
    window.location.href = "/";
  }, 1800);
});
