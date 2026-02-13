import type { Tutorial } from '@/store/slices/tutorial'

export const TUTORIALS: Tutorial[] = [
  {
    id: 'first-job',
    title: 'Your First Job',
    description: 'Learn the basics of defining and simulating an OJS job.',
    level: 0,
    steps: [
      {
        id: 'intro',
        title: 'Welcome',
        description: 'OJS defines a universal envelope for background jobs. In this tutorial, you\'ll create a simple email sending job and watch it execute through the OJS lifecycle.',
      },
      {
        id: 'define-job',
        title: 'Define a Job',
        description: 'Every OJS job needs a `type` (what it does), a `queue` (where it runs), and `args` (what data it needs). The editor on the left shows a pre-filled example. Notice how autocomplete suggests valid fields.',
        spec: JSON.stringify({
          specversion: '1.0.0-rc.1',
          id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
          type: 'email.send',
          queue: 'default',
          args: ['user@example.com', 'welcome'],
          timeout: 30,
        }, null, 2),
        action: 'load_spec',
      },
      {
        id: 'run-sim',
        title: 'Run the Simulation',
        description: 'Click the "Play" button (or press Cmd+Enter) to watch the job flow through its lifecycle: available → active → completed. The state machine diagram shows each transition.',
        action: 'run_simulation',
      },
      {
        id: 'check-code',
        title: 'Generated Code',
        description: 'Look at the right panel — the playground has generated working SDK code. Switch between languages using the tabs (Go, JS, Python, Ruby, Rust, Java). Copy the code and use it in your project!',
        action: 'switch_language',
      },
      {
        id: 'done',
        title: 'Congratulations!',
        description: 'You\'ve created your first OJS job. Next, try Tutorial 2 to learn about retry policies, or explore the templates library for real-world examples.',
      },
    ],
  },
  {
    id: 'retry-policies',
    title: 'Retry Policies',
    description: 'Understand exponential backoff, jitter, and dead letter queues.',
    level: 1,
    steps: [
      {
        id: 'intro',
        title: 'Why Retries Matter',
        description: 'Network failures, rate limits, and temporary outages are inevitable. OJS retry policies let you handle transient errors automatically with configurable backoff strategies.',
      },
      {
        id: 'add-retry',
        title: 'Add a Retry Policy',
        description: 'This job has a retry policy with 5 max attempts, exponential backoff starting at 1 second, and jitter enabled. Watch how the retry timeline shows the increasing delays between attempts.',
        spec: JSON.stringify({
          specversion: '1.0.0-rc.1',
          id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
          type: 'webhook.deliver',
          queue: 'webhooks',
          args: ['https://api.customer.com/hooks'],
          timeout: 30,
          retry: {
            max_attempts: 5,
            initial_interval: 'PT1S',
            backoff_coefficient: 2.0,
            max_interval: 'PT5M',
            jitter: true,
          },
        }, null, 2),
        action: 'load_spec',
      },
      {
        id: 'simulate-failure',
        title: 'Simulate Failures',
        description: 'Change the scenario dropdown to "Success after retries" or "Retries exhausted" to see how the job behaves under different failure conditions. Notice the retry timeline below the state machine.',
        action: 'change_scenario',
      },
      {
        id: 'compare-strategies',
        title: 'Compare Backoff Strategies',
        description: 'Try switching between Exponential, Linear, and Polynomial backoff in the strategy dropdown. Watch how the spacing between retry dots changes in the timeline.',
      },
      {
        id: 'done',
        title: 'Retry Mastery',
        description: 'You now understand OJS retry policies. Key takeaway: always enable jitter to prevent thundering herd problems, and set max_interval to cap exponential growth.',
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling & Priorities',
    description: 'Learn how to schedule jobs for future execution and use priority queues.',
    level: 2,
    steps: [
      {
        id: 'intro',
        title: 'Beyond Immediate Execution',
        description: 'Sometimes jobs need to run at a specific time (daily reports) or with different urgency levels (critical alerts vs. batch imports). OJS supports both.',
      },
      {
        id: 'scheduled-job',
        title: 'Schedule a Job',
        description: 'This job has a `scheduled_at` field set to a future time. When you simulate it, notice the job starts in the "scheduled" state and waits before becoming "available".',
        spec: JSON.stringify({
          specversion: '1.0.0-rc.1',
          id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
          type: 'report.daily_digest',
          queue: 'reports',
          args: ['analytics'],
          scheduled_at: '2026-02-14T06:00:00Z',
          timeout: 600,
          retry: { max_attempts: 3, initial_interval: 'PT30S', backoff_coefficient: 2.0, max_interval: 'PT10M' },
        }, null, 2),
        action: 'load_spec',
      },
      {
        id: 'priority',
        title: 'Priority Queues',
        description: 'Set `priority` to a positive number — higher values mean the job is processed sooner. Priority 10 is processed before priority 0. Try changing the priority field.',
      },
      {
        id: 'done',
        title: 'Complete',
        description: 'You\'ve learned scheduling and priorities. These are Level 2 features — check the Conformance panel to see which backends support them.',
      },
    ],
  },
]
