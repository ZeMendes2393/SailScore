import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://api.sailscore.online';
const REGATTA_ID = __ENV.REGATTA_ID || '1';
const CLASS_NAME = __ENV.CLASS_NAME || 'ILCA 7';
const RUN_ID = (__ENV.RUN_ID || Date.now().toString(36)).slice(-4).toUpperCase();

export const options = {
  scenarios: {
    mixed_load: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

function uniqueId() {
  return `${Date.now()}-${__VU}-${__ITER}`;
}

function uniqueSailNumber() {
  const vu = __VU.toString(36).toUpperCase().padStart(2, '0');
  const iter = __ITER.toString(36).toUpperCase().padStart(4, '0');
  return `LT${RUN_ID}${vu}${iter}`.slice(0, 15);
}

export default function () {
  const listRes = http.get(`${BASE_URL}/entries/by_regatta/${REGATTA_ID}?include_waiting=1`);
  check(listRes, { 'GET entries status 200': (r) => r.status === 200 });

  if (__ITER % 3 === 0) {
    const uid = uniqueId();
    const payload = JSON.stringify({
      class_name: CLASS_NAME,
      boat_country_code: 'POR',
      sail_number: uniqueSailNumber(),
      first_name: `Load${__VU}`,
      last_name: `Test${__ITER}`,
      email: `loadtest+${uid}@example.com`,
      regatta_id: Number(REGATTA_ID),
    });

    const postRes = http.post(`${BASE_URL}/entries`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (postRes.status >= 400 && __ITER < 3) {
      console.warn(`POST failed status=${postRes.status} body=${postRes.body?.slice(0, 300)}`);
    }

    check(postRes, {
      'POST entry status 200/201/409/422': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409 || r.status === 422,
    });
  }

  sleep(1);
}
