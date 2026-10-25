# AI Mystery Room

A fictional, text-first detective mystery game built with React, TypeScript, Express, MongoDB, and Google Gemini. The server owns the canonical solution and reveals it only after the player submits an accusation.

## Requirements

- Node.js 22 or newer and npm
- MongoDB running locally or a MongoDB connection string
- A Google Gemini API key for case generation

## Run locally

1. Copy `.env.example` to `.env` in the repository root.
2. Set `MONGODB_URI` and `GEMINI_API_KEY`. `GEMINI_MODEL` defaults to `gemini-3.8-flash` and can be changed in `.env`.
3. Install and build shared contracts: `npm install` then `npm run build`.
4. Start client and API: `npm run dev`.
5. Open `http://localhost:5173`. The API health endpoint is `http://localhost:4000/api/v1/health`.

The client proxies `/api` requests to the API. The backend refuses to start without MongoDB. When AI generation is not configured, the API returns a safe setup error. Image evidence is represented with a clearly labeled text simulation; image generation and video are out of MVP scope.

## Architecture

- `client/`: responsive React/Vite interface and typed route flows.
- `server/`: Express API, MongoDB model, generation adapter, validation, and explicit player DTO mapping.
- `shared/`: Zod request and generation schemas shared by client and server.

No authentication or public case listing is included. Case links use cryptographically random IDs. Cases are retained indefinitely until a retention policy is selected. Generation is synchronous with a bounded timeout and one schema/semantic repair attempt.

## API

- `GET /api/v1/health`
- `POST /api/v1/cases`
- `GET /api/v1/cases/:caseId`
- `POST /api/v1/cases/:caseId/accusation`

All generated evidence is fictional and simulated. The Gemini adapter uses the official Google GenAI SDK structured JSON response format.
