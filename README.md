# Side Hustle HQ

A private, shared workspace for two people to turn ideas into evidence-backed decisions:
capture → research → compare → experiment → pursue, investigate, or archive.

One Next.js App Router application, TypeScript, Tailwind CSS, shadcn-style UI primitives,
Zod, and Supabase PostgreSQL/Auth. No AI providers, background jobs, or external
research services are required. Sources and findings are entered manually.

## Run locally

Requires Node.js 22.18+ and npm. For a local database, install the
[Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker.

```bash
npm ci
supabase start
supabase db reset
cp .env.example .env.local
npm run dev
```

Set these variables in `.env.local` using the local project's output from
`supabase status`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public publishable key (legacy anon key also works) |

Public keys are intentionally public; authorization comes from the signed-in user's
JWT and database RLS, **not** secrecy of the public key. Never expose a service-role
key through `NEXT_PUBLIC_*`, browser code, or deployment configuration for this app.
No privileged database key is needed by the application.

Open [localhost:3000](http://localhost:3000). Without configured variables, the login
page displays setup guidance rather than sample workspace data.

### Provision the private workspace

There is deliberately no public signup or client-side membership management.
Disable **Allow new users to sign up** in hosted Supabase Auth settings.
In the Supabase dashboard (or local Studio at the URL printed by `supabase status`),
use Authentication → Users → Add user to create the two accounts with separate,
strong passwords and confirmed email addresses. Deliver credentials securely;
do not put them in source control.

Open `supabase/admin/provision_workspace.sql`, replace the two account emails and
workspace name, then run it using the SQL editor as the project administrator.
It creates one shared workspace and both memberships in a transaction.

Run provisioning once. Account IDs are looked up administratively, never hardcoded
in application code. This MVP expects one shared workspace per person. Membership
changes remain an administrator operation, including for the workspace's `owner`.

## Using the workspace

- **Discover:** capture a title immediately; add optional details later. Search,
  filter, sort, shortlist, edit, and archive without losing research.
- **Idea workspace:** Overview, Research, Scoring, Experiments, and History keep
  the recommended next action beside the supporting evidence.
- **Research Lab:** record sources, HTTP(S) URLs, retrieval dates, findings,
  evidence/assumption/conclusion labels, and confidence. External content is
  displayed as text, never executed or rendered as trusted HTML.
- **Compare:** shortlisted ideas appear side by side with independent scorecards
  and rationales. Each criterion is weighted equally; where both users scored a
  criterion, their ratings are averaged first. An incomplete scorecard is not a
  complete evaluation. Evidence confidence is shown separately and reflects
  human-entered confidence, not an objective guarantee of demand.
- **Experiments:** record hypotheses, methods, measurable success metrics,
  dates, results, and outcomes. Decisions require reasoning.
- **Activity:** review research, score updates, experiments, and notes.

Decisions initially live in notes, not a separate decision-history table. The
`record_decision` database function atomically changes status and appends the
reason. General notes can be removed by workspace members; this is a collaborative
working history, not a tamper-proof audit log. Archive/reject rather than deleting
ideas to retain their research. No production demo data is inserted.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The unit suite uses Node's built-in test runner for scoring, next actions, and
server-input validation. To test RLS through direct Supabase API calls, run a
**disposable local Supabase instance**, apply the migrations, and set:

```bash
export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_ANON_KEY='<local anon key from supabase status>'
export SUPABASE_TEST_SERVICE_ROLE_KEY='<local service-role key from supabase status>'
npm run test:access
```

The privileged key is used only by the test harness to provision isolated fixtures,
never by application code. Access tests exercise authenticated member, outsider,
and anonymous requests, parent-child boundaries, and forged membership/creator
fields. Without test environment variables, integration tests explicitly skip;
a skipped suite is **not** proof that RLS has been verified.

## Database and security

Migrations in `supabase/migrations` define UUID keys, timestamps, deliberate foreign
key deletion behavior, constraints, indexes, and RLS on every public table.
Workspace membership is resolved server-side from the verified session; submitted
workspace IDs or creator IDs are not trusted. Child records are authorized through
their parent idea. Each person owns their own scores; both can read them. Database
policies also protect direct REST requests independently of the UI.

Server Actions validate inputs with Zod and check authorization before mutation.
The proxy refreshes sessions; it is not the authorization boundary. Request-local
data reuse must not be replaced by cross-user caching. Keep future provider clients
and credentials in server-only modules, validate responses, preserve citations,
and require human review of automated interpretations.

## Deploy

1. Create a Supabase project and apply the committed migrations with
   `supabase link --project-ref <your-project-ref>` and `supabase db push`.
   Review the migration before applying it to an existing project.
2. Disable public signup; provision the two users and workspace as above.
3. Import this repository into Vercel as a Next.js application. Set the two public
   Supabase environment variables for the correct environment; redeploy after
   changing them. Build command: `npm run build`.
4. Set Supabase Auth's Site URL to the deployed HTTPS URL. Configure explicit
   allowed redirect URLs if adding an email-based auth flow later.
5. Verify both accounts can collaborate, a nonmember cannot enter, and mobile
   navigation/forms work. Run authorization tests on a disposable local instance,
   never against production. Keep preview deployments isolated from production
   data and restrict access as appropriate.

The UI components follow shadcn conventions under `src/components/ui`; the initial
CLI registry request was unavailable in the build environment, so these small
primitives are maintained locally. Use the existing components before adding more
UI dependencies. Charts, automated research, analytics, and project-management
features are intentionally outside this MVP.
