import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}
    const mood = (body.mood || "need a push").trim();

    const res = await invokeLLMWithAdmission(base44, {
      prompt: `You are LOKIN, a high-energy motivation coach for a gig-economy driver, trucker, or traveler about to start their next shift. They just told you how they feel right now: "${mood}". Give ONE short (2-4 sentences), raw, inspiring pep talk to regroup and lock back in. Speak directly to them like a coach in the locker room. No emojis, no quotation marks, no hashtags — just the talk.`,
    });

    return Response.json({ message: typeof res === "string" ? res : res?.message || "You've got this. Lock in and go make that money." });
  } catch (error) {
    console.error("motivationCoach error:", error);
    return Response.json({ message: "You've got this. Take a breath, reset, and go make that money. Lock in." });
  }
}