# Daymark API

The Express API uses MongoDB for users, tasks, and persistent login sessions.

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a random `SESSION_SECRET` of at least 32 characters.
2. Run `npm install` from the repository root.
3. Run `npm run dev` to start the API on port 5000 and the Vite client together.

The API implements the `/api/auth/*` and `/api/todos` routes consumed by the client. Task list filters are `status`, `priority`, `q`, and `sort`; task mutations are restricted to the signed-in user's records.