# SenctraIQ Available Data Structures

## 1. Response envelope

Most Spring controllers return this wrapper:

```ts
interface ApiResponse<T> {
  message: string;
  statusCode: number;
  entity: T | null;
}
```

Example:

```json
{
  "message": "Conversations retrieved successfully",
  "statusCode": 200,
  "entity": []
}
```

The structures below describe the value inside `entity` unless stated otherwise.

## 2. Conversation data

### 2.1 Conversation reference

Returned by:

- `GET /api/conversations`
- `GET /api/conversations/getConversation`
- Conversation-changing POST endpoints after a successful operation

Filters for `GET /api/conversations`:

| Parameter | Meaning |
| --- | --- |
| `source` | Channel/source filter |
| `status` | Conversation status |
| `category` | Classification category |
| `assigned` | Assignment-state filter |

```ts
interface ConversationReference {
  id: number;
  source: string | null;
  senderId: string | null;
  senderName: string | null;
  recipientId: string | null;
  status: ConversationStatus | null;
  category: string | null;
  sentiment: string | null;
  confidence: number | null;

  assignedAgentId: number | null;
  assignedAgentUsername: string | null;
  handedOverByAgentId: number | null;
  handedOverByUsername: string | null;
  handedOverFromAiAgent: boolean | null;

  lastAnsweredBy: string | null;
  lastAnsweredByAgentId: number | null;
  lastAnsweredByUsername: string | null;
  lastAnsweredByEmail: string | null;
  lastAnsweredByFirstName: string | null;
  lastAnsweredByLastName: string | null;
  lastAnsweredByAiAgent: boolean | null;

  handoverNote: string | null;
  startedAt: string | null;
  lastMessageAt: string | null;
  assignedAt: string | null;
  handedOverAt: string | null;
  handedOverFromAiAgentAt: string | null;
  handedOverFromAiAgentExpiresAt: string | null;
  lastAnsweredAt: string | null;
  statusUpdatedAt: string | null;
  pendingSince: string | null;
  closedAt: string | null;
}

type ConversationStatus =
  | "NEW"
  | "ASSIGNED"
  | "HANDED_OVER"
  | "OPEN"
  | "PENDING_CUSTOMER"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";
```

Dates are serialized ISO-8601 `LocalDateTime` strings. `confidence` is a Java `BigDecimal`, serialized as a JSON number.

### 2.2 Conversation message

Returned by:

- `GET /api/conversations/messages`
- `GET /api/conversations/{conversationId}/messages`
- Inside conversation threads

Filters for the general messages endpoint:

| Parameter | Meaning |
| --- | --- |
| `conversationId` | One conversation ID |
| `source` | Channel/source |
| `status` | Parent conversation status |
| `category` | Classification category |

```ts
interface ConversationMessage {
  id: number;
  messageId: string | null;
  conversationId: number | null;
  senderType: SenderType | null;
  senderId: string | null;
  senderName: string | null;
  message: string | null;
  category: string | null;
  sentiment: string | null;
  confidence: number | null;
  createdAt: string | null;
}

type SenderType = "CUSTOMER" | "AGENT" | "SYSTEM";
```

### 2.3 Complete conversation thread

Returned by:

- `GET /api/conversations/threads`
- `GET /api/conversations/agents/{username}/threads`
- `GET /api/conversations/customers/{customerId}/threads`

```ts
interface ConversationThread {
  conversation: ConversationReference;
  messages: ConversationMessage[];
  agentUsernames: string[];
  agentCount: number;
}
```

Available filters for `/threads`:

- `agentUsername` or alias `username`
- `customerId`
- `source`
- `status`
- `category`
- `from`
- `to`

`from` and `to` accept date/time boundaries parsed by the backend. The agent and customer routes accept the same remaining filters.

### 2.4 Channel summary

Returned by:

- `GET /api/conversations/summary`
- `GET /api/conversations/threads/summary`

```ts
interface ConversationChannelSummary {
  channel: string;
  label: string;
  total: number;
  unassigned: number;
  statuses: Record<string, number>;
}
```

The backend pre-populates these channels:

```json
[
  { "channel": "whatsapp", "label": "WhatsApp" },
  { "channel": "facebook", "label": "Facebook" },
  { "channel": "x", "label": "X" },
  { "channel": "instagram", "label": "Instagram" }
]
```

The thread-summary endpoint accepts the same agent, customer, source, status, category, and date filters as `/threads`.

### 2.5 Conversation reports

Returned by `GET /api/conversations/reports`.

Filters:

- `source`
- `sentiment`
- `category`
- `username`
- `from`
- `to`

```ts
interface ConversationReports {
  totalCases: number;
  positiveCases: number;
  negativeCases: number;
  neutralCases: number;
  positiveByCategory: CategoryCaseReport[];
  negativeByCategory: CategoryCaseReport[];
  byChannel: ChannelCaseReport[];
  byChannelAndCategory: ChannelCategoryCaseReport[];
  handledByUsernameCategoryChannel: HandledCaseReport[];
}

interface CategoryCaseReport {
  category: string;
  totalCases: number;
}

interface ChannelCaseReport {
  channel: string;
  label: string;
  totalCases: number;
  positiveCases: number;
  negativeCases: number;
  neutralCases: number;
}

interface ChannelCategoryCaseReport extends ChannelCaseReport {
  category: string;
}

interface HandledCaseReport {
  username: string;
  category: string;
  channel: string;
  label: string;
  totalCases: number;
}
```

### 2.6 Active AI/agent-handled conversations

`GET /api/conversations/ai-agent/active`

Optional filters:

- `answeredBy`
- `source`

Returns `ConversationReference[]`.

### 2.7 Customer active status

`GET /api/conversations/customers/{customerId}/active-status`

Optional query parameter: `source`.

```ts
interface CustomerActiveStatus {
  customerId: string;
  source: string | null;
  active: boolean;
  conversationId: number | null;
  status: ConversationStatus | null;
  startedAt: string | null;
  lastMessageAt: string | null;
  conversationExpiresAt: string | null;
  handedOverFromAiAgent: boolean;
  handedOverFromAiAgentAt: string | null;
  handedOverFromAiAgentExpiresAt: string | null;
}
```

### 2.8 AI handover status

`GET /api/conversations/{conversationId}/ai-agent-handover/status`

```ts
interface AiHandoverStatus {
  conversationId: number;
  handedOverFromAiAgent: boolean;
  handedOverFromAiAgentAt: string | null;
  handedOverFromAiAgentExpiresAt: string | null;
}
```

## 3. User data

### 3.1 List active users

`GET /api/users/getAllUsers`

Only users with `deleted = false` are returned.

```ts
interface User {
  id: number;
  username: string;
  pfNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  isOnShift: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
  deleted: boolean;
  verified: boolean;
  locked: boolean;
  loggedIn: boolean;
  isOnLeave: boolean;
  availableForShift: boolean;
  shiftGroup: string | null;
  leaveDaysThisYear: number;
  role: Role[];
}
```

The password is excluded with `@JsonIgnore`. The linked `shift` entity is also excluded from direct user serialization.

The same safe user structure is returned after create, update, delete, or suspend operations.

## 4. Role data

### 4.1 List roles

`GET /api/roles/getAllRoles`

```ts
interface Role {
  id: number;
  name: string;
  permissions: Permission[];
  postedBy: string;
  postedTime: string;
  modifiedBy: string | null;
  modifiedTime: string | null;
  verifiedBy: string | null;
  verifiedTime: string | null;
  deletedBy: string | null;
  deletedTime: string | null;
  deleted: boolean;
}

type Permission =
  | "SUPERUSER_READ"
  | "SUPERUSER_CREATE"
  | "SUPERUSER_UPDATE"
  | "SUPERUSER_DELETE"
  | "ADMIN_READ"
  | "ADMIN_CREATE"
  | "ADMIN_UPDATE"
  | "ADMIN_DELETE"
  | "ANALYST_READ"
  | "ANALYST_CREATE"
  | "ANALYST_UPDATE"
  | "ANALYST_DELETE";
```

The reverse `Users` relationship is excluded from role JSON to prevent recursion.

## 5. Shift data

Retrievable from:

- `GET /api/shifts/active-now`
- `GET /api/shifts/active-by-time?time=HH:mm:ss`
- `GET /api/shifts/active-list`

```ts
interface Shift {
  id: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  creationTime: string;
  deleted: boolean;
  isActive: boolean;
}
```

`active-now` and `active-by-time` return one `Shift`. `active-list` returns `Shift[]`. The linked user collection is excluded from JSON.

## 6. Notification data

### 6.1 User notification inbox

`GET /api/users/notifications/user/{username}`

```ts
interface UserNotification {
  id: number;
  user: User;
  notification: Notification;
  isRead: boolean;
  isDeleted: boolean;
  readAt: string | null;
}
```

Only delivery rows where `isDeleted = false` are returned.

### 6.2 Notification

Returned inside inbox rows and from `GET /api/users/notifications/sent/{username}`.

```ts
interface Notification {
  id: number;
  message: string;
  targetGroup: string | null;
  targetUsername: string | null;
  createdBy: string;
  createdAt: string;
  actionType: string | null;
  actionRefId: string | null;
  actionStatus: string | null;
  parentId: number | null;
  editedAt: string | null;
}
```

`parentId` links a notification reply to its parent notification.

### 6.3 Unread count

`GET /api/users/notifications/user/{username}/unread-count`

Returns a number inside the normal envelope:

```json
{
  "message": "Unread count fetched successfully",
  "statusCode": 200,
  "entity": 4
}
```

The count excludes deleted deliveries and notifications authored by that same user.

### 6.4 Real-time notification payload

STOMP user queues and role topics deliver:

```ts
interface NotificationPayload {
  id: number;
  message: string;
  createdBy: string;
  createdAt: string;
  targetGroup: string | null;
  targetUsername: string | null;
  actionType: string | null;
  actionRefId: string | null;
  actionStatus: string | null;
  read: boolean;
  parentId: number | null;
  editedAt: string | null;
}
```

The SockJS/STOMP connection endpoint is `/ws-notifications`. Broker destinations use `/topic` and `/queue`; user updates include `/user/queue/notifications` and `/user/queue/notification-updates`.

## 7. Authentication data

### 7.1 Login and refresh response

Returned by:

- `POST /api/auth/login`
- `POST /api/auth/refresh`

```ts
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  username: string;
  firstname: string;
  email: string;
  lastname: string;
  loggedIn: boolean;
  isOnShift: boolean;
  isOnLeave: boolean;
}
```

This structure is inside `ApiResponse<LoginResponse>`.

### 7.2 JWT claims

Application access tokens contain at least:

- `sub`: username
- `role`: role names
- `authorities`: role names and permission names
- `iat`: issued-at time
- `exp`: expiry time

Exact claim presence depends on whether the token is an application JWT or an OIDC token.
The application JWT service currently issues access tokens for five minutes and refresh tokens for seven days.

## 8. OAuth/OIDC data

### 8.1 Registered-client helper response

`GET /api/oauth2/clients/registeredClients` does **not** return registered clients. It returns endpoint metadata only:

```ts
interface OAuthEndpointMetadata {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUrl: string;
  discoveryUrl: string;
}
```

The response currently instructs the caller to query `oauth2_registered_client` directly for an actual client list.

### 8.2 Standard OIDC endpoints

Spring Authorization Server also exposes standard protocol data:

- `GET /.well-known/openid-configuration`: provider metadata
- `GET /oauth2/jwks`: public signing keys
- `GET /userinfo`: claims for an OIDC access token

The exact discovery document and JWK values are generated at runtime.

## 9. Data shown in the frontend but not retrievable here

The frontend defines a rich `TicketResponseDTO` and calls these paths:

- `/api/v1/tickets`
- `/api/v1/tickets/open`
- `/api/v1/tickets/closed`
- `/api/v1/tickets/new`
- `/api/v1/tickets/handed-over`
- `/api/v1/tickets/active-bank-support`
- Ticket-specific assign, handover, reply, and close paths

No `/api/v1/tickets` controller exists in this Spring backend checkout. Therefore these ticket structures cannot be claimed as retrievable from this backend. They require another service/version or migration to the implemented `/api/conversations` model.

The frontend also requests profile and account endpoints such as `/api/users/me`, `/api/users/change-password`, and several `/api/auth/password-reset/**` paths that are absent from the controllers in this checkout.

## 10. Retrieval matrix

| Dataset | Endpoint | Result type | Confirmed in backend |
| --- | --- | --- | --- |
| Conversations | `GET /api/conversations` | `ConversationReference[]` | Yes |
| Channel summary | `GET /api/conversations/summary` | `ConversationChannelSummary[]` | Yes |
| Reports | `GET /api/conversations/reports` | `ConversationReports` | Yes |
| Active AI/agent conversations | `GET /api/conversations/ai-agent/active` | `ConversationReference[]` | Yes |
| Messages | `GET /api/conversations/messages` | `ConversationMessage[]` | Yes |
| Threads | `GET /api/conversations/threads` | `ConversationThread[]` | Yes |
| Filtered thread summary | `GET /api/conversations/threads/summary` | `ConversationChannelSummary[]` | Yes |
| Agent history | `GET /api/conversations/agents/{username}/threads` | `ConversationThread[]` | Yes |
| Customer history | `GET /api/conversations/customers/{id}/threads` | `ConversationThread[]` | Yes |
| Customer active state | `GET /api/conversations/customers/{id}/active-status` | `CustomerActiveStatus` | Yes |
| One conversation timeline | `GET /api/conversations/{id}/messages` | `ConversationMessage[]` | Yes |
| AI handover status | `GET /api/conversations/{id}/ai-agent-handover/status` | `AiHandoverStatus` | Yes |
| Users | `GET /api/users/getAllUsers` | `User[]` | Yes |
| Roles | `GET /api/roles/getAllRoles` | `Role[]` | Yes |
| Active shift | `GET /api/shifts/active-now` | `Shift` | Yes |
| Shift by time | `GET /api/shifts/active-by-time` | `Shift` | Yes |
| Active shifts | `GET /api/shifts/active-list` | `Shift[]` | Yes |
| User notifications | `GET /api/users/notifications/user/{username}` | `UserNotification[]` | Yes |
| Unread count | `GET /api/users/notifications/user/{username}/unread-count` | `number` | Yes |
| Sent notifications | `GET /api/users/notifications/sent/{username}` | `Notification[]` | Yes |
| OAuth endpoint metadata | `GET /api/oauth2/clients/registeredClients` | `OAuthEndpointMetadata` | Yes |
| Ticket queues | `GET /api/v1/tickets/**` | Frontend ticket DTOs | No |
| Current profile | `GET /api/users/me` | Frontend-defined profile | No |
