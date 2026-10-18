import { createFileRoute } from '@tanstack/react-router';
import { matchesIngestToken } from '@/lib/garmin-ingest';
export const Route = createFileRoute('/api/public/evaluate-garmin')({ server: { handlers: {
  POST: async ({ request }) => {
    const secret = process.env['INGEST_TOKEN'];
    if (!secret || !await matchesIngestToken(request.headers.get('x-ingest-token'), secret)) return Response.json({error:'Unauthorized'}, {status:401});
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({error:'Invalid JSON'}, {status:400}); }
    const date = typeof body === 'object' && body !== null && 'for_date' in body ? body.for_date : null;
    const today = new Date().toISOString().slice(0,10);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Math.abs(Date.parse(date)-Date.parse(today)) > 86400000) return Response.json({error:'Current Garmin calendar date required'}, {status:400});
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { captureRecommendations } = await import('@/lib/evaluation.server');
      // Same single owner as the unchanged Garmin SELECT policies; never accept a user ID from the caller.
      const result = await captureRecommendations(supabaseAdmin, supabaseAdmin, '4c0524d5-9621-4a12-92b1-8320d8ab5622', date, true);
      return Response.json({logged:result.logs.length});
    } catch { return Response.json({error:'Evaluation capture failed; retry safely'}, {status:500}); }
  }
} } });