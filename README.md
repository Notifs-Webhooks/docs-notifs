# Tchap document notification prototype

This fork adds opt-in Tchap digests for collaborative document updates. It is
designed for the local demonstration environment composed of three sibling
repositories:

- `docs-notifs`: the Docs frontend, API, version tracking, and digest scheduler;
- `tchap-notification-bot`: the authenticated Notifier API and encrypted Matrix
  delivery worker;
- `tchap-web-notifs`: the local Tchap client and Synapse server.

The demonstration deliberately routes every Tchap subscription and delivery to
`@bob:localhost`. The browser never receives the Notifier bearer token.

For the full implementation rationale, API contracts, data flow, failure
handling, and extension points, see
[`NOTIFICATION_SYSTEM.md`](./NOTIFICATION_SYSTEM.md).

## How notifications work

1. An authenticated user opens **Notify changes** from a document menu.
2. Enabling notifications calls the Docs backend. Docs stores one setting for
   that user and document, then asks Notifier to create or reuse Bob's private
   encrypted conversation.
3. Bob accepts the invitation in Tchap. Until then, Notifier safely retains
   generated deliveries in the `awaiting_recipient` state.
4. Editors are recorded while they work. Each actual object-storage save creates
   a `DocumentVersion` associated with its contributors.
5. A single Celery Beat scheduler checks digest windows every minute. Supported
   windows are hourly, weekly, and monthly; there is no automatic instantaneous
   delivery.
6. When a completed window contains saved versions, Docs sends one idempotent
   digest to Notifier. Empty windows produce no message.
7. The digest contains the document name, number of saved updates,
   contributors, covered period, and a link to the document.
8. Disabling one document only disables that document. Docs asks Notifier to
   leave the global conversation only after every document subscription has
   been disabled.

Each monthly window advances one calendar month from the previous boundary.
Dates that do not exist in the following month are clamped to that month's last
day.

```text
Docs browser
    │ authenticated Docs API request
    ▼
Docs backend ── stores settings, versions, and contributors
    │                    │
    │                    └── Celery Beat checks completed digest windows
    │
    │ Bearer token on the private Docker network
    ▼
Notifier API ── SQLite delivery queue ── encrypted Matrix DM ── @bob:localhost
```

## Run the complete local stack

The repositories must be siblings under the same parent directory. First
bootstrap Docs; this also creates the shared `lasuite-network` Docker network:

```bash
cd docs-notifs
make bootstrap
```

Start the local Tchap/Synapse environment:

```bash
cd ../tchap-web-notifs
TCHAP_PUBLIC_HOST=127.0.0.1 ./run-tchap.sh
```

Configure and start Notifier as described in
`../tchap-notification-bot/README.md`, then run:

```bash
cd ../tchap-notification-bot
bash ./run.sh start
```

The Compose setup uses the development-only token
`local-demo-notifier-api-token-2026` in both Docs and Notifier. Override
`NOTIFIER_API_TOKEN` in both services outside this local demonstration.

Finally start Docs, including its Celery worker and the single digest scheduler:

```bash
cd ../docs-notifs
./run-docs-lan.sh start
```

For an existing checkout that was bootstrapped before the notification feature
was pulled, apply its new database migrations once before opening the UI:

```bash
make migrate
```

Open Docs at `http://127.0.0.1:3000`, enable a digest on a document, then sign
in to Tchap as Bob and accept the Notifier invitation. The local Tchap account
credentials are documented in `../tchap-web-notifs/README.md`.

For a quick demonstration after editing and waiting for Docs to save the
document, close every active digest window immediately:

```bash
./run-docs-lan.sh send
```

`send` ignores the configured waiting period, but it does not bypass consent or
the per-document enable switch. It sends one recap only for enabled documents
with saved changes since their previous check; empty windows remain silent.

The local MinIO bucket has versioning enabled. Any other S3-compatible storage
used with this feature must also return a version identifier for saved objects.

## Notification configuration

Docs backend environment variables:

| Variable | Local value | Purpose |
| --- | --- | --- |
| `NOTIFIER_API_URL` | `http://notifier:8085` | Private Notifier API URL |
| `NOTIFIER_API_TOKEN` | development token | Server-to-server bearer token |
| `NOTIFIER_RECIPIENT` | `@bob:localhost` | Forced demonstration recipient |
| `NOTIFIER_REQUEST_TIMEOUT` | `10` | HTTP timeout in seconds |

Only one Celery Beat scheduler may run for an environment. The regular Celery
worker performs delivery checks; Beat only schedules them.

---

## Quick start (LAN)

**Setup**

```bash
make bootstrap
```

**Run** — login and password: `impress`

```bash
./run-docs-lan.sh
```

**Stop (preserving data)**

```bash
docker compose -f compose.yml -f compose.lan.yml down
```

---

<p align="center">
  <a href="https://github.com/suitenumerique/docs">
    <img alt="Docs" src="documentation/assets/banner-docs.png" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/suitenumerique/docs/stargazers/">
    <img src="https://img.shields.io/github/stars/suitenumerique/docs" alt="">
  </a>
  <a href="https://github.com/suitenumerique/docs/blob/main/CONTRIBUTING.md">
    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  </a>
  <a href="https://github.com/suitenumerique/docs/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/suitenumerique/docs"/>
  </a>
  <a href="https://snyk.io/test/github/suitenumerique/docs">
    <img alt="MIT License" src="https://snyk.io/test/github/suitenumerique/docs/badge.svg"/>
  </a>
  <a href="https://digitalpublicgoods.net/r/docs-collaborative-text-editing">
    <img src="https://img.shields.io/badge/Verified-DPG-3333AB?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMzEiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzMSAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0LjIwMDggMjEuMzY3OEwxMC4xNzM2IDE4LjAxMjRMMTEuNTIxOSAxNi40MDAzTDEzLjk5MjggMTguNDU5TDE5LjYyNjkgMTIuMjExMUwyMS4xOTA5IDEzLjYxNkwxNC4yMDA4IDIxLjM2NzhaTTI0LjYyNDEgOS4zNTEyN0wyNC44MDcxIDMuMDcyOTdMMTguODgxIDUuMTg2NjJMMTUuMzMxNCAtMi4zMzA4MmUtMDVMMTEuNzgyMSA1LjE4NjYyTDUuODU2MDEgMy4wNzI5N0w2LjAzOTA2IDkuMzUxMjdMMCAxMS4xMTc3TDMuODQ1MjEgMTYuMDg5NUwwIDIxLjA2MTJMNi4wMzkwNiAyMi44Mjc3TDUuODU2MDEgMjkuMTA2TDExLjc4MjEgMjYuOTkyM0wxNS4zMzE0IDMyLjE3OUwxOC44ODEgMjYuOTkyM0wyNC44MDcxIDI5LjEwNkwyNC42MjQxIDIyLjgyNzdMMzAuNjYzMSAyMS4wNjEyTDI2LjgxNzYgMTYuMDg5NUwzMC42NjMxIDExLjExNzdMMjQuNjI0MSA5LjM1MTI3WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==" alt="DPG Badge"/>
  </a>
</p>

<p align="center">
  <a href="https://matrix.to/#/#docs-official:matrix.org">Chat on Matrix</a> •
  <a href="documentation/">Documentation</a> •
  <a href="#try-docs">Try Docs</a> •
  <a href="mailto:docs@numerique.gouv.fr">Contact us</a>
</p>

# La Suite Docs: Collaborative Text Editing

**Docs, where your notes can become knowledge through live collaboration.**

Docs is an open-source collaborative editor that helps teams write, organize, and share knowledge together - in real time.

![Live collaboration demo](documentation/assets/mirabeau.png)


## What is Docs?

Docs is an open-source alternative to tools like Notion or Google Docs, focused on:

- Real-time collaboration
- Clean, structured documents
- Knowledge organization
- Data ownership & self-hosting

***Built for public organizations, companies, and open communities.***

## Why use Docs?

### Writing

- Rich-text & Markdown editing
- Slash commands & block system
- Beautiful formatting
- Offline editing
- Optional AI writing helpers (rewrite, summarize, translate, fix typos)

### Collaboration

- Live cursors & presence
- Comments & sharing
- Granular access control

### Knowledge management

- Subpages & hierarchy
- Searchable content

### Presentations

- Simple structure, based on delimiter (`---`)
- Full screen option
- PDF exports
- Keyboard navigation
- Start presention from a block
- Presentation link

![demo of slide mode in Docs](https://upload.wikimedia.org/wikipedia/commons/6/64/Docs%27_slidemode.gif?_=20260722173451)

### Export/Import

- Import to `.docx` and `.md`
- Export to `.docx`, `.odt`, `.pdf`

### AI features
Docs has optional AI features. 
They're model agnostic and gateway agnostic.
You can either run your own or just use your AI provider. 
The config only requires an API key and a URL.

#### V1: You select, AI replaces 
This version features a simple select and replace workflow. 
Your selection is the context and the instruction for the model. 
The AI feedback replaces your selection and is designed is optimized for Docs formatting.

![Demo of Docs AI v1](documentation/assets/docs_ai_feature_v1.gif)

#### V2: AI toolbar, AI cursor (beta)
This version uses [BlockNote AI integration](https://www.blocknotejs.org/docs/features/ai). It features: 
- an AI toolbar at selection in which you can prompt, accept, reject and iterate AI feedback
- an AI cursor, which interacts with the document, just as another collaborator in your document
- document context is used on top of the selection

![Demo of Docs AI v2](documentation/assets/docs_ai_feature_v2.gif)


### Interoperability
Docs comes with a [resource server API](documentation/resource_server.md) and a [server to server API](https://github.com/suitenumerique/docs/blob/c647cb62f1cbf1af9841ae8cb3818e34bb566c9c/documentation/env.md#L76-L77) which allows for awesome integrations.

#### A concrete example: [Meet](https://github.com/suitenumerique/meet/)'s transcriptions
If you're running a Meet instance, with simple config (`DJANGO_SERVER_TO_SERVER_API_TOKENS`) you can push your meeting transcript to Docs and give access to the user who requested it.

![transcript in Docs screenshot](documentation/assets/transcripts.png)

## Try Docs

Experience Docs instantly - no installation required.

- 🔗 [Open a live demo document][demo]
- 🌍 [Browse public instances][instances]

[demo]: https://demo.docs.la-suite.eu/docs/6d1b6f7f-db33-4673-9277-4bf47b9881ec/
[instances]: documentation/instances.md

## Self-hosting

Docs supports Kubernetes, Docker Compose, and community-provided methods such as Nix and YunoHost.

Get started with self-hosting: [Installation guide](documentation/installation/README.md)

> [!WARNING]
> Some advanced features (for example: `Export as PDF`) rely on XL packages from Blocknote.
> These packages are licensed under GPL and are **not MIT-compatible**
>
> You can run Docs **without these packages** by building with:
>
> ```bash
> PUBLISH_AS_MIT=true
> ```
>
> This builds an image of Docs without non-MIT features.
>
> More details can be found in [environment variables](documentation/env.md)

## Local Development (for contributors)

Run Docs locally for development and testing.

> [!WARNING]
> This setup is intended **for development and testing only**.
> It uses Minio as an S3-compatible storage backend, but any S3-compatible service can be used.

### Prerequisites

- Docker
- Docker Compose
- GNU Make

Verify installation:

```bash
docker -v
docker compose version
```

> If you encounter permission errors, you may need to use `sudo`, or add your user to the `docker` group.

### Bootstrap the project

The easiest way to start is using GNU Make:

```bash
make bootstrap FLUSH_ARGS='--no-input'
```

This builds the `app-dev` and `frontend-dev` containers, installs dependencies, runs database migrations, and compiles translations.

It is recommended to run this command after pulling new code.

Start services:

```bash
make run
```

Open <https://localhost:3000>

Default credentials (development only):

```md
username: impress
password: impress
```

### Frontend development mode

For frontend work, running outside Docker is often more convenient:

```bash
make frontend-development-install
make run-frontend-development
```

### Backend only

Starting all services except the frontend container:

```bash
make run-backend
```

### Tests & Linting

```bash
make frontend-test
make frontend-lint
```

Backend tests can be run without docker. This is useful to configure PyCharm or VSCode to do it. 
Removing docker for testing requires to overwrite some URL and port values that are different in and out of 
Docker. `env.d/development/common` contains all variables, some of them having to be overwritten by those in
`env.d/development/common.test`.

### Demo content

Create a basic demo site:

```bash
make demo
```

### More Make targets

To check all available Make rules:

```bash
make help
```

### Django admin

Create a superuser:

```bash
make superuser
```

Admin UI: <http://localhost:8071/admin>

## Contributing

This project is community-driven and PRs are welcome.

- [Contribution guide](CONTRIBUTING.md)
- [Translations](https://crowdin.com/project/lasuite-docs)
- [Chat with us!](https://matrix.to/#/#docs-official:matrix.org)

## Roadmap

Curious where Docs is headed?

Explore upcoming features, priorities and long-term direction on our [public roadmap](https://docs.numerique.gouv.fr/docs/d1d3788e-c619-41ff-abe8-2d079da2f084/).

## License 📝

This work is released under the MIT License (see [LICENSE](https://github.com/suitenumerique/docs/blob/main/LICENSE)).

While Docs is a public-driven initiative, our license choice is an invitation for private sector actors to use, sell and contribute to the project.

## Credits ❤️

### Stack

Docs is built on top of [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/), [HocusPocus](https://tiptap.dev/docs/hocuspocus/introduction), and [Yjs](https://yjs.dev/). We thank the contributors of all these projects for their awesome work!

We are proud sponsors of [BlockNotejs](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/).

---

### Gov ❤️ open source

Docs is the result of a joint initiative led by the French 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) Government and German 🇩🇪 government ([ZenDiS](https://zendis.de/)).

We are always looking for new public partners (we are currently onboarding the Netherlands 🇳🇱), feel free to [contact us](mailto:docs@numerique.gouv.fr) if you are interested in using or contributing to Docs.

<p align="center">
  <img src="documentation/assets/europe_opensource.png" width="50%"/ alt="Europe Opensource">
</p>
