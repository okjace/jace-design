'use client';
import { useState } from 'react';
import { AIS, buildPrompt, copyText } from '@/lib/ai';

const TITLES = {
  design: '✨ Design with AI',
  template: '✨ Make a template with AI',
  pages: '✨ Add pages with AI',
  page: '✨ Redesign this page with AI',
  text: '✨ Rewrite with AI',
  palette: '🎨 Color palette with AI',
  doc: '✨ Write a document with AI',
  'doc-edit': '✨ Edit selection with AI',
};

const PLACEHOLDERS = {
  design: 'e.g. A poster for a school bake sale on Friday, cute and colorful, with cupcakes',
  template: 'e.g. A clean weekly planner template with space for each day',
  pages: 'e.g. 3 slides explaining how our app works, step by step',
  page: 'e.g. Make it more minimal and use a dark background',
  text: 'e.g. Make it shorter and funnier',
  palette: 'e.g. Calm, earthy, for a coffee shop',
  doc: 'e.g. A one-page cover letter for a junior web developer job at a startup',
  'doc-edit': 'e.g. Make this more formal and fix grammar',
};

/**
 * Bring-your-own-AI helper. 1) describe → 2) copy prompt into any AI → 3) paste the answer back.
 * `onApply(reply, idea)` gets the pasted answer and may throw an Error with a friendly message.
 */
export default function AiHelper({ mode, context = {}, onApply, onClose, extra }) {
  const [idea, setIdea] = useState(context.idea || '');
  const [step, setStep] = useState(1);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const needsIdea = !['page', 'text', 'doc-edit', 'palette'].includes(mode);
  const prompt = buildPrompt(mode, { ...context, idea });

  async function openAi(ai) {
    const ok = await copyText(prompt);
    setCopied(ok);
    const href = ai.url && prompt.length < 7000 ? ai.url(prompt) : ai.home;
    window.open(href, '_blank', 'noopener');
    setStep(3);
  }

  async function apply() {
    setErr('');
    setBusy('Working…');
    try {
      await onApply(reply, idea, setBusy);
      onClose();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(640px, 100%)' }}>
        <div className="modal-head"><h3>{TITLES[mode] || '✨ AI'}</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <p className="small muted" style={{ margin: 0 }}>
            Use any AI you like, free. We write the perfect prompt, you paste it into your AI, then paste its answer back here.
          </p>

          <div className="stack">
            <b>1. {needsIdea ? 'Describe your idea' : 'Anything specific? (optional)'}</b>
            <textarea className="input" rows={3} autoFocus value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={PLACEHOLDERS[mode]} />
            {extra}
          </div>

          <div className="stack">
            <b>2. Send the prompt to your AI</b>
            <div className="row wrap" style={{ gap: 6 }}>
              {AIS.map((ai) => (
                <button key={ai.name} className="btn btn-sm" disabled={needsIdea && !idea.trim()} onClick={() => openAi(ai)}>{ai.name} ↗</button>
              ))}
              <button className="btn btn-sm" disabled={needsIdea && !idea.trim()} onClick={async () => { setCopied(await copyText(prompt)); setStep(3); }}>📋 Just copy</button>
            </div>
            {copied ? <div className="small" style={{ color: 'var(--brand)' }}>✓ Prompt copied. If it isn&apos;t already filled in, paste it into the AI and send it.</div> : null}
            <details className="small muted">
              <summary style={{ cursor: 'pointer' }}>See the prompt</summary>
              <textarea className="input" readOnly rows={6} value={prompt} style={{ fontFamily: 'Geist Mono, Fira Code, monospace', fontSize: 11, marginTop: 6 }} onFocus={(e) => e.target.select()} />
            </details>
          </div>

          <div className="stack" style={{ opacity: step >= 3 || reply ? 1 : 0.6 }}>
            <b>3. Paste the AI&apos;s answer</b>
            <textarea className="input" rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Paste the whole reply here…" style={{ fontFamily: 'Geist Mono, Fira Code, monospace', fontSize: 12 }} />
            {err ? <div className="notice err" style={{ margin: 0 }}>{err}</div> : null}
            <div className="row">
              <div className="grow small muted">{busy}</div>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={!reply.trim() || !!busy} onClick={apply}>Use this</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
