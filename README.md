# ApplyTrack — Job Application Tracker

Beginner-friendly full-stack app built with HTML, CSS, JavaScript, Node.js, Express, MongoDB, Mongoose, and Multer.

## Features
- Dashboard counts for total applications, in-progress applications, interviews, and offers
- Create, read, update, and delete applications
- Search by company, role, or location; filter by status
- Interview and follow-up reminders for the next 30 days (shown in the dashboard; these are not push/email notifications)
- Attach PDF, DOC, or DOCX resumes up to 5 MB
- Resume files are stored in a local `uploads/` folder, outside the public static folder

## Requirements
- Node.js 18+ recommended
- MongoDB running locally OR a MongoDB Atlas connection string

## Setup
1. Open this folder in VS Code.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`.
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
4. Make sure MongoDB is running locally, or replace `MONGODB_URI` in `.env` with your Atlas connection string.
5. Start the app:
   ```bash
   npm start
   ```
6. Open http://localhost:3000

## MongoDB Atlas notes
Create a database user and a database, add your current IP address to Atlas Network Access, then put the connection string in `.env`. Replace `<db_password>` in the URI with your real password. Do not share or commit `.env`.

## API endpoints
- `GET /api/health`
- `GET /api/applications?status=Interview&search=Google`
- `GET /api/applications/:id`
- `POST /api/applications`
- `PUT /api/applications/:id`
- `DELETE /api/applications/:id`
- `POST /api/applications/:id/resume` (multipart form field: `resume`)
- `GET /api/applications/:id/resume`

## Important
This starter is a local single-user project and does not include authentication. Do not deploy it publicly as-is: add authentication, per-user data ownership, CSRF/security protections, rate limiting, and stronger upload validation before production use.
