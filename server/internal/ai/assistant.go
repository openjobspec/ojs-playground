// Package ai provides LLM-assisted job definition generation for the OJS Playground.
//
// It includes system prompts, starter templates, and a request/response model
// for generating OJS YAML manifests from natural language descriptions.
package ai

import (
	"encoding/json"
)

// GenerateRequest is the input for AI-assisted job generation.
type GenerateRequest struct {
	Prompt   string `json:"prompt"`
	Template string `json:"template,omitempty"` // starter template name
	Language string `json:"language,omitempty"` // target SDK language (go, typescript, python)
}

// GenerateResponse contains the AI-generated manifest and code.
type GenerateResponse struct {
	Manifest string   `json:"manifest"`          // YAML manifest
	Code     string   `json:"code,omitempty"`     // generated SDK code
	Language string   `json:"language,omitempty"`
	Errors   []string `json:"errors,omitempty"`
}

// StarterTemplate is a pre-built OJS job configuration for common use cases.
type StarterTemplate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Manifest    string `json:"manifest"` // YAML content
}

// SystemPrompt is the LLM system prompt for generating OJS manifests.
const SystemPrompt = `You are an expert OJS (Open Job Spec) architect. Given a natural language description,
generate a valid OJS job type definition in YAML format.

OJS YAML manifest format:
` + "```yaml" + `
version: "1.0"
package: <package_name>
job_types:
  - type: <dotted.name>
    description: <what this job does>
    queue: <queue_name>
    args:
      - name: <arg_name>
        type: <string|int|float|bool|object|array>
        required: <true|false>
        description: <what this arg is>
    retry:
      max_attempts: <1-20>
      backoff: <exponential|linear|constant>
      initial_ms: <milliseconds>
    unique:
      key: <dedup_key>
      period: <duration, e.g. 5m, 1h>
    timeout_ms: <max execution time>
    priority: <0-10, higher = more important>
    tags:
      - <tag1>
      - <tag2>
` + "```" + `

Rules:
1. Job types use dotted notation (e.g., email.send, image.resize, data.process)
2. Queue names are lowercase, descriptive (e.g., email, media, default, critical)
3. Args use positional array format with typed fields
4. Always include a description for the job type and each arg
5. Set sensible retry policies (most jobs: 3 attempts, exponential backoff)
6. Set timeout_ms based on expected job duration
7. Use tags for categorization and filtering

For workflows, use these primitives:
- chain: sequential execution (step1 → step2 → step3)
- group: parallel execution (all run simultaneously)
- batch: parallel with callbacks (on_success, on_failure)

Respond with ONLY the YAML manifest, no explanation.`

// GetTemplates returns all available starter templates.
func GetTemplates() []StarterTemplate {
	return templates
}

// GetTemplate returns a specific template by ID.
func GetTemplate(id string) (*StarterTemplate, bool) {
	for i := range templates {
		if templates[i].ID == id {
			return &templates[i], true
		}
	}
	return nil, false
}

// GetTemplatesByCategory returns templates filtered by category.
func GetTemplatesByCategory(category string) []StarterTemplate {
	var result []StarterTemplate
	for _, t := range templates {
		if t.Category == category {
			result = append(result, t)
		}
	}
	return result
}

// GetCategories returns unique template categories.
func GetCategories() []string {
	seen := make(map[string]bool)
	var categories []string
	for _, t := range templates {
		if !seen[t.Category] {
			seen[t.Category] = true
			categories = append(categories, t.Category)
		}
	}
	return categories
}

// TemplatesJSON returns the templates as a JSON byte slice.
func TemplatesJSON() ([]byte, error) {
	return json.Marshal(templates)
}

var templates = []StarterTemplate{
	{
		ID:          "email-notification",
		Name:        "Email Notification System",
		Description: "Send transactional emails with retry and deduplication",
		Category:    "communication",
		Manifest: `version: "1.0"
package: notifications
job_types:
  - type: email.send
    description: Send a transactional email via SMTP or API provider
    queue: email
    args:
      - name: to
        type: string
        required: true
        description: Recipient email address
      - name: subject
        type: string
        required: true
        description: Email subject line
      - name: template_id
        type: string
        required: true
        description: Email template identifier
      - name: variables
        type: object
        required: false
        description: Template variable substitutions
    retry:
      max_attempts: 3
      backoff: exponential
      initial_ms: 2000
    unique:
      key: "email:{{to}}:{{template_id}}"
      period: 5m
    timeout_ms: 30000
    tags:
      - communication
      - email
`,
	},
	{
		ID:          "image-processing",
		Name:        "Image Processing Pipeline",
		Description: "Resize, optimize, and transform uploaded images",
		Category:    "media",
		Manifest: `version: "1.0"
package: media
job_types:
  - type: image.resize
    description: Resize an image to specified dimensions
    queue: media
    args:
      - name: source_url
        type: string
        required: true
        description: URL of the source image
      - name: width
        type: int
        required: true
        description: Target width in pixels
      - name: height
        type: int
        required: true
        description: Target height in pixels
      - name: format
        type: string
        required: false
        description: Output format (jpeg, png, webp)
    retry:
      max_attempts: 2
      backoff: exponential
      initial_ms: 5000
    timeout_ms: 120000
    priority: 3
    tags:
      - media
      - image
  - type: image.optimize
    description: Optimize image file size while preserving quality
    queue: media
    args:
      - name: source_url
        type: string
        required: true
        description: URL of the image to optimize
      - name: quality
        type: int
        required: false
        description: Quality level 1-100 (default 85)
    retry:
      max_attempts: 2
      backoff: constant
      initial_ms: 3000
    timeout_ms: 60000
    tags:
      - media
      - optimization
`,
	},
	{
		ID:          "webhook-delivery",
		Name:        "Webhook Delivery System",
		Description: "Reliable webhook delivery with exponential backoff",
		Category:    "integration",
		Manifest: `version: "1.0"
package: webhooks
job_types:
  - type: webhook.deliver
    description: Deliver a webhook payload to a registered endpoint
    queue: webhooks
    args:
      - name: url
        type: string
        required: true
        description: Target webhook URL
      - name: payload
        type: object
        required: true
        description: JSON payload to deliver
      - name: headers
        type: object
        required: false
        description: Custom HTTP headers
      - name: secret
        type: string
        required: false
        description: HMAC signing secret
    retry:
      max_attempts: 8
      backoff: exponential
      initial_ms: 1000
    timeout_ms: 30000
    tags:
      - webhook
      - http
      - integration
`,
	},
	{
		ID:          "data-etl",
		Name:        "Data ETL Pipeline",
		Description: "Extract, transform, and load data between systems",
		Category:    "data",
		Manifest: `version: "1.0"
package: etl
job_types:
  - type: data.extract
    description: Extract data from a source system
    queue: etl
    args:
      - name: source
        type: string
        required: true
        description: Data source identifier
      - name: query
        type: string
        required: true
        description: Query or filter for extraction
      - name: batch_size
        type: int
        required: false
        description: Number of records per batch
    retry:
      max_attempts: 3
      backoff: exponential
      initial_ms: 5000
    timeout_ms: 300000
    tags:
      - etl
      - data
  - type: data.transform
    description: Transform extracted data according to rules
    queue: etl
    args:
      - name: input_path
        type: string
        required: true
        description: Path to input data
      - name: rules
        type: object
        required: true
        description: Transformation rules to apply
    retry:
      max_attempts: 2
      backoff: constant
      initial_ms: 3000
    timeout_ms: 600000
    tags:
      - etl
      - transform
  - type: data.load
    description: Load transformed data into the target system
    queue: etl
    args:
      - name: target
        type: string
        required: true
        description: Target system identifier
      - name: data_path
        type: string
        required: true
        description: Path to transformed data
    retry:
      max_attempts: 5
      backoff: exponential
      initial_ms: 2000
    timeout_ms: 300000
    tags:
      - etl
      - load
`,
	},
	{
		ID:          "ml-training",
		Name:        "ML Training Pipeline",
		Description: "Train, evaluate, and deploy machine learning models",
		Category:    "ai-ml",
		Manifest: `version: "1.0"
package: ml
job_types:
  - type: ml.train
    description: Train a machine learning model
    queue: gpu
    args:
      - name: model_id
        type: string
        required: true
        description: Model identifier
      - name: dataset_url
        type: string
        required: true
        description: Training dataset URL
      - name: hyperparams
        type: object
        required: true
        description: Training hyperparameters
      - name: epochs
        type: int
        required: true
        description: Number of training epochs
    retry:
      max_attempts: 2
      backoff: exponential
      initial_ms: 30000
    timeout_ms: 7200000
    priority: 8
    tags:
      - ml
      - training
      - gpu
  - type: ml.evaluate
    description: Evaluate a trained model against test data
    queue: gpu
    args:
      - name: model_id
        type: string
        required: true
        description: Model identifier
      - name: checkpoint
        type: string
        required: true
        description: Model checkpoint path
      - name: test_dataset_url
        type: string
        required: true
        description: Test dataset URL
    retry:
      max_attempts: 1
      backoff: constant
      initial_ms: 5000
    timeout_ms: 1800000
    tags:
      - ml
      - evaluation
`,
	},
	{
		ID:          "e-commerce-orders",
		Name:        "E-Commerce Order Processing",
		Description: "Process orders: payment, fulfillment, notification",
		Category:    "e-commerce",
		Manifest: `version: "1.0"
package: orders
job_types:
  - type: order.process_payment
    description: Process payment for an order
    queue: critical
    args:
      - name: order_id
        type: string
        required: true
        description: Order identifier
      - name: amount_cents
        type: int
        required: true
        description: Payment amount in cents
      - name: currency
        type: string
        required: true
        description: ISO 4217 currency code
      - name: payment_method_id
        type: string
        required: true
        description: Stored payment method ID
    retry:
      max_attempts: 3
      backoff: exponential
      initial_ms: 1000
    unique:
      key: "payment:{{order_id}}"
      period: 1h
    timeout_ms: 30000
    priority: 9
    tags:
      - payment
      - critical
  - type: order.fulfill
    description: Fulfill an order after successful payment
    queue: fulfillment
    args:
      - name: order_id
        type: string
        required: true
        description: Order identifier
      - name: items
        type: array
        required: true
        description: Order line items
    retry:
      max_attempts: 5
      backoff: exponential
      initial_ms: 2000
    timeout_ms: 60000
    tags:
      - fulfillment
      - order
`,
	},
}
