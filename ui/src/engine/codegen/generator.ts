import type { CodegenLanguage, CodegenScope, OJSJob } from '../types'
import { buildContext } from './context'

// ---- Go Templates ----

function goArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return 'ojs.Args{}'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `"${arg}"` : JSON.stringify(arg)
    return `\t\t"${key}": ${val},`
  })
  return `ojs.Args{\n${entries.join('\n')}\n\t}`
}

function goRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  if (retry.max_attempts !== undefined) parts.push(`MaxAttempts: ${retry.max_attempts}`)
  if (retry.initial_interval) {
    const dur = isoToGoDuration(retry.initial_interval as string)
    parts.push(`InitialInterval: ${dur}`)
  }
  if (retry.backoff_coefficient !== undefined) parts.push(`BackoffCoefficient: ${retry.backoff_coefficient}`)
  if (retry.max_interval) {
    const dur = isoToGoDuration(retry.max_interval as string)
    parts.push(`MaxInterval: ${dur}`)
  }
  return `ojs.RetryPolicy{${parts.join(', ')}}`
}

function isoToGoDuration(iso: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso)
  if (!match) return `/* ${iso} */`
  const h = parseInt(match[1] ?? '0', 10)
  const m = parseInt(match[2] ?? '0', 10)
  const s = parseFloat(match[3] ?? '0')
  const parts: string[] = []
  if (h > 0) parts.push(`${h}*time.Hour`)
  if (m > 0) parts.push(`${m}*time.Minute`)
  if (s > 0) parts.push(Number.isInteger(s) ? `${s}*time.Second` : `time.Duration(${s * 1e9})`)
  return parts.length > 0 ? parts.join(' + ') : '0'
}

function generateGoEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'go')
  const options: string[] = []
  if (job.queue !== 'default') options.push(`\t\tojs.WithQueue("${job.queue}"),`)
  if (ctx.hasRetry) options.push(`\t\tojs.WithRetry(${goRetryLiteral(job.retry as Record<string, unknown>)}),`)
  if (ctx.hasPriority) options.push(`\t\tojs.WithPriority(${job.priority}),`)
  if (ctx.hasTimeout) options.push(`\t\tojs.WithTimeout(${job.timeout}*time.Second),`)

  const optionsStr = options.length > 0 ? '\n' + options.join('\n') + '\n\t' : ''

  return `package main

import (
\t"context"
\t"fmt"
\t"log"
\t"time"

\tojs "github.com/openjobspec/ojs-go-sdk"
)

func main() {
\tclient, err := ojs.NewClient("http://localhost:8080")
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\tjob, err := client.Enqueue(context.Background(), "${job.type}",
\t\t${goArgsLiteral(job.args)},${optionsStr})
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\tfmt.Printf("Enqueued job: %s (state: %s)\\n", job.ID, job.State)
}
`
}

function generateGoWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'go')
  const argExtractions = ctx.argsTyped.map((a) => {
    const goType = a.type === 'string' ? 'string' :
                   a.type === 'int' ? 'int' :
                   a.type === 'float' ? 'float64' :
                   a.type === 'bool' ? 'bool' : 'any'
    return `\t${a.name}, _ := ctx.Job.Args["${a.name}"].(${goType})`
  }).join('\n')

  return `package main

import (
\t"context"
\t"fmt"
\t"log"
\t"os"
\t"os/signal"
\t"syscall"

\tojs "github.com/openjobspec/ojs-go-sdk"
)

func main() {
\tworker := ojs.NewWorker("http://localhost:8080",
\t\tojs.WithQueues("${job.queue}"),
\t\tojs.WithConcurrency(10),
\t)

\tworker.Register("${job.type}", func(ctx ojs.JobContext) error {
${argExtractions}

\t\tfmt.Printf("Processing ${ctx.jobTypePascal}: %v\\n", ${ctx.argsTyped[0]?.name ?? '"job"'})

\t\tctx.SetResult(map[string]any{
\t\t\t"processed": true,
\t\t})
\t\treturn nil
\t})

\tctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
\tdefer cancel()

\tlog.Printf("Starting worker for ${job.type}...")
\tif err := worker.Start(ctx); err != nil {
\t\tfmt.Fprintf(os.Stderr, "Worker error: %v\\n", err)
\t\tos.Exit(1)
\t}
}
`
}

function generateGoFull(job: OJSJob): string {
  const enqueue = generateGoEnqueue(job)
  const worker = generateGoWorker(job)
  return `// === Enqueue (Producer) ===\n\n${enqueue}\n// === Worker (Consumer) ===\n\n${worker}`
}

// ---- JavaScript Templates ----

function jsArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return '{}'
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    return JSON.stringify(args[0], null, 2).replace(/\n/g, '\n  ')
  }
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `'${arg}'` : JSON.stringify(arg)
    return `  ${key}: ${val},`
  })
  return `{\n${entries.join('\n')}\n}`
}

function jsRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  if (retry.max_attempts !== undefined) parts.push(`    maxAttempts: ${retry.max_attempts},`)
  if (retry.initial_interval) parts.push(`    initialInterval: '${retry.initial_interval}',`)
  if (retry.backoff_coefficient !== undefined) parts.push(`    backoffCoefficient: ${retry.backoff_coefficient},`)
  if (retry.max_interval) parts.push(`    maxInterval: '${retry.max_interval}',`)
  if (retry.jitter !== undefined) parts.push(`    jitter: ${retry.jitter},`)
  return `{\n${parts.join('\n')}\n  }`
}

function generateJsEnqueue(job: OJSJob): string {
  const options: string[] = []
  if (job.queue !== 'default') options.push(`  queue: '${job.queue}',`)
  if (job.retry) options.push(`  retry: ${jsRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (job.priority !== undefined && job.priority !== 0) options.push(`  priority: ${job.priority},`)
  if (typeof job.timeout === 'number' && job.timeout > 0) options.push(`  timeout: ${job.timeout * 1000},`)

  const optionsArg = options.length > 0 ? `,\n{\n${options.join('\n')}\n}` : ''

  return `import { OJSClient } from '@openjobspec/sdk';

const client = new OJSClient({ url: 'http://localhost:8080' });

const job = await client.enqueue(
  '${job.type}',
  ${jsArgsLiteral(job.args)}${optionsArg}
);

console.log(\`Enqueued job: \${job.id} (state: \${job.state})\`);
`
}

function generateJsWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'javascript')
  const destructure = ctx.argsTyped.map((a) => a.name).join(', ')

  return `import { OJSWorker } from '@openjobspec/sdk';

const worker = new OJSWorker({
  url: 'http://localhost:8080',
  queues: ['${job.queue}'],
  concurrency: 10,
});

worker.register('${job.type}', async (ctx) => {
  const { ${destructure} } = ctx.job.args[0];

  console.log(\`Processing ${ctx.jobTypePascal}: \${${ctx.argsTyped[0]?.name ?? '"job"'}}\`);

  return { processed: true };
});

await worker.start();

process.on('SIGTERM', async () => {
  await worker.stop();
  process.exit(0);
});
`
}

function generateJsFull(job: OJSJob): string {
  const enqueue = generateJsEnqueue(job)
  const worker = generateJsWorker(job)
  return `// === Enqueue (Producer) ===\n\n${enqueue}\n// === Worker (Consumer) ===\n\n${worker}`
}

// ---- Python Templates ----

function pyArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return '{}'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `"${arg}"` :
                typeof arg === 'boolean' ? (arg ? 'True' : 'False') :
                typeof arg === 'object' && arg === null ? 'None' :
                JSON.stringify(arg)
    return `    "${key}": ${val},`
  })
  return `{\n${entries.join('\n')}\n}`
}

function pyRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  if (retry.max_attempts !== undefined) parts.push(`    max_attempts=${retry.max_attempts},`)
  if (retry.initial_interval) parts.push(`    initial_interval="${retry.initial_interval}",`)
  if (retry.backoff_coefficient !== undefined) parts.push(`    backoff_coefficient=${retry.backoff_coefficient},`)
  if (retry.max_interval) parts.push(`    max_interval="${retry.max_interval}",`)
  if (retry.jitter !== undefined) parts.push(`    jitter=${retry.jitter ? 'True' : 'False'},`)
  return `RetryPolicy(\n${parts.join('\n')}\n)`
}

function generatePythonEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'python')
  const options: string[] = []
  if (job.queue !== 'default') options.push(`    queue="${job.queue}",`)
  if (ctx.hasRetry) options.push(`    retry=${pyRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (ctx.hasPriority) options.push(`    priority=${job.priority},`)
  if (ctx.hasTimeout) options.push(`    timeout=${job.timeout},`)

  const optionsStr = options.length > 0 ? '\n' + options.join('\n') + '\n' : ''

  return `import asyncio
from openjobspec import OJSClient${ctx.hasRetry ? ', RetryPolicy' : ''}

async def main():
    client = OJSClient(url="http://localhost:8080")

    job = await client.enqueue(
        "${job.type}",
        ${pyArgsLiteral(job.args)},${optionsStr}    )

    print(f"Enqueued job: {job.id} (state: {job.state})")

asyncio.run(main())
`
}

function generatePythonWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'python')
  const argAccess = ctx.argsTyped.map((a) => `    ${a.name} = ctx.job.args[0]["${a.name}"]`).join('\n')

  return `import asyncio
import signal
from openjobspec import OJSWorker

worker = OJSWorker(
    url="http://localhost:8080",
    queues=["${job.queue}"],
    concurrency=10,
)

@worker.register("${job.type}")
async def handle_${ctx.jobTypeSnake}(ctx):
${argAccess}

    print(f"Processing ${ctx.jobTypePascal}: {${ctx.argsTyped[0]?.name ?? '"job"'}}")

    return {"processed": True}

async def main():
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: asyncio.create_task(worker.stop()))

    print("Starting worker for ${job.type}...")
    await worker.start()

asyncio.run(main())
`
}

function generatePythonFull(job: OJSJob): string {
  const enqueue = generatePythonEnqueue(job)
  const worker = generatePythonWorker(job)
  return `# === Enqueue (Producer) ===\n\n${enqueue}\n# === Worker (Consumer) ===\n\n${worker}`
}

// ---- Ruby Templates ----

function rbArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return '{}'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `"${arg}"` :
                typeof arg === 'boolean' ? (arg ? 'true' : 'false') :
                typeof arg === 'object' && arg === null ? 'nil' :
                JSON.stringify(arg)
    return `    "${key}" => ${val},`
  })
  return `{\n${entries.join('\n')}\n  }`
}

function rbRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  if (retry.max_attempts !== undefined) parts.push(`    max_attempts: ${retry.max_attempts},`)
  if (retry.initial_interval) parts.push(`    initial_interval: "${retry.initial_interval}",`)
  if (retry.backoff_coefficient !== undefined) parts.push(`    backoff_coefficient: ${retry.backoff_coefficient},`)
  if (retry.max_interval) parts.push(`    max_interval: "${retry.max_interval}",`)
  if (retry.jitter !== undefined) parts.push(`    jitter: ${retry.jitter},`)
  return `{\n${parts.join('\n')}\n  }`
}

function generateRubyEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'ruby')
  const options: string[] = []
  if (job.queue !== 'default') options.push(`  queue: "${job.queue}",`)
  if (ctx.hasRetry) options.push(`  retry: ${rbRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (ctx.hasPriority) options.push(`  priority: ${job.priority},`)
  if (ctx.hasTimeout) options.push(`  timeout: ${job.timeout},`)

  const optionsStr = options.length > 0 ? '\n' + options.join('\n') + '\n' : ''

  return `require "openjobspec"

client = OJS::Client.new(url: "http://localhost:8080")

job = client.enqueue(
  "${job.type}",
  ${rbArgsLiteral(job.args)},${optionsStr})

puts "Enqueued job: #{job.id} (state: #{job.state})"
`
}

function generateRubyWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'ruby')
  const argAccess = ctx.argsTyped.map((a) => `    ${a.name} = ctx.job.args[0]["${a.name}"]`).join('\n')

  return `require "openjobspec"

worker = OJS::Worker.new(
  url: "http://localhost:8080",
  queues: ["${job.queue}"],
  concurrency: 10
)

worker.register("${job.type}") do |ctx|
${argAccess}

  puts "Processing ${ctx.jobTypePascal}: #{${ctx.argsTyped[0]?.name ?? '"job"'}}"

  { processed: true }
end

Signal.trap("TERM") { worker.stop }

puts "Starting worker for ${job.type}..."
worker.start
`
}

function generateRubyFull(job: OJSJob): string {
  const enqueue = generateRubyEnqueue(job)
  const worker = generateRubyWorker(job)
  return `# === Enqueue (Producer) ===\n\n${enqueue}\n# === Worker (Consumer) ===\n\n${worker}`
}

// ---- Rust Templates ----

function rustArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return 'serde_json::json!({})'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `"${arg}"` : JSON.stringify(arg)
    return `        "${key}": ${val},`
  })
  return `serde_json::json!({\n${entries.join('\n')}\n    })`
}

function rustRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = ['        RetryPolicy::builder()']
  if (retry.max_attempts !== undefined) parts.push(`            .max_attempts(${retry.max_attempts})`)
  if (retry.initial_interval) parts.push(`            .initial_interval("${retry.initial_interval}".parse().unwrap())`)
  if (retry.backoff_coefficient !== undefined) parts.push(`            .backoff_coefficient(${retry.backoff_coefficient})`)
  if (retry.max_interval) parts.push(`            .max_interval("${retry.max_interval}".parse().unwrap())`)
  if (retry.jitter !== undefined) parts.push(`            .jitter(${retry.jitter})`)
  parts.push('            .build()')
  return parts.join('\n')
}

function generateRustEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'rust')
  const options: string[] = []
  if (job.queue !== 'default') options.push(`        .queue("${job.queue}")`)
  if (ctx.hasRetry) options.push(`        .retry(\n${rustRetryLiteral(job.retry as Record<string, unknown>)}\n        )`)
  if (ctx.hasPriority) options.push(`        .priority(${job.priority})`)
  if (ctx.hasTimeout) options.push(`        .timeout(Duration::from_secs(${job.timeout}))`)

  const builderChain = options.length > 0 ? '\n' + options.join('\n') + '\n        ' : ''

  return `use ojs_sdk::{OJSClient${ctx.hasRetry ? ', RetryPolicy' : ''}};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = OJSClient::new("http://localhost:8080")?;

    let job = client
        .enqueue("${job.type}")
        .args(${rustArgsLiteral(job.args)})${builderChain}.send()
        .await?;

    println!("Enqueued job: {} (state: {:?})", job.id, job.state);
    Ok(())
}
`
}

function generateRustWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'rust')

  return `use ojs_sdk::{OJSWorker, JobContext, Result as OJSResult};
use tokio::signal;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let worker = OJSWorker::builder("http://localhost:8080")
        .queues(vec!["${job.queue}".into()])
        .concurrency(10)
        .build()?;

    worker.register("${job.type}", handle_${ctx.jobTypeSnake}).await;

    println!("Starting worker for ${job.type}...");
    tokio::select! {
        result = worker.start() => result?,
        _ = signal::ctrl_c() => {
            worker.stop().await?;
        }
    }

    Ok(())
}

async fn handle_${ctx.jobTypeSnake}(ctx: JobContext) -> OJSResult<serde_json::Value> {
    let args = &ctx.job.args;
    println!("Processing ${ctx.jobTypePascal}: {:?}", args);

    Ok(serde_json::json!({ "processed": true }))
}
`
}

function generateRustFull(job: OJSJob): string {
  const enqueue = generateRustEnqueue(job)
  const worker = generateRustWorker(job)
  return `// === Enqueue (Producer) ===\n\n${enqueue}\n// === Worker (Consumer) ===\n\n${worker}`
}

// ---- Java Templates ----

function javaArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return 'Map.of()'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    const val = typeof arg === 'string' ? `"${arg}"` :
                typeof arg === 'boolean' ? String(arg) :
                typeof arg === 'number' ? String(arg) :
                `"${JSON.stringify(arg)}"`
    return `            "${key}", ${val}`
  })
  if (entries.length <= 5) {
    return `Map.of(\n${entries.join(',\n')}\n        )`
  }
  return `Map.of(\n${entries.join(',\n')}\n        )`
}

function javaRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = ['        RetryPolicy.builder()']
  if (retry.max_attempts !== undefined) parts.push(`            .maxAttempts(${retry.max_attempts})`)
  if (retry.initial_interval) parts.push(`            .initialInterval(Duration.parse("${retry.initial_interval}"))`)
  if (retry.backoff_coefficient !== undefined) parts.push(`            .backoffCoefficient(${retry.backoff_coefficient})`)
  if (retry.max_interval) parts.push(`            .maxInterval(Duration.parse("${retry.max_interval}"))`)
  if (retry.jitter !== undefined) parts.push(`            .jitter(${retry.jitter})`)
  parts.push('            .build()')
  return parts.join('\n')
}

function generateJavaEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'java')
  const options: string[] = []
  if (job.queue !== 'default') options.push(`            .queue("${job.queue}")`)
  if (ctx.hasRetry) options.push(`            .retry(\n${javaRetryLiteral(job.retry as Record<string, unknown>)}\n            )`)
  if (ctx.hasPriority) options.push(`            .priority(${job.priority})`)
  if (ctx.hasTimeout) options.push(`            .timeout(Duration.ofSeconds(${job.timeout}))`)

  const builderChain = options.length > 0 ? '\n' + options.join('\n') + '\n            ' : ''

  return `import org.openjobspec.sdk.OJSClient;
${ctx.hasRetry ? 'import org.openjobspec.sdk.RetryPolicy;\n' : ''}import java.time.Duration;
import java.util.Map;

public class Enqueue${ctx.jobTypePascal} {
    public static void main(String[] args) throws Exception {
        var client = OJSClient.create("http://localhost:8080");

        var job = client.enqueue("${job.type}")
            .args(${javaArgsLiteral(job.args)})${builderChain}.send();

        System.out.printf("Enqueued job: %s (state: %s)%n", job.id(), job.state());
    }
}
`
}

function generateJavaWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'java')

  return `import org.openjobspec.sdk.OJSWorker;
import org.openjobspec.sdk.JobContext;
import java.util.Map;

public class ${ctx.jobTypePascal}Worker {
    public static void main(String[] args) throws Exception {
        var worker = OJSWorker.builder("http://localhost:8080")
            .queues("${job.queue}")
            .concurrency(10)
            .build();

        worker.register("${job.type}", ${ctx.jobTypePascal}Worker::handle);

        System.out.println("Starting worker for ${job.type}...");
        Runtime.getRuntime().addShutdownHook(new Thread(worker::stop));
        worker.start();
    }

    static Map<String, Object> handle(JobContext ctx) {
        var jobArgs = ctx.job().args();
        System.out.printf("Processing ${ctx.jobTypePascal}: %s%n", jobArgs);

        return Map.of("processed", true);
    }
}
`
}

function generateJavaFull(job: OJSJob): string {
  const enqueue = generateJavaEnqueue(job)
  const worker = generateJavaWorker(job)
  return `// === Enqueue (Producer) ===\n\n${enqueue}\n// === Worker (Consumer) ===\n\n${worker}`
}

// ---- Public API ----

/**
 * Generate SDK code from a parsed OJS job spec.
 */
export function generateCode(
  job: OJSJob,
  language: CodegenLanguage,
  scope: CodegenScope,
): string {
  const generators: Record<CodegenLanguage, Record<CodegenScope, (j: OJSJob) => string>> = {
    go: { enqueue: generateGoEnqueue, worker: generateGoWorker, full: generateGoFull },
    javascript: { enqueue: generateJsEnqueue, worker: generateJsWorker, full: generateJsFull },
    python: { enqueue: generatePythonEnqueue, worker: generatePythonWorker, full: generatePythonFull },
    ruby: { enqueue: generateRubyEnqueue, worker: generateRubyWorker, full: generateRubyFull },
    rust: { enqueue: generateRustEnqueue, worker: generateRustWorker, full: generateRustFull },
    java: { enqueue: generateJavaEnqueue, worker: generateJavaWorker, full: generateJavaFull },
  }

  return generators[language][scope](job)
}
