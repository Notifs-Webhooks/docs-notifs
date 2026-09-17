# Tchap notification system: integration and implementation guide

This document explains the integration work that connects La Suite Docs to the
Notifier service and, ultimately, to an encrypted Tchap direct-message room. It
describes the implemented behavior, the responsibilities of each repository,
the data flow, the HTTP contracts, the scheduling rules, failure handling, and
the local demonstration procedure.

The shorter operational instructions remain at the top of `README.md`. This
document is the technical reference for understanding or extending the feature.

## 1. Intended behavior

The feature allows an authenticated Docs user to subscribe to changes on one
document. The user chooses one of three recap frequencies:

- hourly;
- weekly;
- monthly.

There is no automatic instantaneous-notification option in the UI. A digest is
sent only when at least one saved document version exists in the completed
period. Periods without saved changes produce no Tchap message.

For this local demonstration, all Docs users are deliberately mapped to one
Matrix recipient:

```text
@bob:localhost
```

This mapping is performed by the Docs backend. The browser cannot select or
override the recipient and never receives the Notifier API token.

## 2. Repositories and responsibilities

The complete local system uses three sibling repositories.

### `docs-notifs`

Docs owns the product-level notification behavior:

- the **Notify changes** menu entry and modal;
- per-user and per-document notification settings;
- supported frequencies;
- contribution tracking;
- persisted document-version metadata;
- digest-window calculation;
- periodic and manually forced digest checks;
- aggregation of contributors and changes;
- authenticated server-to-server calls to Notifier.

### `tchap-notification-bot`

Notifier owns Tchap/Matrix delivery:

- authenticated subscription and notification endpoints;
- creation of a private encrypted Matrix room;
- invitation and consent state;
- durable SQLite delivery queue;
- idempotent message creation;
- Matrix synchronization and membership handling;
- encrypted message delivery and retries;
- bot and conversation avatars.

### `tchap-web-notifs`

The local Tchap stack provides:

- the Synapse homeserver;
- the Tchap web client;
- local test accounts such as `@bob:localhost`;
- the environment in which Bob accepts the Notifier invitation and receives
  encrypted messages.

## 3. End-to-end architecture

```text
┌──────────────────────────┐
│ Docs browser             │
│                          │
│ Notification modal       │
│ Document editor          │
└─────────────┬────────────┘
              │ authenticated Docs API requests
              ▼
┌──────────────────────────┐
│ Docs backend             │
│                          │
│ NotificationSetting      │
│ DocumentContribution     │
│ DocumentVersion          │
│ Celery digest scanner    │
└─────────────┬────────────┘
              │ private HTTP request
              │ Authorization: Bearer <server token>
              ▼
┌──────────────────────────┐
│ Notifier                 │
│                          │
│ FastAPI                  │
│ SQLite delivery queue    │
│ matrix-nio E2EE client   │
└─────────────┬────────────┘
              │ encrypted Matrix event
              ▼
┌──────────────────────────┐
│ Private Tchap room       │
│ Notifier + Bob           │
└──────────────────────────┘
```

The browser talks only to Docs. Only the Docs backend talks to Notifier. This
separation keeps the bearer token and fixed-recipient rule on trusted servers.

## 4. Enabling and disabling notifications

The modal uses the following Docs endpoint:

```text
/api/v1.0/documents/{document_id}/notification-settings/
```

The endpoint requires an authenticated user with permission to read the
document.

### Read the current setting

```http
GET /api/v1.0/documents/{document_id}/notification-settings/
```

The response contains:

```json
{
  "enabled": true,
  "frequency": "weekly",
  "last_sent_at": "2026-09-17T08:00:00Z",
  "subscription_status": "active"
}
```

For an enabled setting, Docs also asks Notifier for the current global Matrix
subscription state. Possible UI states include `pending`, `active`, `revoked`,
`error`, `not_found`, and `unavailable`.

### Enable notifications or change frequency

```http
PUT /api/v1.0/documents/{document_id}/notification-settings/
Content-Type: application/json

{
  "frequency": "hourly"
}
```

Docs then:

1. validates that the frequency is `hourly`, `weekly`, or `monthly`;
2. calls `POST /v1/subscriptions` on Notifier for `@bob:localhost`;
3. creates or updates the local `NotificationSetting`;
4. starts a new digest window when enabling or changing frequency;
5. returns the setting and the Notifier subscription state.

Notifier's subscription endpoint is idempotent. Re-enabling while the room is
pending or active reuses the same conversation.

### Disable notifications

```http
DELETE /api/v1.0/documents/{document_id}/notification-settings/
```

Docs disables only the current user's setting for that document. Because every
local Docs account maps to Bob, the Matrix subscription is shared globally by
all enabled document settings. Docs calls Notifier's
`DELETE /v1/subscriptions` only when no enabled `NotificationSetting` remains
anywhere in the local Docs database.

This prevents disabling one document from breaking notifications that are
still enabled for another document.

## 5. Tchap consent model

The bot cannot silently add a Tchap member to a private room. Enabling the
feature initiates this consent flow:

1. Docs asks Notifier to subscribe Bob.
2. Notifier creates an encrypted direct room and invites Bob.
3. The subscription remains `pending` until Bob accepts the invitation.
4. Digests produced while pending are stored as `awaiting_recipient`.
5. When Bob joins, Notifier changes the subscription to `active` and releases
   queued deliveries.
6. If Bob declines the invitation or leaves the room, the subscription becomes
   `revoked` and pending deliveries are cancelled.

Notifier does not automatically reinvite a recipient who revoked consent. The
user must disable and explicitly enable notifications again to request a new
invitation.

## 6. Detecting who changed a document

A useful digest requires both a saved version and the contributors responsible
for it. The integration links the frontend editor, the collaboration server,
and the content-save endpoint.

### Contribution reporting

On the first local Yjs update in an open version window, the Docs frontend sends:

```http
POST /api/v1.0/documents/{document_id}/contributions/
```

The backend derives the contributor from the authenticated session; the client
does not submit an arbitrary user ID. A unique database constraint keeps one
open `DocumentContribution` row per document and user. Repeated reporting
updates its timestamp.

### Creating a version boundary

When Docs persists Yjs content to S3-compatible object storage, the backend:

1. records a contribution cutoff timestamp;
2. selects contribution rows at or before that cutoff;
3. saves the document content;
4. obtains the object-storage version ID and ETag;
5. creates a `DocumentVersion` row;
6. attaches the selected contributors to that version;
7. removes only contribution rows at or before the cutoff;
8. broadcasts a `document-version-boundary` event through the Y provider.

Deleting only rows before the cutoff is important. A contribution received
while object storage is saving has a later timestamp and is preserved for the
next version instead of being lost.

The frontend receives the stateless version-boundary event and resets its local
"contribution already reported" flag. Its next local edit can therefore report
a contribution for the next saved version.

### Object-storage requirement

The feature depends on object-storage version IDs. The local MinIO bucket has
versioning enabled. Another S3-compatible deployment must also enable
versioning and return a `VersionId` when saving document content.

## 7. Persisted notification data

### `NotificationSetting`

One row represents one Docs user following one document:

- `user`;
- `document`;
- `enabled`;
- `frequency`;
- `last_checked_at`;
- `last_sent_at`.

The `(user, document)` pair is unique. `last_checked_at` marks the start of the
next unprocessed digest window. `last_sent_at` records the latest successful
non-empty delivery.

Legacy prototype frequencies `immediate` and `daily` are migrated to `hourly`.
The unused per-setting Tchap destination was removed because the demonstration
recipient is now a trusted backend setting.

### `DocumentVersion`

A row stores:

- the document;
- its object-storage `version_id`;
- its ETag;
- the contributors attached to that saved version;
- its creation time.

The `(document, version_id)` pair is unique.

### `DocumentContribution`

This table temporarily records contributors whose changes have not yet been
consumed by a saved `DocumentVersion`.

## 8. Digest scheduling

Celery Beat schedules
`core.tasks.notifications.dispatch_due_notification_digests` every 60 seconds.
The regular Celery worker executes the scan.

For each enabled setting, the scanner calculates a window:

```text
window_start = last_checked_at, or setting creation time
window_end   = next hourly, weekly, or monthly boundary
```

It then selects `DocumentVersion` rows where:

```text
created_at > window_start and created_at <= window_end
```

The outcomes are:

- `not_due`: the configured boundary has not been reached;
- `empty`: the boundary is due but no saved versions exist; the window advances
  without sending a message;
- `sent`: a digest was accepted by Notifier; the window and `last_sent_at`
  advance;
- `unavailable`: Notifier could not be reached; the window does not advance and
  will be retried;
- `disabled`: Notifier returned `409`, indicating missing or revoked consent;
  the local document setting is disabled.

Hourly windows add one hour. Weekly windows add seven days. Monthly windows add
one calendar month from the previous boundary and clamp invalid dates to the
last day of the target month.

Only one Celery Beat scheduler should run in an environment. The Notifier
idempotency key still protects a logical scheduled delivery from ordinary
request retries.

## 9. Digest payload sent to Notifier

Docs aggregates all contributors and saved versions in the completed window,
then sends:

```json
{
  "recipient": "@bob:localhost",
  "idempotency_key": "digest:<setting-id>:<window-end>",
  "actor_name": "Alice Martin, Bob Dupont",
  "document_id": "<document-uuid>",
  "document_title": "Project roadmap",
  "document_url": "http://<docs-host>:3000/docs/<document-uuid>",
  "change_type": "updated",
  "change_count": 3,
  "period_start": "2026-09-17T08:00:00+00:00",
  "period_end": "2026-09-17T09:00:00+00:00",
  "occurred_at": "2026-09-17T09:00:00+00:00"
}
```

Notifier validates that `period_start` and `period_end` are either both present
or both absent, and that the end is after the start. When a period is present,
it renders the new recap template:

```text
📝 Document update summary

Alice Martin and Bob Dupont made 3 saved updates to "Project roadmap".
Period: 2026-09-17T08:00+00:00 to 2026-09-17T09:00+00:00

Open document: http://<docs-host>:3000/docs/<document-uuid>
```

The older single-change payload remains supported by Notifier for compatibility.

## 10. Manual `send` command

The local launcher accepts:

```bash
./run-docs-lan.sh send
```

This command runs the Django `send_notification_digests` management command in
the existing application container. It does not enable notifications and does
not bypass Tchap consent. Instead, it changes the current scan boundary to
"now" for every enabled setting.

As a result:

- enabled documents with saved changes since their previous check send a recap
  immediately;
- enabled documents without saved changes remain silent;
- disabled documents are ignored;
- successful or empty windows start again from the command execution time;
- failed Notifier calls retain their original window for retry.

The command prints a result summary such as:

```text
Forced digest check complete: sent=1 empty=2 not_due=0 disabled=0 unavailable=0
```

This is intended for local demonstrations and debugging. It does not reintroduce
an instantaneous frequency in the product UI.

## 11. Frontend changes

The modal no longer uses browser-only state or `localStorage`. React Query hooks
now call the real Docs endpoint and update the cached setting after mutations.

The UI exposes only backend-supported behavior:

- enable/disable switch;
- hourly, weekly, or monthly frequency;
- current Tchap status;
- an explanation of digest contents;
- an explicit statement that empty periods do not generate messages.

Unsupported prototype controls were removed:

- instantaneous notifications;
- daily notifications;
- channel selection;
- email delivery;
- webhook delivery;
- per-event checkboxes.

The modal also explains when Bob still needs to accept an invitation, when
delivery is active, when Notifier is unavailable, and when authorization was
revoked.

## 12. Server-to-server configuration

The Docs backend reads:

| Variable | Local demonstration value | Meaning |
| --- | --- | --- |
| `NOTIFIER_API_URL` | `http://notifier:8085` | Notifier URL on the private Docker network |
| `NOTIFIER_API_TOKEN` | `local-demo-notifier-api-token-2026` | Shared development bearer token |
| `NOTIFIER_RECIPIENT` | `@bob:localhost` | Forced Matrix recipient |
| `NOTIFIER_REQUEST_TIMEOUT` | `10` | HTTP timeout in seconds |

Notifier Compose injects the same development token. Both projects join the
external `lasuite-network`, and Notifier registers the `notifier` network alias.

The local token is intentionally predictable for the demonstration only. A
real deployment must inject a strong secret into both services and restrict
the Notifier API to the Docs backend network.

## 13. Launcher and Compose changes

`run-docs-lan.sh` now supports:

```text
start    start missing services without force-recreating stateful dependencies
restart  restart the existing application services
send     force a non-empty digest check immediately
```

The Docs Compose project includes `celery-beat-dev`. Its persistent scheduler
file is written under `/tmp`, not into the source tree.

The Notifier `run.sh` remains portable between the Docker Compose plugin and
legacy `docker-compose`. It supports `start`, `stop`, `restart`, `status`, and
`logs`, waits for `/readyz`, and preserves its named volume when stopping.

## 14. Failure and retry behavior

### Notifier is temporarily unavailable

- Enabling returns HTTP `503` and does not falsely enable the local setting.
- A scheduled digest retains its window and is retried on a later scan.
- Disabling remains locally effective even if the final global unsubscribe
  cannot reach Notifier; the UI reports `unavailable`.

### Bob has not accepted yet

Notifier accepts the digest into its durable queue with the
`awaiting_recipient` status. It sends the queued message after Bob joins.

### Bob revoked consent

Notifier rejects new delivery creation with HTTP `409`. Docs disables the
affected document setting instead of repeatedly attempting delivery.

### Duplicate delivery attempt

Docs generates a stable idempotency key for each scheduled setting/window.
Notifier returns the existing delivery for a reused key instead of creating a
second message.

### Empty period

Docs advances the checked window without calling Notifier. No blank or
"nothing changed" message reaches Tchap.

## 15. Security boundaries

- The Notifier bearer token exists only in backend and container configuration.
- The recipient is chosen by trusted backend configuration, not request data
  from the browser.
- Docs permissions protect notification-setting and contribution endpoints.
- The contribution endpoint derives identity from the authenticated user.
- Matrix messages are sent in encrypted rooms.
- The Notifier SQLite database may contain pending message bodies and must be
  treated as sensitive data.
- Notifier's Matrix store, session, SQLite database, and avatar cache are kept
  in a persistent Docker volume.

## 16. Files introduced or materially changed

### Docs backend

- `core/services/notifier.py`: private authenticated Notifier HTTP client.
- `core/api/viewsets.py`: notification-setting GET/PUT/DELETE action and version
  contribution integration.
- `core/api/serializers.py`: notification-setting validation.
- `core/api/permissions.py`: document permission mapping for the new action.
- `core/models.py`: digest state and saved-version/contributor models.
- `core/choices.py`: supported frequencies.
- `core/tasks/notifications.py`: scheduled and forced digest aggregation.
- `core/management/commands/send_notification_digests.py`: manual forced scan.
- `impress/settings.py`: Notifier settings and Celery Beat schedule.
- `core/migrations/0038_notification_digest_settings.py`: frequency and state
  migration.

### Docs frontend and collaboration server

- `doc-notify/api/useDocNotificationSettings.tsx`: React Query API integration.
- `doc-notify/components/DocNotifyModal.tsx`: backend-driven modal.
- `doc-editor/hook/useSaveDoc.tsx`: contribution reporting and boundary reset.
- `y-provider/handlers/documentVersionBoundaryHandler.ts`: collaboration-wide
  version-boundary broadcast.

### Local orchestration

- `compose.yml`: Celery Beat and shared network configuration.
- `compose.lan.yml`: LAN-aware document URLs used by digests.
- `env.d/development/common`: local Notifier settings.
- `run-docs-lan.sh`: state-preserving start/restart and forced `send` command.
- `tchap-notification-bot/compose.yml`: shared network and development token.

### Notifier

- `notifier/models.py`: digest period and change-count payload fields.
- `notifier/service.py`: digest message rendering.
- `README.md`: consent, API, persistence, and local integration documentation.

## 17. Local startup and demonstration

### Initial setup

From `docs-notifs`:

```bash
make bootstrap
```

From `tchap-web-notifs`:

```bash
TCHAP_PUBLIC_HOST=127.0.0.1 ./run-tchap.sh
```

From `tchap-notification-bot`:

```bash
cp config.example.toml config.toml
# Configure the local Notifier account as described in its README.
bash ./run.sh start
```

From `docs-notifs`:

```bash
./run-docs-lan.sh start
```

For an existing database created before the feature was pulled:

```bash
make migrate
```

### Demonstration

1. Open Docs and sign in.
2. Open or create a document.
3. Open **Notify changes**.
4. Enable notifications and choose a frequency.
5. In Tchap, sign in as Bob and accept the Notifier invitation if it is still
   pending.
6. Edit the document and wait for Docs to persist the content.
7. For a quick demonstration, run:

   ```bash
   ./run-docs-lan.sh send
   ```

8. Check Bob's encrypted conversation with Notifier.

## 18. Validation performed

The integration was validated with:

- Django migration consistency checks;
- 109 focused backend tests covering notification settings, digest scheduling,
  forced delivery, contributions, versions, content saves, and collaboration;
- frontend modal tests;
- contribution/version-boundary frontend tests;
- Y-provider boundary-handler tests;
- frontend TypeScript and targeted ESLint checks;
- 13 Notifier tests plus Ruff formatting, Ruff linting, and basedpyright;
- Compose configuration validation;
- shell syntax validation for both launchers;
- a live Docs/Notifier shared-network request using the bearer token;
- live Notifier readiness with Matrix connected;
- a live Celery Beat dispatch received and completed by the worker;
- a live `./run-docs-lan.sh send` smoke test.

## 19. Current demonstration limitations

- Every Docs account maps to `@bob:localhost`; production identity mapping is
  intentionally out of scope.
- Delivery is Tchap-only. Email and arbitrary webhooks are not implemented.
- Digest content is fixed rather than configurable per event type.
- Frequencies are anchored to activation or the latest completed/forced window,
  not to wall-clock boundaries such as every Monday at 09:00.
- The local Compose setup runs a single Celery Beat instance. A production
  deployment needs the same single-scheduler guarantee.
- The manual `send` command operates on every enabled setting, not one document.

These constraints keep the local prototype predictable while preserving clean
boundaries for later identity mapping, richer scheduling, or additional
delivery channels.
