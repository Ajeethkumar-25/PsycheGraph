# PsycheGraph - API Documentation (Hierarchical RBAC + Scheduling)

This document describes the updated endpoints, access control rules, and providing exact Request/Response formats.

## Roles Overview

1.  **SUPER_ADMIN**: Global access. Can create Hospital Admins.
2.  **HOSPITAL**: Organization-wide access. Can create Doctors and Receptionists.
3.  **DOCTOR**: Restricted to "Own Data" (Assigned Patients/Sessions/Appointments).
4.  **RECEPTIONIST**: Restricted to "Own Data" (Patients/Sessions/Appointments in their Org).

---

### [POST] `/token`
- **Request**: `{ "email": "...", "password": "..." }`
- **Response**: `UserWithToken`

## 1. Authentication & Common
### [POST] `/auth/token`
- **Description**: Standard OAuth2 token endpoint. Recommended for **Super Admin** or general use.
- **Request**: `grant_type`, `username`, `password`.
- **Response**: `UserWithToken`

---

## 2. Hospital Admin Management (`Hospital Login`)

### [POST] `/auth/register/hospital`
- **Description**: Public registration for Hospital Admins.
- **Request**: `{ "email", "password", "full_name", "license_key" }`
- **Response**: `RegisterResponse`

### [POST] `/auth/login/hospital`
- **Description**: Dedicated login for Hospital Admins.
- **Request**: `{ "email", "password" }`
- **Response**: `UserWithToken`

### Admin Endpoints (`/admin/hospitals`)
- **GET** `/admin/hospitals`: List hospital admins (Super Admin only).
- **PUT** `/admin/hospitals/{id}`: Update admin.
- **DELETE** `/admin/hospitals/{id}`: Delete admin.

---

## 3. Doctor Management (`Doctor Login`)

### [POST] `/auth/register/doctor`
- **Description**: Public registration for Doctors.
- **Request**: `{ "email", "password", "full_name", "license_key", "specialization", "license_number" }`
- **Response**: `RegisterResponse`

### [POST] `/auth/login/doctor`
- **Description**: Dedicated login for Doctors.
- **Request**: `{ "email", "password" }`
- **Response**: `UserWithToken`

### Admin Endpoints (`/admin/doctors`)
- **POST** `/admin/doctors`: Internal creation (Admin only).
- **GET** `/admin/doctors`: List doctors (org-filtered).
- **GET** `/admin/doctors/{id}`, **PUT**, **DELETE**

---

## 4. Receptionist Management (`Receptionist Login`)

### [POST] `/auth/register/receptionist`
- **Description**: Public registration for Receptionists.
- **Request**: `{ "email", "password", "full_name", "license_key", "specialization", "license_number", "shift_timing" }`
- **Response**: `RegisterResponse`

### [POST] `/auth/login/receptionist`
- **Description**: Dedicated login for Receptionists.
- **Request**: `{ "email", "password" }`
- **Response**: `UserWithToken`

### Admin Endpoints (`/admin/receptionists`)
- **POST** `/admin/receptionists`: Internal creation (Admin only).
- **GET** `/admin/receptionists`: List receptionists (org-filtered).
- **GET** `/admin/receptionists/{id}`, **PUT**, **DELETE**

---

## Shared Schema: `UserOut`
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "DOCTOR",
  "is_active": true,
  "organization_id": 1,
  "specialization": "...",
  "license_number": "...",
  "shift_timing": "..."
}
```

---

## 3. Patient Management

### [POST] `/patients/`
- **Roles**: `HOSPITAL`, `RECEPTIONIST`, `SUPER_ADMIN`.
- **Note**: `organization_id` is auto-filled for non-admins.

---

## 4. Session Management

### [POST] `/sessions/`
- **Roles**: `DOCTOR`, `HOSPITAL`, `SUPER_ADMIN`.
- **Logic**: Recording -> Upload -> AI Translation/Summary.

---

## 5. Appointment & Scheduling (`/appointments`)

### [POST] `/availability`
- **Role**: `DOCTOR` (own slots), `RECEPTIONIST`/`HOSPITAL` (org-wide slots).
- **Request**:
```json
{
  "doctor_id": 2,
  "start_time": "2024-02-12T10:00:00",
  "end_time": "2024-02-12T10:30:00",
  "organization_id": 1
}
```

### [GET] `/availability`
- **Description**: Query parameters `doctor_id`, `organization_id`, `only_available` (default true).

### [POST] `/book`
- **Roles**: Everyone (Patients/Receptionists).
- **Request**:
```json
{
  "availability_id": 101,
  "patient_id": 10,
  "doctor_id": 2,
  "start_time": "...", 
  "end_time": "...",
  "notes": "Concern about sleep pattern"
}
```
- **Response**: Returns `AppointmentOut` with a **unique telehealth `meet_link`**.

### [DELETE] `/availability/{slot_id}`
- **Behavior**: If the slot is deleted, any **linked appointment is automatically set to `CANCELLED`**.

### [GET] `/`
- **Scope**:
    - `SUPER_ADMIN`/`HOSPITAL`: View org-wide.
    - `DOCTOR`: View their booked slots.
    - `RECEPTIONIST`: View org-wide.
