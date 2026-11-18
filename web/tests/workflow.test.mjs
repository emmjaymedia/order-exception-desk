import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { approveOrder, parseOrder, runDemo } from '../app/demo.js';

const source = await readFile(new URL('../public/purchase-order-template.csv', import.meta.url), 'utf8');

test('approval requires evidence and blocks an inconsistent price', () => {
  const order = parseOrder(source, 'template.csv');
  assert.throws(() => approveOrder(order, { 0: 'CASE' }, ''), /confirmation/);
  assert.throws(() => approveOrder(order, { 0: 'EACH' }, 'Confirmed'), /exceptions/);
  const approved = approveOrder(order, { 0: 'CASE' }, 'Buyer confirmed cases.');
  assert.equal(approved.lines[0].each, 180);
  assert.equal(approved.status, 'Approved');
});

test('a completed order survives reading the queue and exports once approved', async () => {
  const data = new Map();
  globalThis.localStorage = {getItem: key => data.get(key), setItem: (key, value) => data.set(key, value)};
  const form = new FormData();
  form.append('file', new File([source], 'order.csv'));
  const options = {body: form};
  const response = await runDemo('upload', options, 'alpha');
  const order = await response.json();
  await runDemo('upload', options, 'alpha');
  await assert.rejects(runDemo('orders/' + order.id + '/export', {}, 'alpha'), /Approve/);
  await runDemo('orders/' + order.id + '/approve', {body: JSON.stringify({units: {0: 'CASE'}, note: 'Confirmed'})}, 'alpha');
  const queue = await (await runDemo('orders', {}, 'alpha')).json();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'Approved');
  assert.match(await (await runDemo('orders/' + order.id + '/export', {}, 'alpha')).text(), /PO-2042,FLT-778,15,CASE,180,96.00/);
  assert.deepEqual(await (await runDemo('orders', {}, 'other')).json(), []);
});
