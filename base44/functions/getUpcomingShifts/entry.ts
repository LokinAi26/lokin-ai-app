import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'calendar_sync', priority:55, estimatedMs:5000, realtime:false, background:true, tags:['provider','scheduled'] });

    // Shared Google Calendar connector (builder's account).
    // Throws when the connector isn't authorized yet — surface that to the UI.
    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    } catch {
      return Response.json({ connected: false, events: [] });
    }
    if (!connection || !connection.accessToken) {
      return Response.json({ connected: false, events: [] });
    }

    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`
      + `?timeMin=${encodeURIComponent(timeMin)}&maxResults=10&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    if (!res.ok) {
      return Response.json({ connected: false, events: [], error: `calendar_api_${res.status}` });
    }
    const data = await res.json();

    const events = (data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || 'Untitled',
      start: e.start?.dateTime || e.start?.date || null,
      end: e.end?.dateTime || e.end?.date || null,
      allDay: !e.start?.dateTime,
      location: e.location || '',
    }));

    return Response.json({ connected: true, events });
  } catch (error) {
    return Response.json({ connected: false, events: [], error: error.message }, { status: 500 });
  }
}