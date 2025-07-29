npx tsx src/${WHAT:-client}.ts \
  $URL 8001 \
  --static-oauth-client-info "{\"client_id\": \"$OKTA_CLIENT_ID\", \"client_secret\": \"$OKTA_CLIENT_SECRET\"}" \
  --static-oauth-client-metadata "{\"scope\": \"openid profile offline_access $CUSTOM_SCOPE\"}" \
  --transport=http-first \
  --debug
