<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchUsers, createUser, updateUser, deleteUser } from '@/api/users'
import type { User, UserRequest } from '@/api/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const auth = useAuthStore()

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')

// Modal state
const showModal = ref(false)
const editingUser = ref<User | null>(null)
const saving = ref(false)
const form = ref<UserRequest>({
  email: '',
  name: '',
  role: 'viewer',
  password: '',
  is_active: true,
})

// Delete confirmation
const confirmDelete = ref<User | null>(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await fetchUsers()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingUser.value = null
  form.value = { email: '', name: '', role: 'viewer', password: '', is_active: true }
  showModal.value = true
}

function openEdit(user: User) {
  editingUser.value = user
  form.value = {
    email: user.email,
    name: user.name,
    role: user.role,
    password: '',
    is_active: user.is_active,
  }
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  error.value = ''
  try {
    if (editingUser.value) {
      const payload: Partial<UserRequest> = {
        email: form.value.email,
        name: form.value.name,
        role: form.value.role,
        is_active: form.value.is_active,
      }
      if (form.value.password) {
        payload.password = form.value.password
      }
      await updateUser(editingUser.value.id, payload)
    } else {
      if (!form.value.password) {
        error.value = 'Password is required for new users'
        saving.value = false
        return
      }
      await createUser(form.value)
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to save user'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirmDelete.value) return
  deleting.value = true
  try {
    await deleteUser(confirmDelete.value.id)
    confirmDelete.value = null
    await load()
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Failed to delete user'
  } finally {
    deleting.value = false
  }
}

function formatDate(d?: string) {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const roleBadgeColor: Record<string, string> = {
  admin: 'red',
  editor: 'blue',
  viewer: 'gray',
}

onMounted(load)
</script>

<template>
  <div class="page-enter">
    <PageHeader title="User Management" description="Manage dashboard users and their roles">
      <button
        @click="openCreate"
        class="inline-flex items-center gap-2 px-4 py-2 bg-[#020288] text-white text-sm font-medium rounded-lg hover:bg-[#0d35d7] transition-colors"
      >
        <PlusIcon class="h-4 w-4" />
        Add User
      </button>
    </PageHeader>

    <!-- Error -->
    <div v-if="error" class="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">Loading users...</div>

    <!-- Users table -->
    <div v-else class="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Login</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50/70 transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-gray-900">{{ user.name }}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ user.email }}</td>
            <td class="px-6 py-4">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                  user.role === 'admin' ? 'bg-red-100 text-red-700' :
                  user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                ]"
              >
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                ]"
              >
                {{ user.is_active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">{{ formatDate(user.last_login_at) }}</td>
            <td class="px-6 py-4 text-right">
              <div v-if="auth.isAdmin" class="flex items-center justify-end gap-2">
                <button @click="openEdit(user)" class="text-gray-400 hover:text-[#020288] transition-colors" title="Edit">
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button @click="confirmDelete = user" class="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="6" class="px-6 py-12 text-center text-gray-500">No users found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="showModal = false" />
        <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold tracking-tight text-gray-900">
              {{ editingUser ? 'Edit User' : 'Create User' }}
            </h2>
            <button @click="showModal = false" class="text-gray-400 hover:text-gray-600">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="handleSave" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input v-model="form.name" type="text" required
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-[#0099db]/40 focus:border-[#0099db]" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input v-model="form.email" type="email" required
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-[#0099db]/40 focus:border-[#0099db]" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Password {{ editingUser ? '(leave blank to keep current)' : '' }}
              </label>
              <input v-model="form.password" type="password" :required="!editingUser"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-[#0099db]/40 focus:border-[#0099db]" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select v-model="form.role"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-[#0099db]/40 focus:border-[#0099db]">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <p class="mt-1 text-xs text-gray-500">
                <strong>Admin:</strong> Full access including user management.
                <strong>Editor:</strong> Create/edit campaigns and templates.
                <strong>Viewer:</strong> Read-only access.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <input v-model="form.is_active" type="checkbox" id="is_active"
                class="h-4 w-4 text-[#020288] border-gray-300 rounded" />
              <label for="is_active" class="text-sm text-gray-700">Active</label>
            </div>

            <div v-if="error" class="text-sm text-red-600">{{ error }}</div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showModal = false"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-slate-50/70 transition-colors">
                Cancel
              </button>
              <button type="submit" :disabled="saving"
                class="px-4 py-2 text-sm font-medium text-white bg-[#020288] rounded-lg hover:bg-[#0d35d7] disabled:opacity-50">
                {{ saving ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="confirmDelete = null" />
        <div class="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-semibold tracking-tight text-gray-900 mb-2">Delete User</h3>
          <p class="text-sm text-gray-600 mb-6">
            Are you sure you want to delete <strong>{{ confirmDelete.name }}</strong> ({{ confirmDelete.email }})?
            This action cannot be undone.
          </p>
          <div class="flex justify-end gap-3">
            <button @click="confirmDelete = null"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-slate-50/70 transition-colors">
              Cancel
            </button>
            <button @click="handleDelete" :disabled="deleting"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {{ deleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
