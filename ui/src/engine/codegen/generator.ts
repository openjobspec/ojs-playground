import type { CodegenLanguage, CodegenScope, OJSJob } from '../types'
import { buildContext } from './context'
import {
  booleanLiteral,
  goLiteral,
  goString,
  integerLiteral,
  javaLiteral,
  javaString,
  jsLiteral,
  jsString,
  numberLiteral,
  pythonLiteral,
  pythonString,
  rubyLiteral,
  rubyString,
  rustLiteral,
  rustString,
} from './literals'

// ---- Go Templates ----

function goArgsLiteral(args: unknown[]): string {
  if (args.length === 0) return 'ojs.Args{}'
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    return `\t\t${goString(key)}: ${goLiteral(arg)},`
  })
  return `ojs.Args{\n${entries.join('\n')}\n\t}`
}

function goRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  if (maxAttempts !== null) parts.push(`MaxAttempts: ${maxAttempts}`)
  if (typeof retry.initial_interval === 'string') {
    const dur = isoToGoDuration(retry.initial_interval)
    parts.push(`InitialInterval: ${dur}`)
  }
  if (backoffCoefficient !== null) parts.push(`BackoffCoefficient: ${backoffCoefficient}`)
  if (typeof retry.max_interval === 'string') {
    const dur = isoToGoDuration(retry.max_interval)
    parts.push(`MaxInterval: ${dur}`)
  }
  return `ojs.RetryPolicy{${parts.join(', ')}}`
}

function isoToGoDuration(iso: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso)
  if (!match) return '0'
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
  const priority = integerLiteral(job.priority)
  const timeout = integerLiteral(ctx.timeout)
  if (job.queue !== 'default') options.push(`\t\tojs.WithQueue(${goString(job.queue)}),`)
  if (ctx.hasRetry) options.push(`\t\tojs.WithRetry(${goRetryLiteral(job.retry as Record<string, unknown>)}),`)
  if (ctx.hasMeta) options.push(`\t\tojs.WithMeta(${goLiteral(job.meta)}),`)
  if (ctx.hasPriority && priority !== null) options.push(`\t\tojs.WithPriority(${priority}),`)
  if (ctx.hasTimeout && timeout !== null) options.push(`\t\tojs.WithTimeout(${timeout}*time.Second),`)

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

\tjob, err := client.Enqueue(context.Background(), ${goString(job.type)},
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
    return `\t${a.name}, _ := ctx.Job.Args[${goString(a.name)}].(${goType})`
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
\t\tojs.WithQueues(${goString(job.queue)}),
\t\tojs.WithConcurrency(10),
\t)

\tworker.Register(${goString(job.type)}, func(ctx ojs.JobContext) error {
${argExtractions}

\t\tfmt.Printf("Processing ${ctx.jobTypePascal}: %v\\n", ${ctx.argsTyped[0]?.name ?? '"job"'})

\t\tctx.SetResult(map[string]any{
\t\t\t"processed": true,
\t\t})
\t\treturn nil
\t})

\tctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
\tdefer cancel()

\tlog.Printf("Starting worker for %s...", ${goString(job.type)})
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
    return jsLiteral(args[0])
  }
  const entries = args.map((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    return `  ${jsString(key)}: ${jsLiteral(arg)},`
  })
  return `{\n${entries.join('\n')}\n}`
}

function jsRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  const jitter = booleanLiteral(retry.jitter)
  if (maxAttempts !== null) parts.push(`    maxAttempts: ${maxAttempts},`)
  if (typeof retry.initial_interval === 'string') parts.push(`    initialInterval: ${jsString(retry.initial_interval)},`)
  if (backoffCoefficient !== null) parts.push(`    backoffCoefficient: ${backoffCoefficient},`)
  if (typeof retry.max_interval === 'string') parts.push(`    maxInterval: ${jsString(retry.max_interval)},`)
  if (jitter !== null) parts.push(`    jitter: ${jitter},`)
  return `{\n${parts.join('\n')}\n  }`
}

function generateJsEnqueue(job: OJSJob): string {
  const options: string[] = []
  const priority = integerLiteral(job.priority)
  const timeout = typeof job.timeout === 'number' ? numberLiteral(job.timeout * 1000) : null
  if (job.queue !== 'default') options.push(`  queue: ${jsString(job.queue)},`)
  if (job.retry) options.push(`  retry: ${jsRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (job.meta && Object.keys(job.meta).length > 0) options.push(`  meta: ${jsLiteral(job.meta)},`)
  if (job.priority !== undefined && job.priority !== 0 && priority !== null) options.push(`  priority: ${priority},`)
  if (typeof job.timeout === 'number' && job.timeout > 0 && timeout !== null) options.push(`  timeout: ${timeout},`)

  const optionsArg = options.length > 0 ? `,\n{\n${options.join('\n')}\n}` : ''

  return `import { OJSClient } from '@openjobspec/sdk';

const client = new OJSClient({ url: 'http://localhost:8080' });

const job = await client.enqueue(
  ${jsString(job.type)},
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
  queues: [${jsString(job.queue)}],
  concurrency: 10,
});

worker.register(${jsString(job.type)}, async (ctx) => {
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
    return `    ${pythonString(key)}: ${pythonLiteral(arg)},`
  })
  return `{\n${entries.join('\n')}\n}`
}

function pyRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  const jitter = booleanLiteral(retry.jitter)
  if (maxAttempts !== null) parts.push(`    max_attempts=${maxAttempts},`)
  if (typeof retry.initial_interval === 'string') parts.push(`    initial_interval=${pythonString(retry.initial_interval)},`)
  if (backoffCoefficient !== null) parts.push(`    backoff_coefficient=${backoffCoefficient},`)
  if (typeof retry.max_interval === 'string') parts.push(`    max_interval=${pythonString(retry.max_interval)},`)
  if (jitter !== null) parts.push(`    jitter=${jitter === 'true' ? 'True' : 'False'},`)
  return `RetryPolicy(\n${parts.join('\n')}\n)`
}

function generatePythonEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'python')
  const options: string[] = []
  const priority = integerLiteral(job.priority)
  const timeoutMs = integerLiteral(ctx.timeout * 1000)
  if (job.queue !== 'default') options.push(`    queue=${pythonString(job.queue)},`)
  if (ctx.hasRetry) options.push(`    retry=${pyRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (ctx.hasMeta) options.push(`    meta=${pythonLiteral(job.meta)},`)
  if (ctx.hasPriority && priority !== null) options.push(`    priority=${priority},`)
  if (ctx.hasTimeout && timeoutMs !== null) options.push(`    timeout_ms=${timeoutMs},`)

  const optionsStr = options.length > 0 ? '\n' + options.join('\n') + '\n' : ''

  return `import asyncio
from openjobspec import OJSClient${ctx.hasRetry ? ', RetryPolicy' : ''}

async def main():
    client = OJSClient(url="http://localhost:8080")

    job = await client.enqueue(
        ${pythonString(job.type)},
        ${pyArgsLiteral(job.args)},${optionsStr}    )

    print(f"Enqueued job: {job.id} (state: {job.state})")

asyncio.run(main())
`
}

function generatePythonWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'python')
  const argAccess = ctx.argsTyped.map((a) => `    ${a.name} = ctx.job.args[0][${pythonString(a.name)}]`).join('\n')

  return `import asyncio
import signal
from openjobspec import OJSWorker

worker = OJSWorker(
    url="http://localhost:8080",
    queues=[${pythonString(job.queue)}],
    concurrency=10,
)

@worker.register(${pythonString(job.type)})
async def handle_${ctx.jobTypeSnake}(ctx):
${argAccess}

    print(f"Processing ${ctx.jobTypePascal}: {${ctx.argsTyped[0]?.name ?? '"job"'}}")

    return {"processed": True}

async def main():
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: asyncio.create_task(worker.stop()))

    print("Starting worker for " + ${pythonString(job.type)} + "...")
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
    return `    ${rubyString(key)} => ${rubyLiteral(arg)},`
  })
  return `{\n${entries.join('\n')}\n  }`
}

function rbRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = []
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  const jitter = booleanLiteral(retry.jitter)
  if (maxAttempts !== null) parts.push(`    max_attempts: ${maxAttempts},`)
  if (typeof retry.initial_interval === 'string') parts.push(`    initial_interval: ${rubyString(retry.initial_interval)},`)
  if (backoffCoefficient !== null) parts.push(`    backoff_coefficient: ${backoffCoefficient},`)
  if (typeof retry.max_interval === 'string') parts.push(`    max_interval: ${rubyString(retry.max_interval)},`)
  if (jitter !== null) parts.push(`    jitter: ${jitter},`)
  return `{\n${parts.join('\n')}\n  }`
}

function generateRubyEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'ruby')
  const options: string[] = []
  const priority = integerLiteral(job.priority)
  const timeout = integerLiteral(ctx.timeout)
  if (job.queue !== 'default') options.push(`  queue: ${rubyString(job.queue)},`)
  if (ctx.hasRetry) options.push(`  retry: ${rbRetryLiteral(job.retry as Record<string, unknown>)},`)
  if (ctx.hasMeta) options.push(`  meta: ${rubyLiteral(job.meta)},`)
  if (ctx.hasPriority && priority !== null) options.push(`  priority: ${priority},`)
  if (ctx.hasTimeout && timeout !== null) options.push(`  timeout: ${timeout},`)

  const optionsStr = options.length > 0 ? '\n' + options.join('\n') + '\n' : ''

  return `require "openjobspec"

client = OJS::Client.new(url: "http://localhost:8080")

job = client.enqueue(
  ${rubyString(job.type)},
  ${rbArgsLiteral(job.args)},${optionsStr})

puts "Enqueued job: #{job.id} (state: #{job.state})"
`
}

function generateRubyWorker(job: OJSJob): string {
  const ctx = buildContext(job, 'ruby')
  const argAccess = ctx.argsTyped.map((a) => `    ${a.name} = ctx.job.args[0][${rubyString(a.name)}]`).join('\n')

  return `require "openjobspec"

worker = OJS::Worker.new(
  url: "http://localhost:8080",
  queues: [${rubyString(job.queue)}],
  concurrency: 10
)

worker.register(${rubyString(job.type)}) do |ctx|
${argAccess}

  puts "Processing ${ctx.jobTypePascal}: #{${ctx.argsTyped[0]?.name ?? '"job"'}}"

  { processed: true }
end

Signal.trap("TERM") { worker.stop }

puts "Starting worker for " + ${rubyString(job.type)} + "..."
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
    return `        ${rustString(key)}: ${rustLiteral(arg)},`
  })
  return `serde_json::json!({\n${entries.join('\n')}\n    })`
}

function rustRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = ['        RetryPolicy::builder()']
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  const jitter = booleanLiteral(retry.jitter)
  if (maxAttempts !== null) parts.push(`            .max_attempts(${maxAttempts})`)
  if (typeof retry.initial_interval === 'string') parts.push(`            .initial_interval(${rustString(retry.initial_interval)}.parse().unwrap())`)
  if (backoffCoefficient !== null) parts.push(`            .backoff_coefficient(${backoffCoefficient})`)
  if (typeof retry.max_interval === 'string') parts.push(`            .max_interval(${rustString(retry.max_interval)}.parse().unwrap())`)
  if (jitter !== null) parts.push(`            .jitter(${jitter})`)
  parts.push('            .build()')
  return parts.join('\n')
}

function generateRustEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'rust')
  const options: string[] = []
  const priority = integerLiteral(job.priority)
  const timeout = integerLiteral(ctx.timeout)
  if (job.queue !== 'default') options.push(`        .queue(${rustString(job.queue)})`)
  if (ctx.hasRetry) options.push(`        .retry(\n${rustRetryLiteral(job.retry as Record<string, unknown>)}\n        )`)
  if (ctx.hasMeta) options.push(`        .meta(serde_json::from_value(serde_json::json!(${rustLiteral(job.meta)}))?)`)
  if (ctx.hasPriority && priority !== null) options.push(`        .priority(${priority})`)
  if (ctx.hasTimeout && timeout !== null) options.push(`        .timeout(Duration::from_secs(${timeout}))`)

  const builderChain = options.length > 0 ? '\n' + options.join('\n') + '\n        ' : ''

  return `use ojs_sdk::{OJSClient${ctx.hasRetry ? ', RetryPolicy' : ''}};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = OJSClient::new("http://localhost:8080")?;

    let job = client
        .enqueue(${rustString(job.type)})
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
        .queues(vec![${rustString(job.queue)}.into()])
        .concurrency(10)
        .build()?;

    worker.register(${rustString(job.type)}, handle_${ctx.jobTypeSnake}).await;

    println!("Starting worker for {}...", ${rustString(job.type)});
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
  const entries = args.flatMap((arg, i) => {
    const key = typeof arg === 'string' && i === 0 ? 'to' :
                typeof arg === 'string' && i === 1 ? 'template' :
                `arg${i}`
    return [javaString(key), javaLiteral(arg)]
  })
  return `mapOf(\n            ${entries.join(',\n            ')}\n        )`
}

function javaRetryLiteral(retry: Record<string, unknown>): string {
  const parts: string[] = ['        RetryPolicy.builder()']
  const maxAttempts = integerLiteral(retry.max_attempts)
  const backoffCoefficient = numberLiteral(retry.backoff_coefficient)
  const jitter = booleanLiteral(retry.jitter)
  if (maxAttempts !== null) parts.push(`            .maxAttempts(${maxAttempts})`)
  if (typeof retry.initial_interval === 'string') parts.push(`            .initialInterval(Duration.parse(${javaString(retry.initial_interval)}))`)
  if (backoffCoefficient !== null) parts.push(`            .backoffCoefficient(${backoffCoefficient})`)
  if (typeof retry.max_interval === 'string') parts.push(`            .maxInterval(Duration.parse(${javaString(retry.max_interval)}))`)
  if (jitter !== null) parts.push(`            .jitter(${jitter})`)
  parts.push('            .build()')
  return parts.join('\n')
}

function generateJavaEnqueue(job: OJSJob): string {
  const ctx = buildContext(job, 'java')
  const options: string[] = []
  const priority = integerLiteral(job.priority)
  const timeout = integerLiteral(ctx.timeout)
  if (job.queue !== 'default') options.push(`            .queue(${javaString(job.queue)})`)
  if (ctx.hasRetry) options.push(`            .retry(\n${javaRetryLiteral(job.retry as Record<string, unknown>)}\n            )`)
  if (ctx.hasMeta) options.push(`            .meta(${javaLiteral(job.meta)})`)
  if (ctx.hasPriority && priority !== null) options.push(`            .priority(${priority})`)
  if (ctx.hasTimeout && timeout !== null) options.push(`            .timeout(Duration.ofSeconds(${timeout}))`)

  const builderChain = options.length > 0 ? '\n' + options.join('\n') + '\n            ' : ''

  return `import org.openjobspec.sdk.OJSClient;
${ctx.hasRetry ? 'import org.openjobspec.sdk.RetryPolicy;\n' : ''}import java.time.Duration;
  import java.util.ArrayList;
  import java.util.Arrays;
  import java.util.LinkedHashMap;
  import java.util.List;
  import java.util.Map;

  public class Enqueue${ctx.jobTypePascal} {
    public static void main(String[] args) throws Exception {
        var client = OJSClient.create("http://localhost:8080");

        var job = client.enqueue(${javaString(job.type)})
            .args(${javaArgsLiteral(job.args)})${builderChain}.send();

        System.out.printf("Enqueued job: %s (state: %s)%n", job.id(), job.state());
    }

    private static Map<String, Object> mapOf(Object... entries) {
        var result = new LinkedHashMap<String, Object>();
        for (var i = 0; i < entries.length; i += 2) {
            result.put((String) entries[i], entries[i + 1]);
        }
        return result;
    }

    private static List<Object> listOf(Object... values) {
        return new ArrayList<>(Arrays.asList(values));
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
            .queues(${javaString(job.queue)})
            .concurrency(10)
            .build();

        worker.register(${javaString(job.type)}, ${ctx.jobTypePascal}Worker::handle);

        System.out.println("Starting worker for " + ${javaString(job.type)} + "...");
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
