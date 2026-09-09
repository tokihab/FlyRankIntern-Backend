# FlyRank Task API

A persistent CRUD API for managing a to-do list, built with **Express.js** and **SQLite**. This project demonstrates the transition from volatile in-memory storage to persistent database-backed architecture. Originally built for the FlyRank AI Internship (Backend Track), it showcases API design, database integration, and interactive documentation.

---

## Features

* **Create** – Add a new task with a title and completion status, stored permanently in SQLite.
* **Read** – Retrieve all tasks or a single task by ID using parameterized SQL queries.
* **Update** – Modify the title or status of an existing task with SQL updates.
* **Delete** – Remove a task from the database by its ID.
* **Interactive API Documentation** – Swagger UI available at `/docs`.
* **Persistent Storage** – SQLite database (`tasks.db`) ensures data survives server restarts.
* **Automatic Setup** – Database and tables are created automatically on first run.
* **Example Seed Data** – Three initial tasks are inserted only on the first run.

---

## Prerequisites

* [Node.js](https://nodejs.org/) (v18 or v20 recommended; better-sqlite3 requires v20+)
* [npm](https://www.npmjs.com/) (comes with Node.js)
* Optional: [DB Browser for SQLite](https://sqlitebrowser.org/) for visual database inspection

---

## Installation & Setup

### 1. Clone the repository:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd flyrank-task-api
```

### 2. Install dependencies:

```bash
npm install
```

### 3. Start the server:

```bash
node index.js
```

The server will run on **http://localhost:3000**. On first run, the database file `tasks.db` will be created automatically along with the `tasks` table and three seed tasks.

---

## Database Architecture

### Why SQLite Was Chosen

* **Zero Configuration** – No separate database server to install or manage.
* **Single File Storage** – Entire database lives in one local file (`tasks.db`).
* **Persistence** – Data survives application restarts, unlike in-memory arrays.
* **Lightweight** – Minimal overhead, perfect for learning and prototyping.
* **Built-in** – No external dependencies beyond a single npm package (`better-sqlite3`).

### Database File

The `tasks.db` file is created automatically on first run. It is listed in `.gitignore` so each clean clone starts with a fresh database. When you restart the server, existing tasks remain in the database.

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL
);
```

The table has three columns:
* **id** – Auto-incrementing primary key (assigned by SQLite).
* **title** – Task description (required, not null).
* **done** – Boolean completion flag (0 = false, 1 = true).

---

## API Endpoints

| Operation | HTTP Method | Endpoint | Description |
|-----------|-------------|----------|-------------|
| Create | POST | `/tasks` | Add a new task |
| Read (All) | GET | `/tasks` | List all tasks |
| Read (One) | GET | `/tasks/:id` | Get task by ID |
| Update | PUT | `/tasks/:id` | Change task title or status |
| Delete | DELETE | `/tasks/:id` | Remove a task |

All endpoints return and accept JSON.

---

## Example Requests & Responses

### GET /tasks – List all tasks

**Request:**
```http
GET /tasks HTTP/1.1
Host: localhost:3000
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 104
Date: Wed, 09 Sep 2026 13:25:21 GMT
```

```json
[
  {
    "id": 1,
    "title": "Set up Express server",
    "done": true
  },
  {
    "id": 3,
    "title": "Publish to GitHub",
    "done": false
  }
]
```

### POST /tasks – Create a new task

**Request:**
```http
POST /tasks HTTP/1.1
Host: localhost:3000
Content-Type: application/json
```

```json
{
  "title": "Deploy to production"
}
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "id": 4,
  "title": "Deploy to production",
  "done": false
}
```

### PUT /tasks/:id – Update a task

**Request:**
```http
PUT /tasks/1 HTTP/1.1
Host: localhost:3000
Content-Type: application/json
```

```json
{
  "title": "Update Express server",
  "done": true
}
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "id": 1,
  "title": "Update Express server",
  "done": true
}
```

### DELETE /tasks/:id – Remove a task

**Request:**
```http
DELETE /tasks/2 HTTP/1.1
Host: localhost:3000
```

**Response:**
```http
HTTP/1.1 204 No Content
```

---

## Swagger UI Documentation

Interactive API documentation is automatically generated and available at:

```
http://localhost:3000/docs
```

You can explore all endpoints, view request/response schemas, and execute requests directly from the browser without needing tools like Postman or curl.

### Swagger UI Screenshot

![Swagger UI Screenshot](./swagger-screenshot.png)

---

## SQLite Exploration (Stage 4)

### Example SQL Query Executed

The following query was executed directly in a SQL database client to verify data integrity:

```sql
SELECT COUNT(*) FROM tasks;
```

**Result:** `3` (Three initial seed tasks confirmed in the database)

### Database Viewer Screenshot

![SQLite Database Screenshot](./sql-screenshot.png)

This screenshot shows the tasks table as viewed in DB Browser for SQLite, displaying all columns and rows from the persistent database.

---

## Technology Stack

* **Runtime:** Node.js (v20+)
* **Framework:** Express.js
* **Database Driver:** better-sqlite3 (Synchronous SQLite bindings)
* **Database:** SQLite (tasks.db)
* **Documentation:** Swagger UI (swagger-ui-express)
* **Language:** JavaScript (ES6)

---

## Project Structure

```
flyrank-task-api/
├── index.js                 # Main server file with SQLite bindings and endpoints
├── openapi.json            # Swagger/OpenAPI specification
├── package.json            # Project dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── .gitignore              # Ignores node_modules/ and tasks.db
├── README.md               # Project documentation
├── swagger-screenshot.png  # Screenshot of Swagger UI documentation
├── sql-screenshot.png      # Screenshot of SQLite database viewer (Stage 4 proof)
└── tasks.db                # SQLite database file (created automatically, git-ignored)
```

---

## How It Works

### Architecture

1. **Server starts** on port 3000 with Express.js
2. **Database connects** – SQLite file (`tasks.db`) is opened or created automatically
3. **Table setup** – `tasks` table is created if it doesn't exist
4. **Seeding** – Three example tasks are inserted only if the table is empty (count check ensures this happens once)
5. **CRUD operations** – Express routes execute parameterized SQL queries instead of modifying arrays
6. **Persistence** – All changes are written to disk immediately via SQLite
7. **JSON responses** – Query results are converted to JSON for the API client

### Key Differences from Assignment 1

| Aspect | Assignment 1 (In-Memory) | Assignment 2 (SQLite) |
|--------|-------------------------|------------------------|
| Storage | JavaScript array | SQLite database file |
| Data after restart | ❌ Lost | ✅ Persists |
| Setup time | Instant | Automatic (first run) |
| ID generation | Array index + 1 | SQLite AUTOINCREMENT |
| Query method | Array.find() / .map() | SQL SELECT/INSERT/UPDATE/DELETE |
| Scalability | Megabytes | Gigabytes |

### Important Note

Data is now **persistent** – tasks survive server restarts. The database file `tasks.db` is automatically created on first run and is git-ignored so each clone starts with fresh example data.

---

## Testing the API

### Method 1: Swagger UI (Interactive)

```
http://localhost:3000/docs
```

Click on any endpoint to expand, then press **Try it out** to send requests directly from the browser.

### Method 2: cURL (Command Line)

```bash
# Get all tasks
curl http://localhost:3000/tasks

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"New Task"}'

# Get a specific task
curl http://localhost:3000/tasks/1

# Update a task
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Task","done":true}'

# Delete a task
curl -X DELETE http://localhost:3000/tasks/1

# Get all tasks again (to verify persistence)
curl http://localhost:3000/tasks
```

### Method 3: DB Browser for SQLite (Direct Database Inspection)

Open `tasks.db` in DB Browser for SQLite to visually inspect the database contents, run custom SQL queries, and verify that changes made via the API are persisted to disk.

---

## Stages Completed

✅ **Stage 0** – Create SQLite database, tasks table, and seed data  
✅ **Stage 1** – Read from database using SELECT queries  
✅ **Stage 2** – Insert new tasks with POST /tasks  
✅ **Stage 3** – Update and delete tasks with PUT and DELETE  
✅ **Stage 4** – Explored SQLite with manual SQL queries (COUNT, WHERE, etc.)  
✅ **Stage 5** – Published to GitHub with documentation and screenshots  
✅ **Stage 6 (Bonus)** – AI vs Me code review and comparison  

---

## Contributing

This is a demo project, but contributions are welcome! Feel free to:

* Open an issue to report bugs or suggest features
* Submit a pull request to improve functionality or documentation
* Add optional extras (search with LIKE, filtering, sorting, timestamps, etc.)

---

## License

This project is open-source and available under the **MIT License**.

---

## Author

**Toni Ihab Youssef**

FlyRank AI Internship · Backend Track