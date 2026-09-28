/**
 * Calls to the Express + MongoDB backend (see server.js, routes/auth.js,
 * routes/users.js). Everything else in the app still reads from MOCK in
 * data.js - only auth and user/guard management go through here.
 */

/**
 * Reads a fetch Response as JSON, but fails with a clear error instead of
 * a cryptic "Unexpected token '<'..." if the server returned HTML (e.g. an
 * unmatched route, a proxy error page, or the server needing a restart
 * after a code change) instead of JSON.
 */
async function readJsonResponse(res) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
    throw new Error(
      `Server returned a non-JSON response (HTTP ${res.status}). This usually means the API route ` +
      `wasn't found or the server needs restarting. Response started with: "${snippet}"`
    );
  }

  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(body.error || `Request failed (HTTP ${res.status}).`);
  }
  return body;
}

async function loginViaApi(roll_no, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll_no, password }),
  });
  return readJsonResponse(res); // { roll_no, first_name, designation, mobile, role }
}

async function fetchUsersViaApi({ role, search, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);

  const res = await fetch(`/api/users?${params.toString()}`);
  return readJsonResponse(res); // { data, total, page, limit, totalPages }
}

async function addUserViaApi(payload) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res);
}

async function bulkAddUsersViaApi(users) {
  const res = await fetch('/api/users/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  });
  return readJsonResponse(res); // { insertedCount, skippedCount, results }
}

async function updateUserViaApi(id, payload) {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res);
}

async function toggleBlockUserViaApi(id) {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}/toggle-block`, { method: 'PATCH' });
  return readJsonResponse(res); // { _id, roll_no, blocked }
}

async function deleteUserViaApi(id) {
  const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return readJsonResponse(res);
}

/**
 * Duty places (see routes/dutyPlaces.js, models/DutyPlace.js).
 */

async function fetchDutyPlacesViaApi({ search, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);

  const res = await fetch(`/api/duty-places?${params.toString()}`);
  return readJsonResponse(res); // { data, total, page, limit, totalPages }
}

async function fetchDutyPlaceOptionsViaApi() {
  const res = await fetch('/api/duty-places/options');
  return readJsonResponse(res); // { data }
}

/**
 * Home dashboard's "Main locations" and "Sub places" cards: both counts come
 * straight from the DutyPlace collection (see GET /api/duty-places/stats),
 * so "Sub places" reflects every sub-place on record, not just the ones
 * currently covered by a duty assignment.
 */
async function fetchDutyPlaceStatsViaApi() {
  const res = await fetch('/api/duty-places/stats');
  return readJsonResponse(res); // { totalMainPlaces, totalSubPlaces }
}

async function addDutyPlaceViaApi(payload) {
  const res = await fetch('/api/duty-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res);
}

async function addSubPlacesViaApi(id, subPlaces) {
  const res = await fetch(`/api/duty-places/${encodeURIComponent(id)}/sub-places`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subPlaces }),
  });
  return readJsonResponse(res);
}

async function updateDutyPlaceViaApi(id, payload) {
  const res = await fetch(`/api/duty-places/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res);
}

async function deleteDutyPlaceViaApi(id) {
  const res = await fetch(`/api/duty-places/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return readJsonResponse(res);
}

/**
 * Duty assignments (see routes/dutyAssignments.js, models/DutyAssignment.js).
 */

async function fetchDutyAssignmentsViaApi({ search, date, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (date) params.set('date', date);
  params.set('page', page);
  params.set('limit', limit);

  const res = await fetch(`/api/duty-assignments?${params.toString()}`);
  return readJsonResponse(res); // { data, total, page, limit, totalPages }
}

/**
 * Home dashboard's "Active assignments" card: total duty assignments, and
 * how many sub places those assignments cover between them (see
 * GET /api/duty-assignments/stats).
 */
async function fetchDutyAssignmentStatsViaApi() {
  const res = await fetch('/api/duty-assignments/stats');
  return readJsonResponse(res); // { totalAssignments, totalSubPlaces }
}

async function bulkAssignDutiesViaApi(payload) {
  const res = await fetch('/api/duty-assignments/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res); // { insertedCount, skippedCount, results }
}

async function updateDutyAssignmentViaApi(id, payload) {
  const res = await fetch(`/api/duty-assignments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonResponse(res);
}

async function deleteDutyAssignmentViaApi(id) {
  const res = await fetch(`/api/duty-assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return readJsonResponse(res);
}

/**
 * The logged-in guard's own duties (see GET /api/duty-assignments/mine).
 * Only assignments whose guardEmpId equals this roll number are returned,
 * each tagged with status: 'completed' | 'today' | 'upcoming'.
 */
async function fetchMyDutiesViaApi(guardEmpId) {
  const params = new URLSearchParams({ guardEmpId });
  const res = await fetch(`/api/duty-assignments/mine?${params.toString()}`);
  return readJsonResponse(res); // { data, total }
}

/**
 * QR scans (see routes/qrScans.js, models/QrScan.js).
 */

async function fetchQrScansViaApi({ search, date, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (date) params.set('date', date);
  params.set('page', page);
  params.set('limit', limit);

  const res = await fetch(`/api/qr-scans?${params.toString()}`);
  return readJsonResponse(res); // { data, total, page, limit, totalPages }
}

/**
 * One guard's own scans (GET /api/qr-scans/mine). Pass date ("YYYY-MM-DD") for the
 * duty that starts on that day, or leave it out for everything.
 */
async function fetchMyQrScansViaApi({ guardEmpId, date } = {}) {
  const params = new URLSearchParams();
  params.set('guardEmpId', guardEmpId);
  if (date) params.set('date', date);
  const res = await fetch(`/api/qr-scans/mine?${params.toString()}`);
  return readJsonResponse(res); // { data, total }
}

/**
 * Per-guard scan coverage for a given date (see GET /api/qr-scans/coverage).
 * One entry per guard who has a duty assigned that day, with every one of
 * their sub places tagged as scanned/not-scanned (plus every scan
 * timestamp) - powers the admin Home page's "Recent QR scans" card, where
 * tapping a guard on the left shows their main place + sub-place scan
 * detail on the right.
 */
async function fetchQrScanCoverageViaApi({ date, guardEmpId } = {}) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (guardEmpId) params.set('guardEmpId', guardEmpId);

  const res = await fetch(`/api/qr-scans/coverage?${params.toString()}`);
  return readJsonResponse(res); // { data, total }
}

/**
 * Uploaded site-visit images (see routes/uploadedImages.js, models/UploadedImage.js).
 */

// file, comment, guardEmpId and guardName are required by the server too -
// see routes/uploadedImages.js. Sent as multipart/form-data (not JSON)
// since it carries a real file.
async function uploadImageViaApi({ file, comment, guardEmpId, guardName }) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('comment', comment);
  formData.append('guardEmpId', guardEmpId);
  formData.append('guardName', guardName);

  const res = await fetch('/api/uploaded-images', { method: 'POST', body: formData });
  return readJsonResponse(res);
}

// Pass guardEmpId to get only that guard's images (guard panel); leave it out
// for everyone's images (admin panel).
async function fetchUploadedImagesViaApi({ search, guardEmpId, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (guardEmpId) params.set('guardEmpId', guardEmpId);
  params.set('page', page);
  params.set('limit', limit);

  const res = await fetch(`/api/uploaded-images?${params.toString()}`);
  return readJsonResponse(res); // { data, total, page, limit, totalPages }
}

/**
 * Guard profile photo. Sent as multipart/form-data; returns { profile_pic }
 * (the public URL of the saved photo).
 */
async function uploadProfilePicViaApi(rollNo, file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/users/by-roll/${encodeURIComponent(rollNo)}/profile-pic`, {
    method: 'POST',
    body: formData,
  });
  return readJsonResponse(res);
}
