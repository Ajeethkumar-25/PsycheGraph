# PsycheGraph Project

This is a monorepo containing the frontend and backend for the PsycheGraph project.

## Structure

- **frontend/**: React + TypeScript (Vite)
- **backend/**: FastAPI (Python)

## Getting Started

### Frontend

1.  Navigate to `frontend/`:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```

### Backend

1.  Navigate to `backend/`:
    ```bash
    cd backend
    ```
2.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install requirements:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the server:
    ```bash
    uvicorn app.main:app --reload
    ```
