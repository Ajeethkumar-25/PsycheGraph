# PsycheGraph Backend API Documentation

This document provides details on the available API endpoints and example requests. The server is running at `http://localhost:8000`. Full interactive documentation is available at `http://localhost:8000/docs`.

## Authentication

### Login
**POST** `/token`
- **Body** (`application/json`):
```json
{
  "email": "your_email@example.com",
  "password": "your_password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer"
}
```

> **Note**: Default Super Admin credentials are verified against `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in your `.env` file.

### Refresh Token
**POST** `/token/refresh`
- **Body** (`application/json`):
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response**:
```json
{
  "access_token": "new_access_token...",
  "refresh_token": "new_refresh_token...",
  "token_type": "bearer"
}
```

## Admin & Users

### Create Organization (Super Admin)
**POST** `/organizations`
- **Headers**: `Authorization: Bearer <super_admin_token>`
- **Body**:
```json
{
  "name": "Healing Center",
  "license_key": "LICENSE-123"
}
```

### Create User
**POST** `/users`
- **Headers**: `Authorization: Bearer <admin_token>`
- **Body**:
```json
{
  "email": "doctor@healing.com",
  "full_name": "Dr. Smith",
  "role": "DOCTOR",
  "password": "securepassword",
  "organization_id": 1
}
```
**Response** (includes tokens for immediate use):
```json
{
  "id": 2,
  "email": "doctor@healing.com",
  "role": "DOCTOR",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

> **Roles**: `SUPER_ADMIN`, `HOSPITAL` (formerly Admin), `DOCTOR`, `RECEPTIONIST`

### Get All Users
**GET** `/users/`
- **Headers**: `Authorization: Bearer <admin_token>`

### User CRUD
- **GET** `/users/{id}`
- **PUT** `/users/{id}` (Body: JSON with fields to update)
- **DELETE** `/users/{id}`

## Patients

### Create Patient
**POST** `/patients/`
- **Headers**: `Authorization: Bearer <receptionist_token>`
- **Body**:
```json
{
  "full_name": "John Doe",
  "date_of_birth": "1980-01-01T00:00:00",
  "contact_number": "1234567890",
  "email": "john@example.com"
}
```

### Patient CRUD
- **GET** `/patients/{id}`
- **PUT** `/patients/{id}`
- **DELETE** `/patients/{id}`

## Sessions

### Create Session (Upload Audio)
**POST** `/sessions/`
- **Headers**: `Authorization: Bearer <doctor_token>`
- **Form Data**:
    - `patient_id`: 1
    - `file`: (Select audio file)

### Session CRUD
- **GET** `/sessions/{id}`
- **PUT** `/sessions/{id}` (Update notes/summary)
```json
{
  "soap_note": "Updated SOAP note content..."
}
```
- **DELETE** `/sessions/{id}`
