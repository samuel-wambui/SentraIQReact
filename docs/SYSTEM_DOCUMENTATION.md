# SenctraIQ System Documentation

## 1. Purpose and scope

SenctraIQ is a customer-support operations application for receiving, classifying, assigning, answering, handing over, and reporting on conversations from social channels. The current UI recognizes four channels:

- WhatsApp
- Facebook
- X (Twitter)
- Instagram

The system is split across these runtime components:

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/Radix | Authentication UI, ticket queues, message handling, administration, reports, and embedded dashboards |
| Backend | Java 17, Spring Boot 3.3.3 | JWT authentication, OIDC authorization server, user/role/shift management, conversations, notifications, and reporting |
| Database | PostgreSQL | Application entities, messages, OAuth clients/authorizations, and RSA signing keys |
| Workflow integration | Configured HTTP webhook, currently n8n | Delivers agent replies back to the channel automation flow |

This document describes the code currently found in:

- Frontend: `/home/samuel/Downloads/senctraiq/frontend`
- Backend: `/home/samuel/Downloads/senctraiq/backend/backend`

It also identifies places where the frontend expects APIs that are not present in this backend checkout.

## 2. High-level architecture

```text
Browser
  |
  | React routes, sessionStorage JWT, Bearer requests
  v
Frontend (Vite in development, Nginx in the container)
  |
  | /api, /login, /oauth2, /userinfo
  v
Spring Boot backend
  |                  |
  | JPA              | reply webhook
  v                  v
PostgreSQL          n8n/channel flow
```

The frontend normally uses same-origin API paths. In development, Vite proxies those paths to the backend. In the container deployment, Nginx performs the equivalent proxying.

## 3. Frontend

### 3.1 Technology and application bootstrap

The frontend is a Vite single-page application using:

- React and React Router for rendering and navigation
- TypeScript for application types
- Tailwind CSS and shadcn/Radix components for UI primitives
- TanStack Query as an application-level provider
- Lucide icons
- `@stomp/stompjs` and SockJS dependencies for messaging support
- Recharts and PDF libraries for reporting/export capabilities

`src/main.tsx` mounts the application. `src/App.tsx` installs the global query, tooltip, toast, router, and authentication providers.

### 3.2 Frontend routing and access control

| Route | Access | Purpose |
| --- | --- | --- |
| `/auth` | Public | Login, signup, and password-reset request UI |
| `/reset-password` | Public | Password-reset confirmation |
| `/set-password` | Public | Required temporary-password change |
| `/` | Authenticated | Redirects a super user to `/super-user`, everyone else to `/dashboard` |
| `/dashboard` | Agent, admin, super user | Channel queue summary |
| `/messages` | Agent, admin, super user | New, handed-over, and active ticket workspace |
| `/ticket-history` | Agent, admin, super user | Searchable open/closed ticket history |
| `/reports` | Agent, admin, super user | Conversation totals and sentiment/category reports |
| `/admin` | Admin, super user | User creation, editing, suspension, deletion, and role assignment |
| `/super-user` | Super user | Role/permission and OAuth client administration |

`ProtectedRoute` rejects unauthenticated users. `RoleBasedRoute` additionally checks the normalized role produced by `useUserRole`.

The UI role mapping is:

- `SUPERUSER` or `SUPER_USER` -> `super_user`
- `ADMIN` -> `admin`
- `AGENT`, `ANALYST`, or `USER` -> `agent`

This mapping is a presentation-level simplification. The JWT may also contain detailed authorities such as `ADMIN_CREATE` or `ANALYST_READ`.

### 3.3 Authentication state

Authentication is managed by `AuthProvider`.

1. The login form calls `POST /api/auth/login` with username and password.
2. A successful response supplies an access token and usually a refresh token.
3. Tokens are stored in `sessionStorage`, not persistent `localStorage`.
4. Legacy tokens in `localStorage` are deleted.
5. The JWT subject becomes the current username and JWT roles/authorities drive route access.
6. `apiFetch` adds `Authorization: Bearer <token>` to authenticated calls.
7. A `401` response dispatches a global session-expired event and clears the session.
8. If a refresh token exists, the access token is refreshed 15 seconds before expiry.
9. Five minutes without mouse, keyboard, scrolling, or touch activity logs the user out.
10. Logout calls `POST /api/auth/logout/{username}`, clears browser state, and returns to `/auth`.

If the login response says that a password change is required, the frontend clears the session and redirects to `/set-password?token=...`.

### 3.4 Shared API client

`src/lib/api.ts` defines `apiFetch`, which:

- Uses `VITE_API_BASE`, defaulting to the current browser origin
- Serializes ordinary request bodies as JSON
- Leaves `FormData` and `URLSearchParams` untouched
- Adds the bearer token unless `auth: false` is specified
- Parses JSON responses while tolerating plain text responses
- Understands the backend's `{ message, statusCode, entity }` envelope
- Throws an `Error` containing the backend message for non-2xx responses

The client currently logs full API response bodies to the browser console. That is useful during development but can expose customer or authentication data and should be disabled or sanitized for production.

### 3.5 Main application layout

Authenticated pages share `Layout`, which provides:

- Role-filtered sidebar navigation
- Branded header
- Profile and settings dialogs
- Sign-out action
- Main routed content
- Footer

### 3.6 Dashboard

The agent dashboard loads ticket queues through `useConversations`. It displays one card per recognized channel, showing total and unassigned/new counts. Selecting a channel opens the new-ticket view in `/messages`.

### 3.7 Message and ticket workspace

The message workspace is organized into three queue views:

- `new`: unassigned customer tickets
- `handover`: tickets handed over by AI or bank support and waiting for assignment
- `active`: tickets currently assigned to support staff

The frontend polls queue and selected-thread data and prevents overlapping refresh/reply operations. Operators can:

- Filter tickets by channel, category, and sentiment
- Open a ticket timeline
- Assign a new or handed-over ticket to themselves
- Reply to a customer
- Hand a ticket to another processing path
- Return Facebook and WhatsApp tickets to AI while preserving the same conversation
- Close a ticket with mandatory closing remarks
- View previous handler, handover note, timestamps, classification, and response ownership

The UI contains a pending-customer action, but the ticket-controller path currently reports that this operation is not exposed by the `/api/v1/tickets` contract.

### 3.8 Ticket history

Ticket History loads open, closed, or all tickets and performs client-side filtering by:

- Agent username
- Customer identifier/name
- Channel
- Status
- Category
- Date range

It derives channel summaries from the matching tickets and then displays full per-channel timelines.

### 3.9 Reports

The Reports page calls `GET /api/conversations/reports` and supports filters for:

- Channel/source
- Sentiment
- Category
- Username
- Date period

It displays:

- Total, positive, negative, and neutral case counts
- Positive cases by category
- Negative cases by category
- Totals and sentiment split by channel
- Totals by channel and category
- Cases handled by username, category, and channel

### 3.10 Administration

The Admin page manages users and role assignments. Its UI expects operations for:

- Listing users and roles
- Creating users
- Editing users
- Soft deleting users
- Suspending and unlocking users
- Assigning and removing roles

The Super User page manages:

- Role creation, update, permissions, and deletion
- OAuth client registration and deletion
- Redirect URIs and OAuth grant/client authentication settings

## 4. Backend

### 4.1 Technology and package layout

The backend uses Java 17 and Spring Boot 3.3.3. Important dependencies include:

- Spring MVC
- Spring Data JPA
- Spring Security
- Spring Authorization Server 1.3.1
- Spring WebSocket/STOMP
- Spring Mail
- PostgreSQL JDBC
- JJWT 0.12.5
- springdoc OpenAPI/Swagger
- Lombok

The major packages are:

| Package | Responsibility |
| --- | --- |
| `Authentication` | Login, refresh, logout, and JWT-to-session SSO bridge |
| `security` | Security filter chains, JWT filter/service, OIDC server, OAuth clients, CORS |
| `users` | User persistence and administration |
| `roles` | Roles, permissions, assignment, and audit fields |
| `shifts` | Shift creation and active-shift lookup |
| `conversations` | Conversation/message ingestion, lifecycle, replies, history, and reports |
| `notifications` | Stored notifications and user-specific STOMP delivery |
| `dashboard` | Placeholder dashboard controller; its summary endpoint is currently commented out |

### 4.2 Security architecture

The backend defines three ordered Spring Security filter chains.

#### SSO login chain

Matches `/login` and `/login/**`. It permits the JWT-to-session bridge, allows framing from configured local origins, and stores the security context in the HTTP session.

#### Authorization-server chain

Handles OAuth 2.0/OIDC endpoints. It is session-based and exposes OIDC UserInfo. Unauthenticated authorization requests are redirected to `/login`.

#### REST API chain

Uses stateless JWT bearer authentication. A custom `JwtFilter` reads and validates access tokens before standard username/password authentication.

Role administration is restricted as follows:

- Role create/update/delete requires `SUPERUSER`.
- User management and role assignment/removal require `ADMIN` or `SUPERUSER`.
- OAuth client management requires `ADMIN` or `SUPERUSER`.

Several routes, including conversations, shifts, notifications, and authentication, are currently explicitly permitted without authentication in `SecurityConfig`. Controller methods sometimes recover the current user from the security context, but the URL-level policy itself does not require a bearer token for these permitted routes.

CORS currently accepts credentialed requests from `http://localhost:*` and `http://127.0.0.1:*` only.

### 4.3 JWT login and refresh

`AuthService` authenticates credentials through Spring Security and loads the non-deleted user. It records `loggedIn = true`, gathers role names and role permissions as authorities, then returns:

- Access token
- Refresh token
- Username and profile names/email
- Login, shift, and leave state

The frontend sends the refresh token to `POST /api/auth/refresh`. The backend validates it, reloads the user, rejects locked accounts, rotates both tokens, and keeps the user marked as logged in.

Logout marks the user logged out, clears the Spring security context, and invalidates any existing HTTP session.

### 4.4 OAuth/OIDC authorization server

The backend is also an OIDC provider. It persists:

- Registered OAuth clients
- OAuth authorizations and refresh/access/ID tokens
- Authorization consent
- The generated RSA signing key pair

OAuth clients can be registered and managed through the super-user interface. OIDC token/UserInfo claims are derived from SenctraIQ users and roles.

### 4.5 Users and roles

The `User` entity stores:

- Username, PF number, first/last name, email, BCrypt password
- Deleted, verified, locked, and logged-in flags
- On-shift, on-leave, and available-for-shift flags
- Shift start/end and shift group
- Many-to-many roles
- Optional assigned shift

The `Role` entity stores:

- Unique role name
- A set of permissions
- Posted, modified, verified, and deleted audit fields
- Soft-delete state

Permissions cover create/read/update/delete capabilities for super-user, admin, and analyst domains. `Role.getAuthorities()` exposes both permission enum names and the role name as Spring authorities.

### 4.6 Shifts

The shift module stores named start/end times, creator and creation time, active state, and soft-delete state. Its API can create shifts, find the active shift for the current time or a supplied time, list active shifts, and delete a shift.

### 4.7 Conversation data model

The conversation subsystem is the most developed business module.

`Conversation` represents the current aggregate state of one customer interaction. It includes:

- Channel/source and sender/recipient identifiers
- Sender display name
- Status
- Category, sentiment, and confidence
- Assigned agent and previous handover agent
- Handover note and timestamps
- Last-answer ownership and timestamps
- AI handover/continuation-window state
- Started, last-message, assigned, pending, status-update, and closed timestamps

`ConversationMessage` stores individual customer, agent, AI, and system timeline entries. Message IDs are unique and provide idempotency for channel/workflow retries.

`ConversationContinuationMessage` records messages received during an active AI-to-human continuation/handover window.

Recognized statuses include:

- `NEW`
- `ASSIGNED`
- `HANDED_OVER`
- `OPEN`
- `PENDING_CUSTOMER`
- `ESCALATED`
- `RESOLVED`
- `CLOSED`

### 4.8 Conversation lifecycle

#### Incoming customer message

`POST /api/conversations/incoming` requires a unique message ID and a customer identifier. It finds the latest non-terminal, non-expired conversation for the same source, sender, and recipient, or creates a new conversation.

The service then:

- Rejects duplicate message IDs
- Saves the customer message
- Applies category/sentiment/confidence metadata
- Preserves an active AI-handover continuation state when applicable
- Routes unassigned conversations to `NEW`
- Reopens assigned `NEW`, `ASSIGNED`, `HANDED_OVER`, or `PENDING_CUSTOMER` conversations as `OPEN`

#### Assignment

Assignment resolves the requested/current agent, records the assigned agent and timestamp, sets `OPEN`, and clears pending/closed state. Picking up an AI-handled conversation records the AI handover in the timeline.

#### Agent reply

Replying creates an agent message and updates last-answer metadata. The backend then posts a normalized `conversation.reply` payload to `app.conversations.reply-webhook-url`, currently defaulting to an n8n webhook. The payload contains channel, customer, recipient/page, reply text, agent identity, category, and status.

The API reports failure if the downstream webhook is missing, unreachable, or returns a non-2xx status.

#### Handover

Only the current assignee can hand over a non-terminal conversation. Handover records the previous agent and note, clears the assignment, changes status to `HANDED_OVER`, and adds a system message.

#### Pending customer

The operation sets status to `PENDING_CUSTOMER`, records `pendingSince`, and assigns the conversation first if needed.

#### Close

Closing requires non-empty remarks. An ordinary open conversation can only be closed by its current assignee. A pending-customer conversation can be closed only after 24 hours. Closing records a system message and terminal timestamps.

#### AI conversation and handover

The backend accepts combined customer-message/AI-answer payloads, records AI answer ownership, and supports explicit AI handover state. It exposes status checks and continuation-message APIs so external automation can continue using the same customer thread without creating a disconnected conversation.

### 4.9 Conversation API summary

| Method and path | Purpose |
| --- | --- |
| `GET /api/conversations` | List/filter conversation references |
| `GET /api/conversations/summary` | Channel totals and unassigned/status counts |
| `GET /api/conversations/reports` | Aggregated sentiment/category/channel/handler reports |
| `GET /api/conversations/ai-agent/active` | Active conversations last handled by AI/a selected agent |
| `GET /api/conversations/messages` | Filter message rows |
| `GET /api/conversations/threads` | Filter complete conversation timelines |
| `GET /api/conversations/threads/summary` | Channel summary for filtered threads |
| `GET /api/conversations/agents/{username}/threads` | Threads involving an agent |
| `GET /api/conversations/customers/{customerId}/threads` | Threads for a customer |
| `GET /api/conversations/customers/{customerId}/active-status` | Customer active-conversation state |
| `GET /api/conversations/{id}/messages` | Timeline for one conversation |
| `POST /api/conversations/{id}/reply` | Send and record an agent reply |
| `POST /api/conversations/{id}/agent-answer` | Record agent/AI answer metadata |
| `POST /api/conversations/full` | Record a complete customer-message plus AI-answer exchange |
| `POST /api/conversations/continuation` | Record continuation during handover |
| `POST /api/conversations/incoming` | Ingest a customer message |
| `POST /api/conversations/{id}/assign` | Assign/pick a conversation |
| `POST /api/conversations/{id}/handover` | Return conversation to an unassigned queue |
| `POST /api/conversations/{id}/ai-agent-handover` | Set AI handover state |
| `GET /api/conversations/{id}/ai-agent-handover/status` | Read AI handover state |
| `POST /api/conversations/{id}/pending-customer` | Mark pending customer |
| `POST /api/conversations/{id}/close` | Close with remarks |

### 4.10 Notifications and WebSockets

Notifications are persisted as a notification plus per-user delivery rows. They support:

- One or multiple explicit recipients
- Role/group recipients
- Inbox and sent views
- Unread count
- Mark as read
- Soft delete per recipient
- Creator-only edit
- Replies to notifications

The backend exposes a SockJS/STOMP endpoint at `/ws-notifications`. A JWT may be supplied in the `Authorization` header or `?token=` query parameter during the handshake. Valid tokens attach the username as the WebSocket principal. User-specific updates are sent to queues such as `/user/queue/notification-updates`, and group broadcasts use role topics.

The handshake currently remains open even when the token is absent or invalid; it simply lacks an authenticated username.

## 5. Persistence

PostgreSQL database name is configured as `senctra_iq`. Hibernate uses `ddl-auto=update`, and `schema.sql` is always executed for the OAuth tables.

Important tables include:

- `users`
- `roles`
- `role_permissions`
- `User_roles`
- `shift`
- `conversations`
- `conversation_messages`
- `conversation_continuation_messages`
- Notification and user-notification tables generated by JPA
- `oauth2_registered_client`
- `oauth2_authorization`
- `oauth2_authorization_consent`
- `oauth2_rsa_key`

The conversation repositories use native projections for denormalized response data, including assigned-agent and answer-owner details.

## 6. Development and deployment

### 6.1 Current local development behavior

The checked-in Vite configuration serves the frontend on:

```text
http://localhost:8084
```

It proxies these paths to `VITE_DEV_API_PROXY_TARGET`, currently defaulting to `http://localhost:8080`:

- `/api`
- `/oauth2`
- `/userinfo`
- `/login`
- `/.well-known`

The backend's checked-in `application.properties` declares `server.port=8081`. A backend observed on another port is therefore using a command-line, environment, IDE, or other runtime override.

### 6.2 Container deployment

The frontend Dockerfile builds static assets with Node 20 and serves them using Nginx. `nginx.conf` provides SPA fallback and proxies API/OIDC paths to the Compose backend service on port `8081`.

Compose defines:

- PostgreSQL 16
- A prebuilt `sentraiq-backend:latest` image
- The frontend image built from this checkout

Default host mappings from `.env.example` are:

| Service | Host port | Container port |
| --- | --- | --- |
| PostgreSQL | `5433` | `5432` |
| Backend | `8082` | `8081` |
| Frontend | `83` | `80` |

### 6.3 Useful commands

Frontend development:

```bash
npm install
npm run dev
```

Frontend verification:

```bash
npm run build
npm run lint
```

Backend development:

```bash
cd /home/samuel/Downloads/senctraiq/backend/backend
./mvnw spring-boot:run
```

Backend verification:

```bash
./mvnw test
```

Swagger UI, when the backend is running, is available under `/swagger-ui/index.html`.

## 7. Current implementation gaps and operational risks

These are source-code observations, not intended behavior assumptions.

### 7.1 Port and origin inconsistency

- The old frontend README says frontend `8080` and backend `8081`.
- Vite currently uses frontend `8084` and backend target `8080`.
- Backend `application.properties` still defaults to `8081`.
- OAuth issuer/discovery URLs have contained hardcoded localhost ports.

Ports and public origins should be externalized into one environment-specific configuration model, especially for ngrok or production deployment.

### 7.2 Ticket API is not in this backend checkout

The dashboard, message workspace, and ticket-history page primarily call `/api/v1/tickets/**`. No controller implementing that prefix exists under this backend source tree. Either:

- Another service/version supplies the ticket API, or
- The frontend is midway through migration from ticket DTOs to `/api/conversations/**`.

The reports page already uses the conversation API. Until the ownership is made explicit, deployment must ensure `/api/v1/tickets/**` reaches the service that implements it.

### 7.3 Frontend account endpoints exceed this backend controller

The frontend calls signup, password-reset, temporary-password, profile, change-password, suspension, and unlock endpoints. The checked-in `AuthController` only defines login, refresh, and logout, while `UserController` defines list, signup, update, delete, and suspend. Some frontend account flows therefore do not have a matching endpoint in this backend checkout.

### 7.4 API authorization is broader than the UI

The UI protects conversation and notification screens, but `SecurityConfig` currently permits `/api/conversations/**`, `/api/users/notifications/**`, and several other operational API groups without URL-level authentication. Browser route protection is not a backend security boundary.

### 7.5 Hardcoded development credentials and URLs

Local development origins are configured in the backend CORS allowlist. Secrets and externally visible URLs should be supplied through environment variables or a secret manager.

### 7.6 Sensitive logging

- The frontend logs parsed API responses.
- The backend logs detailed SSO/session diagnostics.
- SQL logging and mail debug logging are enabled.

These settings should be reduced for production to avoid leaking customer data, tokens, session identifiers, or infrastructure details.

## 8. Recommended source-of-truth boundaries

For maintenance, treat these files as the primary entry points:

| Concern | Source of truth |
| --- | --- |
| Frontend routes and role visibility | `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/hooks/useUserRole.tsx` |
| Browser authentication lifecycle | `src/components/auth/AuthProvider.tsx`, `src/lib/api.ts` |
| Ticket UI contract | `src/lib/tickets.ts`, `src/pages/Messages.tsx` |
| Conversation/report contract | `src/lib/conversations.ts` |
| Backend REST security | `security/SecurityConfig.java` |
| JWT behavior | `security/jwt/JwtService.java`, `Authentication/AuthService.java` |
| OIDC authorization server | `security/OAuth2AuthorizationServerConfig.java` |
| Conversation business rules | `conversations/ConversationService.java` |
| Conversation endpoints | `conversations/ConversationController.java` |
| Runtime defaults | Frontend `vite.config.ts`; backend `application.properties`; deployment `docker-compose.yml` |

When behavior and prose disagree, verify these source files and the active runtime environment before updating documentation.
