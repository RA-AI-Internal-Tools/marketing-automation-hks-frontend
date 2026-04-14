// Provider key-name schema used by the credential-editing UI.
//
// The backend's GET /api/integrations/credentials endpoint deliberately never
// returns secret values (or even the list of expected fields per provider) —
// it only returns metadata rows for fields that have already been saved. So
// the UI needs a static source of truth for "which fields does this provider
// accept, what are they labelled, and which ones are secret?". That lives
// here. Keep entries aligned with the backend's encrypted-credential reader.

export interface KeyField {
  key_name: string
  label: string
  hint?: string
  /** If true the input renders as <type=password> with a Show toggle. */
  secret?: boolean
  /** If true the input renders as a <textarea> (e.g. JSON blobs). */
  multiline?: boolean
}

export const INTEGRATION_KEYS: Record<string, KeyField[]> = {
  openai: [
    { key_name: 'api_key', label: 'API Key', hint: 'sk-proj-...', secret: true },
  ],
  elastic_email: [
    { key_name: 'api_key', label: 'API Key', secret: true },
  ],
  plivo: [
    { key_name: 'auth_id', label: 'Auth ID' },
    { key_name: 'auth_token', label: 'Auth Token', secret: true },
  ],
  ses: [
    { key_name: 'access_key_id', label: 'Access Key ID' },
    { key_name: 'secret_access_key', label: 'Secret Access Key', secret: true },
    { key_name: 'region', label: 'Region', hint: 'us-east-1' },
  ],
  fcm: [
    {
      key_name: 'service_account_json',
      label: 'Service Account JSON',
      hint: 'paste full JSON',
      secret: true,
      multiline: true,
    },
    { key_name: 'project_id', label: 'Project ID' },
  ],
  meta_whatsapp: [
    { key_name: 'access_token', label: 'Access Token', secret: true },
    { key_name: 'phone_number_id', label: 'Phone Number ID' },
  ],
}

export function getKeyFields(provider: string): KeyField[] {
  return INTEGRATION_KEYS[provider] ?? []
}
