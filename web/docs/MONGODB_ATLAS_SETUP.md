# MongoDB Atlas Setup Guide for AI Campus Guardian

This guide details how team developers set up and configure the AI Campus Guardian Web Application to connect to the shared MongoDB Atlas cloud database.

---

## Prerequisites

Before starting, ensure you have:

1. Access to the team's MongoDB Atlas project.
2. A valid database user with read/write permissions for the `ai-campus-guardian` database.
3. Your current public IP address added to the MongoDB Atlas project IP Access List.
4. **Node.js** (v18 or higher recommended) installed locally.
5. The repository cloned to your local workstation.

---

## Setup Instructions

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repository-url>
   cd AI_Campus_Guardian_Web_app
   npm install
   ```

2. **Create local environment configuration**:
   In the root directory of the project, create a file named `.env.local` (or copy `.env.example` to `.env.local`).

3. **Configure your MongoDB Atlas Connection String**:
   In `.env.local`, set the `MONGODB_URI` variable:
   ```env
   MONGODB_URI=mongodb+srv://<database-user>:<database-password>@ai-campus-guardian.i494qhq.mongodb.net/ai-campus-guardian?retryWrites=true&w=majority&appName=AI-Campus-Guardian
   ```
   Replace `<database-user>` and `<database-password>` with your actual MongoDB Atlas database user credentials.

4. **Start the local development server**:
   ```bash
   npm run dev
   ```

---

## Network Access & Security

- **IP Whitelisting**: Ensure your IP address is whitelisted in Atlas under **Security → Network Access**. Avoid using `0.0.0.0/0` (allow access from anywhere) unless explicitly required and approved by the team lead.
- **Never Commit Credentials**: `.env.local` is ignored by Git (`.gitignore`). Never commit real credentials, passwords, or Atlas connection strings containing secrets to GitHub.
- **Dedicated Credentials**: Each developer should use their own database user credentials created within the team's Atlas project rather than sharing administrator credentials.

---

## Special Character Encoding in Passwords

If your MongoDB Atlas password contains special URI reserved characters such as:
`@`, `:`, `/`, `?`, `#`, `%`, `&`, `=`

You **must** URL-encode those characters before putting them in the connection string.
For example:
- `@` becomes `%40`
- `#` becomes `%23`
- `:` becomes `%3A`
- `/` becomes `%2F`

Example: If your password is `P@ss#123`, the connection string segment should be `P%40ss%23123`.

---

## Connection Verification

You can verify database connectivity by running the server and visiting:
`http://localhost:3000/api/health`

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```
