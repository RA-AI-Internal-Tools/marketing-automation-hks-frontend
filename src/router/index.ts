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
    },
    {
      path: '/campaigns/:id/edit',
      name: 'campaign-edit',
      component: () => import('@/views/CampaignEditorPage.vue'),
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
    },
    {
      path: '/templates/:id/edit',
      name: 'template-edit',
      component: () => import('@/views/TemplateEditorPage.vue'),
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
  ],
})

// Navigation guard: redirect unauthenticated users to login
router.beforeEach((to) => {
  const isPublic = to.meta.public === true
  const token = localStorage.getItem('ma_auth_token')
  if (!isPublic && !token) {
    return { name: 'login' }
  }
  if (to.name === 'login' && token) {
    return { name: 'overview' }
  }
})

export default router
