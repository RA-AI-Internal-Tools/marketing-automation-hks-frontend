import api from './client'
import type { User, UserRequest } from './types'

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get('/api/users')
  return data
}

export async function fetchUser(id: number): Promise<User> {
  const { data } = await api.get(`/api/users/${id}`)
  return data
}

export async function createUser(req: UserRequest): Promise<User> {
  const { data } = await api.post('/api/users', req)
  return data
}

export async function updateUser(id: number, req: Partial<UserRequest>): Promise<User> {
  const { data } = await api.put(`/api/users/${id}`, req)
  return data
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/users/${id}`)
}
