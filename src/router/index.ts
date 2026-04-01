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
      meta: { public: true, title: 'Login' },
    },
    {
      path: '/preferences',
      name: 'preferences',
      component: () => import('@/views/PreferenceCenterPage.vue'),
      meta: { public: true, title: 'Preferences' },
    },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('@/views/OverviewPage.vue'),
      meta: { title: 'Dashboard' },
    },
    {
      path: '/campaigns',
      name: 'campaigns',
      component: () => import('@/views/CampaignsPage.vue'),
      meta: { title: 'Campaigns' },
    },
    {
      path: '/campaigns/new',
      name: 'campaign-new',
      component: () => import('@/views/CampaignEditorPage.vue'),
      meta: { requiresWrite: true, title: 'New Campaign' },
    },
    {
      path: '/campaigns/:id/edit',
      name: 'campaign-edit',
      component: () => import('@/views/CampaignEditorPage.vue'),
      meta: { requiresWrite: true, title: 'Edit Campaign' },
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/TemplatesPage.vue'),
      meta: { title: 'Templates' },
    },
    {
      path: '/templates/new',
      name: 'template-new',
      component: () => import('@/views/TemplateEditorPage.vue'),
      meta: { requiresWrite: true, title: 'New Template' },
    },
    {
      path: '/templates/:id/edit',
      name: 'template-edit',
      component: () => import('@/views/TemplateEditorPage.vue'),
      meta: { requiresWrite: true, title: 'Edit Template' },
    },
    {
      path: '/enrollments',
      name: 'enrollments',
      component: () => import('@/views/EnrollmentsPage.vue'),
      meta: { title: 'Enrollments' },
    },
    {
      path: '/consents',
      name: 'consents',
      component: () => import('@/views/ConsentsPage.vue'),
      meta: { title: 'Consents' },
    },
    {
      path: '/integrations',
      name: 'integrations',
      component: () => import('@/views/IntegrationsPage.vue'),
      meta: { title: 'Integrations' },
    },
    {
      path: '/channels',
      name: 'channels',
      component: () => import('@/views/ChannelsPage.vue'),
      meta: { title: 'Channels' },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsPage.vue'),
      meta: { title: 'Logs' },
    },
    {
      path: '/health',
      name: 'health',
      component: () => import('@/views/HealthPage.vue'),
      meta: { title: 'Health' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
      meta: { title: 'Settings' },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersPage.vue'),
      meta: { requiresAdmin: true, title: 'Users' },
    },
    {
      path: '/campaign-funnel',
      name: 'campaign-funnel',
      component: () => import('@/views/CampaignFunnelPage.vue'),
      meta: { title: 'Campaign Funnel' },
    },
    {
      path: '/audit-logs',
      name: 'audit-logs',
      component: () => import('@/views/AuditLogsPage.vue'),
      meta: { requiresAdmin: true, title: 'Audit Logs' },
    },
    // Analytics
    {
      path: '/analytics/executive',
      name: 'analytics-executive',
      component: () => import('@/views/analytics/ExecutivePage.vue'),
      meta: { title: 'Executive Analytics' },
    },
    {
      path: '/analytics/acquisition',
      name: 'analytics-acquisition',
      component: () => import('@/views/analytics/AcquisitionPage.vue'),
      meta: { title: 'Acquisition' },
    },
    {
      path: '/analytics/funnel',
      name: 'analytics-funnel',
      component: () => import('@/views/analytics/FunnelPage.vue'),
      meta: { title: 'Funnel' },
    },
    {
      path: '/analytics/users',
      name: 'analytics-users',
      component: () => import('@/views/analytics/UsersPage.vue'),
      meta: { title: 'Users Analytics' },
    },
    {
      path: '/analytics/products',
      name: 'analytics-products',
      component: () => import('@/views/analytics/ProductsPage.vue'),
      meta: { title: 'Products' },
    },
    {
      path: '/analytics/payments',
      name: 'analytics-payments',
      component: () => import('@/views/analytics/PaymentsPage.vue'),
      meta: { title: 'Payments' },
    },
    {
      path: '/analytics/orders',
      name: 'analytics-orders',
      component: () => import('@/views/analytics/OrdersPage.vue'),
      meta: { title: 'Orders' },
    },
    {
      path: '/analytics/retention',
      name: 'analytics-retention',
      component: () => import('@/views/analytics/RetentionPage.vue'),
      meta: { title: 'Retention' },
    },
    {
      path: '/analytics/data-health',
      name: 'analytics-data-health',
      component: () => import('@/views/analytics/DataHealthPage.vue'),
      meta: { title: 'Data Health' },
    },
    {
      path: '/analytics/reports',
      name: 'analytics-reports',
      component: () => import('@/views/analytics/ReportsPage.vue'),
      meta: { title: 'Reports' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundPage.vue'),
      meta: { public: true, title: 'Not Found' },
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
