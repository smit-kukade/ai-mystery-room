# AI Mystery Room --- Product & Engineering Specification

**Document status:** Single Source of Truth (SSoT)\
**Version:** 1.0\
**Date:** 2026-10-25\
**Product name:** AI Mystery Room\
**Primary audience:** Codex / implementation agents, developers,
testers\
**Primary stack:** MERN (MongoDB, Express.js, React, Node.js)\
**AI provider:** Google Gemini\
**Document rule:** When implementation choices conflict with this
document, follow this document. If a required detail is genuinely
unspecified, use the defaults in this document and record any deviation
in the README.

------------------------------------------------------------------------

## 1. Product Summary

AI Mystery Room is a browser-based interactive mystery game. A user
submits a short scenario or story premise. The backend uses Gemini to
create a fictional investigation containing suspects, a culprit, a
coherent timeline, evidence, and a solution. The frontend presents the
investigation as a case file. The player reviews AI-generated
evidence---such as fictional chat transcripts, images, and simulated
CCTV stills/clips---and selects the person they believe is responsible.
The game then evaluates the answer and provides an explanation grounded
in the generated evidence.

The experience should feel like solving a mystery, not like reading a
story with the answer already obvious. Evidence must be internally
consistent, relevant, and sufficient to support one intended culprit.

### 1.1 Product goals

-   Turn a short user-provided premise into a playable mystery.
-   Provide a clear investigation flow: create case → inspect evidence →
    make accusation → see outcome.
-   Generate a coherent fictional case with one canonical culprit and an
    evidence-backed solution.
-   Make the interface immersive, readable, responsive, and accessible.
-   Keep Gemini credentials and all AI calls on the server.
-   Persist cases and player progress so a refresh does not erase an
    investigation.
-   Provide safe handling for user prompts and generated content.

### 1.2 Non-goals for MVP

-   Real-world investigations, real crime reporting, or claims about
    actual people.
-   Real WhatsApp integration, real surveillance footage, or access to a
    user's camera/microphone.
-   User-to-user chat, multiplayer, leaderboards, payments,
    subscriptions, or social sharing.
-   Generating actual video files. MVP may use generated still images
    and text-based CCTV logs / simulated frames. Video generation is a
    later optional capability.
-   Public case marketplace or user-created case publishing.
-   Training or fine-tuning a model.

### 1.3 Core product principles

1.  All cases and evidence are fictional and clearly labeled as
    AI-generated simulations.
2.  The backend owns the canonical answer; the frontend must never
    receive the culprit or solution before the player submits a guess.
3.  AI output is untrusted input. Validate and normalize it before
    saving or showing it.
4.  A case must be playable even if image generation fails; text
    evidence is the fallback.
5.  Every clue that matters to the solution must be represented in the
    evidence shown to the player.

------------------------------------------------------------------------

## 2. Users and Main User Journey

### 2.1 Target user

A person who wants to play a short, AI-generated detective mystery in a
browser.

### 2.2 Main journey

1.  Open the landing page.
2.  Enter a short premise, choose difficulty, and optionally choose a
    setting/theme.
3.  Submit the form.
4.  See a loading state while the backend generates and validates the
    case.
5.  Enter the case room and review the case summary, victim/incident,
    suspects, timeline, and evidence.
6.  Open evidence items in a detail viewer and compare clues.
7.  Select one suspect as the culprit and optionally enter a short
    explanation.
8.  Confirm the accusation.
9.  See correct/incorrect result, score, explanation, and evidence
    references supporting the canonical answer.
10. Restart, return to the case, or create a new mystery.

### 2.3 Required routes

-   `/` --- landing page and case creation form.
-   `/case/:caseId` --- investigation room.
-   `/case/:caseId/result` --- result page after accusation.
-   `*` --- not-found page.

Authentication is out of scope for MVP. Cases are accessed by
unguessable IDs and treated as private-by-link. Do not expose a public
list of all cases.

------------------------------------------------------------------------

## 3. Functional Requirements

### FR-01: Create a mystery

The user can submit: - `premise` (required, 30--1,000 characters) -
`difficulty` (required; `easy`, `medium`, `hard`; default `medium`) -
`theme` (optional; examples: locked-room, theft, disappearance,
sabotage, workplace, campus, historical, sci-fi) - `setting` (optional,
maximum 160 characters) - `evidencePreferences` (optional list; `chat`,
`image`, `cctv`, `documents`, `testimony`; default all supported types)

Validation: - Trim leading/trailing whitespace. - Reject empty prompts
and prompts over 1,000 characters. - Reject requests that ask for a real
person to be accused of a crime, real surveillance, impersonation, or
non-fictional evidence. - Show validation errors next to the relevant
field. - The server repeats all validation; client validation is not
sufficient.

### FR-02: Generate the case

The server sends a structured generation request to Gemini. The model
must return JSON conforming to the schema in Section 8. The backend
must: - Set a server-side timeout. - Validate output against a schema. -
Verify IDs and references are unique and valid. - Verify the culprit ID
refers to an existing suspect. - Verify the case contains at least 3
suspects and 5 evidence items. - Verify the solution cites existing
evidence IDs. - Retry once with a repair prompt if JSON/schema
validation fails. - If the second attempt fails, return a clear
recoverable error; do not save malformed content. - Save the canonical
solution separately from the player-visible case payload. - Return a
case ID and player-safe case data only.

### FR-03: Case content

Each playable case must include: - Title and short synopsis. - Incident
description, location, and incident time. - 3--6 suspects, each with a
public profile, motive, and alibi. - 5--10 evidence items across
available evidence types. - A timeline of 4--8 events. - A final
canonical culprit stored privately on the server. - A solution rationale
with evidence references stored privately on the server. - At least 2
meaningful clues that support the culprit and at least 1 clue that
weakens a plausible alternative. - No contradictory timestamps,
identities, or facts. - Difficulty-appropriate ambiguity: difficult
cases may require combining clues, but the intended answer must remain
defensible.

### FR-04: Evidence presentation

Evidence types: - `chat`: fictional chat transcript styled as a generic
messaging artifact. Do not use official WhatsApp branding or imply that
messages are authentic. - `image`: AI-generated fictional scene/object
image, or a clearly labeled text fallback if image generation is not
configured. - `cctv`: simulated CCTV still/frame with timestamp and
camera label, or a textual CCTV event log. Do not claim real video
exists if it does not. - `document`: fictional receipts, access logs,
notes, reports, or records. - `testimony`: fictional witness
statement/interview. - `timeline`: structured event entry.

Each evidence item contains a title, type, summary, detail, timestamp if
applicable, and `relevance`/metadata safe for players. Do not expose
hidden internal relevance labels that reveal the answer. Evidence detail
should be viewable in a modal or side panel.

### FR-05: Accuse a suspect

-   The player must select exactly one suspect.
-   The optional explanation field has a maximum of 500 characters.
-   The player must confirm before submitting.
-   A case can be accused once in MVP. Store the guess and result.
-   Repeated submission returns the existing result; it must not change
    the original guess.
-   The client must not decide whether the answer is correct.

### FR-06: Results and explanation

After an accusation, show: - Correct / incorrect outcome. - Selected
suspect and canonical culprit. - A concise solution explanation. -
Evidence references that support the answer. - Why the most plausible
alternative(s) are not the culprit. - A "Play another mystery" action
and "Review evidence" action.

The result endpoint may reveal the solution only after a guess has been
recorded. Do not include canonical culprit or solution fields in initial
generation responses, case reads, browser state, HTML, logs sent to the
client, or client-side source constants.

### FR-07: Persistence

-   Save cases, evidence metadata, canonical solution, and accusation
    result in MongoDB.
-   Refreshing `/case/:caseId` restores the investigation.
-   Case reads must return only player-safe fields unless an accusation
    has already been submitted.
-   Do not create a global public listing of cases.
-   MVP can use an unguessable MongoDB ObjectId or a separate
    cryptographically random public ID. Never rely on sequential IDs.

### FR-08: Error handling

Provide clear user-facing errors for: - Invalid prompt. - AI generation
timeout. - AI provider quota/rate limit. - Invalid model output after
retry. - Image generation unavailable. - Case not found or
expired/deleted. - Network/server error. - Duplicate accusation.

Errors must not expose stack traces, API keys, prompts containing
secrets, database connection strings, or raw provider internals.

------------------------------------------------------------------------

## 4. UX and Visual Design

### 4.1 Visual direction

Use a polished detective case-file aesthetic: dark charcoal/navy
background, warm off-white text, restrained amber accent, subtle
borders, evidence-card surfaces, and readable typography. Avoid
excessive neon, noisy animations, or a cluttered "hacker terminal" look.
The experience should feel premium and focused.

### 4.2 Shared layout

-   Responsive top navigation with product wordmark and "New Mystery"
    action.
-   Main content container with a comfortable maximum width.
-   Clear loading, empty, success, and error states.
-   Footer stating: "AI Mystery Room is fictional entertainment. All
    cases and evidence are simulated."

### 4.3 Landing page

Include: - Product name and one-sentence value proposition. - Short "How
it works" section with 3 steps. - Scenario textarea and character
counter. - Difficulty selector. - Theme selector and optional setting
input. - Evidence type preferences (optional, collapsed under "Customize
case"). - Primary "Create Mystery" button. - Small fictional-content
disclaimer. - Disable submit while a request is in progress; prevent
accidental duplicate requests.

### 4.4 Investigation room

Desktop layout: - Left/main area: case summary, incident facts,
timeline. - Right/sidebar: suspect cards and evidence index. - Evidence
details open in a modal/drawer. - Sticky accusation panel or clear
accusation section below evidence.

Mobile layout: - Single column. - Suspects and evidence use collapsible
sections/tabs. - Modal content fits viewport and can scroll. -
Accusation button remains easy to find without covering content.

Suspect card: - Name, age (fictional adult only), role, relationship to
incident, motive, alibi. - Do not display a "suspicion score" unless
explicitly introduced later; it may bias the player.

Evidence card: - Type icon/label, title, timestamp if available, short
summary, "Inspect evidence" control. - Use descriptive text labels, not
color alone, to distinguish types.

### 4.5 Result page

-   Strong correct/incorrect state without relying on color alone.
-   Culprit reveal and explanation.
-   Evidence citation list; clicking a citation reopens that evidence
    item.
-   Restart/new mystery actions.
-   Avoid revealing the answer through page title, URL, metadata,
    analytics events, or network payload before submission.

### 4.6 Accessibility

-   Semantic headings and buttons.
-   Keyboard-accessible forms, dialogs, tabs, and evidence viewer.
-   Visible focus states.
-   Appropriate text contrast.
-   Labels for all inputs.
-   `aria-live` region for generation status and errors.
-   Respect `prefers-reduced-motion`.
-   All generated images have useful alt text based on safe
    descriptions.

------------------------------------------------------------------------

## 5. Technical Architecture

### 5.1 Monorepo structure

Use one repository with `client` and `server` directories.

``` text
ai-mystery-room/
  client/
    src/
      api/
      assets/
      components/
      features/
        case-creation/
        investigation/
        results/
      hooks/
      layouts/
      pages/
      types/
      utils/
    public/
    package.json
    vite.config.ts
  server/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
        gemini/
        case-generation/
        evidence/
      validators/
      utils/
      app.ts
      server.ts
    package.json
  shared/
    schemas/
    types/
  .env.example
  .gitignore
  README.md
  package.json
```

Use TypeScript for both frontend and backend. If the repository already
exists with a different structure, inspect it first and adapt without
deleting unrelated work. Do not introduce a second architecture without
documenting why.

### 5.2 Frontend

-   React + TypeScript.
-   Vite for development/build.
-   React Router for routes.
-   Native `fetch` or a small typed API wrapper; do not add a large
    state-management library for MVP.
-   Use local component state for form and modal state.
-   Use a small shared type/schema package or duplicate only when
    necessary; avoid type drift.
-   Styling: CSS Modules or a consistent plain CSS design system. Do not
    add a UI framework unless the existing repo already uses one.
-   Never store Gemini API keys in frontend environment variables.
-   Never embed canonical solution data in the client bundle.

### 5.3 Backend

-   Node.js + Express + TypeScript.
-   Mongoose for MongoDB.
-   Zod for request and AI response validation.
-   Central error middleware.
-   Separate routes, controllers, services, models, and validators.
-   Gemini access must be isolated in `services/gemini`.
-   Case generation/orchestration must be isolated in
    `services/case-generation`.
-   Use structured logs with request IDs; do not log API keys or full
    sensitive environment values.
-   Configure CORS from an explicit allowlist.
-   Use JSON request-size limits and security headers.

### 5.4 Database

MongoDB is the source of truth for persisted cases and guesses. Do not
use browser local storage as the only persistence layer.

### 5.5 AI provider

Use Google Gemini via the current official Google Gen AI SDK for Node.js
and the supported structured-output/JSON mode where available. Pin a
stable SDK version in the lockfile and configure the model through an
environment variable so it can be changed without code edits. Do not
hard-code a model name across multiple files. Check the official current
SDK documentation when implementing because model IDs and SDK interfaces
can change.

Text generation and image generation are separate capabilities. Do not
assume that a text Gemini model automatically returns image files. For
MVP: - Generate case structure and text evidence with Gemini. - Support
image evidence through an optional image-generation adapter configured
separately. - If image generation is unavailable, provide a simulated
text artifact or placeholder image card clearly labeled as a
simulation. - Do not generate or present fake evidence as authentic
evidence from real people or real incidents.

------------------------------------------------------------------------

## 6. API Contract

Base path: `/api/v1`

### 6.1 `GET /api/v1/health`

Returns service status, not secrets.

``` json
{ "status": "ok" }
```

### 6.2 `POST /api/v1/cases`

Creates a new mystery. Request:

``` json
{
  "premise": "A valuable prototype vanished from a locked laboratory.",
  "difficulty": "medium",
  "theme": "locked-room",
  "setting": "A fictional research facility",
  "evidencePreferences": ["chat", "image", "cctv", "documents", "testimony"]
}
```

Success `201`:

``` json
{
  "case": {
    "id": "public-case-id",
    "title": "The Silent Prototype",
    "synopsis": "A prototype vanished from a locked laboratory.",
    "incident": {
      "description": "A fictional prototype disappeared overnight.",
      "location": "Research Lab 3",
      "occurredAt": "2026-10-24T21:30:00.000Z"
    },
    "suspects": [],
    "timeline": [],
    "evidence": [],
    "status": "investigating",
    "createdAt": "2026-10-25T10:00:00.000Z"
  }
}
```

The empty arrays above are illustrative. The actual response includes
validated player-visible objects. It must never include
`culpritSuspectId`, `solution`, private generation prompts, or internal
answer keys.

### 6.3 `GET /api/v1/cases/:caseId`

Returns player-safe case data. If a guess already exists, it may include
the player's result summary, but do not expose solution fields before a
guess.

### 6.4 `POST /api/v1/cases/:caseId/accusation`

Request:

``` json
{
  "suspectId": "suspect-id",
  "reasoning": "The access log conflicts with the suspect's stated alibi."
}
```

Success `200`:

``` json
{
  "result": {
    "correct": false,
    "selectedSuspectId": "suspect-id",
    "culprit": {
      "id": "culprit-id",
      "name": "Fictional Suspect"
    },
    "explanation": "The decisive clue was the access log...",
    "supportingEvidenceIds": ["evidence-1", "evidence-4"],
    "alternativeExplanation": "The other suspect's suspicious message was a red herring."
  }
}
```

The result shape is only returned after the accusation has been
persisted. Use `409` for a duplicate accusation only if no prior result
is returned; preferred behavior is to return the existing result
idempotently.

### 6.5 Error format

``` json
{
  "error": {
    "code": "CASE_GENERATION_FAILED",
    "message": "The mystery could not be created. Please try again.",
    "requestId": "request-id"
  }
}
```

### 6.6 HTTP status expectations

-   `200` success read/action.
-   `201` case created.
-   `400` malformed request/validation failure.
-   `404` unknown case.
-   `409` incompatible state or duplicate action if not handled
    idempotently.
-   `413` request too large.
-   `429` rate limit.
-   `502` AI provider invalid response or upstream failure.
-   `503` temporary service unavailability.
-   `500` unexpected server error.

------------------------------------------------------------------------

## 7. Data Model

### 7.1 Case document

Collection: `cases`

``` ts
type Difficulty = "easy" | "medium" | "hard";
type EvidenceType = "chat" | "image" | "cctv" | "document" | "testimony";

interface Suspect {
  id: string;
  name: string;
  age: number; // fictional adult, 18+
  role: string;
  relationshipToIncident: string;
  motive: string;
  alibi: string;
}

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  summary: string;
  detail: string;
  createdAt?: string;
  eventTime?: string;
  media?: {
    kind: "image" | "none";
    url?: string;
    altText?: string;
    isSimulated: true;
  };
  metadata?: Record<string, string>;
}

interface TimelineEvent {
  id: string;
  time: string;
  description: string;
  relatedEvidenceIds: string[];
}

interface CaseDocument {
  publicId: string;
  title: string;
  synopsis: string;
  premise: string;
  difficulty: Difficulty;
  theme?: string;
  incident: {
    description: string;
    location: string;
    occurredAt: string;
  };
  suspects: Suspect[];
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  solutionPrivate: {
    culpritSuspectId: string;
    explanation: string;
    supportingEvidenceIds: string[];
    alternativeExplanation: string;
    generationVersion: string;
  };
  accusation?: {
    suspectId: string;
    reasoning?: string;
    correct: boolean;
    submittedAt: Date;
  };
  status: "investigating" | "solved";
  createdAt: Date;
  expiresAt?: Date;
}
```

Implementation requirements: - Keep `solutionPrivate` server-only. Never
serialize the raw Mongoose document to the client. - Prefer explicit DTO
mapping (`toPlayerCaseDTO`) over removing private fields after
serialization. - Add indexes on `publicId` (unique), `createdAt`, and
`expiresAt` if TTL expiry is enabled. - Do not enable TTL expiry by
default until retention behavior is intentional and documented. -
Validate all incoming IDs and ensure `suspectId` belongs to the case. -
Store only fictional names and generated content; do not ask for or
store personal information.

### 7.2 Media storage

Do not store large base64 images in MongoDB. If image generation is
enabled, store files in object storage or a configured media provider
and persist only the URL and metadata. Validate file type and size. If
object storage is not configured, use a text fallback rather than saving
large binary payloads in MongoDB.

------------------------------------------------------------------------

## 8. Gemini Generation Contract

### 8.1 Generation behavior

Use a system instruction that establishes: - The case is fictional
entertainment. - The model must produce exactly one culprit. - All
suspects are fictional adults. - Evidence and timeline must be
internally consistent. - The culprit must be deducible from the visible
evidence. - At least two clues must support the culprit and one clue
must contradict a plausible alternative. - Red herrings are allowed but
must not make another suspect equally correct. - No real-person
allegations, real private information, real credentials, or real
surveillance data. - Output must be JSON matching the schema; no
markdown fences or prose outside JSON.

### 8.2 Canonical generation JSON

``` json
{
  "title": "string",
  "synopsis": "string",
  "incident": {
    "description": "string",
    "location": "string",
    "occurredAt": "ISO-8601 timestamp"
  },
  "suspects": [
    {
      "id": "suspect-1",
      "name": "fictional adult name",
      "age": 28,
      "role": "string",
      "relationshipToIncident": "string",
      "motive": "string",
      "alibi": "string"
    }
  ],
  "timeline": [
    {
      "id": "event-1",
      "time": "ISO-8601 timestamp",
      "description": "string",
      "relatedEvidenceIds": ["evidence-1"]
    }
  ],
  "evidence": [
    {
      "id": "evidence-1",
      "type": "chat",
      "title": "string",
      "summary": "string",
      "detail": "string",
      "eventTime": "ISO-8601 timestamp or null",
      "metadata": {}
    }
  ],
  "solution": {
    "culpritSuspectId": "suspect-2",
    "explanation": "string",
    "supportingEvidenceIds": ["evidence-1", "evidence-3"],
    "alternativeExplanation": "string"
  }
}
```

### 8.3 Server-side validation rules

-   3--6 suspects.
-   Every suspect ID is unique; every evidence ID and timeline ID is
    unique.
-   Suspect names are unique within a case.
-   5--10 evidence items.
-   4--8 timeline events.
-   Every timeline evidence reference exists.
-   `solution.culpritSuspectId` exists in `suspects`.
-   Every supporting evidence ID exists in `evidence`.
-   All timestamps parse as ISO-8601 and fit the case timeline
    logically.
-   Evidence types are from the allowlist.
-   Required strings are non-empty and bounded in length.
-   No HTML is trusted; render strings as text.
-   Optional media URLs must be from configured trusted storage domains.
-   Ensure the solution is not leaked through evidence metadata, IDs,
    titles, filenames, or client payloads.

### 8.4 Generation retry

-   Attempt 1: normal structured generation.
-   If schema validation fails: one repair attempt containing validation
    errors and the invalid JSON needed to correct it. Avoid unbounded
    retry loops.
-   If semantic checks fail, either run one targeted repair or fail
    safely.
-   Do not silently fabricate missing clues in the client.
-   Record generation model/version and validation outcome without
    logging secrets.

### 8.5 Quality checks

Before persistence, perform deterministic checks: - The culprit
exists. - The evidence supporting the solution is visible to the
player. - At least two supporting evidence items exist. - Evidence does
not directly state "X is the culprit" before the accusation. - A
suspect's alibi can be checked against timeline/evidence. - No
contradictory times or impossible event ordering. - A human-readable
explanation cites the same evidence IDs as the solution. - The visible
facts provide a rational route to one answer.

LLM generation cannot guarantee logical quality. Build the validator and
show the result of quality checks in server logs during development. If
validation fails after retry, return an error rather than delivering an
incoherent mystery.

------------------------------------------------------------------------

## 9. Security, Privacy, and Abuse Prevention

-   Store `GEMINI_API_KEY` only on the backend.
-   Store MongoDB URI only on the backend.
-   Use `.env` locally and platform secrets in deployment.
-   Commit `.env.example` with placeholder values only; `.env` must be
    ignored by Git.
-   Validate and bound all inputs.
-   Rate-limit case creation and accusation endpoints by IP/session to
    limit cost abuse. Set conservative configurable limits.
-   Apply request timeouts and AI token/output limits.
-   Set CORS to configured frontend origins only.
-   Use Helmet or equivalent security headers.
-   Do not expose stack traces or provider error bodies.
-   Do not store IP addresses longer than operationally necessary;
    document any retention.
-   Do not include real WhatsApp exports, real CCTV uploads, or
    real-person crime accusations in MVP.
-   Clearly label all generated evidence as fictional/simulated.
-   Sanitize or escape rendered content; never use
    `dangerouslySetInnerHTML` for model output.
-   Use a generic public case ID and do not expose MongoDB internal IDs
    if avoidable.
-   Ensure the solution is not sent in API responses until the
    accusation is saved.
-   Add abuse controls and a basic prompt-injection defense: user
    premises are content inputs, not instructions that override the
    system generation policy.

------------------------------------------------------------------------

## 10. Environment Configuration

Create `.env.example` with:

``` env
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/ai-mystery-room
GEMINI_API_KEY=
GEMINI_MODEL=
CASE_GENERATION_TIMEOUT_MS=45000
CASE_GENERATION_MAX_OUTPUT_TOKENS=8000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10
PUBLIC_CASE_ID_SECRET=
MEDIA_PROVIDER=
MEDIA_BASE_URL=
```

Rules: - `GEMINI_MODEL` must be set to a currently supported model in
the deployment environment. - If a required environment variable is
missing, fail fast at server startup with a clear configuration error
(without printing secret values). - Image/media variables are optional
for MVP. - Do not invent or commit real API keys.

------------------------------------------------------------------------

## 11. Testing Strategy

### 11.1 Unit tests

Test: - Prompt validation and trimming. - Difficulty/theme/evidence
preference validation. - AI JSON schema validation. - Semantic case
validation. - DTO mapping does not leak `solutionPrivate`. -
Correct/incorrect accusation evaluation. - Duplicate accusation
idempotency. - Evidence reference validation. - Error mapping and safe
error messages.

### 11.2 Integration tests

Test: - `POST /cases` with a mocked Gemini service. - Generation failure
and retry exhaustion. - `GET /cases/:id` hides solution. - Accusation
persists and returns result. - Unknown case returns 404. - Invalid
suspect ID returns 400. - Rate limiting works. - MongoDB failures return
safe errors.

### 11.3 Frontend tests

Test: - Case form validation. - Loading and error states. - Rendering
suspect and evidence cards. - Evidence modal keyboard interaction. -
Accusation confirmation. - Result display and evidence links. - Mobile
layout smoke test.

### 11.4 End-to-end acceptance tests

1.  User enters a valid premise and creates a case.
2.  The case page displays 3--6 suspects and 5--10 evidence items.
3.  Refreshing the page restores the same case.
4.  Initial API payload and browser state contain no culprit or
    solution.
5.  User submits a suspect ID that belongs to the case.
6.  The server persists the accusation and returns a result.
7.  Reloading the result page returns the same result without permitting
    a new guess.
8.  Invalid or oversized input is rejected.
9.  AI failure produces a useful retry message and does not create a
    broken case.
10. If image generation is unavailable, the case remains fully playable
    using text evidence.

------------------------------------------------------------------------

## 12. Performance and Reliability

-   Show progress feedback during generation; do not pretend the case is
    ready before it is validated and persisted.
-   Set a configurable server timeout for Gemini calls.
-   Avoid multiple simultaneous generation requests from double-clicks.
-   Use loading skeletons or simple status messaging, not endless
    spinners.
-   Set reasonable limits on generated content and response size.
-   Keep API handlers thin; long-running generation belongs in services.
-   For MVP, synchronous generation is acceptable if the timeout and
    error handling are implemented. If generation routinely exceeds the
    timeout, move to an asynchronous job model in a later version.
-   Avoid unnecessary polling and avoid storing duplicate media.
-   Add request IDs to logs to debug failed generations.

------------------------------------------------------------------------

## 13. Analytics and Logging

MVP does not require third-party analytics. Log only operational
events: - `case_generation_started` - `case_generation_succeeded` -
`case_generation_failed` - `accusation_submitted` - `validation_failed`

Log request ID, duration, result category, model identifier, and
validation status. Do not log API keys, complete environment variables,
or unnecessary user prompt contents. If prompts are logged for
development, make that behavior opt-in and remove it from production.

------------------------------------------------------------------------

## 14. Deployment

Recommended deployment shape: - React client on a static frontend
host. - Express API on a Node-compatible backend host. - MongoDB Atlas
or another managed MongoDB service. - Optional object storage for
generated images.

Deployment checklist: - Configure production environment variables. -
Restrict CORS to production client origin. - Ensure API key is a backend
secret. - Verify MongoDB network access and credentials. - Use HTTPS. -
Run production build and test suite. - Confirm health endpoint. -
Confirm errors do not expose secrets. - Test one complete case creation
and accusation in production. - Configure quotas/budgets/alerts for AI
provider usage where available.

------------------------------------------------------------------------

## 15. Definition of Done

MVP is complete only when: - The app runs locally using documented
commands. - A user can create a mystery from a premise. -
Gemini-generated output is validated before use. - The case has coherent
suspects, timeline, evidence, and a private canonical answer. - The user
can inspect evidence and accuse one suspect. - The server determines
correctness and reveals the answer only after accusation. - Cases and
results persist in MongoDB. - The site works on mobile and desktop. -
Loading, empty, and error states are implemented. - Basic security
controls and rate limits are enabled. - Automated tests cover key
backend rules and major user flows. - `.env.example` and README explain
setup, architecture, and limitations. - No secrets are committed. -
Generated media is clearly labeled as fictional/simulated.

------------------------------------------------------------------------

## 16. Implementation Plan for Codex

Implement in this order. Do not attempt the entire app in one unreviewed
code dump.

### Phase 0 --- Repository inspection

-   Inspect existing files, package managers, and conventions before
    editing.
-   Preserve useful existing work.
-   Summarize the discovered structure and any conflicts with this spec.
-   If no repository exists, create the monorepo described in Section
    5.1.

### Phase 1 --- Foundation

-   Set up TypeScript client and server.
-   Add linting/formatting and scripts.
-   Add environment validation, Express app, health route, MongoDB
    connection, central error handler.
-   Add `.env.example` and `.gitignore`.
-   Confirm client and server start independently.

### Phase 2 --- Data contracts

-   Implement shared types and Zod schemas.
-   Implement Mongoose case model.
-   Implement explicit player-safe DTO mapping.
-   Write tests proving private solution fields never leak.

### Phase 3 --- AI generation

-   Implement Gemini adapter.
-   Implement structured generation prompt.
-   Implement validation, semantic checks, one repair retry, timeout,
    and safe failure.
-   Use mocked AI output in tests; do not require live Gemini
    credentials for the test suite.

### Phase 4 --- API

-   Implement create case, read case, submit accusation endpoints.
-   Implement idempotent accusation behavior.
-   Add rate limiting and security middleware.
-   Test API contracts and failure cases.

### Phase 5 --- Frontend

-   Build landing page and creation form.
-   Build investigation room, suspect list, timeline, evidence index,
    evidence detail viewer.
-   Build accusation confirmation and result page.
-   Add responsive styling and accessibility.

### Phase 6 --- End-to-end validation

-   Run lint, typecheck, unit/integration tests, and production build.
-   Test with at least three different premises and all difficulty
    levels.
-   Inspect network responses to confirm no solution leak.
-   Fix broken references, contradictions, and layout defects.
-   Update README with actual commands and known limitations.

### Phase 7 --- Optional media

-   Only after text-first mystery flow is stable, add an
    image-generation adapter and storage.
-   Keep media provider separate from text generation.
-   Add text fallback for every media item.
-   Do not implement video generation in MVP unless explicitly approved
    as a scope change.

### Codex operating rules

-   Treat this file as the source of truth.
-   Do not silently expand scope.
-   Do not add authentication, payments, multiplayer, or video
    generation without approval.
-   Do not hard-code API secrets or the culprit in frontend code.
-   Do not remove validation or tests to make a failing build pass.
-   Prefer small, testable changes and run relevant checks after each
    phase.
-   If a requirement conflicts with the current repository, report the
    conflict and propose the smallest safe adaptation.
-   Update this spec when an approved product decision changes; do not
    let implementation and spec drift apart.

------------------------------------------------------------------------

## 17. Open Decisions and Defaults

These are intentionally decided for MVP unless the project owner
explicitly changes them: - **Authentication:** none. - **Persistence:**
MongoDB. - **Case access:** private-by-link using an unguessable ID; no
public listing. - **Number of guesses:** one. - **Case generation:**
synchronous request with timeout and one repair retry. - **Suspects:**
3--6 fictional adults. - **Evidence:** 5--10 items, text-first. -
**Images:** optional adapter; no dependency on image generation for
playability. - **Video:** not in MVP; use simulated CCTV stills or
logs. - **Difficulty:** easy, medium, hard. - **Frontend styling:**
custom CSS or CSS Modules. - **State management:** React local state
plus typed API functions. - **Testing:** unit/integration tests plus
core E2E flows. - **Retention:** no automatic deletion until retention
policy is explicitly selected. - **Deployment:** separate
frontend/backend with managed MongoDB is the default recommendation.

Any change to these defaults must be approved and reflected in this
document.

------------------------------------------------------------------------

## 18. Final Acceptance Checklist

-   [ ] Landing page clearly explains the game and fictional nature of
    evidence.
-   [ ] Prompt form validates and submits safely.
-   [ ] Server creates a valid, coherent case using Gemini.
-   [ ] Invalid AI output is retried once and then fails safely.
-   [ ] Case has 3--6 suspects, 5--10 evidence items, and 4--8 timeline
    events.
-   [ ] All evidence and timeline references are valid.
-   [ ] Culprit and solution remain private before accusation.
-   [ ] Player can inspect evidence and choose one suspect.
-   [ ] Server persists and evaluates the accusation.
-   [ ] Result explanation references real evidence items.
-   [ ] Refresh restores case/result.
-   [ ] Rate limiting, CORS, security headers, and input bounds are in
    place.
-   [ ] No secrets or real personal data are committed.
-   [ ] Text fallback works when media generation is unavailable.
-   [ ] Desktop/mobile and keyboard navigation work.
-   [ ] Tests, typecheck, lint, and production build pass.
-   [ ] README setup instructions are accurate.
