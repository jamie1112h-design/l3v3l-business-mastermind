// ============================================================
// QuVivant Business Clarity — netlify/functions/negotiate.js (v4)
// Serverless proxy for the Negotiation instrument.
// The Anthropic key and every prompt stay server-side. The browser supplies only
// a mode, the user's access token, and the conversation messages. It cannot choose
// the system prompt, the model, or the token limit, and requests without a valid
// access token or from an unlisted origin are refused.
// ============================================================

const ALLOWED_ORIGINS = [
  'https://quvivant.com',
  'https://www.quvivant.com',
  'https://monumental-sopapillas-d1862e.netlify.app'
];
const VALIDATE_URL = 'https://wljxufilyobwpbavvwsr.supabase.co/functions/v1/bm-trial-validate';
const MODEL = 'claude-sonnet-5';

// Request limits
const MAX_MESSAGES      = 40;
const MAX_MESSAGE_CHARS = 40000;
const MAX_TOTAL_CHARS   = 100000;

// ── Layer 2 intake architect prompt (moved here from the page) ───────────────
const LAYER2_SYSTEM = `You are the QuVivant Business Clarity Negotiation Instrument's intake architect. Your role is to classify a negotiation from Layer 1 answers and generate exactly 10 targeted Layer 2 questions.

NEGOTIATION TYPES:
- DISTRIBUTIVE: single issue, fixed-pie, one-time, price/quantity focus
- INTEGRATIVE: multiple issues, mutual gain possible, ongoing relationship
- MULTI-PARTY: three or more parties, coalition dynamics, shifting alliances
- CRISIS/HIGH-STAKES: time-compressed, high-consequence, breakdown is costly
- COALITION: outcome depends on alliance management as much as substance

LAYER 2 QUESTION DOMAINS BY TYPE:
- DISTRIBUTIVE: anchor strategy, concession sequencing, reservation price, higher authority exposure, written authority available, nibble risk, competitive alternatives
- INTEGRATIVE: underlying interests vs stated positions, shared gains available, objective criteria, relationship history, Five Core Concerns active, emotional dynamics, post-deal relationship
- MULTI-PARTY: full stakeholder map, each party's real interests, existing alliances, information asymmetry between parties, unseen influencers, coalition formation risk
- CRISIS/HIGH-STAKES: their primary fear in breakdown, emotional state and volatility, prior behaviour under pressure, information withheld, Black Swan candidates, face-saving options
- COALITION: alliance architecture, loyalty and defection risk, shared enemy or objective, sequencing of approaches, regime change risk

RULES FOR QUESTION GENERATION:
1. Never repeat ground covered in Layer 1
2. Always deepen, never restate
3. Follow signals in L1-06 (the open intelligence field) — if it flags complexity, pursue it
4. Generate exactly 10 questions
5. Assign each question a tier: CRITICAL (the instrument cannot produce a full brief without it) or IMPORTANT (significantly improves brief quality)
6. First 4 questions should always be CRITICAL

OUTPUT FORMAT — respond with valid JSON only, no markdown, no preamble:
{
  "negotiationType": "DISTRIBUTIVE|INTEGRATIVE|MULTI-PARTY|CRISIS/HIGH-STAKES|COALITION",
  "classificationReason": "2-3 sentence explanation of why this classification applies",
  "layer2Headline": "Short headline for the Layer 2 intake screen (e.g. 'Mapping the Counterpart's Architecture')",
  "layer2Desc": "One sentence description of what Layer 2 will establish",
  "questions": [
    {
      "id": "l2q1",
      "tier": "CRITICAL",
      "text": "Full question text",
      "placeholder": "Helpful example answer placeholder"
    }
  ]
}`;

// ── Negotiation brief and follow-up prompt ───────────────────────────────────
// The full RTTR library (119 entries) is referenced by ID in output.
// The runtime prompt carries principles and citation rules only,
// not the full catalogue, to stay within Netlify's 26s timeout.
const NEGOTIATION_SYSTEM = `You are the QuVivant Negotiation Instrument — the most comprehensively sourced AI negotiating intelligence system available, drawing on 14 canonical authorities and 119 documented RTTRs.

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

NEGOTIATION TYPE CLASSIFICATION (a starting guide, not a limit: draw on any system that serves this negotiation):
DISTRIBUTIVE — single issue, fixed-pie, one-time: often useful — Dawson, Camp, Machiavelli, G48
INTEGRATIVE — multiple issues, ongoing relationship, mutual gain: often useful — GTY, Voss, Shapiro, Goleman
MULTI-PARTY — three+ parties, coalition dynamics: often useful — Sun Tzu, G33, G48 Law 31, Bustamante SADRAT
CRISIS/HIGH-STAKES — time-compressed, high-consequence: often useful — Voss, Hughes, Bustamante, Sun Tzu
COALITION — alliance management primary: often useful — Sun Tzu, Machiavelli, G33

ADJUDICATION RULES:
Tier 1: Negotiation type guides primary system selection
Tier 2: High stakes + one-time = power systems; ongoing relationship = principled/EI systems
Tier 3: When 3+ systems recommend the same move (Convergence), elevate to Primary Recommendation — known convergences: strategic silence (CAMP-007, VOSS-011, DAW-004, TZU-013), never accept first offer (DAW-002, CAMP-003, COH-001, MAC-008), identify real decision-maker (CAMP-011, DAW-007, TZU-013, BUS-001)
Tier 4: When systems genuinely conflict, present the divergence explicitly with an Instrument Default

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
- The instrument is authoritative and direct — no hedging, no unnecessary qualifications
- Democratising enterprise-grade negotiating intelligence is the mission`;

// ── Modes: the only three things this endpoint will do ───────────────────────
const MODES = {
  layer2:   { max_tokens: 2000, system: LAYER2_SYSTEM },
  brief:    { max_tokens: 4000, system: NEGOTIATION_SYSTEM },
  followup: { max_tokens: 1500, system: NEGOTIATION_SYSTEM }
};

exports.handler = async (event) => {
  const origin   = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const originOk = !origin || ALLOWED_ORIGINS.includes(origin);
  const cors     = corsHeaders(origin && originOk ? origin : ALLOWED_ORIGINS[0]);

  if (event.httpMethod === 'OPTIONS') {
    if (!originOk) return { statusCode: 403, headers: cors, body: '' };
    return {
      statusCode: 200,
      headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }
  if (!originOk) return fail(403, 'Origin not allowed.', cors);

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return fail(400, 'Invalid request body.', cors);
  }

  // The caller's system prompt, model, and max_tokens are deliberately ignored.
  const { mode, token, messages } = payload || {};
  const cfg = Object.prototype.hasOwnProperty.call(MODES, mode) ? MODES[mode] : null;
  if (!cfg) return fail(400, 'Unknown mode.', cors);
  if (!validMessages(messages)) return fail(400, 'Invalid messages.', cors);
  if (!(await tokenIsValid(token))) return fail(401, 'A valid access token is required.', cors);

  console.log('negotiate.js called — mode:', mode, 'messages:', messages.length);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: cfg.max_tokens,
        thinking: { type: 'disabled' },
        system: cfg.system,
        messages
      })
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: cors,
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Anthropic proxy error:', err);
    return fail(502, 'Proxy error: ' + err.message, cors);
  }
};

// A token is accepted if the trial service recognises it. It does not have to have sessions left:
// the last session is consumed before the brief and follow-ups are requested.
async function tokenIsValid(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) return false;
  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, peek: true })
    });
    const d = await res.json();
    return typeof d.uses_remaining === 'number' || d.status === 'subscribed' || d.error === 'trial_exhausted';
  } catch (err) {
    console.error('Token check failed:', err.message);
    return false;
  }
}

function validMessages(m) {
  if (!Array.isArray(m) || m.length === 0 || m.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const x of m) {
    if (!x || (x.role !== 'user' && x.role !== 'assistant')) return false;
    if (typeof x.content !== 'string' || x.content.length === 0 || x.content.length > MAX_MESSAGE_CHARS) return false;
    total += x.content.length;
  }
  return total <= MAX_TOTAL_CHARS && m[0].role === 'user' && m[m.length - 1].role === 'user';
}

function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin'
  };
}

function fail(status, message, cors) {
  return { statusCode: status, headers: cors, body: JSON.stringify({ error: { message } }) };
}
