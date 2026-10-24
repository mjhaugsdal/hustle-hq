import { addSource, updateSource, deleteSource, createExperiment, updateExperiment, deleteExperiment } from "@/app/actions";
import { confidenceLevels, evidenceTypes, outcomes, type ResearchSource, type Experiment } from "@/lib/domain";
import { humanize, safeUrl, dateLabel, personLabel } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { HiddenFields } from "@/components/workspace";
import { ExternalLink, Trash2 } from "lucide-react";

export function Field({ label, name, value, type = "text", required, placeholder, maxLength, min, max, step }: { label: string; name: string; value?: string | number | null; type?: string; required?: boolean; placeholder?: string; maxLength?: number; min?: number; max?: number; step?: string }) {
  return <label className="field"><span>{label}{!required && <small>Optional</small>}</span><Input name={name} type={type} defaultValue={value ?? ""} required={required} placeholder={placeholder} maxLength={maxLength} min={min} max={max} step={step} /></label>;
}
export function TextField({ label, name, value, required, placeholder, maxLength = 8000 }: { label: string; name: string; value?: string | null; required?: boolean; placeholder?: string; maxLength?: number }) {
  return <label className="field"><span>{label}{!required && <small>Optional</small>}</span><Textarea name={name} defaultValue={value ?? ""} required={required} placeholder={placeholder} maxLength={maxLength} /></label>;
}
export function SelectField({ label, name, options, value }: { label: string; name: string; options: readonly string[]; value?: string }) {
  return <label className="field"><span>{label}</span><select name={name} defaultValue={value ?? options[0]}>{options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}</select></label>;
}
export function SourceForm({ ideaId, source, returnTo }: { ideaId: string; source?: ResearchSource; returnTo: string }) {
  return <form action={source ? updateSource : addSource} className="stack-form"><HiddenFields ideaId={ideaId} id={source?.id} returnTo={returnTo} /><Field label="Source title" name="title" value={source?.title} required maxLength={200} placeholder="Customer interview, industry report, competitor…" /><div className="form-grid"><Field label="URL" name="url" value={source?.url} type="url" placeholder="https://" maxLength={2048} /><Field label="Source type" name="source_type" value={source?.source_type} placeholder="Interview, article, survey…" maxLength={100} /></div><TextField label="Key finding" name="finding" value={source?.finding} placeholder="What did you learn? Be specific about what this does and doesn't prove." /><div className="form-grid three"><SelectField label="Evidence type" name="evidence_type" options={evidenceTypes} value={source?.evidence_type} /><SelectField label="Confidence" name="confidence" options={confidenceLevels} value={source?.confidence} /><Field label="Retrieved on" name="retrieved_at" value={source?.retrieved_at?.slice(0, 10)} type="date" /></div><SubmitButton>{source ? "Save source" : "Add source"}</SubmitButton></form>;
}
export function SourceCard({ source, ideaId, returnTo, userId }: { source: ResearchSource; ideaId: string; returnTo: string; userId?: string }) {
  const url = safeUrl(source.url);
  return (
    <article className="record-card">
      <div className="record-top">
        <div>
          <div className="badge-row"><Badge>{humanize(source.evidence_type)}</Badge><Badge className="badge-neutral">{humanize(source.confidence)} confidence</Badge></div>
          <h3>{source.title}</h3>
        </div>
        {url && <a className="icon-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open source: ${source.title}`}><ExternalLink size={18} /></a>}
      </div>
      {source.finding && <p className="preserve-lines">{source.finding}</p>}
      <div className="record-meta">
        {source.source_type || "Research source"} · Added {dateLabel(source.created_at)} by {personLabel(source.created_by, userId ?? "")}
        {source.retrieved_at && <> · Retrieved {dateLabel(source.retrieved_at)}</>}
      </div>
      <details className="edit-disclosure">
        <summary>Edit source</summary>
        <SourceForm ideaId={ideaId} source={source} returnTo={returnTo} />
        <form action={deleteSource} className="delete-form">
          <HiddenFields ideaId={ideaId} id={source.id} returnTo={returnTo} />
          <SubmitButton variant="destructive" size="sm"><Trash2 size={14} /> Delete source</SubmitButton>
        </form>
      </details>
    </article>
  );
}
export function ExperimentForm({ ideaId, experiment, returnTo }: { ideaId: string; experiment?: Experiment; returnTo: string }) {
  return (
    <form action={experiment ? updateExperiment : createExperiment} className="stack-form">
      <HiddenFields ideaId={ideaId} id={experiment?.id} returnTo={returnTo} />
      <Field label="Experiment title" name="title" value={experiment?.title} required maxLength={200} placeholder="A small test with a clear answer" />
      <TextField label="Hypothesis" name="hypothesis" value={experiment?.hypothesis} required maxLength={4000} placeholder="We believe that… We will know this is true when…" />
      <div className="form-grid">
        <TextField label="Method" name="method" value={experiment?.method} placeholder="How will you test it?" />
        <TextField label="Success metric" name="success_metric" value={experiment?.success_metric} maxLength={2000} placeholder="What measurable outcome would count as success?" />
      </div>
      <p className="form-hint">Dates are optional. When both are known, completion must be on or after the start date. Completed outcomes require a result.</p>
      <div className="form-grid three">
        <SelectField label="Outcome" name="outcome" options={outcomes} value={experiment?.outcome} />
        <Field label="Start date" name="started_at" value={experiment?.started_at?.slice(0, 10)} type="date" />
        <Field label="Completion date" name="completed_at" value={experiment?.completed_at?.slice(0, 10)} type="date" />
      </div>
      <TextField label="Result and learning" name="result" value={experiment?.result} placeholder="Required for a completed outcome. What happened, and what did it teach you?" />
      <SubmitButton>{experiment ? "Save experiment" : "Create experiment"}</SubmitButton>
    </form>
  );
}
export function ExperimentCard({ experiment, ideaId, returnTo }: { experiment: Experiment; ideaId: string; returnTo: string }) {
  return <article className="record-card"><div className="badge-row"><Badge className={experiment.outcome === "pending" ? "badge-neutral" : ""}>{humanize(experiment.outcome)}</Badge></div><h3>{experiment.title}</h3><p className="preserve-lines">{experiment.hypothesis}</p><dl className="experiment-detail">{experiment.method && <div><dt>Method</dt><dd>{experiment.method}</dd></div>}{experiment.success_metric && <div><dt>Success metric</dt><dd>{experiment.success_metric}</dd></div>}{experiment.result && <div><dt>Result & learning</dt><dd>{experiment.result}</dd></div>}</dl><div className="record-meta">{experiment.started_at ? `Started ${dateLabel(experiment.started_at)}` : "Not started"}{experiment.completed_at ? ` · Completed ${dateLabel(experiment.completed_at)}` : ""}</div><details className="edit-disclosure"><summary>Edit experiment</summary><ExperimentForm ideaId={ideaId} experiment={experiment} returnTo={returnTo} /><form action={deleteExperiment} className="delete-form"><HiddenFields ideaId={ideaId} id={experiment.id} returnTo={returnTo} /><SubmitButton variant="destructive" size="sm"><Trash2 size={14} /> Delete experiment</SubmitButton></form></details></article>;
}
