## Simple Web DB Editor

A lightweight web-based database editor for PostgreSQL and MongoDB.

### Prerequisites

* **Operating System**: Linux or Windows with [WSL](https://learn.microsoft.com/windows/wsl/install).
* **Package Manager** (e.g., `apt`, `dnf`, `brew`).
* **Node.js** (v14+ recommended).

### Install Dependencies

1. **Install PostgreSQL client (`psql`) and MongoDB shell (`mongosh`):**

   ```sh
   # Debian/Ubuntu
   sudo apt update
   sudo apt install postgresql-client mongodb-org-shell

   # Fedora/RHEL
   sudo dnf install postgresql mongodb-org-shell
   ```

2. **Clone the repository:**

   ```sh
   git clone https://github.com/yourusername/web-db-editor.git
   cd web-db-editor
   ```

3. **Configure environment variables:**
   Create a `.env` file in the project root:

   ```dotenv
   # PostgreSQL
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=YourPasswordHere

   # MongoDB
   MN_HOST=localhost
   MN_PORT=27017
   ```

   > You can customize ports if your databases use non-default values.

### Run the Application

1. **Install Node.js dependencies:**

   ```sh
   npm install
   ```

2. **Start the server:**

   ```sh
   node server.js
   ```

3. **Access the editor:**
   Open your browser and navigate to `http://localhost:3000` (or the port configured in `server.js`).


### Troubleshooting

* **Connection errors:**

  * Verify your `.env` settings.
  * Ensure the database services are running.
* **Port conflicts:**

  * Change the port in `server.js` or via environment variable.

---

For any issues or feature requests, please open an issue on the repository.
