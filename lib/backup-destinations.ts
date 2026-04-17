/**
 * Strip secrets from backup destination config before sending to the admin UI.
 */
export function sanitizeDestinationOutput(destination: Record<string, unknown> | null | undefined) {
  const row = destination || {};
  const config = { ...((row.config as Record<string, unknown>) || {}) };
  delete config.serviceAccountJson;
  delete config.oauthAccessToken;
  delete config.oauthRefreshToken;
  delete config.oauthStateNonce;
  delete config.oauthStateExpiresAt;
  delete config.oauthRequestedByUserId;
  return {
    ...row,
    config,
  };
}
