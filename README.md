# React + FastAPI Project

This is a simple project to demonstrate a React frontend communicating with a FastAPI backend.

## How to run this project

### Backend (FastAPI)

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment and activate it (optional but recommended):
    ```bash
    python -m venv venv
    # On Windows
    venv\Scripts\activate
    # On macOS/Linux
    source venv/bin/activate
    ```

3.  Install the dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Run the FastAPI server:
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be running at `http://127.0.0.1:8000`.

### Frontend (React)

1.  Open a new terminal.
2.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```

3.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```

4.  Start the React development server:
    ```bash
    npm start
    ```
    The frontend will open in your browser at `http://localhost:3000`.

## How to use

1.  Open `http://localhost:3000` in your browser.
2.  Click the "Get Message" button.
3.  You should see the message "Hello World" displayed on the page, which is fetched from the FastAPI backend.
