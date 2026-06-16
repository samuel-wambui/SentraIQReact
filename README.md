# SentraIQ Frontend

## Project Info

Built with **Vite + TypeScript + React + shadcn-ui + Tailwind CSS**

Backend: Spring Boot on `http://localhost:8081`

---

## Getting Started

```sh
# Install dependencies
npm i

# Start development server
npm run dev
```

Runs on `http://localhost:8080`

---

## Grafana SSO Configuration

Grafana runs on `http://localhost:3000`. The app authenticates silently into Grafana using OIDC SSO backed by the Spring Boot authorization server.

### `/etc/grafana/grafana.ini`

```ini
[server]
domain = localhost
root_url = http://localhost:3000/

[security]
cookie_secure = false
cookie_samesite = disabled
allow_embedding = true

[auth]
oauth_auto_login = false
login_cookie_name = grafana_session

[auth.generic_oauth]
enabled = true
name = SentraIQ SSO
icon = signin
allow_sign_up = true
auto_login = false
client_id = grafana
client_secret = secret
scopes = openid profile email
auth_url = http://localhost:8081/oauth2/authorize
token_url = http://localhost:8081/oauth2/token
api_url = http://localhost:8081/userinfo
redirect_uri = http://localhost:3000/login/generic_oauth
use_pkce = false
use_refresh_token = true
validate_id_token = false
allow_assign_grafana_admin = true
skip_org_role_sync = false
role_attribute_path = contains(grafana_roles[*], 'Admin') && 'Admin' || contains(grafana_roles[*], 'Editor') && 'Editor' || 'Viewer'
```

After any change restart Grafana:

```bash
sudo systemctl restart grafana-server
```

The backend only emits Grafana `Admin`/`Editor` roles for SentraIQ `SUPERUSER` users. Admin, agent, analyst, and other users are mapped to Grafana `Viewer`.

### How SSO Works

1. User logs into SentraIQ — Spring Boot creates a JWT + Spring session (`JSESSIONID`)
2. On the Dashboards page, the frontend calls `http://localhost:8081/login?token=<JWT>` with `credentials: include` — this establishes the Spring session in the browser
3. A hidden iframe loads `http://localhost:3000/login/generic_oauth` — Grafana redirects to Spring `/oauth2/authorize`
4. Spring sees the `JSESSIONID` cookie and authenticates silently — redirects back to Grafana with an auth code
5. Grafana exchanges the code for tokens, sets `grafana_session` cookie
6. The iframe navigates to `/dashboards` — Grafana loads without any login prompt

### Spring Boot OIDC Client Registration

In `OAuth2AuthorizationServerConfig.java`:

```java
.clientId("grafana")
.clientSecret("{noop}secret")
.clientAuthenticationMethod(CLIENT_SECRET_BASIC)
.clientAuthenticationMethod(CLIENT_SECRET_POST)
.redirectUri("http://localhost:3000/login/generic_oauth")
.scope(OPENID, PROFILE, EMAIL)
.authorizationGrantType(AUTHORIZATION_CODE)
.authorizationGrantType(REFRESH_TOKEN)
.clientSettings(ClientSettings.builder().requireAuthorizationConsent(false).build())
```

---

## Backend Requirements

- Spring Boot on port `8081`
- PostgreSQL database
- OIDC Authorization Server enabled (`spring-security-oauth2-authorization-server`)
- `JSESSIONID` session created on login alongside JWT

---

## Environment

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:8080       |
| Backend  | http://localhost:8081       |
| Grafana  | http://localhost:3000       |
