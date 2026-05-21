import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST;

let _client = null;

function getClient() {
  if (!_client) {
    if (!apiKey) {
      console.warn("[posthog] POSTHOG_API_KEY not set — analytics disabled.");
      return null;
    }
    _client = new PostHog(apiKey, host ? { host } : {});
  }
  return _client;
}

export function capture(distinctId, event, properties = {}) {
  const client = getClient();
  if (!client) return;
  client.capture({ distinctId: String(distinctId), event, properties });
}

export async function shutdown() {
  if (_client) {
    await _client.shutdown();
    _client = null;
  }
}
