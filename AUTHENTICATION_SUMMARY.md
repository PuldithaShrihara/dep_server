# Authentication & Authorization System

## Overview
This system implements role-based access control where:
- **Admin users** can view and edit ALL departments
- **Manager users** can VIEW all departments but can only EDIT their own department's plans

## User Roles

### Admin Role
- **Full Access**: Can create, read, update, and delete plans for all departments
- Example: `sadmin` / `admin123456`

### Manager Role  
- **View Access**: Can view plans from all departments
- **Edit Access**: Can only create, update, and delete plans for their assigned department
- *Note: All previous default manager accounts have been removed. New managers must be created by an Admin.*

## Implementation Details

### Backend Changes

1. **Auth Route (`routes/auth.js`)**
   - Updated login to include `department` in JWT token and user response
   - User object now includes: `id`, `username`, `role`, `department`

2. **Auth Middleware (`middleware/auth.js`)**
   - `authMiddleware`: Fetches full user details from database including department
   - `departmentEditMiddleware`: New middleware that:
     - Allows Admin to edit any department
     - Restricts Managers to only edit their own department
     - Checks department when creating/updating/deleting plans

3. **Plans Route (`routes/plans.js`)**
   - GET `/api/plans/department/:deptId` - All authenticated users can view
   - POST `/api/plans` - Requires `departmentEditMiddleware` (Admin or own department)
   - PUT `/api/plans/:id/tasks` - Requires `departmentEditMiddleware` (Admin or own department)
   - DELETE `/api/plans/:id` - Requires `departmentEditMiddleware` (Admin or own department)

### Frontend Changes

- AuthContext automatically receives and stores department information from login
- User object includes: `id`, `username`, `role`, `department`
- Frontend can use `user.department` to display department-specific UI if needed

## Security Features

1. **JWT Tokens**: Include user ID, role, and department
2. **Database Verification**: Middleware fetches latest user data from database
3. **Department Validation**: Checks department name matches before allowing edits
4. **Error Messages**: Clear messages when access is denied

## Testing

To test the authentication:
1. Login as a Manager user (e.g., `markadmin` / `mark123`)
2. Try to view plans from all departments - Should work ✓
3. Try to create/edit a plan for Marketing - Should work ✓
4. Try to create/edit a plan for Finance - Should fail with "Access denied" ✗

Login as Admin (`admin` / `admin123`) - Should have full access to all departments ✓
