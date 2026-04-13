export interface VariableDefinition {
  name: string
  label: string
  token: string
  description: string
  sampleValue: string
  category: string
  required: boolean
}

export interface VariableCategory {
  key: string
  label: string
  variables: VariableDefinition[]
}

const VAR_REGEX = /\{\{([\w.]+)\}\}/g

export function extractVariables(text: string): string[] {
  const vars = new Set<string>()
  let match: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX.source, 'g')
  while ((match = re.exec(text)) !== null) {
    vars.add(match[1]!)
  }
  return Array.from(vars)
}

export function extractVariablesFromMultiple(...texts: (string | undefined | null)[]): string[] {
  const vars = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const v of extractVariables(text)) {
      vars.add(v)
    }
  }
  return Array.from(vars)
}

export function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(VAR_REGEX, (match, varName: string) => {
    if (Object.prototype.hasOwnProperty.call(data, varName)) {
      const val = data[varName]
      return val != null ? String(val) : match
    }
    return match
  })
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const VARIABLE_CATEGORIES: VariableCategory[] = [
  {
    key: 'recipient',
    label: 'Recipient',
    variables: [
      { name: 'first_name', label: 'First Name', token: '{{first_name}}', description: 'Recipient first name', sampleValue: 'John', category: 'recipient', required: true },
      { name: 'last_name', label: 'Last Name', token: '{{last_name}}', description: 'Recipient last name', sampleValue: 'Doe', category: 'recipient', required: false },
      { name: 'email', label: 'Email', token: '{{email}}', description: 'Recipient email address', sampleValue: 'john@example.com', category: 'recipient', required: true },
      { name: 'full_name', label: 'Full Name', token: '{{full_name}}', description: 'Recipient full name', sampleValue: 'John Doe', category: 'recipient', required: false },
    ],
  },
  {
    key: 'order',
    label: 'Order',
    variables: [
      { name: 'order_id', label: 'Order ID', token: '{{order_id}}', description: 'Order identifier', sampleValue: 'ORD-12345', category: 'order', required: false },
      { name: 'order_amount', label: 'Order Amount', token: '{{order_amount}}', description: 'Total order amount', sampleValue: '149.99', category: 'order', required: false },
      { name: 'currency', label: 'Currency', token: '{{currency}}', description: 'Payment currency code', sampleValue: 'USD', category: 'order', required: false },
      { name: 'order_date', label: 'Order Date', token: '{{order_date}}', description: 'Date of the order', sampleValue: '2026-01-15', category: 'order', required: false },
      { name: 'order_items', label: 'Order Items', token: '{{order_items}}', description: 'Formatted list of items', sampleValue: '1× Widget Pro, 2× Cable', category: 'order', required: false },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    variables: [
      { name: 'payment_method', label: 'Payment Method', token: '{{payment_method}}', description: 'Payment method used', sampleValue: 'Visa •••• 4242', category: 'payment', required: false },
      { name: 'transaction_id', label: 'Transaction ID', token: '{{transaction_id}}', description: 'Payment transaction ID', sampleValue: 'TXN-98765', category: 'payment', required: false },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    variables: [
      { name: 'product_name', label: 'Product Name', token: '{{product_name}}', description: 'Name of the product', sampleValue: 'Widget Pro', category: 'product', required: false },
      { name: 'product_url', label: 'Product URL', token: '{{product_url}}', description: 'Link to the product page', sampleValue: 'https://example.com/product/123', category: 'product', required: false },
      { name: 'product_image_url', label: 'Product Image URL', token: '{{product_image_url}}', description: 'Product image source', sampleValue: 'https://example.com/img/product.jpg', category: 'product', required: false },
    ],
  },
  {
    key: 'company',
    label: 'Company',
    variables: [
      { name: 'company_name', label: 'Company Name', token: '{{company_name}}', description: 'Sender company name', sampleValue: 'AR-PAY', category: 'company', required: false },
      { name: 'support_email', label: 'Support Email', token: '{{support_email}}', description: 'Customer support email', sampleValue: 'support@hks.com', category: 'company', required: false },
      { name: 'company_address', label: 'Company Address', token: '{{company_address}}', description: 'Physical mailing address', sampleValue: '123 Main St, London, UK', category: 'company', required: false },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing / Campaign',
    variables: [
      { name: 'unsubscribe_url', label: 'Unsubscribe URL', token: '{{unsubscribe_url}}', description: 'One-click unsubscribe link', sampleValue: 'https://example.com/unsubscribe?t=abc', category: 'marketing', required: true },
      { name: 'view_in_browser_url', label: 'View in Browser URL', token: '{{view_in_browser_url}}', description: 'View email in browser link', sampleValue: 'https://example.com/view?t=abc', category: 'marketing', required: false },
      { name: 'campaign_name', label: 'Campaign Name', token: '{{campaign_name}}', description: 'Name of the campaign', sampleValue: 'Spring Sale 2026', category: 'marketing', required: false },
      { name: 'coupon_code', label: 'Coupon Code', token: '{{coupon_code}}', description: 'Promotional coupon code', sampleValue: 'SPRING20', category: 'marketing', required: false },
      { name: 'discount_amount', label: 'Discount Amount', token: '{{discount_amount}}', description: 'Discount value', sampleValue: '20%', category: 'marketing', required: false },
    ],
  },
  {
    // Cart variables populated by the /internal/events/cart ingestion path
    // (checkout_started fires a NATS trigger that injects cart_items +
    // cart_total into the campaign context; the renderer exposes them as
    // Handlebars-shim iterables — see template_render.go).
    key: 'cart',
    label: 'Cart',
    variables: [
      { name: 'cart_total', label: 'Cart Total', token: '{{cart_total}}', description: 'Current cart total amount', sampleValue: '49.90', category: 'cart', required: false },
      { name: 'cart_currency', label: 'Cart Currency', token: '{{cart_currency}}', description: 'Cart currency code', sampleValue: 'USD', category: 'cart', required: false },
      { name: 'cart_items', label: 'Cart Items (loop)', token: '{{#each cart_items}}{{this.name}} x{{this.quantity}}{{/each}}', description: 'Iterate cart items — use inside {{#each}}...{{/each}}', sampleValue: '[{"name":"Hoodie","quantity":2}]', category: 'cart', required: false },
    ],
  },
  {
    // Products & recommendations — injected by the executor when a client
    // has computed recommendations (see engine.GetRecommendations). Author
    // use: {{#each recommended_products}}...{{/each}}.
    key: 'products',
    label: 'Products & Recommendations',
    variables: [
      { name: 'recommended_products', label: 'Recommended Products (loop)', token: '{{#each recommended_products}}{{this.name}}{{/each}}', description: 'Personalised product recommendations from the collaborative-filtering engine', sampleValue: '[{"name":"Related Widget","price":29.90}]', category: 'products', required: false },
    ],
  },
  {
    key: 'custom',
    label: 'Custom',
    variables: [
      { name: 'custom_1', label: 'Custom Field 1', token: '{{custom_1}}', description: 'Custom placeholder 1', sampleValue: 'value_1', category: 'custom', required: false },
      { name: 'custom_2', label: 'Custom Field 2', token: '{{custom_2}}', description: 'Custom placeholder 2', sampleValue: 'value_2', category: 'custom', required: false },
    ],
  },
]

export const ALL_KNOWN_VARIABLES: VariableDefinition[] = VARIABLE_CATEGORIES.flatMap((c) => c.variables)

export function getDefaultSampleData(): Record<string, any> {
  const data: Record<string, any> = {}
  for (const v of ALL_KNOWN_VARIABLES) {
    data[v.name] = v.sampleValue
  }
  return data
}

export function getKnownVariableNames(): Set<string> {
  return new Set(ALL_KNOWN_VARIABLES.map((v) => v.name))
}

export const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{company_name}}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f4f4f7; padding: 24px 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .email-header { background-color: #020288; color: #ffffff; padding: 32px 40px; text-align: center; }
    .email-header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .email-body { padding: 40px; color: #333333; line-height: 1.6; }
    .email-body h2 { color: #020288; margin-top: 0; }
    .email-body p { margin: 0 0 16px; }
    .email-button { display: inline-block; background-color: #0099db; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 0; }
    .email-footer { background-color: #f4f4f7; padding: 24px 40px; text-align: center; color: #888888; font-size: 12px; line-height: 1.5; }
    .email-footer a { color: #0099db; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <h1>{{company_name}}</h1>
      </div>
      <div class="email-body">
        <h2>Hello {{first_name}},</h2>
        <p>Your email content goes here. Write your message and use variables like {{first_name}} and {{order_id}} for personalization.</p>
        <p style="text-align: center;">
          <a href="{{product_url}}" class="email-button">Call to Action</a>
        </p>
        <p>Thank you,<br>The {{company_name}} Team</p>
      </div>
      <div class="email-footer">
        <p>© 2026 {{company_name}} · {{company_address}}</p>
        <p>
          <a href="{{unsubscribe_url}}">Unsubscribe</a> ·
          <a href="{{view_in_browser_url}}">View in browser</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`

export const TEMPLATE_CATEGORIES = [
  { value: 'transactional', label: 'Transactional' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'notification', label: 'Notification' },
] as const

export const TEMPLATE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ar-iq', label: 'Arabic (Iraq)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'tr', label: 'Turkish' },
] as const

/**
 * Build the localized template key the MA backend looks up at send time.
 * Convention mirrors internal/locale/resolver.go TemplateCandidates:
 *
 *   "welcome"       + "ar-iq" → "welcome.ar-iq"
 *   "welcome"       + "ar"    → "welcome.ar"
 *   "welcome.ar-iq" + "ar"    → "welcome.ar"   (replaces existing suffix)
 *   any key         + ""      → key unchanged
 */
export function buildLocalizedTemplateKey(baseKey: string, locale: string): string {
  const trimmed = (baseKey || '').trim()
  const loc = (locale || '').trim().toLowerCase()
  if (!trimmed) return ''
  if (!loc) return trimmed
  const root = trimmed.replace(/\.([a-z]{2}(-[a-z]{2})?)$/i, '')
  return `${root}.${loc}`
}
