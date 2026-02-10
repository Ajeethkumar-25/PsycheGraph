# PsycheGraph - Complete API Reference (with Authorization Status)

This document categorizes all API endpoints into **Public** (No Auth required) and **Authorized** (Requires Bearer Token).

---

## 🔐 1. Authentication & Registration (Public)
*These endpoints do not require a token.*

### [POST] `/auth/token`
- **Status**: 🔓 Public
- **Request/Response**: Standard login flow.

### [POST] `/auth/token/refresh`
- **Status**: 🔓 Public
- **Description**: Uses refresh token to get new access token.

### [POST] `/auth/login/hospital`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Hospital Admins.

### [POST] `/auth/login/doctor`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Doctors.

### [POST] `/auth/login/receptionist`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Receptionists.

### [POST] `/auth/register/hospital`
- **Status**: 🔓 Public
- **Description**: Registration for Hospital Admins using License Key.

### [POST] `/auth/register/doctor`
- **Status**: 🔓 Public
- **Description**: Registration for Doctors using License Key.

### [POST] `/auth/register/receptionist`
- **Status**: 🔓 Public
- **Description**: Registration for Receptionists using License Key.

---

## 🏥 2. Admin & Organization Management (Authorized)
*Requires: Authorization: Bearer <token>*

### [POST] `/admin/organizations`
- **Status**: 🔐 Authorized (SUPER_ADMIN)

### [GET] `/admin/organizations`
- **Status**: 🔐 Authorized (SUPER_ADMIN / HOSPITAL)

### [GET/PUT/DELETE] `/admin/organizations/{org_id}`
- **Status**: 🔐 Authorized

### [GET/PUT/DELETE] `/admin/hospitals`
- **Status**: 🔐 Authorized

### [POST/GET] `/admin/doctors`
- **Status**: � Authorized

### [POST/GET] `/admin/receptionists`
- **Status**: 🔐 Authorized

---

## 👥 3. Patient Management (Authorized)
*Requires: Authorization: Bearer <token>*

### [POST] `/patients/`
- **Status**: 🔐 Authorized

### [GET] `/patients`
- **Status**: 🔐 Authorized

### [GET/PUT/DELETE] `/patients/{patient_id}`
- **Status**: 🔐 Authorized

---

## 🎙️ 4. Session Management (Authorized)
*Requires: Authorization: Bearer <token>*

### [POST] `/sessions/`
- **Status**: 🔐 Authorized

### [GET] `/sessions`
- **Status**: 🔐 Authorized

### [GET/PUT/DELETE] `/sessions/{session_id}`
- **Status**: 🔐 Authorized

---

## 📅 5. Appointments & Scheduling

### [POST] `/appointments/availability`
- **Status**: 🔐 Authorized (Doctors/Receptionists)
- **Description**: Create a new time slot.

### [GET] `/appointments/availability`
- **Status**: 🔓 Public
- **Description**: Allows patients to view available slots without logging in.

### [POST] `/appointments/book`
- **Status**: 🔐 Authorized
- **Description**: Confirm an appointment booking.

### [DELETE] `/appointments/availability/{slot_id}`
- **Status**: 🔐 Authorized

### [GET] `/appointments`
- **Status**: 🔐 Authorized

---

## 📈 6. Stats & Root

### [GET] `/stats/`
- **Status**: 🔐 Authorized
- **Description**: Role-based analytics.

### [GET] `/`
- **Status**: 🔓 Public
- **Description**: Root health check.
