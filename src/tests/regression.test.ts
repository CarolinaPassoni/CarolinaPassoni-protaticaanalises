import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { extractVideoId, teamsFromVideoTitle, parseClipRange } from '../utils/videoIdentity.js';
import { db, saveCompetition, saveMatch, getMatchById, saveTeam, listTeams, saveAnalysis, getAnalysisById, updateAnalysisVisibility, getPublicAnalysisById, saveTacticalBoard, listTacticalBoards, createUserWithPassword, createAuthSession, verifyAuthSessionToken } from '../db-sqlite.js';
import { generateGeminiResilient, getGeminiRetryAfterSeconds } from '../../server.js';
import { verifyVideo } from '../services/geminiService.js';

test('YouTube rejects lookalike hosts, arbitrary query URLs and invalid IDs', () => {
  for (const url of ['https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be.evil.test/dQw4w9WgXcQ', 'https://evil.test/embed/dQw4w9WgXcQ', 'https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)']) assert.equal(extractVideoId(url), null, url);
  assert.equal(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractVideoId('https://youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('Competition label is not treated as opposing team', () => {
  assert.equal(teamsFromVideoTitle('🔴PROSPERIDADE - ESTADUAL'), null);
  assert.equal(teamsFromVideoTitle('PROSPERIDADE x ESTADUAL'), null);
  assert.deepEqual(teamsFromVideoTitle('AO VIVO: Prosperidade x Rio Branco - ESTADUAL - 22/09/2026'), { timeA: 'Prosperidade', timeB: 'Rio Branco' });
  assert.deepEqual(teamsFromVideoTitle('Flamengo vs. Palmeiras | Melhores momentos'), { timeA: 'Flamengo', timeB: 'Palmeiras' });
});

test('Clip range rejects NaN, reverse intervals and oversized requests', () => {
  for (const [a,b] of [['oops',20], [0,'Infinity'], [-1,50], [100,50], [0,20000]]) assert.throws(() => parseClipRange(a,b));
  assert.deepEqual(parseClipRange('0','60'), { startSec:0,endSec:60 });
});

test('Editing competition preserves fixtures; editing fixture preserves provider metadata', () => {
  const comp = saveCompetition({ name:'Audit League',season:'2026',slug:'audit-'+randomUUID() });
  const match = saveMatch({ competitionId:comp.id,homeTeam:'A',awayTeam:'B',matchDate:'2026-09-23' });
  db.prepare('UPDATE matches SET external_fixture_id = ?, source_provider = ? WHERE id = ?').run(123456789, 'api_football', match.id);
  saveCompetition({ ...comp, name:'Audit League updated' });
  assert.ok(getMatchById(match.id), 'fixture must survive parent edit');
  saveMatch({ ...match, videoUrl:'https://youtu.be/dQw4w9WgXcQ' });
  const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id);
  assert.equal(row.external_fixture_id,123456789);
  assert.equal(row.source_provider,'api_football');
});

test('Team ID cannot be taken over by another user; same team name is allowed', () => {
  const original = saveTeam({ userId:'owner-a',name:'Same club',category:'Senior',season:'2026' });
  assert.throws(() => saveTeam({ ...original,userId:'owner-b' }), /outra conta/);
  saveTeam({ userId:'owner-b',name:'Same club',category:'Senior',season:'2026' });
  assert.equal(listTeams('owner-a')[0].id, original.id);
  assert.notEqual(listTeams('owner-b')[0].id, original.id);
});

test('Tactical board updates preserve ownership and original creation timestamp', () => {
  const board = saveTacticalBoard({ userId:'owner-a',title:'Board',formationA:'4-4-2',formationB:'4-3-3',payload:{} });
  assert.throws(() => saveTacticalBoard({ ...board,userId:'owner-b',title:'Hijack' }), /outra conta/);
  saveTacticalBoard({ ...board,title:'Updated' });
  assert.equal(listTacticalBoards('owner-a')[0].title,'Updated');
  assert.equal(listTacticalBoards('owner-a')[0].createdAt,board.createdAt);
});

test('Analysis update preserves public visibility; child insertion failure rolls back all changes', () => {
  const analysis = { analysisId:randomUUID(),timeA:'A',timeB:'B',placar:'1 x 0',resumoPartida:'Original',analiseJogadores:[{nome:'Original player'}] };
  saveAnalysis(analysis,'owner-a');
  updateAnalysisVisibility(analysis.analysisId,'public');
  saveAnalysis({ ...analysis,resumoPartida:'Updated' },'owner-a');
  assert.ok(getPublicAnalysisById(analysis.analysisId));
  assert.throws(() => saveAnalysis({ ...analysis,resumoPartida:'Must roll back',analiseJogadores:[{ nome: { invalid:'binding' } }] },'owner-a'));
  assert.equal(getAnalysisById(analysis.analysisId).resumoPartida,'Updated');
  assert.equal(db.prepare('SELECT display_name FROM player_analyses WHERE analysis_id = ?').get(analysis.analysisId).display_name,'Original player');
});

test('Blocked accounts cannot reuse active sessions', () => {
  const id = createUserWithPassword('audit-'+randomUUID(),'Audit','PasswordForTest123!');
  const token = createAuthSession(id);
  assert.equal(verifyAuthSessionToken(token)?.id,id);
  db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(id);
  assert.equal(verifyAuthSessionToken(token),null);
});

test('Frontend video verification sends stored bearer token', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis,'localStorage',{ configurable:true,value:{ getItem:()=> 'test-session' } });
  globalThis.fetch = (async (_url: any, init: any) => {
    assert.equal(init.headers.Authorization,'Bearer test-session');
    return new Response(JSON.stringify({ verifiedContext:{videoId:'dQw4w9WgXcQ'} }), {status:200});
  }) as any;
  try { assert.equal((await verifyVideo('https://youtu.be/dQw4w9WgXcQ')).videoId,'dQw4w9WgXcQ'); }
  finally { globalThis.fetch=originalFetch; if (originalStorage) Object.defineProperty(globalThis,'localStorage',originalStorage); else delete (globalThis as any).localStorage; }
});

test('Gemini cooldown skips exhausted models across subsequent calls', async () => {
  let calls = 0;
  const ai = { models:{ generateContent:async ()=> {calls++;throw Object.assign(new Error('quota GenerateRequestsPerDayPerProjectPerModel'),{status:429});} } };
  await assert.rejects(generateGeminiResilient(ai as any,{model:'gemini-3.8-flash'},'test'), {status:429});
  const firstCalls = calls;
  assert.ok(firstCalls > 0 && firstCalls <= 4);
  await assert.rejects(generateGeminiResilient(ai as any,{model:'gemini-3.8-flash'},'test'), {status:429});
  assert.equal(calls,firstCalls,'cooldowns must prevent repeated quota consumption');
  assert.ok(getGeminiRetryAfterSeconds({message:'GenerateRequestsPerDayPerProjectPerModel'}) >= 60);
});

test('HTTP smoke: health, login, authorization, ownership, invalid JSON and API 404', async () => {
  const { app } = await import('../../server.js');
  const server = app.listen(0,'127.0.0.1');
  await new Promise<void>((resolve,reject)=> { server.once('listening',resolve);server.once('error',reject); });
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;
  const request = (path: string, init?: RequestInit) => fetch(base+path,init);
  const username = 'http-'+randomUUID();
  const id = createUserWithPassword(username,'HTTP test','HttpTestPassword123!');
  try {
    assert.equal((await request('/healthz')).status,200);
    assert.equal((await (await request('/healthz')).json()).version,'6.10.15');
    assert.equal((await request('/api/analyses')).status,401);
    const login = await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'HttpTestPassword123!'})});
    assert.equal(login.status,200);
    const {token} = await login.json();
    const headers = {'Content-Type':'application/json',Authorization:`Bearer ${token}`};
    assert.equal((await request('/api/admin/users',{headers})).status,403);
    assert.equal((await request('/api/analyses',{headers})).status,200);
    const team = saveTeam({userId:'another-owner',name:'Other',category:'Senior',season:'2026'});
    const hijack = await request('/api/tactical/teams',{method:'POST',headers,body:JSON.stringify(team)});
    assert.equal(hijack.status,403);
    assert.equal((await request('/api/verify-video',{method:'POST',headers,body:JSON.stringify({url:'https://evil.test/watch?v=dQw4w9WgXcQ'})})).status,400);
    const badJson=await request('/api/login',{method:'POST',headers,body:'{oops'});
    assert.equal(badJson.status,400);
    assert.match(badJson.headers.get('content-type') || '',/json/);
    const missing=await request('/api/does-not-exist');
    assert.equal(missing.status,404);
    assert.match(missing.headers.get('content-type') || '',/json/);
    db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(id);
    assert.equal((await request('/api/me',{headers})).status,401);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
