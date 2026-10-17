import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import "@lovable.dev/cloud-auth-js/styles.css";

export function ActivitySignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (signup && !data.session) setMessage("Check your email to confirm your account, then sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed. Try again."); }
    finally { setBusy(false); }
  }
  async function social(provider: "google" | "lovable") {
    setBusy(true); setMessage("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) setMessage(result.error.message);
    } catch { setMessage("Sign-in failed. Try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <h3 className="font-semibold">Sign in to your Garmin history</h3>
    <Button variant="outline" className="w-full" disabled={busy} onClick={() => social("google")}>Continue with Google</Button>
    <Button className="lovable-auth-button w-full" disabled={busy} onClick={() => social("lovable")}>Continue with Lovable</Button>
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">Email<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block text-sm">Password<input className="mt-1 w-full rounded-md border bg-background px-3 py-2" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
    </form>
    <Button variant="link" disabled={busy} onClick={() => {setSignup(!signup); setMessage("");}}>{signup ? "Already have an account? Sign in" : "Create an account"}</Button>
    <Button variant="link" disabled={busy || !email} onClick={async () => {
      setBusy(true);
      const {error} = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setMessage(error ? error.message : "Check your email for a password reset link."); setBusy(false);
    }}>Forgot password?</Button>
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </div>;
}