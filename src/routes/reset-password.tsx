import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Recovery Tracker" }, {name: "description", content: "Reset your Recovery Tracker account password."}, {property: "og:title", content: "Reset password — Recovery Tracker"}, {property: "og:description", content: "Reset your Recovery Tracker account password."}, {property: "og:type", content: "website"}, {name: "twitter:card", content: "summary"}] }),
  component: ResetPassword,
});
function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="mx-auto max-w-md space-y-5 px-5 py-16"><h1 className="text-3xl font-bold">New password</h1><form className="space-y-4" onSubmit={async e => {e.preventDefault(); setBusy(true); const {error} = await supabase.auth.updateUser({password}); setMessage(error ? error.message : "Password updated."); setBusy(false);}}><label className="block">Password<input className="mt-2 w-full rounded-md border bg-background px-3 py-2" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label><Button disabled={busy}>Save password</Button></form><p role="status">{message}</p><Button asChild variant="link"><Link to="/">Back to recovery</Link></Button></main>;
}