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
    // Public preference centre. Anonymous: the recipient of a marketing email
    // has no session, and the subject is resolved server-side from the token.
    // `/preferences/:token` is canonical; the bare `/preferences` form stays
    // for the `?token=` links already sitting in inboxes.
    //
    // `/preferences/confirm/:shortToken` is three segments and `:token` is
    // two, so the confirm route cannot be swallowed by the token route.
    {
      path: '/preferences',
      name: 'preferences',
      component: () => import('@/views/PreferenceCenterPage.vue'),
      meta: { public: true, title: 'Preferences' },
    },
    {
      path: '/preferences/confirm/:shortToken',
      name: 'preferences-confirm',
      component: () => import('@/views/PreferenceConfirmPage.vue'),
      meta: { public: true, title: 'Confirm preference' },
    },
    {
      path: '/preferences/:token',
      name: 'preferences-token',
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
      meta: { requiresAnalytics: true, title: 'Executive Analytics' },
    },
    {
      path: '/analytics/acquisition',
      name: 'analytics-acquisition',
      component: () => import('@/views/analytics/AcquisitionPage.vue'),
      meta: { requiresAnalytics: true, title: 'Acquisition' },
    },
    {
      path: '/analytics/funnel',
      name: 'analytics-funnel',
      component: () => import('@/views/analytics/FunnelPage.vue'),
      meta: { requiresAnalytics: true, title: 'Funnel' },
    },
    {
      path: '/analytics/clients',
      name: 'analytics-clients',
      component: () => import('@/views/analytics/ClientsPage.vue'),
      meta: { requiresAnalytics: true, title: 'Clients Analytics' },
    },
    {
      path: '/analytics/users',
      redirect: '/analytics/clients',
    },
    {
      path: '/analytics/products',
      name: 'analytics-products',
      component: () => import('@/views/analytics/ProductsPage.vue'),
      meta: { requiresAnalytics: true, title: 'Products' },
    },
    {
      path: '/analytics/payments',
      name: 'analytics-payments',
      component: () => import('@/views/analytics/PaymentsPage.vue'),
      meta: { requiresAnalytics: true, title: 'Payments' },
    },
    {
      path: '/analytics/orders',
      name: 'analytics-orders',
      component: () => import('@/views/analytics/OrdersPage.vue'),
      meta: { requiresAnalytics: true, title: 'Orders' },
    },
    {
      path: '/analytics/retention',
      name: 'analytics-retention',
      component: () => import('@/views/analytics/RetentionPage.vue'),
      meta: { requiresAnalytics: true, title: 'Retention' },
    },
    {
      path: '/analytics/data-health',
      name: 'analytics-data-health',
      component: () => import('@/views/analytics/DataHealthPage.vue'),
      meta: { requiresAnalytics: true, title: 'Data Health' },
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
      meta: { requiresAnalytics: true, title: 'Attribution' },
    },
    {
      path: '/analytics/churn',
      name: 'analytics-churn',
      component: () => import('@/views/analytics/ChurnPage.vue'),
      meta: { requiresAnalytics: true, title: 'Churn Risk' },
    },
    {
      path: '/analytics/rfm',
      name: 'analytics-rfm',
      component: () => import('@/views/analytics/RFMPage.vue'),
      meta: { requiresAnalytics: true, title: 'RFM Segmentation' },
    },
    {
      path: '/analytics/cohort',
      name: 'analytics-cohort',
      component: () => import('@/views/analytics/CohortPage.vue'),
      meta: { requiresAnalytics: true, title: 'Cohorts & LTV' },
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
  // Analytics: admin or editor, READ-only.
  //
  // Same allow-list as requiresWrite but deliberately a separate flag, because
  // requiresWrite also arms the production confirmation below. Reusing it here
  // would pop a "you are about to change production" dialog on every dashboard
  // click, and a confirmation that fires on ordinary reads is one operators
  // learn to dismiss without reading — which is the whole point of the guard,
  // gone.
  //
  // This mirrors the server: /api/analytics/* is gated to admin+editor. Without
  // it a viewer still sees the sidebar entry and reaches a page that renders
  // nothing but 403s. That was already true for Churn Risk and Cohorts & LTV,
  // whose endpoints have been admin+editor for longer than this flag has
  // existed.
  if (to.meta.requiresAnalytics && role !== 'admin' && role !== 'editor') {
    return { name: 'overview' }
  }
  // Production guard: confirm ONCE per session before entering write routes
  // in production. `needsProductionGuard` is false after the operator has
  // acknowledged for the current environment, and switching environment
  // re-arms it — see the scope rationale in stores/environment.ts.
  //
  // Two of these routes (/template-library, /catalog) are plain sidebar
  // entries, so without the memory this fired on every ordinary click.
  if (to.meta.requiresWrite) {
    const envStore = useEnvironmentStore()
    if (envStore.needsProductionGuard) {
      // requestGuard owns both outcomes, so nothing here reassigns store
      // actions; confirm resolves true, cancel/supersede resolves false.
      return new Promise<boolean>((resolve) => envStore.requestGuard(resolve))
    }
  }
})

// Update document title on navigation
router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `AR-PAY · ${title}` : 'AR-PAY · Marketing Automation'
})

export default router
