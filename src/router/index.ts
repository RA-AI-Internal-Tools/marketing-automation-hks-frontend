import { createRouter, createWebHistory } from 'vue-router'
import { useEnvironmentStore } from '@/stores/environment'
import { STORAGE_KEYS } from '@/constants/storage'

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
      path: '/clients/:id/journey',
      name: 'client-journey',
      component: () => import('@/views/ClientJourneyPage.vue'),
      meta: { title: 'Client Journey' },
    },
    {
      path: '/campaigns/:id/builder',
      name: 'campaign-builder',
      component: () => import('@/views/CampaignBuilderPage.vue'),
      meta: { title: 'Campaign Flow' },
    },
    {
      path: '/broadcasts',
      name: 'broadcasts',
      component: () => import('@/views/BroadcastsPage.vue'),
      meta: { title: 'Broadcasts' },
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/TemplatesPage.vue'),
      meta: { title: 'Templates' },
    },
    {
      path: '/template-library',
      name: 'template-library',
      component: () => import('@/views/TemplateLibraryPage.vue'),
      meta: { requiresWrite: true, title: 'Template Library' },
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
      path: '/push-audience',
      name: 'push-audience',
      component: () => import('@/views/PushAudiencePage.vue'),
      meta: { title: 'Push Audience' },
    },
    {
      path: '/segments',
      name: 'segments',
      component: () => import('@/views/SegmentsPage.vue'),
      meta: { title: 'Segments' },
    },
    {
      path: '/segments/:slug',
      name: 'segment-detail',
      component: () => import('@/views/SegmentDetailPage.vue'),
      meta: { title: 'Segment Detail' },
    },
    {
      path: '/catalog',
      name: 'catalog',
      component: () => import('@/views/CatalogPage.vue'),
      // Catalog touches data that's read-only for viewers but the UI
      // shows product-mutation controls inside. requiresWrite gates
      // the whole page so a viewer never sees half-disabled UI; the
      // page's in-page buttons also guard defensively below.
      meta: { requiresWrite: true, title: 'Catalog' },
    },
    {
      path: '/cart-activity',
      name: 'cart-activity',
      component: () => import('@/views/CartActivityPage.vue'),
      meta: { title: 'Cart Activity' },
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
      path: '/campaigns/slug/:slug/funnel',
      redirect: (to) => ({ path: '/campaign-funnel', query: { slug: to.params.slug as string } }),
    },
    {
      path: '/outbound-webhooks',
      name: 'outbound-webhooks',
      component: () => import('@/views/OutboundWebhooksPage.vue'),
      meta: { requiresAdmin: true, title: 'Outbound webhooks' },
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
      path: '/analytics/attribution',
      name: 'analytics-attribution',
      component: () => import('@/views/analytics/AttributionPage.vue'),
      meta: { title: 'Attribution' },
    },
    {
      path: '/analytics/churn',
      name: 'analytics-churn',
      component: () => import('@/views/analytics/ChurnPage.vue'),
      meta: { title: 'Churn Risk' },
    },
    {
      path: '/analytics/rfm',
      name: 'analytics-rfm',
      component: () => import('@/views/analytics/RFMPage.vue'),
      meta: { title: 'RFM Segmentation' },
    },
    {
      path: '/analytics/cohort',
      name: 'analytics-cohort',
      component: () => import('@/views/analytics/CohortPage.vue'),
      meta: { title: 'Cohorts & LTV' },
    },
    {
      path: '/analytics/journey',
      name: 'analytics-journey',
      component: () => import('@/views/analytics/JourneyPage.vue'),
      meta: { title: 'Journey' },
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
  // Cookie-auth: the JWT is no longer readable from JS. We use the
  // AUTH_EMAIL marker as a client-side "probably logged in" signal —
  // the server is still the source of truth and will 401 if the cookie
  // is actually absent/expired, which our axios 401 interceptor handles.
  const loggedIn = !!localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL)
  const role = localStorage.getItem(STORAGE_KEYS.AUTH_ROLE)

  if (!isPublic && !loggedIn) {
    return { name: 'login' }
  }
  if (to.name === 'login' && loggedIn) {
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
  // Production guard: prompt confirmation before entering write routes in production
  if (to.meta.requiresWrite) {
    const envStore = useEnvironmentStore()
    if (envStore.isProduction) {
      return new Promise<boolean>((resolve) => {
        envStore.triggerGuard(() => resolve(true))
        // If the user cancels, the promise never resolves — use cancelGuard to reject
        const originalCancel = envStore.cancelGuard.bind(envStore)
        envStore.cancelGuard = () => {
          originalCancel()
          resolve(false)
          envStore.cancelGuard = originalCancel
        }
      })
    }
  }
})

// Update document title on navigation
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `AR-PAY · ${title}` : 'AR-PAY · Marketing Automation'
})

export default router
