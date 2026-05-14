// Realistic load test for SailScore
//
// Simula tráfego mais próximo do mundo real:
//  - Cenário 1 (entradas): velejadores a fazer inscrição. Olham o formulário,
//    pensam, escrevem, submetem. Cada um faz ~1 inscrição completa e vai-se
//    embora.
//  - Cenário 2 (browsers): visitantes a ver entry list, notice board e
//    results em loop, com pausas. Não submetem nada.
//
// Cenário recomendado para validar capacidade real:
//   k6 run loadtest_realistic.js
//
// Configurações via env vars:
//   BASE_URL, REGATTA_ID, CLASS_NAME, RUN_ID
//   SAILORS_PEAK    (default 30) → utilizadores a inscrever-se no pico
//   BROWSERS_PEAK   (default 60) → utilizadores a navegar no pico
//   DURATION        (default '5m')

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://api.sailscore.online';
const REGATTA_ID = __ENV.REGATTA_ID || '1';
const CLASS_NAME = __ENV.CLASS_NAME || 'ILCA';
const RUN_ID = (__ENV.RUN_ID || Date.now().toString(36)).slice(-4).toUpperCase();
const SAILORS_PEAK = Number(__ENV.SAILORS_PEAK || 30);
const BROWSERS_PEAK = Number(__ENV.BROWSERS_PEAK || 60);
const DURATION = __ENV.DURATION || '5m';

export const options = {
  scenarios: {
    sailors_signing_up: {
      executor: 'ramping-vus',
      exec: 'sailorSigningUp',
      startVUs: 1,
      stages: [
        { duration: '30s', target: Math.max(1, Math.floor(SAILORS_PEAK / 3)) },
        { duration: '1m', target: SAILORS_PEAK },
        { duration: DURATION, target: SAILORS_PEAK },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
    public_browsers: {
      executor: 'ramping-vus',
      exec: 'publicBrowser',
      startVUs: 1,
      stages: [
        { duration: '30s', target: Math.max(1, Math.floor(BROWSERS_PEAK / 3)) },
        { duration: '1m', target: BROWSERS_PEAK },
        { duration: DURATION, target: BROWSERS_PEAK },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2500'],
    'http_req_duration{group:::sailor_post_entry}': ['p(95)<3000'],
    'http_req_duration{group:::browser_get_entries}': ['p(95)<1500'],
  },
};

function pause(minMs, maxMs) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  sleep(ms / 1000);
}

function uniqueSailNumber() {
  const vu = __VU.toString(36).toUpperCase().padStart(2, '0');
  const iter = __ITER.toString(36).toUpperCase().padStart(4, '0');
  return `LT${RUN_ID}${vu}${iter}`.slice(0, 15);
}

// ============================================================================
// Cenário 1 — Velejador a inscrever-se
// ============================================================================
export function sailorSigningUp() {
  // 1) Abre página da regata, lê informação
  const headers = http.get(`${BASE_URL}/design/header`, {
    tags: { group: 'sailor_open_page' },
  });
  check(headers, { 'GET header 200': (r) => r.status === 200 });
  pause(800, 2000);

  // 2) Olha para a entry list
  const list = http.get(`${BASE_URL}/entries/by_regatta/${REGATTA_ID}?include_waiting=1`, {
    tags: { group: 'sailor_view_entries' },
  });
  check(list, { 'GET entries 200': (r) => r.status === 200 });
  pause(2000, 5000);

  // 3) Vê as classes disponíveis
  const classes = http.get(`${BASE_URL}/regattas/${REGATTA_ID}/classes`, {
    tags: { group: 'sailor_view_classes' },
  });
  check(classes, { 'GET classes 200': (r) => r.status === 200 });
  pause(5000, 12000);

  // 4) Submete a inscrição (escreveu o formulário durante a pausa anterior)
  const payload = JSON.stringify({
    class_name: CLASS_NAME,
    boat_country_code: 'POR',
    sail_number: uniqueSailNumber(),
    first_name: `Sailor${__VU}`,
    last_name: `Test${__ITER}`,
    email: `sailor+${RUN_ID}-${__VU}-${__ITER}@example.com`,
    regatta_id: Number(REGATTA_ID),
  });

  const postRes = http.post(`${BASE_URL}/entries`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { group: 'sailor_post_entry' },
  });

  if (postRes.status >= 400 && __ITER < 2) {
    console.warn(`POST failed status=${postRes.status} body=${postRes.body?.slice(0, 300)}`);
  }

  check(postRes, {
    'POST entry 200/201/409/422': (r) =>
      r.status === 200 || r.status === 201 || r.status === 409 || r.status === 422,
  });

  // 5) Espera um bocado a verificar resultado e sai
  pause(3000, 8000);
}

// ============================================================================
// Cenário 2 — Visitante a navegar (não submete)
// ============================================================================
export function publicBrowser() {
  // Sequência típica: header → entry list → notice board → results
  const r1 = http.get(`${BASE_URL}/entries/by_regatta/${REGATTA_ID}?include_waiting=1`, {
    tags: { group: 'browser_get_entries' },
  });
  check(r1, { 'browser GET entries 200': (r) => r.status === 200 });
  pause(2000, 6000);

  const r2 = http.get(`${BASE_URL}/regattas/${REGATTA_ID}`, {
    tags: { group: 'browser_get_regatta' },
  });
  check(r2, { 'browser GET regatta 200/404': (r) => r.status === 200 || r.status === 404 });
  pause(2000, 5000);

  const r3 = http.get(`${BASE_URL}/regattas/${REGATTA_ID}/classes`, {
    tags: { group: 'browser_get_classes' },
  });
  check(r3, { 'browser GET classes 200': (r) => r.status === 200 });
  pause(3000, 8000);
}
