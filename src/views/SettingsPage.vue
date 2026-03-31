<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { fetchSettings, changePassword } from '@/api/dashboard'

const auth = useAuthStore()

const settings = ref<any>(null)
const loading = ref(true)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    settings.value = await fetchSettings()
  } finally {
    loading.value = false
  }
})

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    return
  }

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    passwordSuccess.value = 'Password updated successfully'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    passwordError.value = e.response?.data?.error || 'Failed to change password'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Settings" description="Application configuration and account settings" />

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <div v-else class="space-y-6 max-w-2xl">
      <!-- Account info -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Account</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Email</span>
            <span class="text-gray-900">{{ auth.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Token Expiry</span>
            <span class="text-gray-900">{{ settings?.jwt_expiry_hours || 24 }} hours</span>
          </div>
        </div>
      </div>

      <!-- Change password -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
        <form @submit.prevent="handleChangePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              v-model="currentPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              v-model="newPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div v-if="passwordError" class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {{ passwordError }}
          </div>
          <div v-if="passwordSuccess" class="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            {{ passwordSuccess }}
          </div>

          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {{ saving ? 'Updating...' : 'Update Password' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
