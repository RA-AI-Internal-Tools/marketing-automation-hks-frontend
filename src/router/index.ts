import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/overview',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/preferences',
      name: 'preferences',
      component: () => import('@/views/PreferenceCenterPage.vue'),
      meta: { public: true },
    },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('@/views/OverviewPage.vue'),
    },
    {
      path: '/campaigns',
      name: 'campaigns',
      component: () => import('@/views/CampaignsPage.vue'),
    },
    {
      path: '/campaigns/new',
      name: 'campaign-new',
      component: () => import('@/views/CampaignEditorPage.vue'),
      meta: { requiresWrite: true },
    },
    {
      path: '/campaigns/:id/edit',
      name: 'campaign-edit',
      component: () => import('@/views/CampaignEditorPage.vue'),
      meta: { requiresWrite: true },
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/TemplatesPage.vue'),
    },
    {
      path: '/templates/new',
      name: 'template-new',
      component: () => import('@/views/TemplateEditorPage.vue'),
      meta: { requiresWrite: true },
    },
    {
      path: '/templates/:id/edit',
      name: 'template-edit',
      component: () => import('@/views/TemplateEditorPage.vue'),
      meta: { requiresWrite: true },
    },
    {
      path: '/enrollments',
      name: 'enrollments',
      component: () => import('@/views/EnrollmentsPage.vue'),
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsPage.vue'),
    },
    {
      path: '/channels',
      name: 'channels',
      component: () => import('@/views/ChannelsPage.vue'),
    },
    {
      path: '/consents',
      name: 'consents',
      component: () => import('@/views/ConsentsPage.vue'),
    },
    {
      path: '/health',
      name: 'health',
      component: () => import('@/views/HealthPage.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersPage.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/campaign-funnel',
      name: 'campaign-funnel',
      component: () => import('@/views/CampaignFunnelPage.vue'),
    },
    {
      path: '/audit-logs',
      name: 'audit-logs',
      component: () => import('@/views/AuditLogsPage.vue'),
      meta: { requiresAdmin: true },
    },
    // Analytics
    {
      path: '/analytics/executive',
      name: 'analytics-executive',
      component: () => import('@/views/analytics/ExecutivePage.vue'),
    },
    {
      path: '/analytics/acquisition',
      name: 'analytics-acquisition',
      component: () => import('@/views/analytics/AcquisitionPage.vue'),
    },
    {
      path: '/analytics/funnel',
      name: 'analytics-funnel',
      component: () => import('@/views/analytics/FunnelPage.vue'),
    },
    {
      path: '/analytics/users',
      name: 'analytics-users',
      component: () => import('@/views/analytics/UsersPage.vue'),
    },
    {
      path: '/analytics/products',
      name: 'analytics-products',
      component: () => import('@/views/analytics/ProductsPage.vue'),
    },
    {
      path: '/analytics/payments',
      name: 'analytics-payments',
      component: () => import('@/views/analytics/PaymentsPage.vue'),
    },
    {
      path: '/analytics/orders',
      name: 'analytics-orders',
      component: () => import('@/views/analytics/OrdersPage.vue'),
    },
    {
      path: '/analytics/retention',
      name: 'analytics-retention',
      component: () => import('@/views/analytics/RetentionPage.vue'),
    },
    {
      path: '/analytics/data-health',
      name: 'analytics-data-health',
      component: () => import('@/views/analytics/DataHealthPage.vue'),
    },
    {
      path: '/analytics/reports',
      name: 'analytics-reports',
      component: () => import('@/views/analytics/ReportsPage.vue'),
    },
  ],
})

// Navigation guard: redirect unauthenticated users to login
router.beforeEach((to) => {
  const isPublic = to.meta.public === true
  const token = localStorage.getItem('ma_auth_token')
  const role = localStorage.getItem('ma_auth_role')

  if (!isPublic && !token) {
    return { name: 'login' }
  }
  if (to.name === 'login' && token) {
    return { name: 'overview' }
  }
  // Admin-only routes
  if (to.meta.requiresAdmin && role !== 'admin') {
    return { name: 'overview' }
  }
  // Write-access routes (admin or editor only)
  if (to.meta.requiresWrite && role !== 'admin' && role !== 'editor') {
    return { name: 'overview' }
  }
})

export default router
