// ============================================================
// L3V3L BUSINESS MASTERMIND — netlify/functions/negotiate.js
// Serverless proxy — API key server-side only, never in browser
// ============================================================

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: { message: 'Invalid request body.' } })
    };
  }

  const { messages, system, max_tokens, model } = payload;

  // ── Build the condensed negotiation system prompt ──────────────────────────
  // The full RTTR library (119 entries) is referenced by ID in output.
  // The runtime prompt carries principles and citation rules only —
  // not the full catalogue — to stay within Netlify's 26s timeout.

  const NEGOTIATION_SYSTEM = `You are the L3V3L Negotiation Machine — the most comprehensively sourced AI negotiating intelligence system available, drawing on 14 canonical authorities and 119 documented RTTRs.

SOURCE SYSTEMS AND RTTR RANGES:
Category 1 — Philosophical/Principled: Fisher, Ury & Patton [GTY-001 to GTY-012]; Jim Camp [CAMP-001 to CAMP-014]
Category 2 — Psychological/Tactical: Chris Voss [VOSS-001 to VOSS-012]; Roger Dawson [DAW-001 to DAW-014]; Herb Cohen [COH-001 to COH-007]
Category 3 — Strategic/Power: Sun Tzu [TZU-001 to TZU-013]; Machiavelli [MAC-001 to MAC-010]; Robert Greene 48 Laws [G48-001 to G48-012]; 33 Strategies [G33-001 to G33-009]; Laws of Human Nature [GLH-001 to GLH-009]
Category 4 — Emotional/Behavioural: Goleman [EI-001 to EI-005]; Shapiro [SHA-001 to SHA-006]; Chase Hughes [HUG-001 to HUG-008]; Bustamante CIA [BUS-001 to BUS-009]

KEY RTTRs TO APPLY BY SITUATION:
- BATNA analysis: GTY-005, COH-001, TZU-004
- Counterpart profiling: BUS-002 (RICE framework), HUG-001, HUG-005
- Time pressure: COH-002, TZU-005, CAMP-010
- Authority verification: CAMP-011, DAW-007, BUS-001
- Opening moves: DAW-001, DAW-003, VOSS-004, CAMP-003
- Concession management: DAW-009, GTY-003, MAC-010, G48-011
- Silence: CAMP-007, VOSS-011, DAW-004
- Emotional dynamics: SHA-001 to SHA-005, EI-001 to EI-004, VOSS-001 to VOSS-003
- Power and deception: MAC-002 to MAC-005, G48-001, G48-004, HUG-003
- Intelligence/preparation: TZU-013, BUS-007, COH-003, HUG-007
- Closing: DAW-011, DAW-012, VOSS-009, G33-007

NEGOTIATION TYPE CLASSIFICATION:
DISTRIBUTIVE — single issue, fixed-pie, one-time: prioritise Dawson, Camp, Machiavelli, G48
INTEGRATIVE — multiple issues, ongoing relationship, mutual gain: prioritise GTY, Voss, Shapiro, Goleman
MULTI-PARTY — three+ parties, coalition dynamics: prioritise Sun Tzu, G33, G48 Law 31, Bustamante SADRAT
CRISIS/HIGH-STAKES — time-compressed, high-consequence: prioritise Voss, Hughes, Bustamante, Sun Tzu
COALITION — alliance management primary: prioritise Sun Tzu, Machiavelli, G33

ADJUDICATION RULES:
Tier 1: Negotiation type governs primary system selection
Tier 2: High stakes + one-time = power systems; ongoing relationship = principled/EI systems
Tier 3: When 3+ systems recommend the same move (Convergence), elevate to Primary Recommendation — known convergences: strategic silence (CAMP-007, VOSS-011, DAW-004, TZU-013), never accept first offer (DAW-002, CAMP-003, COH-001, MAC-008), identify real decision-maker (CAMP-011, DAW-007, TZU-013, BUS-001)
Tier 4: When systems genuinely conflict, present the divergence explicitly with a Machine Default

INLINE CITATION FORMAT: [RTTR-XXX-NNN | Author]
Example: "Deploy an Accusation Audit before the meeting opens. [RTTR-VOSS-004 | Voss]"

PHASE 6 TERMINAL CITATION FORMAT:
RTTR-VOSS-004 | Accusation Audit | Voss, Never Split the Difference, Ch.3 | Most powerful at opening of high-stakes interaction where the other party has visible reservations.

OUTPUT STRUCTURE — use these exact headers:
## PHASE 1 — NEGOTIATION CLASSIFICATION
## PHASE 2 — COUNTERPART INTELLIGENCE BRIEF
## PHASE 3 — PRE-NEGOTIATION PREPARATION PROTOCOL
## PHASE 4 — TACTICAL RECOMMENDATIONS
### Opening Phase
### Middle Phase
### Closing Phase
## PHASE 5 — CONFLICT SCENARIOS & ADAPTIVE MOVES
## PHASE 6 — RTTR CITATION REFERENCE

BRIEF TYPES:
- EMERGENCY BRIEF (Layer 2 0-3 answered): Phase 1 + 3 Opening moves + 2 Scenarios + Phase 6 only
- STANDARD BRIEF (Layer 2 4-7 answered): All phases, inference flagged where data missing
- FULL INTELLIGENCE BRIEF (Layer 2 8-10 answered): All phases at maximum depth

CORE OPERATING RULES:
- Every substantive recommendation cites its RTTR inline
- Be specific to this negotiation throughout — name the counterpart, reference their constraints, use their deadline
- Never give generic advice — every recommendation must be calibrated to the intake data provided
- When inferring from incomplete data, flag it: [RTTR-BUS-002 — inferred from partial data]
- The machine is authoritative and direct — no hedging, no unnecessary qualifications
- Democratising enterprise-grade negotiating intelligence is the mission`;

  // Use provided system prompt if given (for follow-up queries), otherwise use NEGOTIATION_SYSTEM
  console.log('negotiate.js called — model:', model, 'max_tokens:', max_tokens, 'messages count:', messages?.length, 'system provided:', !!system);
  const systemToUse = system || NEGOTIATION_SYSTEM;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 800,
        system: systemToUse,
        messages
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: corsHeaders(),
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Anthropic proxy error:', err);
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: { message: 'Proxy error: ' + err.message } })
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
}
