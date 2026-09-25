import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { createTaskboardServer, resolveHost } from '../server/app.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'task-atlas-test-'));
  let app;
  let base;
  async function start() {
    app = createTaskboardServer({ dataDirectory: dir });
    const address = await app.listen({ port: 0 });
    base = `http://127.0.0.1:${address.port}`;
  }
  await start();
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  return {
    dir,
    async badHost() {
      return new Promise((resolve, reject) => {
        const req = httpRequest(base + '/api/projects', { headers: { host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject); req.end();
      });
    },
    async restart() { await app.close(); await start(); },
    async request(route, method = 'GET', body, status = 200, headers = {}) {
      const res = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await res.json();
      assert.equal(res.status, status, JSON.stringify(result));
      return result;
    },
  };
}

test('tasks: create, status, stale edit rejection, idea placement, reparent, log and restart persistence', async t => {
  const f = await fixture(t);
  await f.request('/api/projects', 'POST', { id: 'release-test', name: '发布验证' }, 201);
  const create = async (title, labels = []) => (await f.request('/api/tasks', 'POST', { projectId: 'release-test', title, labels }, 201)).task;
  const root = await create('总目标');
  const branch = await create('阶段');
  let idea = await create('新想法', ['想法池']);
  idea = (await f.request(`/api/tasks/${idea.id}`, 'PATCH', { version: idea.version, status: 'in_progress' })).task;
  await f.request(`/api/tasks/${idea.id}`, 'PATCH', { version: 1, status: 'done' }, 409);
  await f.request(`/api/tasks/${idea.id}/relations/parent/${root.id}`, 'POST', { version: idea.version });
  idea = (await f.request(`/api/tasks/${idea.id}`)).task;
  idea = (await f.request(`/api/tasks/${idea.id}`, 'PATCH', { version: idea.version, labels: ['atlas-order:1'] })).task;
  assert.equal(idea.relations.parent.id, root.id);
  assert.ok(!idea.labels.includes('想法池'));
  await f.request(`/api/tasks/${idea.id}/relations/parent/${branch.id}`, 'POST', { version: idea.version });
  idea = (await f.request(`/api/tasks/${idea.id}`)).task;
  assert.equal(idea.relations.parent.id, branch.id);
  const currentBranch = (await f.request(`/api/tasks/${branch.id}`)).task;
  await f.request(`/api/tasks/${branch.id}/relations/parent/${idea.id}`, 'POST', { version: currentBranch.version }, 409);
  await f.request(`/api/tasks/${idea.id}/comments`, 'POST', { body: '推进记录：已核验材料' }, 201);
  await f.restart();
  const saved = (await f.request(`/api/tasks/${idea.id}`)).task;
  assert.equal(saved.status, 'in_progress');
  assert.equal(saved.relations.parent.id, branch.id);
  assert.deepEqual(saved.labels, ['atlas-order:1']);
  assert.equal((await f.request(`/api/tasks/${idea.id}/comments`)).comments[0].body, '推进记录：已核验材料');
});

test('local boundary: reject external origins/hosts and removed capabilities; ignore old cloud config', async t => {
  const f = await fixture(t);
  for (const origin of ['https://example.com', 'http://192.168.1.2', 'http://127.0.0.1:1', 'null']) {
    await f.request('/api/projects', 'POST', { id: 'unwanted', name: 'unwanted' }, 403, { origin });
  }
  assert.equal(await f.badHost(), 403);
  for (const route of ['/api/local/cloud-session', '/api/local/ai/threads', '/api/workflow-capabilities', '/api/device-workspaces']) {
    await f.request(route, 'GET', undefined, 404);
  }
  assert.equal((await f.request('/api/meta')).capabilities.localAiChat, false);
  await writeFile(path.join(f.dir, 'cloud-companion.json'), JSON.stringify({ remoteUrl: 'http://127.0.0.1:1', sharedKey: 'test-only' }));
  await f.restart();
  assert.ok(Array.isArray((await f.request('/api/projects')).projects));
  assert.equal(resolveHost('127.0.0.1'), '127.0.0.1');
  assert.throws(() => resolveHost('0.0.0.0'));
});

test('Markdown defaults do not execute raw HTML or javascript links', () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, '<img src=x onerror=alert(1)>\n\n[click](javascript:alert%281%29)'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
});

test('existing database: restore missing legacy project column without losing project records', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { TaskboardDatabase } = await import('../server/database.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'task-atlas-migration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'taskboard.sqlite');
  const first = new TaskboardDatabase(file);
  first.close();
  const legacy = new DatabaseSync(file);
  legacy.exec('ALTER TABLE projects DROP COLUMN workspace_path');
  const before = legacy.prepare('SELECT id, name FROM projects ORDER BY id').all();
  legacy.close();
  const upgraded = new TaskboardDatabase(file);
  upgraded.close();
  const check = new DatabaseSync(file);
  try {
    assert.deepEqual(check.prepare('SELECT id, name FROM projects ORDER BY id').all(), before);
    assert.ok(check.prepare('PRAGMA table_info(projects)').all().some(c => c.name === 'workspace_path'));
    assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { check.close(); }
});
