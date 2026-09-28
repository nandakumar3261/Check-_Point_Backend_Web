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

function currentUser() {
  const raw = sessionStorage.getItem('asg_user');
  return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
  sessionStorage.setItem('asg_user', JSON.stringify(user));
}

function logout() {
  sessionStorage.removeItem('asg_user');
  window.location.href = 'index.html';
}

function requireRole(role) {
  const u = currentUser();
  if (!u || u.role !== role) {
    window.location.href = 'index.html';
  }
  return u;
}
