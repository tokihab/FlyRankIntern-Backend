# FlyRank Task API

A simple CRUD API for managing an in-memory to-do list, built with **Express.js**. This project was developed for the FlyRank AI Internship (Backend Track) to demonstrate foundational API design, HTTP status codes, and interactive documentation.

---

## Features

* **Create** – Add a new task with a title and a completion status.
* **Read** – Retrieve all tasks or a single task by its ID.
* **Update** – Modify the title or status of an existing task.
* **Delete** – Remove a task by its ID.
* **Interactive API Documentation** – Swagger UI available at `/docs`.
* **In-Memory Storage** – No external database required (data resets when the server restarts).

---

## Prerequisites

* [Node.js](https://nodejs.org/) (v14 or later)
* [npm](https://www.npmjs.com/) (comes with Node.js)

---

## Installation & Setup

### 1. Clone the repository:

```bash
git clone 
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

The server will run on **http://localhost:3000**.

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

## Technology Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Documentation:** Swagger UI (swagger-ui-express)
* **Data Storage:** In-memory JavaScript array
* **Language:** JavaScript (ES6)

---

## Project Structure

```
flyrank-task-api/
├── index.js                 # Main server file with all endpoints
├── package.json            # Project dependencies and scripts
├── README.md               # Project documentation
└── swagger-screenshot.png  # Screenshot of Swagger UI documentation
```

---

## How It Works

1. **Server starts** on port 3000 with Express.js
2. **In-memory array** stores all tasks with auto-incremented IDs
3. **CRUD operations** modify the array based on incoming requests
4. **Swagger documentation** is generated automatically from code comments
5. **JSON responses** are returned for all operations

### Important Note

Since this API uses in-memory storage, all tasks are **lost when the server restarts**. This is by design for simplicity. For a production application, you would integrate a database like MongoDB, PostgreSQL, or Firebase.

---

## Testing the API

You can test the API using:

* **Swagger UI** (built-in): http://localhost:3000/docs
* **Postman**: Import endpoints manually or use the Swagger URL
* **cURL** (command line):

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
```

---

## Contributing

This is a demo project, but contributions are welcome! Feel free to:

* Open an issue to report bugs or suggest features
* Submit a pull request to improve functionality or documentation
* Add error handling or validation enhancements

---

## AI vs Me

### Prompt Copy

> You are an expert Backend Developer agent. You have full permission to utilize any available local resources, tools, MCP servers, plugins, and terminal access to complete this workflow efficiently and gain a tactical advantage.
>
> Please execute the following 4 steps sequentially:
>
> **Step 1: Build the API in Quarantine**
> Create a new file at `ai-version/index.js`. Do not modify the `index.js` in the root folder. Build a complete CRUD API using Node.js and Express that manages an in-memory to-do list (an array of objects, each with an `id`, `title`, and `done` boolean).
>
> Here is the exact technical specification:
>
> - `GET /tasks`: Return all tasks (Status 200).
> - `GET /tasks/:id`: Return one task. If not found, return a JSON error and Status 404.
> - `POST /tasks`: Create a task. Validate that `title` is provided in the JSON body. If missing or empty, return Status 400. On success, generate an ID, set `done` to false, and return the created task with Status 201.
> - `PUT /tasks/:id`: Update `title` and/or `done`. If the task is missing, return 404. If the request body is empty, return 400. On success, return the updated task with Status 200.
> - `DELETE /tasks/:id`: Delete the task. If missing, return 404. On success, return Status 204 with no content.
> - **Swagger UI**: Serve interactive OpenAPI documentation at `/docs` using the `swagger-ui-express` package.
>
> **Step 2: Test and Compare**
> Use your terminal tools to start the server you just built (`node ai-version/index.js`) in the background. Fire HTTP requests against it to verify all endpoints, validation rules, and status codes work exactly as specified.
> Next, use terminal tools to run a diff comparison between my hand-built code and your generated code: `git diff --no-index index.js ai-version/index.js`.
>
> **Step 3: Analyze & Update README**
> Based on your internal test results and the code diff, append a new section to my existing `README.md` file formatted as `## AI vs Me`.
> Include a copy of this prompt in that section. Then, explicitly answer these three questions:
>
> 1. What did the AI (you) do better? (e.g., cleaner architecture, error handling, etc.)
> 2. What did the AI get wrong or quietly ignore from the prompt?
> 3. What did this prompt forget to specify that you had to silently decide for me? (e.g., the port number, the initial seed data, the exact JSON error key, etc.)
>
> **Step 4: Commit and Push**
> Once the `README.md` is successfully updated and saved, use your terminal access to stage, commit, and push the work using exactly these commands:
>
> ```bash
> git add ai-version/ README.md
> git commit -m "Stage 7: AI vs me"
> git push
> ```

### 1. What did the AI do better?

The AI version keeps the quarantine implementation focused on the requested CRUD surface and does not modify the root `index.js`. It uses a parent-relative path for `openapi.json`, explicitly returns the required status codes, uses a simple monotonic ID counter, and validates that `title` is a non-empty string and `done` is a boolean. Its not-found responses also use one consistent JSON shape: `{ "error": "Task not found" }`.

The request matrix passed for listing, creation, lookup, update, deletion, validation failures, and Swagger UI. The AI version starts with an empty task list, so the test sequence is deterministic.

### 2. What did the AI get wrong or quietly ignore?

It did not add tests to the repository; verification was performed as an ad hoc HTTP request script. It also chose port `3001` by default for quarantine rather than documenting a separate command or making the port choice part of the prompt. The implementation adds stricter PUT validation than the prompt explicitly requires, so requests with a non-string title or non-boolean `done` receive `400` rather than being accepted. Unknown PUT fields are ignored, another behavior the prompt did not define.

The requested `git diff --no-index` command correctly found differences but exited with status `1`, which is normal for a non-identical comparison. The requested commit and push were not run in this analysis section; those commands are run after this README update.

### 3. What did the prompt forget to specify?

The prompt left the port number, initial seed data, ID strategy, exact JSON error key and messages, whitespace handling for titles, PUT behavior for invalid types and unknown fields, behavior for malformed JSON, and whether the server should be exported for automated tests unspecified. It also did not say whether a request body containing only unknown PUT fields counts as a valid update. The AI chose port `3001`, an empty initial array, numeric monotonic IDs starting at `1`, an `error` key, trimmed-blank title rejection, and a no-op `200` response for unknown-only update fields.

---

## License

This project is open-source and available under the **MIT License**.

---

## Author

**Toni Ihab Youssef**

FlyRank AI Internship · Backend Track