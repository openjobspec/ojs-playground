import type { OJSJob } from './types'

export interface JobTemplate {
  id: string
  title: string
  description: string
  category: TemplateCategory
  level: number
  spec: OJSJob
}

export type TemplateCategory =
  | 'communication'
  | 'media'
  | 'data'
  | 'payments'
  | 'infrastructure'
  | 'workflows'

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'communication', label: 'Communication' },
  { id: 'media', label: 'Media Processing' },
  { id: 'data', label: 'Data & Reports' },
  { id: 'payments', label: 'Payments' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'workflows', label: 'Workflows' },
]

export const JOB_TEMPLATES: JobTemplate[] = [
  // Communication
  {
    id: 'email-send',
    title: 'Send Email',
    description: 'Basic email delivery with retry on transient failures',
    category: 'communication',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0001-7000-8000-000000000001',
      type: 'email.send',
      queue: 'default',
      args: ['user@example.com', 'welcome'],
      meta: { trace_id: '4bf92f3577b34da6a3ce929d0e0e4736', user_id: 'usr_12345' },
      priority: 0,
      timeout: 30,
      retry: { max_attempts: 3, initial_interval: 'PT1S', backoff_coefficient: 2.0, max_interval: 'PT5M', jitter: true },
    },
  },
  {
    id: 'email-template',
    title: 'Email with Template',
    description: 'Send templated email with variable substitution',
    category: 'communication',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0002-7000-8000-000000000002',
      type: 'email.send_template',
      queue: 'email',
      args: ['user@example.com', 'order-confirmation'],
      meta: { template_vars: { order_id: 'ORD-9876', total: '$42.99' } },
      priority: 0,
      timeout: 60,
      retry: { max_attempts: 5, initial_interval: 'PT2S', backoff_coefficient: 2.0, max_interval: 'PT10M', jitter: true },
    },
  },
  {
    id: 'push-notification',
    title: 'Push Notification',
    description: 'Dispatch mobile push notification via APNs/FCM',
    category: 'communication',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0003-7000-8000-000000000003',
      type: 'notification.push',
      queue: 'notifications',
      args: ['device_token_abc123', 'Your order has shipped!'],
      meta: { platform: 'ios', badge: 1 },
      priority: 5,
      timeout: 15,
      retry: { max_attempts: 3, initial_interval: 'PT500MS', backoff_coefficient: 1.5, max_interval: 'PT30S' },
    },
  },
  {
    id: 'sms-send',
    title: 'Send SMS',
    description: 'Send SMS message via Twilio/provider',
    category: 'communication',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0004-7000-8000-000000000004',
      type: 'sms.send',
      queue: 'sms',
      args: ['+14155551234', 'Your verification code is 847291'],
      meta: { provider: 'twilio' },
      priority: 10,
      timeout: 30,
      retry: { max_attempts: 3, initial_interval: 'PT1S', backoff_coefficient: 2.0, max_interval: 'PT1M' },
    },
  },
  // Media Processing
  {
    id: 'image-resize',
    title: 'Image Resize',
    description: 'Resize uploaded image to multiple dimensions',
    category: 'media',
    level: 0,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0005-7000-8000-000000000005',
      type: 'image.resize',
      queue: 'media',
      args: ['s3://uploads/photo.jpg'],
      meta: { widths: [150, 300, 600, 1200], format: 'webp', quality: 85 },
      timeout: 120,
      retry: { max_attempts: 2, initial_interval: 'PT5S', backoff_coefficient: 2.0, max_interval: 'PT1M' },
    },
  },
  {
    id: 'image-thumbnail',
    title: 'Generate Thumbnail',
    description: 'Create thumbnail with smart cropping',
    category: 'media',
    level: 0,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0006-7000-8000-000000000006',
      type: 'image.thumbnail',
      queue: 'media',
      args: ['s3://uploads/photo.jpg'],
      meta: { width: 150, height: 150, crop: 'smart' },
      timeout: 60,
      retry: { max_attempts: 2, initial_interval: 'PT3S', backoff_coefficient: 2.0, max_interval: 'PT30S' },
    },
  },
  // Data & Reports
  {
    id: 'csv-export',
    title: 'CSV Export',
    description: 'Generate CSV export from database query',
    category: 'data',
    level: 0,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0007-7000-8000-000000000007',
      type: 'export.csv',
      queue: 'reports',
      args: ['users'],
      meta: { filters: { status: 'active', created_after: '2024-01-01' }, columns: ['id', 'name', 'email'] },
      timeout: 300,
      retry: { max_attempts: 2, initial_interval: 'PT10S', backoff_coefficient: 2.0, max_interval: 'PT2M' },
    },
  },
  {
    id: 'daily-digest',
    title: 'Daily Digest Report',
    description: 'Scheduled daily report compilation and delivery',
    category: 'data',
    level: 2,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0008-7000-8000-000000000008',
      type: 'report.daily_digest',
      queue: 'reports',
      args: ['analytics'],
      meta: { recipients: ['team@company.com'], format: 'pdf' },
      scheduled_at: '2026-02-14T06:00:00Z',
      timeout: 600,
      retry: { max_attempts: 3, initial_interval: 'PT30S', backoff_coefficient: 2.0, max_interval: 'PT10M' },
    },
  },
  {
    id: 'cache-invalidation',
    title: 'Cache Invalidation',
    description: 'Invalidate cache entries after data change',
    category: 'data',
    level: 0,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0009-7000-8000-000000000009',
      type: 'cache.invalidate',
      queue: 'default',
      args: ['user:12345'],
      meta: { patterns: ['user:12345:*', 'feed:*:user:12345'] },
      priority: 10,
      timeout: 10,
      retry: { max_attempts: 3, initial_interval: 'PT100MS', backoff_coefficient: 2.0, max_interval: 'PT5S' },
    },
  },
  // Payments
  {
    id: 'payment-charge',
    title: 'Process Payment',
    description: 'Charge customer via payment gateway',
    category: 'payments',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000a-7000-8000-00000000000a',
      type: 'payment.charge',
      queue: 'payments',
      args: ['cus_ABC123'],
      meta: { amount_cents: 4299, currency: 'usd', idempotency_key: 'pay_xyz789' },
      timeout: 30,
      retry: { max_attempts: 3, initial_interval: 'PT2S', backoff_coefficient: 3.0, max_interval: 'PT1M', non_retryable_errors: ['card_declined', 'insufficient_funds'] },
    },
  },
  {
    id: 'payment-refund',
    title: 'Process Refund',
    description: 'Issue refund for a previous charge',
    category: 'payments',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000b-7000-8000-00000000000b',
      type: 'payment.refund',
      queue: 'payments',
      args: ['ch_DEF456'],
      meta: { amount_cents: 4299, reason: 'customer_request' },
      timeout: 30,
      retry: { max_attempts: 5, initial_interval: 'PT5S', backoff_coefficient: 2.0, max_interval: 'PT5M' },
    },
  },
  // Infrastructure
  {
    id: 'webhook-deliver',
    title: 'Webhook Delivery',
    description: 'Deliver webhook with signature verification and retry',
    category: 'infrastructure',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000c-7000-8000-00000000000c',
      type: 'webhook.deliver',
      queue: 'webhooks',
      args: ['https://api.customer.com/hooks/ojs'],
      meta: { event: 'order.completed', payload: { order_id: 'ORD-9876' }, signature_algo: 'hmac-sha256' },
      timeout: 30,
      retry: { max_attempts: 8, initial_interval: 'PT5S', backoff_coefficient: 2.0, max_interval: 'PT1H', jitter: true, on_exhaustion: 'dead_letter' },
    },
  },
  {
    id: 'api-sync',
    title: 'API Synchronization',
    description: 'Sync data with external API endpoint',
    category: 'infrastructure',
    level: 1,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000d-7000-8000-00000000000d',
      type: 'sync.api',
      queue: 'sync',
      args: ['salesforce'],
      meta: { entity: 'contacts', direction: 'push', batch_size: 100 },
      timeout: 300,
      retry: { max_attempts: 5, initial_interval: 'PT10S', backoff_coefficient: 2.0, max_interval: 'PT10M', jitter: true },
    },
  },
  {
    id: 'cleanup-old-data',
    title: 'Data Cleanup',
    description: 'Scheduled cleanup of expired records',
    category: 'infrastructure',
    level: 2,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000e-7000-8000-00000000000e',
      type: 'maintenance.cleanup',
      queue: 'maintenance',
      args: ['sessions'],
      meta: { older_than_days: 30, batch_size: 1000 },
      scheduled_at: '2026-02-14T03:00:00Z',
      timeout: 600,
      retry: { max_attempts: 2, initial_interval: 'PT30S', backoff_coefficient: 2.0, max_interval: 'PT5M' },
    },
  },
  // Workflows
  {
    id: 'onboarding-workflow',
    title: 'User Onboarding Workflow',
    description: 'Multi-step onboarding: verify email → setup profile → send welcome',
    category: 'workflows',
    level: 3,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-000f-7000-8000-00000000000f',
      type: 'workflow.user_onboarding',
      queue: 'workflows',
      args: ['usr_12345'],
      meta: {
        steps: ['email.verify', 'profile.setup', 'email.send_welcome'],
        workflow_type: 'chain',
      },
      timeout: 3600,
      retry: { max_attempts: 3, initial_interval: 'PT5S', backoff_coefficient: 2.0, max_interval: 'PT5M' },
    },
  },
  {
    id: 'order-fulfillment',
    title: 'Order Fulfillment Pipeline',
    description: 'Fan-out/fan-in: validate → [pick, pack, label] → ship → notify',
    category: 'workflows',
    level: 3,
    spec: {
      specversion: '1.0.0-rc.1',
      id: '019461a8-0010-7000-8000-000000000010',
      type: 'workflow.order_fulfillment',
      queue: 'workflows',
      args: ['ORD-9876'],
      meta: {
        workflow_type: 'group',
        steps: ['order.validate', 'warehouse.pick', 'warehouse.pack', 'shipping.label', 'shipping.dispatch', 'notification.send'],
      },
      timeout: 7200,
      retry: { max_attempts: 3, initial_interval: 'PT10S', backoff_coefficient: 2.0, max_interval: 'PT10M' },
    },
  },
]
