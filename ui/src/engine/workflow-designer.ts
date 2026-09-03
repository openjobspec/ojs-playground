/**
 * Workflow Designer Engine
 * Converts visual DAG representation to/from OJS workflow specs
 */
import {
  csharpLiteral,
  csharpString,
  goLiteral,
  goString,
  javaLiteral,
  javaString,
  jsLiteral,
  jsString,
  pythonLiteral,
  pythonString,
  rubyLiteral,
  rubyString,
  rustLiteral,
  rustString,
  safePascalIdentifier,
} from './codegen/literals';

export interface WorkflowNode {
  id: string;
  type: 'job' | 'chain' | 'group' | 'batch' | 'callback';
  label: string;
  jobType: string;
  args?: Record<string, unknown>;
  queue?: string;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'sequential' | 'parallel' | 'callback-success' | 'callback-failure';
}

export interface WorkflowDesign {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  name: string;
  description?: string;
}

export interface DesignValidationError {
  path: string;
  message: string;
}

export interface DesignValidationResult {
  valid: boolean;
  errors: DesignValidationError[];
}

// ---- Conversion: Design → OJS Spec ----

function buildStep(node: WorkflowNode): Record<string, unknown> {
  const step: Record<string, unknown> = { type: node.jobType };
  if (node.args && Object.keys(node.args).length > 0) step.args = node.args;
  if (node.queue) step.queue = node.queue;
  return step;
}

function getJobNodes(design: WorkflowDesign): WorkflowNode[] {
  return design.nodes.filter((n) => n.type === 'job');
}

/**
 * Convert a visual workflow design to an OJS workflow JSON spec.
 */
export function designToOJSSpec(design: WorkflowDesign): object {
  const jobNodes = getJobNodes(design);
  if (jobNodes.length === 0) {
    return { specversion: '1.0', type: 'workflow', name: design.name, steps: [] };
  }

  // Determine workflow structure from edges
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  // Build topologically sorted steps
  const sorted = topologicalSort(jobNodes, design.edges);
  const steps = sorted.map(buildStep);

  let workflowType: string = 'chain';
  if (hasCallback) {
    workflowType = 'batch';
  } else if (hasParallel) {
    workflowType = 'group';
  }

  const spec: Record<string, unknown> = {
    specversion: '1.0',
    type: 'workflow',
    name: design.name,
    workflow_type: workflowType,
    steps,
  };

  if (design.description) spec.description = design.description;

  // Add structural metadata
  if (workflowType === 'group') {
    const parallelEdges = design.edges.filter((e) => e.type === 'parallel');
    const parallelTargetIds = new Set(parallelEdges.map((e) => e.target));
    spec.parallel = sorted
      .filter((n) => parallelTargetIds.has(n.id))
      .map((n) => n.jobType);
  }

  if (workflowType === 'batch') {
    const successEdges = design.edges.filter((e) => e.type === 'callback-success');
    const failureEdges = design.edges.filter((e) => e.type === 'callback-failure');
    if (successEdges.length > 0) {
      const successNode = jobNodes.find((n) => n.id === successEdges[0]!.target);
      if (successNode) spec.on_success = buildStep(successNode);
    }
    if (failureEdges.length > 0) {
      const failureNode = jobNodes.find((n) => n.id === failureEdges[0]!.target);
      if (failureNode) spec.on_failure = buildStep(failureNode);
    }
  }

  return spec;
}

// ---- Conversion: OJS Spec → Design ----

/**
 * Parse an OJS workflow spec into a visual WorkflowDesign.
 */
export function ojsSpecToDesign(spec: object): WorkflowDesign {
  const s = spec as Record<string, unknown>;
  const name = (s.name as string) ?? 'Untitled Workflow';
  const description = s.description as string | undefined;
  const workflowType = (s.workflow_type as string) ?? 'chain';
  const rawSteps = (s.steps as Record<string, unknown>[]) ?? [];

  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  const NODE_SPACING_X = 220;
  const NODE_SPACING_Y = 120;

  if (workflowType === 'chain') {
    rawSteps.forEach((step, i) => {
      const nodeId = `node-${i}`;
      nodes.push({
        id: nodeId,
        type: 'job',
        label: (step.type as string) ?? `Step ${i}`,
        jobType: (step.type as string) ?? '',
        args: step.args as Record<string, unknown> | undefined,
        queue: step.queue as string | undefined,
        position: { x: i * NODE_SPACING_X, y: 100 },
      });

      if (i > 0) {
        edges.push({
          id: `edge-${i - 1}-${i}`,
          source: `node-${i - 1}`,
          target: nodeId,
          type: 'sequential',
        });
      }
    });
  } else if (workflowType === 'group') {
    // Fan-out/fan-in pattern
    const parallelTypes = (s.parallel as string[]) ?? [];
    const parallelSet = new Set(parallelTypes);
    const sequentialSteps = rawSteps.filter((st) => !parallelSet.has(st.type as string));
    const parallelSteps = rawSteps.filter((st) => parallelSet.has(st.type as string));

    // First sequential node
    if (sequentialSteps.length > 0) {
      nodes.push({
        id: 'node-start',
        type: 'job',
        label: (sequentialSteps[0]!.type as string) ?? 'Start',
        jobType: (sequentialSteps[0]!.type as string) ?? '',
        args: sequentialSteps[0]!.args as Record<string, unknown> | undefined,
        queue: sequentialSteps[0]!.queue as string | undefined,
        position: { x: 0, y: 100 },
      });
    }

    // Parallel nodes
    parallelSteps.forEach((step, i) => {
      const nodeId = `node-parallel-${i}`;
      nodes.push({
        id: nodeId,
        type: 'job',
        label: (step.type as string) ?? `Parallel ${i}`,
        jobType: (step.type as string) ?? '',
        args: step.args as Record<string, unknown> | undefined,
        queue: step.queue as string | undefined,
        position: { x: NODE_SPACING_X, y: i * NODE_SPACING_Y },
      });
      if (sequentialSteps.length > 0) {
        edges.push({
          id: `edge-start-p${i}`,
          source: 'node-start',
          target: nodeId,
          type: 'parallel',
        });
      }
    });

    // Last sequential node (fan-in)
    if (sequentialSteps.length > 1) {
      const lastStep = sequentialSteps[sequentialSteps.length - 1]!;
      const endNodeId = 'node-end';
      nodes.push({
        id: endNodeId,
        type: 'job',
        label: (lastStep.type as string) ?? 'End',
        jobType: (lastStep.type as string) ?? '',
        args: lastStep.args as Record<string, unknown> | undefined,
        queue: lastStep.queue as string | undefined,
        position: { x: NODE_SPACING_X * 2, y: 100 },
      });
      parallelSteps.forEach((_, i) => {
        edges.push({
          id: `edge-p${i}-end`,
          source: `node-parallel-${i}`,
          target: endNodeId,
          type: 'parallel',
        });
      });
    }
  } else if (workflowType === 'batch') {
    // Batch with callbacks
    rawSteps.forEach((step, i) => {
      const nodeId = `node-${i}`;
      nodes.push({
        id: nodeId,
        type: 'job',
        label: (step.type as string) ?? `Step ${i}`,
        jobType: (step.type as string) ?? '',
        args: step.args as Record<string, unknown> | undefined,
        queue: step.queue as string | undefined,
        position: { x: i * NODE_SPACING_X, y: 100 },
      });
      if (i > 0) {
        edges.push({
          id: `edge-${i - 1}-${i}`,
          source: `node-${i - 1}`,
          target: nodeId,
          type: 'sequential',
        });
      }
    });

    const lastNodeId = rawSteps.length > 0 ? `node-${rawSteps.length - 1}` : undefined;

    // Success callback
    if (s.on_success) {
      const cb = s.on_success as Record<string, unknown>;
      const cbId = 'node-cb-success';
      nodes.push({
        id: cbId,
        type: 'callback',
        label: `✓ ${(cb.type as string) ?? 'on_success'}`,
        jobType: (cb.type as string) ?? '',
        args: cb.args as Record<string, unknown> | undefined,
        queue: cb.queue as string | undefined,
        position: { x: (rawSteps.length) * NODE_SPACING_X, y: 40 },
      });
      if (lastNodeId) {
        edges.push({
          id: 'edge-cb-success',
          source: lastNodeId,
          target: cbId,
          type: 'callback-success',
        });
      }
    }

    // Failure callback
    if (s.on_failure) {
      const cb = s.on_failure as Record<string, unknown>;
      const cbId = 'node-cb-failure';
      nodes.push({
        id: cbId,
        type: 'callback',
        label: `✗ ${(cb.type as string) ?? 'on_failure'}`,
        jobType: (cb.type as string) ?? '',
        args: cb.args as Record<string, unknown> | undefined,
        queue: cb.queue as string | undefined,
        position: { x: (rawSteps.length) * NODE_SPACING_X, y: 160 },
      });
      if (lastNodeId) {
        edges.push({
          id: 'edge-cb-failure',
          source: lastNodeId,
          target: cbId,
          type: 'callback-failure',
        });
      }
    }
  }

  return { nodes, edges, name, description };
}

// ---- Validation ----

/**
 * Validate a workflow design for cycles, disconnected nodes, and invalid types.
 */
export function validateDesign(design: WorkflowDesign): DesignValidationResult {
  const errors: DesignValidationError[] = [];

  if (!design.name || design.name.trim() === '') {
    errors.push({ path: 'name', message: 'Workflow name is required' });
  }

  if (design.nodes.length === 0) {
    errors.push({ path: 'nodes', message: 'Workflow must have at least one node' });
    return { valid: false, errors };
  }

  const validNodeTypes = new Set(['job', 'chain', 'group', 'batch', 'callback']);
  const validEdgeTypes = new Set([
    'sequential',
    'parallel',
    'callback-success',
    'callback-failure',
  ]);
  const nodeIds = new Set(design.nodes.map((n) => n.id));

  // Validate node types and required fields
  for (const node of design.nodes) {
    if (!validNodeTypes.has(node.type)) {
      errors.push({
        path: `nodes.${node.id}.type`,
        message: `Invalid node type: "${node.type}"`,
      });
    }
    if (!node.jobType || node.jobType.trim() === '') {
      errors.push({
        path: `nodes.${node.id}.jobType`,
        message: `Node "${node.label || node.id}" must have a job type`,
      });
    }
  }

  // Validate edges reference existing nodes
  for (const edge of design.edges) {
    if (!validEdgeTypes.has(edge.type)) {
      errors.push({
        path: `edges.${edge.id}.type`,
        message: `Invalid edge type: "${edge.type}"`,
      });
    }
    if (!nodeIds.has(edge.source)) {
      errors.push({
        path: `edges.${edge.id}.source`,
        message: `Edge source "${edge.source}" references non-existent node`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        path: `edges.${edge.id}.target`,
        message: `Edge target "${edge.target}" references non-existent node`,
      });
    }
  }

  // Check for cycles using DFS
  const adjacency = new Map<string, string[]>();
  for (const node of design.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of design.edges) {
    if (adjacency.has(edge.source)) {
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of design.nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        errors.push({
          path: 'edges',
          message: 'Workflow contains a cycle — edges must form a DAG',
        });
        break;
      }
    }
  }

  // Check for disconnected nodes (nodes with no edges at all)
  if (design.nodes.length > 1) {
    const connectedNodes = new Set<string>();
    for (const edge of design.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }
    for (const node of design.nodes) {
      if (!connectedNodes.has(node.id)) {
        errors.push({
          path: `nodes.${node.id}`,
          message: `Node "${node.label || node.id}" is disconnected from the workflow`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Topological Sort & Auto-Layout ----

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Append any remaining nodes (part of cycles) at the end
  for (const node of nodes) {
    if (!sorted.find((n) => n.id === node.id)) {
      sorted.push(node);
    }
  }

  return sorted;
}

/**
 * Auto-arrange nodes using topological sort with layered layout.
 */
export function autoLayout(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return [];

  const sorted = topologicalSort(nodes, edges);
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Assign layers via longest-path from roots
  const layers = new Map<string, number>();
  for (const node of sorted) {
    const incoming = edges.filter((e) => e.target === node.id && nodeIds.has(e.source));
    if (incoming.length === 0) {
      layers.set(node.id, 0);
    } else {
      const maxParentLayer = Math.max(
        ...incoming.map((e) => layers.get(e.source) ?? 0)
      );
      layers.set(node.id, maxParentLayer + 1);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, WorkflowNode[]>();
  for (const node of sorted) {
    const layer = layers.get(node.id) ?? 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 100;

  return sorted.map((node) => {
    const layer = layers.get(node.id) ?? 0;
    const nodesInLayer = layerGroups.get(layer) ?? [node];
    const indexInLayer = nodesInLayer.indexOf(node);
    const totalInLayer = nodesInLayer.length;
    const yOffset = -(totalInLayer - 1) * NODE_HEIGHT / 2;

    return {
      ...node,
      position: {
        x: 80 + layer * NODE_WIDTH,
        y: 80 + yOffset + indexInLayer * NODE_HEIGHT,
      },
    };
  });
}

// ---- Code Generation ----

function toPascalCase(s: string): string {
  return safePascalIdentifier(s, 'Generated');
}

function generateGoCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const stepsGo = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `Args: ${goLiteral(n.args).replace(/^map\[string\]any/, 'ojs.Args')}`
      : '';
    const queueStr = n.queue ? `, Queue: ${goString(n.queue)}` : '';
    return `\t\tojs.Step{Type: ${goString(n.jobType)}${argsStr ? `, ${argsStr}` : ''}${queueStr}}`;
  }).join(',\n');

  let wrapperFn = 'ojs.Chain';
  if (hasCallback) wrapperFn = 'ojs.Batch';
  else if (hasParallel) wrapperFn = 'ojs.Group';

  let callbackGo = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackGo += `\n\t// On success\n\tojs.OnSuccess(ojs.Step{Type: ${goString(node.jobType)}}),`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackGo += `\n\t// On failure\n\tojs.OnFailure(ojs.Step{Type: ${goString(node.jobType)}}),`;
    }
  }

  return `package main

import (
\t"context"
\t"fmt"
\t"log"

\tojs "github.com/openjobspec/ojs-go-sdk"
)

func main() {
\tclient, err := ojs.NewClient("http://localhost:8080")
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\t// Workflow generated by OJS Playground.
\twf, err := client.CreateWorkflow(context.Background(), ${wrapperFn}(
${stepsGo},${callbackGo}
\t))
\tif err != nil {
\t\tlog.Fatal(err)
\t}

\tfmt.Printf("Created workflow: %s\\n", wf.ID)
}
`;
}

function generateTypeScriptCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const stepsTs = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `, args: ${jsLiteral(n.args)}`
      : '';
    const queueStr = n.queue ? `, queue: ${jsString(n.queue)}` : '';
    return `  { type: ${jsString(n.jobType)}${argsStr}${queueStr} }`;
  }).join(',\n');

  let wrapperFn = 'chain';
  if (hasCallback) wrapperFn = 'batch';
  else if (hasParallel) wrapperFn = 'group';

  let callbackTs = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    const opts: string[] = [];
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) opts.push(`  onSuccess: { type: ${jsString(node.jobType)} }`);
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) opts.push(`  onFailure: { type: ${jsString(node.jobType)} }`);
    }
    if (opts.length > 0) callbackTs = `, {\n${opts.join(',\n')}\n}`;
  }

  return `import { OJSClient, ${wrapperFn} } from '@openjobspec/sdk';

const client = new OJSClient({ url: 'http://localhost:8080' });

// Workflow generated by OJS Playground.
const wf = await client.createWorkflow(${wrapperFn}([
${stepsTs},
]${callbackTs}));

console.log(\`Created workflow: \${wf.id}\`);
`;
}

function generatePythonCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const stepsPy = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `, args=${pythonLiteral(n.args)}`
      : '';
    const queueStr = n.queue ? `, queue=${pythonString(n.queue)}` : '';
    return `        Step(type=${pythonString(n.jobType)}${argsStr}${queueStr})`;
  }).join(',\n');

  let wrapperFn = 'Chain';
  if (hasCallback) wrapperFn = 'Batch';
  else if (hasParallel) wrapperFn = 'Group';

  let callbackPy = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackPy += `\n        on_success=Step(type=${pythonString(node.jobType)}),`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackPy += `\n        on_failure=Step(type=${pythonString(node.jobType)}),`;
    }
  }

  return `import asyncio
from openjobspec import OJSClient, ${wrapperFn}, Step

async def main():
    client = OJSClient(url="http://localhost:8080")

    # Workflow generated by OJS Playground.
    wf = await client.create_workflow(
        ${wrapperFn}([
${stepsPy},
        ]${callbackPy ? `,${callbackPy}` : ''})
    )

    print(f"Created workflow: {wf.id}")

asyncio.run(main())
`;
}

function generateRubyCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const stepsRb = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `, args: ${rubyLiteral(n.args)}`
      : '';
    const queueStr = n.queue ? `, queue: ${rubyString(n.queue)}` : '';
    return `    Step.new(type: ${rubyString(n.jobType)}${argsStr}${queueStr})`;
  }).join(',\n');

  let method = 'chain';
  if (hasCallback) method = 'batch';
  else if (hasParallel) method = 'group';

  let callbackRb = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackRb += `\n  on_success: Step.new(type: ${rubyString(node.jobType)}),`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackRb += `\n  on_failure: Step.new(type: ${rubyString(node.jobType)}),`;
    }
  }

  return `require "openjobspec"

client = OJS::Client.new(url: "http://localhost:8080")

# Workflow generated by OJS Playground.
wf = client.create_workflow(
  OJS.${method}([
${stepsRb},
  ]${callbackRb ? `,${callbackRb}` : ''})
)

puts "Created workflow: #{wf.id}"
`;
}

function generateJavaCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const className = toPascalCase(design.name.replace(/\s+/g, '_')) + 'Workflow';

  const stepsJava = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `.args(${javaLiteral(n.args)})`
      : '';
    const queueStr = n.queue ? `.queue(${javaString(n.queue)})` : '';
    return `                Step.of(${javaString(n.jobType)})${argsStr}${queueStr}`;
  }).join(',\n');

  let method = 'chain';
  if (hasCallback) method = 'batch';
  else if (hasParallel) method = 'group';

  let callbackJava = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackJava += `\n            .onSuccess(Step.of(${javaString(node.jobType)}))`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackJava += `\n            .onFailure(Step.of(${javaString(node.jobType)}))`;
    }
  }

  return `import org.openjobspec.sdk.OJSClient;
import org.openjobspec.sdk.Step;
import org.openjobspec.sdk.Workflow;
  import java.util.ArrayList;
  import java.util.Arrays;
  import java.util.LinkedHashMap;
  import java.util.List;
  import java.util.Map;

  // Workflow generated by OJS Playground.
  public class ${className} {
    public static void main(String[] args) throws Exception {
        var client = OJSClient.create("http://localhost:8080");

        var wf = client.createWorkflow(
            Workflow.${method}(List.of(
${stepsJava}
            ))${callbackJava}
        ).send();

        System.out.printf("Created workflow: %s%n", wf.id());
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
`;
}

function generateRustCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const stepsRust = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `.args(serde_json::json!(${rustLiteral(n.args)}))`
      : '';
    const queueStr = n.queue ? `.queue(${rustString(n.queue)})` : '';
    return `        Step::new(${rustString(n.jobType)})${argsStr}${queueStr}`;
  }).join(',\n');

  let method = 'chain';
  if (hasCallback) method = 'batch';
  else if (hasParallel) method = 'group';

  let callbackRust = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackRust += `\n        .on_success(Step::new(${rustString(node.jobType)}))`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackRust += `\n        .on_failure(Step::new(${rustString(node.jobType)}))`;
    }
  }

  return `use ojs_sdk::{OJSClient, Workflow, Step};

// Workflow generated by OJS Playground.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = OJSClient::new("http://localhost:8080")?;

    let wf = client
        .create_workflow(
            Workflow::${method}(vec![
${stepsRust},
            ])${callbackRust}
        )
        .send()
        .await?;

    println!("Created workflow: {}", wf.id);
    Ok(())
}
`;
}

function generateCSharpCode(design: WorkflowDesign): string {
  const sorted = topologicalSort(getJobNodes(design), design.edges);
  const hasParallel = design.edges.some((e) => e.type === 'parallel');
  const hasCallback = design.edges.some(
    (e) => e.type === 'callback-success' || e.type === 'callback-failure'
  );

  const className = toPascalCase(design.name.replace(/\s+/g, '_')) + 'Workflow';

  const stepsCs = sorted.map((n) => {
    const argsStr = n.args && Object.keys(n.args).length > 0
      ? `, ${csharpLiteral(n.args)}`
      : '';
    const queueStr = n.queue ? `.WithQueue(${csharpString(n.queue)})` : '';
    return `            Step.Of(${csharpString(n.jobType)}${argsStr})${queueStr}`;
  }).join(',\n');

  let method = 'Chain';
  if (hasCallback) method = 'Batch';
  else if (hasParallel) method = 'Group';

  let callbackCs = '';
  if (hasCallback) {
    const successEdge = design.edges.find((e) => e.type === 'callback-success');
    const failureEdge = design.edges.find((e) => e.type === 'callback-failure');
    if (successEdge) {
      const node = design.nodes.find((n) => n.id === successEdge.target);
      if (node) callbackCs += `\n            .OnSuccess(Step.Of(${csharpString(node.jobType)}))`;
    }
    if (failureEdge) {
      const node = design.nodes.find((n) => n.id === failureEdge.target);
      if (node) callbackCs += `\n            .OnFailure(Step.Of(${csharpString(node.jobType)}))`;
    }
  }

  return `using OpenJobSpec.Sdk;
using System.Collections.Generic;

// Workflow generated by OJS Playground.
class ${className}
{
    static async Task Main(string[] args)
    {
        var client = new OJSClient("http://localhost:8080");

        var wf = await client.CreateWorkflow(
            Workflow.${method}(
${stepsCs}
            )${callbackCs}
        );

        Console.WriteLine($"Created workflow: {wf.Id}");
    }
}
`;
}

/**
 * Generate idiomatic code for the workflow design in the specified language.
 */
export function generateCode(design: WorkflowDesign, language: string): string {
  switch (language.toLowerCase()) {
    case 'go':
      return generateGoCode(design);
    case 'typescript':
    case 'javascript':
      return generateTypeScriptCode(design);
    case 'python':
      return generatePythonCode(design);
    case 'ruby':
      return generateRubyCode(design);
    case 'java':
      return generateJavaCode(design);
    case 'rust':
      return generateRustCode(design);
    case 'csharp':
    case 'c#':
      return generateCSharpCode(design);
    default:
      return '// Code generation is not supported for this language.';
  }
}
