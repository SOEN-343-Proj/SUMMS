"""
SUMMS - Student Union Management System
Credentials Management Module

This module maintains lists of user and admin credentials.
In a production environment, this would be replaced with a secure database.
"""

# Hardcoded admin code for verification
ADMIN_CODE = "ADMIN2025"

# Admin credentials list
# Each admin has: email, password, name, assigned_code
admin_credentials = [
    {
        "email": "admin@summs.com",
        "password": "SecureAdmin123!",
        "name": "System Administrator",
        "code": ADMIN_CODE,
        "role": "admin"
    }
]

# User credentials list
# Each user has: email, password, name
user_credentials = [
    {
        "email": "john.doe@student.com",
        "password": "student123",
        "name": "John Doe",
        "role": "user"
    },
    {
        "email": "jane.smith@student.com",
        "password": "student456",
        "name": "Jane Smith",
        "role": "user"
    },
    {
        "email": "alex.wilson@student.com",
        "password": "student789",
        "name": "Alex Wilson",
        "role": "user"
    }
]


def verify_admin_code(code):
    """
    Verify if the provided code matches the admin code.
    
    Args:
        code (str): The code to verify
        
    Returns:
        bool: True if code is valid, False otherwise
    """
    return code == ADMIN_CODE


def authenticate_admin(email, password):
    """
    Authenticate an admin user.
    
    Args:
        email (str): Admin email
        password (str): Admin password
        
    Returns:
        dict or None: Admin info if authenticated, None otherwise
    """
    for admin in admin_credentials:
        if admin["email"] == email and admin["password"] == password:
            return {
                "email": admin["email"],
                "name": admin["name"],
                "code": admin["code"],
                "role": admin["role"]
            }
    return None


def authenticate_user(email, password):
    """
    Authenticate a regular user.
    
    Args:
        email (str): User email
        password (str): User password
        
    Returns:
        dict or None: User info if authenticated, None otherwise
    """
    for user in user_credentials:
        if user["email"] == email and user["password"] == password:
            return {
                "email": user["email"],
                "name": user["name"],
                "role": user["role"]
            }
    return None


def register_user(email, password, name):
    """
    Register a new user.
    
    Args:
        email (str): User email
        password (str): User password
        name (str): User full name
        
    Returns:
        dict: Result with success status and message
    """
    # Check if email already exists
    for user in user_credentials:
        if user["email"] == email:
            return {
                "success": False,
                "message": "Email already registered"
            }
    
    # Add new user
    new_user = {
        "email": email,
        "password": password,
        "name": name,
        "role": "user"
    }
    user_credentials.append(new_user)
    
    return {
        "success": True,
        "message": "User registered successfully",
        "user": {
            "email": email,
            "name": name,
            "role": "user"
        }
    }


def get_all_users():
    """
    Get all registered users (excluding passwords).
    
    Returns:
        list: List of user dictionaries without passwords
    """
    return [{
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    } for user in user_credentials]


def get_all_admins():
    """
    Get all registered admins (excluding passwords).
    
    Returns:
        list: List of admin dictionaries without passwords
    """
    return [{
        "email": admin["email"],
        "name": admin["name"],
        "code": admin["code"],
        "role": admin["role"]
    } for admin in admin_credentials]


# For demo purposes - print credentials on module load
if __name__ == "__main__":
    print("=" * 50)
    print("SUMMS Credentials System")
    print("=" * 50)
    print(f"\nAdmin Code: {ADMIN_CODE}")
    print(f"\nAdmin Accounts ({len(admin_credentials)}):")
    for admin in admin_credentials:
        print(f"  - Email: {admin['email']}")
        print(f"    Password: {admin['password']}")
        print(f"    Name: {admin['name']}")
    print(f"\nUser Accounts ({len(user_credentials)}):")
    for user in user_credentials:
        print(f"  - Email: {user['email']}")
        print(f"    Password: {user['password']}")
        print(f"    Name: {user['name']}")
    print("\n" + "=" * 50)
