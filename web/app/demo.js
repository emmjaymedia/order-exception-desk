import sample from './demo-order.json' with { type: 'json' };

const catalog = Object.fromEntries(sample.lines.map(line => [line.part, line.item]));
const [unitEvidence] = sample.lines[0].evidence;
const timestamp = () => new Date().toISOString();

function analyze(line, unit) {
  const item = catalog[line.part];
  const each = item && unit ? line.quantity * (unit === 'CASE' ? item.pack : 1) : null;
  const exceptions = [];
  const evidence = [];
  if (!item) exceptions.push('Customer part has no saved SKU mapping.');
  else if (!unit) {
    exceptions.push('Quantity could mean individual items or cases.');
    evidence.push(unitEvidence);
  } else {
    if (line.price !== item[unit.toLowerCase() + '_price']) exceptions.push('Unit price differs from the agreed price.');
    if (each > item.stock) exceptions.push('Requested quantity exceeds available stock.');
  }
  return { ...line, item, each, resolved_unit: unit, exceptions, evidence };
}

export function parseOrder(source, name) {
  const rows = source.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const po = rows.shift()?.match(/^PO:\s*([A-Z0-9-]{1,40})$/i)?.[1].toUpperCase();
  const customer = rows.shift()?.match(/^Customer:\s*(Alder Supply)$/i)?.[1];
  if (!po || !customer || rows.shift()?.trim() !== 'Part,Quantity,Unit,Unit price' || !rows.length || rows.length > 50) {
    throw new Error('Use the order template with an Alder Supply customer and 1–50 lines.');
  }
  const lines = rows.map((row, index) => {
    const [part, quantity, unit, price, ...extra] = row.split(',').map(value => value.trim().toUpperCase());
    if (extra.length || !/^[A-Z0-9-]{1,30}$/.test(part) || !/^\d{1,6}$/.test(quantity) ||
        Number(quantity) < 1 || !['', 'EACH', 'CASE'].includes(unit) || !/^\d{1,7}(\.\d{1,2})?$/.test(price)) {
      throw new Error('Check part number, quantity, unit and price on line ' + (index + 1) + '.');
    }
    return analyze({ index, part, quantity: Number(quantity), unit, price: Number(price).toFixed(2) }, unit);
  });
  return { id: po, po, customer: 'Alder Supply', source, name, lines, status: 'In review',
    audit: ['Imported ' + name], received: timestamp(),
    trace: { method: 'CSV template parser', retrieval: 'Sample customer agreement', tools: ['SKU lookup', 'Stock check'] } };
}

export function approveOrder(order, units, note) {
  if (order.status === 'Approved') return order;
  const lines = order.lines.map(line => analyze(line, line.unit || units[line.index] || ''));
  if (lines.some(line => line.exceptions.length)) throw new Error('Resolve all quantity, price, stock and mapping exceptions before approval.');
  if (order.lines.some(line => !line.unit) && !note.trim()) throw new Error('Record the buyer’s confirmation before approving.');
  const totals = new Map();
  for (const line of lines) {
    const total = (totals.get(line.item.sku) || 0) + line.each;
    if (total > line.item.stock) throw new Error('Combined quantity exceeds stock for ' + line.item.sku + '.');
    totals.set(line.item.sku, total);
  }
  return { ...order, lines, status: 'Approved',
    audit: [...order.audit, 'Approved ' + timestamp() + (note.trim() ? ' · ' + note.trim() : '')] };
}

function csv(order) {
  return ['purchase_order,sku,quantity,unit,each_quantity,unit_price',
    ...order.lines.map(line => [order.po, line.item.sku, line.quantity, line.resolved_unit, line.each, line.price].join(','))].join('\r\n');
}

export async function runDemo(path, options, owner) {
  const key = 'orderdesk-v2-' + owner;
  const read = () => JSON.parse(localStorage.getItem(key) || '[]');
  const write = orders => localStorage.setItem(key, JSON.stringify(orders));
  if (path === 'orders') return Response.json(read());
  if (path === 'sample' || path === 'upload') {
    let candidate;
    if (path === 'sample') {
      candidate = { ...sample, name: 'Sample purchase order', received: timestamp() };
    } else {
      const file = options.body.get('file');
      if (!file || file.size > 100_000 || !/\.(csv|txt)$/i.test(file.name)) throw new Error('Choose a CSV or TXT order under 100 KB.');
      candidate = parseOrder(await file.text(), file.name);
    }
    const orders = read();
    const existing = orders.find(order => order.po === candidate.po);
    if (existing) {
      if (existing.source !== candidate.source) throw new Error('This PO number already exists with different contents.');
      return Response.json(existing);
    }
    write([candidate, ...orders]);
    return Response.json(candidate);
  }
  const orders = read();
  const [, id, action] = path.split('/');
  const order = orders.find(entry => entry.id === id);
  if (!order) throw new Error('This order is no longer in the queue.');
  if (action === 'approve') {
    const { units, note } = JSON.parse(options.body);
    const approved = approveOrder(order, units, note);
    write(orders.map(entry => entry.id === id ? approved : entry));
    return Response.json(approved);
  }
  if (action === 'export' && order.status === 'Approved') return new Response(csv(order), { headers: { 'content-type': 'text/csv' } });
  throw new Error('Approve the draft before exporting.');
}
