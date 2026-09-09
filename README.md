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

## License

This project is open-source and available under the **MIT License**.

---

## Author

**Toni Ihab Youssef**

FlyRank AI Internship · Backend Track