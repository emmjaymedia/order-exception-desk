'use client';
import { useEffect, useState } from 'react';
import { runDemo } from './demo';

const standalone = process.env.NEXT_PUBLIC_STANDALONE_DEMO === 'true';

export default function Desk() {
  const [session, setSession] = useState('');
  const [order, setOrder] = useState(null);
  const [units, setUnits] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Review');

  async function request(path, options = {}, owner = session) {
    if (standalone) return runDemo(path, options, owner);
    const response = await fetch('/api/' + path, { ...options, headers: { ...options.headers, 'x-session': owner } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(typeof payload.detail === 'string' ? payload.detail : 'The request failed. Please retry.');
    }
    return response;
  }

  useEffect(() => {
    const owner = localStorage.getItem('orderdesk-session') || crypto.randomUUID();
    localStorage.setItem('orderdesk-session', owner);
    setSession(owner);
    request('sample', { method: 'POST' }, owner)
      .then(response => response.json()).then(setOrder)
      .catch(() => setError('The API is unavailable. Use Load sample to retry.'));
  }, []);

  async function act(action) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function load(path, options) {
    const response = await request(path, options);
    setOrder(await response.json());
    setUnits({});
    setNote('');
    setTab('Review');
  }

  function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    const body = new FormData();
    body.append('file', file);
    act(() => load('upload', { method: 'POST', body }));
  }

  async function download() {
    const response = await request('orders/' + order.id + '/export');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = order.po + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const approved = order?.status === 'Approved';
  const exceptions = order?.lines.filter(line => line.exceptions.length).length ?? 0;

  return <>
    <header><div className="shell bar"><div className="brand"><span className="mark">≋</span> Orderdesk</div><span className="environment"><i/> Demo workspace</span></div></header>
    <main className="shell">
      <div className="intro">
        <div><div className="eyebrow">SALES OPERATIONS / PURCHASE ORDERS</div><h1>Order exception desk</h1><p>Check incoming purchase orders and approve fulfillment drafts.</p></div>
        <div className="actions"><button disabled={busy || !session} onClick={() => act(() => { if (standalone) localStorage.removeItem('orderdesk-demo-' + session); return load('sample', { method: 'POST' }); })}>{standalone ? 'Reset sample' : 'Load sample'}</button>{!standalone && <label className="button primary">↑ Upload order<input type="file" disabled={busy || !session} accept=".pdf,.txt,.csv" onChange={upload}/></label>}</div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {order ? <>
        <section className="orderbar"><div><small>PURCHASE ORDER</small><strong>{order.po}</strong></div><div><small>CUSTOMER PROFILE</small><strong>{order.customer}</strong></div><div><small>ORDER LINES</small><strong>{order.lines.length}</strong></div><div><small>STATUS</small><strong className={'status ' + (approved ? 'approved' : '')}>{order.status}</strong></div></section>
        <nav aria-label="Order views">{['Review', 'Source document', 'Run trace'].map(view => <button key={view} aria-pressed={tab === view} onClick={() => setTab(view)}>{view}</button>)}</nav>
        {tab === 'Review' && <div className="workspace">
          <section className="panel"><div className="panelHead"><div><h2>Order lines</h2><p>Customer items matched to the distributor catalog.</p></div><span className="badge">{exceptions} flagged</span></div>
            {order.lines.map(line => <article key={line.index}>
              <div className="lineHead"><div><code>{line.part} {line.item && '→ ' + line.item.sku}</code><h3>{line.item?.name || 'Unmapped product'}</h3></div><div className="qty">{line.quantity} {line.resolved_unit || 'units unspecified'}<small>${line.price} per source unit</small></div></div>
              {line.exceptions.map(message => <div className="flag" key={message}>{message}</div>)}
              {line.item && <p className="facts">{line.item.pack} per case · {line.item.stock} available{line.each !== null && ' · ' + line.each + ' individual items'}</p>}
              {line.evidence.map(([reference, quote]) => <p className="citation" key={reference}><b>{reference}</b> {quote}</p>)}
              {!approved && !line.unit && line.item && <label className="field">Confirmed unit<select value={units[line.index] || ''} onChange={event => setUnits({ ...units, [line.index]: event.target.value })}><option value="">Select unit</option><option value="EACH">Each · {line.quantity} items</option><option value="CASE">Case · {line.quantity * line.item.pack} items</option></select></label>}
            </article>)}
          </section>
          <aside className="panel"><div className="panelHead"><div><h2>Reviewer decision</h2><p>Confirm missing details with the buyer before release.</p></div></div>
            <div className="decision">{approved ? <button className="primary full" disabled={busy} onClick={() => act(download)}>Download ERP CSV ↓</button> : <>
              <label className="field">Buyer confirmation<textarea placeholder="Example: Buyer confirmed 20 cases by email." value={note} maxLength={500} onChange={event => setNote(event.target.value)}/></label>
              <button className="primary full" disabled={busy} onClick={() => act(() => load('orders/' + order.id + '/approve', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({units:Object.fromEntries(Object.entries(units).filter(([, value]) => value)), note}) }))}>Approve draft →</button>
            </>}<h3>Activity</h3>{order.audit.map((entry, i) => <p className="activity" key={i}>{entry}</p>)}</div>
          </aside>
        </div>}
        {tab === 'Source document' && <section className="panel padded"><h2>Extracted document text</h2><pre>{order.source}</pre></section>}
        {tab === 'Run trace' && <section className="panel padded"><h2>Extraction and checks</h2><dl><dt>Extraction</dt><dd>{order.trace.method}</dd><dt>Analysis latency</dt><dd>{order.trace.latency_ms} ms</dd><dt>Policy retrieval</dt><dd>{order.trace.retrieval}</dd><dt>Tools</dt><dd>{order.trace.tools.join(' · ')}</dd><dt>Model usage</dt><dd>{order.trace.usage ? JSON.stringify(order.trace.usage) : 'No model call for this order'}</dd></dl></section>}
      </> : !error && <p role="status">Loading sample purchase order…</p>}
      <footer>Orderdesk <span>{standalone ? 'Sample order · Browser storage' : 'Synthetic catalog · ERP simulation'}</span></footer>
    </main>
  </>;
}
