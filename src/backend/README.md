# SUMMS Backend - Credentials Management

This backend module manages user and admin authentication for the SUMMS (Student Union Management System).

## Structure

- `credentials.py` - Python module containing user/admin credential lists and authentication functions
- `main.py` - FastAPI application entry point with authentication endpoints

## FastAPI Setup

Install backend dependencies:

```bash
pip install -r src/backend/requirements.txt
```

Run the API server from the project root:

```bash
uvicorn src.backend.main:app --reload
```

Then open:

- API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### Available API Endpoints

- `POST /auth/admin/code` - verify admin code
- `POST /auth/admin/login` - admin login
- `POST /auth/user/login` - user login
- `POST /auth/user/register` - user registration
- `GET /users` - list all users
- `GET /admins` - list all admins

## Credentials Lists

### Admin Code
- **Admin Code**: `ADMIN2025`
- Required before admin login

### Admin Accounts

| Email | Password | Name | Role |
|-------|----------|------|------|
| admin@summs.com | SecureAdmin123! | System Administrator | admin |

### User Accounts

| Email | Password | Name | Role |
|-------|----------|------|------|
| john.doe@student.com | student123 | John Doe | user |
| jane.smith@student.com | student456 | Jane Smith | user |
| alex.wilson@student.com | student789 | Alex Wilson | user |

## Login Flow

### Admin Login
1. User selects "Admin Login" on welcome page
2. System prompts for admin code
3. User enters: `ADMIN2025`
4. System verifies code and proceeds to admin login
5. User enters admin email and password
6. Upon successful authentication, admin dashboard is displayed

### User Login
1. User selects "User Login" on welcome page
2. User can either:
   - **Login**: Enter existing email and password
   - **Sign Up**: Enter name, email, and password to create new account
3. Upon successful authentication, user is logged in

## Python Functions

### `verify_admin_code(code)`
Verifies if the provided code matches the admin code.

### `authenticate_admin(email, password)`
Authenticates an admin and returns admin info if successful.

### `authenticate_user(email, password)`
Authenticates a regular user and returns user info if successful.

### `register_user(email, password, name)`
Registers a new user account.

### `get_all_users()`
Returns list of all users (without passwords).

### `get_all_admins()`
Returns list of all admins (without passwords).

## Testing

To view all credentials, run:
```bash
python src/backend/credentials.py
```

## Security Notes

⚠️ **Important**: This implementation uses hardcoded credentials for demonstration purposes only.

In a production environment:
- Store credentials in a secure database
- Hash passwords using bcrypt or similar
- Use environment variables for sensitive data
- Implement JWT tokens for session management
- Add rate limiting for login attempts
- Implement HTTPS for all authentication endpoints

## React Frontend Integration

The React components mirror this credentials structure:
- `src/components/AdminCodeVerification.jsx` - Verifies admin code
- `src/components/AdminLogin.jsx` - Admin authentication
- `src/components/UserLogin.jsx` - User authentication and registration

All components use the same credentials as defined in `credentials.py`.
