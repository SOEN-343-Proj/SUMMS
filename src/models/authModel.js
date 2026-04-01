import { requestApiJson } from './api'

export function verifyAdminCode(code) {
  return requestApiJson('/auth/admin/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })
}

export function loginAdmin(email, password) {
  return requestApiJson('/auth/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
}

export function loginUser(email, password) {
  return requestApiJson('/auth/user/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
}

export function registerUser(name, email, password) {
  return requestApiJson('/auth/user/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, password }),
  })
}
