import type { BackendInfo, BackendType } from '@/store/slices/comparison'

export const BACKEND_DATA: Record<BackendType, BackendInfo> = {
  redis: {
    id: 'redis',
    name: 'Redis',
    conformanceLevel: 4,
    features: {
      'Basic enqueue/dequeue': 'supported',
      'Priority queues': 'supported',
      'Delayed/scheduled jobs': 'supported',
      'Retry with backoff': 'supported',
      'Unique jobs': 'supported',
      'Batch operations': 'supported',
      'Workflow chains': 'supported',
      'Fan-out/fan-in': 'supported',
      'Dead letter queue': 'supported',
      'Job cancellation': 'supported',
      'Real-time notifications': 'supported',
      'Transactional enqueue': 'unsupported',
      'Persistent storage': 'partial',
      'Horizontal scaling': 'partial',
    },
    performance: { throughput: '50,000+ jobs/sec', p50: '< 1ms', p99: '< 5ms', maxPayload: '512 MB' },
    notes: 'In-memory with optional persistence (RDB/AOF). Lua scripts for atomic operations. Requires Redis 7.0+.',
    tradeoff: 'Best for high-throughput, low-latency workloads. Excellent developer experience with mature ecosystem. Trade-off: data durability requires careful configuration; memory-bound.',
  },
  postgres: {
    id: 'postgres',
    name: 'PostgreSQL',
    conformanceLevel: 4,
    features: {
      'Basic enqueue/dequeue': 'supported',
      'Priority queues': 'supported',
      'Delayed/scheduled jobs': 'supported',
      'Retry with backoff': 'supported',
      'Unique jobs': 'supported',
      'Batch operations': 'supported',
      'Workflow chains': 'supported',
      'Fan-out/fan-in': 'supported',
      'Dead letter queue': 'supported',
      'Job cancellation': 'supported',
      'Real-time notifications': 'supported',
      'Transactional enqueue': 'supported',
      'Persistent storage': 'supported',
      'Horizontal scaling': 'partial',
    },
    performance: { throughput: '10,000+ jobs/sec', p50: '< 5ms', p99: '< 20ms', maxPayload: '1 GB' },
    notes: 'Uses SELECT ... FOR UPDATE SKIP LOCKED for non-blocking dequeue. LISTEN/NOTIFY for real-time. Requires PostgreSQL 15+.',
    tradeoff: 'Best for transactional consistency — enqueue jobs in the same transaction as your business data. No additional infrastructure if you already use Postgres. Trade-off: lower throughput than Redis.',
  },
  kafka: {
    id: 'kafka',
    name: 'Kafka',
    conformanceLevel: 2,
    features: {
      'Basic enqueue/dequeue': 'supported',
      'Priority queues': 'unsupported',
      'Delayed/scheduled jobs': 'partial',
      'Retry with backoff': 'supported',
      'Unique jobs': 'partial',
      'Batch operations': 'supported',
      'Workflow chains': 'partial',
      'Fan-out/fan-in': 'supported',
      'Dead letter queue': 'supported',
      'Job cancellation': 'unsupported',
      'Real-time notifications': 'supported',
      'Transactional enqueue': 'supported',
      'Persistent storage': 'supported',
      'Horizontal scaling': 'supported',
    },
    performance: { throughput: '100,000+ msgs/sec', p50: '< 10ms', p99: '< 50ms', maxPayload: '1 MB default' },
    notes: 'Partition-based ordering. Consumer groups for scaling. Requires external state for job metadata.',
    tradeoff: 'Best for event-driven architectures with massive throughput needs and strong ordering guarantees per partition. Trade-off: no native priority queues; complex operational model.',
  },
  sqs: {
    id: 'sqs',
    name: 'Amazon SQS',
    conformanceLevel: 1,
    features: {
      'Basic enqueue/dequeue': 'supported',
      'Priority queues': 'partial',
      'Delayed/scheduled jobs': 'supported',
      'Retry with backoff': 'supported',
      'Unique jobs': 'supported',
      'Batch operations': 'supported',
      'Workflow chains': 'unsupported',
      'Fan-out/fan-in': 'unsupported',
      'Dead letter queue': 'supported',
      'Job cancellation': 'unsupported',
      'Real-time notifications': 'unsupported',
      'Transactional enqueue': 'unsupported',
      'Persistent storage': 'supported',
      'Horizontal scaling': 'supported',
    },
    performance: { throughput: '3,000 msgs/sec (FIFO)', p50: '< 20ms', p99: '< 100ms', maxPayload: '256 KB' },
    notes: 'Fully managed, no infrastructure to operate. Standard queues: unlimited throughput, at-least-once. FIFO: exactly-once, 3K msgs/sec.',
    tradeoff: 'Best for AWS-native workloads needing zero-ops queue infrastructure. Trade-off: limited advanced features; no workflows or cancellation; 256 KB payload limit.',
  },
  nats: {
    id: 'nats',
    name: 'NATS JetStream',
    conformanceLevel: 2,
    features: {
      'Basic enqueue/dequeue': 'supported',
      'Priority queues': 'unsupported',
      'Delayed/scheduled jobs': 'supported',
      'Retry with backoff': 'supported',
      'Unique jobs': 'partial',
      'Batch operations': 'supported',
      'Workflow chains': 'partial',
      'Fan-out/fan-in': 'supported',
      'Dead letter queue': 'supported',
      'Job cancellation': 'partial',
      'Real-time notifications': 'supported',
      'Transactional enqueue': 'unsupported',
      'Persistent storage': 'supported',
      'Horizontal scaling': 'supported',
    },
    performance: { throughput: '50,000+ msgs/sec', p50: '< 2ms', p99: '< 10ms', maxPayload: '1 MB default' },
    notes: 'JetStream provides persistence, acknowledgments, and consumer groups. Lightweight single binary. Embedded or clustered.',
    tradeoff: 'Best for lightweight, high-performance messaging with minimal operational overhead. Excellent for edge and IoT. Trade-off: less mature job-specific features compared to Redis/Postgres.',
  },
}

export function getRecommendation(features: Set<string>): { backend: BackendType; reason: string } {
  if (features.has('transactional_enqueue') || features.has('unique')) {
    return { backend: 'postgres', reason: 'Your job uses transactional enqueue or unique jobs, which PostgreSQL handles natively with ACID guarantees.' }
  }
  if (features.has('workflow') || features.has('fan_out')) {
    return { backend: 'redis', reason: 'Your job uses workflow features (chain/group/batch), which Redis supports at Level 4 with Lua-scripted atomicity.' }
  }
  if (features.has('priority')) {
    return { backend: 'redis', reason: 'Your job uses priority queues, which Redis supports natively. Kafka and SQS do not support priorities.' }
  }
  if (features.has('scheduled')) {
    return { backend: 'redis', reason: 'Your job uses scheduled execution. Redis handles delayed jobs with sorted sets for optimal performance.' }
  }
  return { backend: 'redis', reason: 'For general-purpose job processing, Redis offers the best combination of throughput, features, and developer experience.' }
}

export function detectJobFeatures(spec: Record<string, unknown>): Set<string> {
  const features = new Set<string>()
  if (spec.scheduled_at) features.add('scheduled')
  if (spec.priority !== undefined && spec.priority !== 0) features.add('priority')
  if (spec.retry) features.add('retry')
  if (spec.unique) features.add('unique')
  if (spec.meta && typeof spec.meta === 'object') {
    const meta = spec.meta as Record<string, unknown>
    if (meta.workflow_type) features.add('workflow')
    if (meta.workflow_type === 'group') features.add('fan_out')
  }
  return features
}
