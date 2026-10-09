/**
 * MOCK holds static data for everything that is NOT yet wired to MongoDB
 * (QR scans, uploaded images, duty status).
 *
 * Login, user/guard management, duty places and duty assignments (admin
 * Assign Duty screens AND the guard's Home / My Duties pages) now go through
 * the real backend API (see api.js) which is backed by MongoDB - see
 * loginViaApi() / fetchUsersViaApi() / fetchDutyPlacesViaApi() /
 * fetchDutyAssignmentsViaApi() / fetchMyDutiesViaApi() etc. in api.js.
 */

const MOCK = {
  // Fallback list only used by the "Assign Duty" dropdown, which is still
  // static-data driven. The "Get Security Data" screen now reads live from
  // MongoDB instead of this list - see renderers.getSecurityData in admin.js.
  guards: [
    { empId: '2758', name: 'Ramesh Yadav', mobile: '9123456780', designation: 'Security Guard' },
    { empId: '3049', name: 'Suresh Pawar', mobile: '9988776655', designation: 'Security Guard' },
    { empId: '3105', name: 'Vikram Singh', mobile: '9012345678', designation: 'Senior Guard' },
    { empId: '3220', name: 'Mahesh Rao', mobile: '9345612780', designation: 'Security Guard' },
  ],

  // Fallback list only used by the "Assign Duty" dropdown, which is still
  // static-data driven. "Add Duty Places" / "Existing Duty Places" now read
  // and write live MongoDB data instead of this list - see the
  // renderers.addDutyPlaces section in admin.js.
  dutyPlaces: [
    { mainPlace: 'Aditya Towers - Main Gate', subPlaces: ['Gate A', 'Gate B', 'Reception Lobby'] },
    { mainPlace: 'Warehouse Complex', subPlaces: ['Loading Bay 1', 'Loading Bay 2', 'Perimeter Fence'] },
    { mainPlace: 'Parking Structure', subPlaces: ['Level 1', 'Level 2', 'Rooftop'] },
    { mainPlace: 'Corporate Park', subPlaces: ['Block A Entrance', 'Block B Entrance', 'Cafeteria Wing'] },
  ],

  scans: [
    { dateRange: '10-01-2024_11-01-2024', guardLabel: 'Ramesh Yadav ( 2758 )', scannedPlace: 'Gate A', timestamp: '10-01-2024 18:42:11' },
    { dateRange: '10-01-2024_11-01-2024', guardLabel: 'Ramesh Yadav ( 2758 )', scannedPlace: 'Gate B', timestamp: '10-01-2024 21:05:37' },
    { dateRange: '10-01-2024_11-01-2024', guardLabel: 'Suresh Pawar ( 3049 )', scannedPlace: 'Loading Bay 1', timestamp: '10-01-2024 19:15:02' },
  ],

  // Uploaded images are no longer mock data - admin.js's Images section now
  // reads/writes real MongoDB documents via fetchUploadedImagesViaApi() /
  // uploadImageViaApi() in api.js (see routes/uploadedImages.js).
};

/**
 * Session storage for the logged-in user, plus the password they signed in
 * with - kept only so this tab can silently re-check itself against the
 * server (see verifySessionStillValid below), so that a password changed
 * from another browser/device invalidates this session automatically
 * instead of leaving it logged in with stale credentials.
 *
 * Honest security note: this is light obfuscation (base64), not real
 * encryption - a secret stored and read back by the same client-side code
 * can never be truly secret, since anyone with devtools access to this
 * session already has everything needed to decode it. The actual
 * protections here are: sessionStorage is wiped when the tab closes, the
 * password never leaves the browser except back to the same login
 * endpoint over HTTPS in production, and the server only ever compares it
 * against a bcrypt hash - it's never stored anywhere in plaintext on disk.
 */
function _encodePw(pw) {
  try {
    return btoa(unescape(encodeURIComponent(pw)));
  } catch (err) {
    return '';
  }
}
function _decodePw(encoded) {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch (err) {
    return '';
  }
}

function currentUser() {
  const raw = sessionStorage.getItem('asg_user');
  return raw ? JSON.parse(raw) : null;
}

/** `password` is optional - pass it at login time; omit it on later updates
 *  (e.g. refreshing the cached profile) to leave the stored one untouched. */
function setCurrentUser(user, password) {
  sessionStorage.setItem('asg_user', JSON.stringify(user));
  if (password) sessionStorage.setItem('asg_cred', _encodePw(password));
}

function _storedPassword() {
  const raw = sessionStorage.getItem('asg_cred');
  return raw ? _decodePw(raw) : null;
}

function logout() {
  sessionStorage.removeItem('asg_user');
  sessionStorage.removeItem('asg_cred');
  window.location.href = 'index.html';
}

/**
 * Re-checks the signed-in account against the server: still exists, not
 * blocked, and the stored password still matches what's on the server
 * right now. If it doesn't - most commonly because the password was
 * changed from another device - the session is cleared and the person is
 * sent back to the login page. A transient network/server error does NOT
 * log the person out; only an explicit rejection from the server does.
 *
 * Returns true if the caller should proceed (valid, or inconclusive due to
 * a hiccup), false if the session was invalid and has already been
 * cleared + redirected away from.
 */
async function verifySessionStillValid() {
  const u = currentUser();
  if (!u) return true; // no session at all; requireRole() already sends those to the login page

  const pw = _storedPassword();
  if (!pw) {
    // A session with a cached profile but no stored credential (e.g. one
    // started before this check existed) can't be verified against the
    // server, so don't trust it - one fresh login fixes it for good.
    sessionStorage.removeItem('asg_user');
    alert('Please log in again to continue.');
    window.location.href = 'index.html';
    return false;
  }

  const result = await verifyCredentials(u.roll_no, pw);
  if (result.ok === false) {
    sessionStorage.removeItem('asg_user');
    sessionStorage.removeItem('asg_cred');
    alert(result.message || 'Your session is no longer valid. Please log in again.');
    window.location.href = 'index.html';
    return false;
  }
  if (result.ok === true) {
    setCurrentUser(result.user); // keep the cached profile fresh; stored password is untouched
  }
  return true; // valid, or inconclusive (network/server hiccup) - don't punish the user for that
}

function requireRole(role) {
  const u = currentUser();
  if (!u || u.role !== role) {
    window.location.href = 'index.html';
  }
  return u;
}
