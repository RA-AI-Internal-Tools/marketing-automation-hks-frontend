<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchUsers, createUser, updateUser, deleteUser } from '@/api/users'
import type { User, UserRequest } from '@/api/types'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DataTable, { type Column } from '@/components/DataTable.vue'
import ModalWrapper from '@/components/ModalWrapper.vue'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'

// Users list is small; client-side sort is fine. No dedicated sort
// API param exists so we sort the already-loaded array.
const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc' | null>(null)
const selectedUsers = ref<(string | number)[]>([])

const columns: Column[] = [
  { key: 'id', label: 'ID', width: '60px' },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role' },
  { key: 'is_active', label: 'Status' },
  { key: 'last_login_at', label: 'Last Login', sortable: true },
  { key: 'actions', label: 'Actions', align: 'right' },
]

const sortedUsers = computed(() => {
  if (!sortKey.value || !sortDir.value) return users.value
  const k = sortKey.value as keyof User
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...users.value].sort((a, b) => {
    const av = a[k] ?? ''
    const bv = b[k] ?? ''
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
})

async function handleBulkDelete() {
  if (!selectedUsers.value.length) return
  if (!confirm(`Delete ${selectedUsers.value.length} user(s)? This cannot be undone.`)) return
  for (const id of selectedUsers.value) {
    try { await deleteUser(id as number) } catch { /* collected on next load */ }
  }
  selectedUsers.value = []
  await load()
}

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

    <DataTable
      :columns="columns"
      :rows="sortedUsers"
      row-key="id"
      :loading="loading"
      empty-title="No users found"
      sortable
      :selectable="auth.isAdmin"
      v-model:sort-key="sortKey"
      v-model:sort-dir="sortDir"
      v-model:selected="selectedUsers"
      @row-click="(u) => auth.isAdmin && openEdit(u)"
      @bulk-delete="handleBulkDelete"
    >
      <template #bulk-actions="{ selected }" v-if="auth.isAdmin">
        <button class="btn btn-ghost btn-sm" @click="handleBulkDelete">
          <TrashIcon class="h-4 w-4" /> Delete {{ selected.length }} user{{ selected.length === 1 ? '' : 's' }}
        </button>
      </template>
      <template #cell-is_active="{ row }">
        <StatusBadge :status="row.is_active ? 'active' : 'inactive'" />
      </template>
      <template #cell-role="{ row }">
        <StatusBadge :status="row.role" />
      </template>
      <template #cell-last_login_at="{ row }">
        <span class="text-sm text-[var(--color-text-tertiary)]">{{ formatDate(row.last_login_at) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div v-if="auth.isAdmin" class="flex items-center justify-end gap-2" @click.stop>
          <button @click="openEdit(row)" class="btn-icon" :aria-label="`Edit user ${row.email}`" title="Edit">
            <PencilSquareIcon class="h-4 w-4" />
          </button>
          <button @click="confirmDelete = row" class="btn-icon" :aria-label="`Delete user ${row.email}`" title="Delete">
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Create/Edit Modal -->
    <ModalWrapper
      :model-value="showModal"
      :title="editingUser ? 'Edit User' : 'Create User'"
      size="md"
      @update:model-value="(v) => { if (!v) showModal = false }"
    >
      <template #body>
        <form id="users-edit-form" @submit.prevent="handleSave" class="space-y-4">
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
        </form>
      </template>
      <template #footer>
        <button type="button" @click="showModal = false" class="btn btn-ghost">Cancel</button>
        <button type="submit" form="users-edit-form" :disabled="saving" class="btn btn-primary">
          {{ saving ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
        </button>
      </template>
    </ModalWrapper>

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
