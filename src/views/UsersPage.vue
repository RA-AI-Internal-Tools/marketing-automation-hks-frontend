<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchUsers, createUser, updateUser, deleteUser } from '@/api/users'
import type { User, UserRequest } from '@/api/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const auth = useAuthStore()

const users = ref<User[]>([])
const loading = ref(true)
// Page-level error (load/delete failures). Kept separate from form errors
// so a failed save inside the modal doesn't leak onto the page banner.
const loadError = ref('')
// Modal-only error surface; cleared every time the modal opens.
const formError = ref('')

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
  loadError.value = ''
  try {
    users.value = await fetchUsers()
  } catch (e: any) {
    loadError.value = e.response?.data?.error || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingUser.value = null
  formError.value = ''
  form.value = { email: '', name: '', role: 'viewer', password: '', is_active: true }
  showModal.value = true
}

function openEdit(user: User) {
  editingUser.value = user
  formError.value = ''
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
  formError.value = ''
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
        formError.value = 'Password is required for new users'
        saving.value = false
        return
      }
      await createUser(form.value)
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    formError.value = e.response?.data?.error || 'Failed to save user'
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
    loadError.value = e.response?.data?.error || 'Failed to delete user'
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

onMounted(load)
</script>

<template>
  <div class="page-enter">
    <PageHeader title="User Management" description="Manage dashboard users and their roles">
      <button
        v-if="auth.isAdmin"
        @click="openCreate"
        class="btn btn-primary"
      >
        <PlusIcon class="h-4 w-4" />
        Add User
      </button>
    </PageHeader>

    <!-- Page-level error (load / delete) -->
    <div v-if="loadError" class="mb-4 bg-[var(--color-error-bg)] text-[var(--color-error-text)] px-4 py-3 rounded-lg text-sm">
      {{ loadError }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-[var(--color-text-tertiary)]">Loading users...</div>

    <!-- Users table -->
    <div v-else class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
      <table class="min-w-full divide-y divide-[var(--color-border)]">
        <thead class="bg-[var(--color-bg-page)]">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Email</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Role</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Status</th>
            <th class="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Last Login</th>
            <th class="px-6 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border-muted)]">
          <tr v-for="user in users" :key="user.id" class="hover:bg-[var(--color-bg-hover)] transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-[var(--color-text-primary)]">{{ user.name }}</div>
            </td>
            <td class="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{{ user.email }}</td>
            <td class="px-6 py-4">
              <StatusBadge :status="user.role" />
            </td>
            <td class="px-6 py-4">
              <StatusBadge :status="user.is_active ? 'active' : 'inactive'" />
            </td>
            <td class="px-6 py-4 text-sm text-[var(--color-text-tertiary)]">{{ formatDate(user.last_login_at) }}</td>
            <td class="px-6 py-4 text-right">
              <div v-if="auth.isAdmin" class="flex items-center justify-end gap-2">
                <button @click="openEdit(user)" class="btn-icon" :aria-label="`Edit user ${user.email}`" title="Edit">
                  <PencilSquareIcon class="h-4 w-4" />
                </button>
                <button @click="confirmDelete = user" class="btn-icon" :aria-label="`Delete user ${user.email}`" title="Delete">
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="6" class="px-6 py-12 text-center text-[var(--color-text-tertiary)]">No users found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50" @click="showModal = false" />
        <div class="relative bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
              {{ editingUser ? 'Edit User' : 'Create User' }}
            </h2>
            <button @click="showModal = false" class="btn-icon" aria-label="Close">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <form @submit.prevent="handleSave" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
              <input v-model="form.name" type="text" required class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
              <input v-model="form.email" type="email" required class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Password {{ editingUser ? '(leave blank to keep current)' : '' }}
              </label>
              <input v-model="form.password" type="password" :required="!editingUser" class="form-input" />
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Role</label>
              <select v-model="form.role" class="form-select">
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <p class="mt-1 text-xs text-[var(--color-text-tertiary)]">
                <strong>Admin:</strong> Full access including user management.
                <strong>Editor:</strong> Create/edit campaigns and templates.
                <strong>Viewer:</strong> Read-only access.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <input v-model="form.is_active" type="checkbox" id="is_active"
                class="h-4 w-4 text-[var(--color-primary)] border-[var(--color-border)] rounded" />
              <label for="is_active" class="text-sm text-[var(--color-text-secondary)]">Active</label>
            </div>

            <div v-if="formError" class="text-sm text-[var(--color-error-text)]">{{ formError }}</div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="showModal = false" class="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" :disabled="saving" class="btn btn-primary">
                {{ saving ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation -->
    <ConfirmDialog
      :open="!!confirmDelete"
      :title="`Delete user ${confirmDelete?.name || ''}?`"
      :message="confirmDelete ? `Are you sure you want to delete ${confirmDelete.name} (${confirmDelete.email})? This action cannot be undone.` : ''"
      :confirm-text="deleting ? 'Deleting...' : 'Delete'"
      cancel-text="Cancel"
      variant="danger"
      @confirm="handleDelete"
      @cancel="confirmDelete = null"
    />
  </div>
</template>
