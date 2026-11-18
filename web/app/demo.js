import sample from './demo-order.json';

export function runDemo(path, options, owner) {
  const key = 'orderdesk-demo-' + owner;
  const order = JSON.parse(localStorage.getItem(key) || JSON.stringify(sample));
  if (path === 'sample') return Response.json(order);
  if (path === 'orders/' + order.id + '/approve') {
    if (order.status === 'Approved') return Response.json(order);
    const { units, note } = JSON.parse(options.body);
    if (units[0] !== 'CASE' || !note.trim()) {
      throw new Error('Confirm 20 cases and record the buyer’s confirmation. The listed price is for a case.');
    }
    const line = order.lines[0];
    Object.assign(line, { resolved_unit: 'CASE', each: line.quantity * line.item.pack, exceptions: [], evidence: [] });
    order.status = 'Approved';
    order.audit.push('Approved by demo reviewer · ' + note.trim());
    localStorage.setItem(key, JSON.stringify(order));
    return Response.json(order);
  }
  if (path === 'orders/' + order.id + '/export' && order.status === 'Approved') {
    const rows = order.lines.map(line =>
      [order.po, line.item.sku, line.quantity, line.resolved_unit, line.each, line.price].join(','));
    return new Response(['purchase_order,sku,quantity,unit,each_quantity,unit_price', ...rows].join('\r\n'), {
      headers: { 'content-type': 'text/csv' },
    });
  }
  throw new Error('This action requires the connected backend.');
}
