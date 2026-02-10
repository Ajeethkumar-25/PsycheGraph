# PsycheGraph - API Documentation (Hierarchical RBAC + Scheduling)

This document describes the updated endpoints, access control rules, and providing exact Request/Response formats.

## Roles Overview

1.  **SUPER_ADMIN**: Global access. Can create Hospital Admins.
2.  **HOSPITAL**: Organization-wide access. Can create Doctors and Receptionists.
3.  **DOCTOR**: Restricted to "Own Data" (Assigned Patients/Sessions/Appointments).
4.  **RECEPTIONIST**: Restricted to "Own Data" (Patients/Sessions/Appointments in their Org).

---

## 1. Authentication

### [POST] `/token`
- **Request**: `{ "email": "...", "password": "..." }`
- **Response**: `UserWithToken`

---

## 2. Admin & User Management

### [POST] `/users`
- **Hierarchy Rules**: `SUPER_ADMIN` -> `HOSPITAL` -> `DOCTOR`/`RECEPTIONIST`.

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
