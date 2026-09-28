const user = requireRole('security');

const titles = {
  home: 'Home',
  images: 'Images',
  logs: 'Logs/Data',
  contact: 'Contact Us',
};

// Fills an .avatar element with the guard's profile photo, or their first
// letter when they haven't uploaded one yet.
function fillAvatar(el) {
  if (!el || !user) return;
  if (user.profile_pic) {
    el.innerHTML = `<img src="${esc(user.profile_pic)}" alt="${esc(user.first_name)}">`;
  } else {
    el.textContent = user.first_name.charAt(0);
  }
}

// Sidebar header (name, designation, emp id, mobile + photo) - the guard's
// own details, always visible top-left - and the mobile topbar avatar.
function paintIdentity() {
  if (!user) return;
  document.getElementById('sidebarName').textContent = user.first_name;
  document.getElementById('sidebarDesignation').textContent = user.designation || 'Security Guard';
  document.getElementById('sidebarEmpId').textContent = `Emp ID: ${user.roll_no}`;
  document.getElementById('sidebarMobile').textContent = user.mobile || '';
  document.getElementById('whoName').textContent = user.first_name;
  fillAvatar(document.getElementById('sidebarAvatar'));
  fillAvatar(document.getElementById('avatarInitial'));
}

paintIdentity();

document.querySelectorAll('.nav-link[data-section]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-link[data-section]').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    render(el.dataset.section);
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Sections that show the guard's live duty assignments from MongoDB. Every
// time the guard opens one of these, duties are re-fetched, so a duty the
// admin assigns while the guard is logged in shows up on the next visit.
const DUTY_SECTIONS = ['home'];
let currentSection = 'home';

const dutyState = { loaded: false, error: null, data: [] };
let dutyLoadSeq = 0; // ignore out-of-order responses if the guard clicks around quickly

async function loadMyDuties() {
  if (!user) return;
  const seq = ++dutyLoadSeq;
  try {
    const res = await fetchQrScanCoverageViaApi({ guardEmpId: user.roll_no }); // every duty, with per-sub-place scanned status
    if (seq !== dutyLoadSeq) return;
    dutyState.data = res.data || [];
    dutyState.error = null;
    dutyState.loaded = true;
  } catch (err) {
    if (seq !== dutyLoadSeq) return;
    dutyState.error = err.message || 'Could not load your duties.';
  }
}

function paint(section) {
  document.getElementById('pageTitle').textContent = titles[section];
  document.getElementById('content').innerHTML = renderers[section]();
  attachHandlers(section);
}

function render(section) {
  currentSection = section;
  if (section === 'home') dutyPage = 1; // fresh visit -> start from page 1
  paint(section);

  if (DUTY_SECTIONS.includes(section)) {
    loadMyDuties().then(() => {
      if (currentSection === section) paint(section); // still on this page -> show fresh data
    });
  }
}

// Data comes from the database now, so escape it before putting it in HTML.
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function openModal(html, { maxWidth } = {}) {
  const box = document.getElementById('modalBox');
  box.innerHTML = html;
  box.style.maxWidth = maxWidth || '';
  document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.getElementById('modalBox').innerHTML = '';
  document.getElementById('modalBox').style.maxWidth = '';
}
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

function sectionHead(title, sub) {
  return `<div class="section-head"><h2>${title}</h2><p>${sub}</p></div>`;
}

// Today's duty first, then upcoming (soonest first), then completed (latest first).
// The server returns duties newest-first (dutyDate descending). That's the
// right order for "completed" (most recently finished duty on top), but
// upcoming duties need the opposite - the soonest one next, not the
// farthest-away one - so only upcoming gets reversed.
function splitDuties() {
  const list = dutyState.data;
  return {
    today: list.filter(d => d.status === 'today'),
    upcoming: list.filter(d => d.status === 'upcoming').reverse(),
    completed: list.filter(d => d.status === 'completed'),
  };
}

function prettyRange(dateRange) {
  return String(dateRange || '').replace('_', ' → ');
}

const STATUS_BADGE = {
  today: '<span class="badge badge-success">Today</span>',
  upcoming: '<span class="badge badge-amber">Upcoming</span>',
  completed: '<span class="badge badge-neutral">Completed</span>',
};

// today, then upcoming, then completed - one flat list, in that order.
function combinedDuties() {
  const { today, upcoming, completed } = splitDuties();
  return [...today, ...upcoming, ...completed];
}

// Rows-per-page state for the My Duties table (Home page). Reset to page 1
// whenever the guard (re)opens Home - see render().
let dutyPage = 1;
let dutyPageSize = 10;

// Clamps dutyPage into range for the current data/page size and returns the
// slice to show. Called both when painting the table and when wiring the
// pagination buttons, so both agree on the current page.
function dutyPageSlice() {
  const all = combinedDuties();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / dutyPageSize));
  if (dutyPage > totalPages) dutyPage = totalPages;
  if (dutyPage < 1) dutyPage = 1;
  const start = (dutyPage - 1) * dutyPageSize;
  return { all, total, totalPages, start, pageItems: all.slice(start, start + dutyPageSize) };
}

// One row per duty: #, Duty Date Range, Status, Main Place, Sub Places.
// A scanned sub place gets a green tick, an unscanned one a red cross - so a
// guard can tell at a glance which sub places on a duty they still need to
// visit.
function subPlaceChip(sp) {
  const icon = sp.scanned
    ? '<span style="color:var(--success);">✓</span>'
    : '<span style="color:var(--danger);">✗</span>';
  return `<span class="chip">${icon} ${esc(sp.name)}</span>`;
}

function dutyRow(d, serial) {
  return `
    <tr>
      <td class="serial-col">${serial}</td>
      <td style="white-space:nowrap;">${esc(prettyRange(d.dateRange))}</td>
      <td>${STATUS_BADGE[d.status] || ''}</td>
      <td class="preserve-space">${esc(d.mainPlace)}</td>
      <td>${(d.subPlaces || []).map(subPlaceChip).join('')}</td>
    </tr>`;
}

// Pagination toolbar (rows-per-page, Previous/Next, Download PDF) plus the
// table for the current page. Returns '' when there is nothing to page
// through - dutyPlaceholder() covers that case instead.
function dutySection() {
  const { pageItems, total, totalPages, start } = dutyPageSlice();
  const rows = pageItems.map((d, i) => dutyRow(d, start + i + 1)).join('');
  const rangeEnd = Math.min(start + dutyPageSize, total);

  return `
    <div style="display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <label for="dutyPageSize" style="font-size:12.5px; color:var(--ink-500);">Rows per page</label>
        <select id="dutyPageSize" class="pill-select">
          ${[10, 20, 50, 100].map(n => `<option value="${n}" ${n === dutyPageSize ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-outline" id="downloadDutiesPdfBtn" type="button" style="width:auto; padding:9px 16px;" ${total === 0 ? 'disabled' : ''}>⬇ Download PDF</button>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th class="serial-col">#</th><th>Duty Date Range</th><th>Status</th><th>Main Place</th><th>Sub Places</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:14px;">
      <span style="font-size:12.5px; color:var(--ink-500);">${total === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}-${rangeEnd} of ${total}`}</span>
      <div style="display:flex; align-items:center; gap:10px;">
        <button class="btn btn-outline" id="dutyPrevBtn" type="button" style="width:auto; padding:8px 16px;" ${dutyPage <= 1 ? 'disabled' : ''}>Previous</button>
        <button class="btn btn-outline" id="dutyNextBtn" type="button" style="width:auto; padding:8px 16px;" ${dutyPage >= totalPages ? 'disabled' : ''}>Next</button>
      </div>
    </div>`;
}

// Shown in place of the duty list while loading, on failure, or when empty.
// Returns '' when there is real data to show.
function dutyPlaceholder() {
  if (!dutyState.loaded) {
    return dutyState.error
      ? `<div class="card"><p style="color:var(--danger); font-size:13.5px;">${esc(dutyState.error)}</p>
           <button class="btn btn-outline" id="retryDutiesBtn" style="width:auto; padding:8px 18px; margin-top:12px;">Retry</button></div>`
      : '<div class="card"><p style="color:var(--ink-500); font-size:13.5px;">Loading your duties…</p></div>';
  }
  if (dutyState.data.length === 0) {
    return '<div class="card"><p style="color:var(--ink-300); font-size:13.5px;">No duties have been assigned to you yet. When an admin assigns you a duty it will appear here.</p></div>';
  }
  return '';
}

// Small warning when a refresh failed but we still have older data to show.
function staleWarning() {
  return dutyState.loaded && dutyState.error
    ? `<p style="color:var(--danger); font-size:12.5px; margin-bottom:12px;">Couldn't refresh: ${esc(dutyState.error)} Showing the last loaded duties.</p>`
    : '';
}

// "YYYY-MM-DD" for today in the browser's local time.
function todayISODate() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const renderers = {
  home: () => {
    return `
    ${sectionHead('Welcome back, ' + esc(user.first_name.split(' ')[0]), esc(user.designation) + ' • Roll No ' + esc(user.roll_no))}
    <div class="card">
      <div class="card-title">Reminder</div>
      <p style="color:var(--ink-300); font-size:13.5px;">QR scanning is only accepted between 6:00 PM and 6:00 AM. Scans outside this window will be rejected.</p>
    </div>
    <div class="section-head" style="margin:26px 0 4px;"><h2>My Duties</h2><p>Duties your admin has assigned to you.</p></div>
    ${staleWarning()}
    ${dutyPlaceholder() || dutySection()}
  `;
  },

  images: () => `
    ${sectionHead('Images', 'Upload site-visit photo evidence and review the photos you have submitted.')}

    <div class="tabs" id="imagesTabs">
      <button class="tab-btn active" data-tab="uploadImage" type="button">Upload Images</button>
      <button class="tab-btn" data-tab="getImages" type="button">Get Images</button>
    </div>

    <div class="tab-panel" id="tab-uploadImage">
      <div class="card" style="max-width:420px;">
        <div class="image-tile" style="margin-bottom:14px;"><div class="ph" style="height:160px;">🖼</div></div>
        <input type="file" id="imageFileInput" accept=".jpg,.jpeg,.png,image/jpeg,image/png" style="display:none;">
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline" id="pickImgBtn" style="flex:1;">Pick Image</button>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>Comment <span style="color:var(--amber);">*</span></label>
          <textarea id="imageCommentInput" rows="3" maxlength="500" placeholder="Describe what this photo shows (required, min 3 characters)"></textarea>
          <div style="display:flex; justify-content:flex-end; margin-top:4px;">
            <span id="imageCommentCount" style="font-size:11px; color:var(--ink-500);">0 / 500</span>
          </div>
        </div>
        <button class="btn btn-primary" id="uploadImgBtn" style="width:100%;" disabled>Upload</button>
        <div class="error-text" id="imageUploadError"></div>
        <p style="color:var(--ink-500); font-size:11.5px; margin-top:8px;">
          Accepted formats: JPG, JPEG, PNG only. Size must be between 10 KB and 2 MB. Comment must be 3-500 characters.
        </p>
      </div>
    </div>

    <div class="tab-panel" id="tab-getImages" style="display:none;">
      <div class="image-grid" id="myImagesGrid">
        <p style="color:var(--ink-500); font-size:13px;">Loading your images...</p>
      </div>
    </div>
  `,

  logs: () => `
    ${sectionHead('Logs/Data', 'Every sub place assigned to you, and whether it was scanned.')}
    <div class="card">
      <div class="data-toolbar">
        <div class="toolbar-right" style="margin-left:0; gap:10px; flex-wrap:wrap;">
          <select id="logsFilter">
            <option value="date" selected>Date</option>
            <option value="all">All</option>
          </select>
          <input type="date" id="logsDate" value="${todayISODate()}" max="${todayISODate()}">
        </div>
        <div class="toolbar-right" style="margin-left:auto;">
          <span id="logsSummary" style="font-size:12.5px; color:var(--ink-500);"></span>
          <button class="btn btn-outline" id="downloadLogsPdfBtn" type="button" style="width:auto; padding:9px 16px;" disabled>⬇ Download PDF</button>
        </div>
      </div>
      <div class="table-scroll" id="logsTableWrap">
        <p style="color:var(--ink-500); font-size:13px; padding:8px 0;">Loading...</p>
      </div>
    </div>
  `,

  contact: () => `
    ${sectionHead('Contact Us', 'Reach the support team for help with the app.')}
    <div class="card" style="max-width:420px;">
      <p>support@adityasecurityguard.com</p>
      <p>+91 98765 43210</p>
      <p>Aditya Towers, Hyderabad, India</p>
    </div>
  `,
};

function attachHandlers(section) {
  const retry = document.getElementById('retryDutiesBtn');
  if (retry) retry.addEventListener('click', () => render(section));

  if (section === 'home') {
    const sizeSel = document.getElementById('dutyPageSize');
    const prevBtn = document.getElementById('dutyPrevBtn');
    const nextBtn = document.getElementById('dutyNextBtn');
    const pdfBtn = document.getElementById('downloadDutiesPdfBtn');

    // Pagination controls only exist once there are duties to page through
    // (dutyPlaceholder() covers the loading/empty/error states instead).
    if (sizeSel) {
      sizeSel.addEventListener('change', () => {
        dutyPageSize = Number(sizeSel.value) || 10;
        dutyPage = 1;
        paint('home'); // repaint from the data already loaded - no refetch
      });
      prevBtn.addEventListener('click', () => { dutyPage -= 1; paint('home'); });
      nextBtn.addEventListener('click', () => { dutyPage += 1; paint('home'); });

pdfBtn.addEventListener('click', () => {
        if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
          alert('The PDF export library did not load. Check your internet connection and try again.');
          return;
        }
        const all = combinedDuties();
        const STATUS_LABEL = { today: 'Today', upcoming: 'Upcoming', completed: 'Completed' };

        // One row per duty, Sub Places wrapped inline like a flowing sentence
        // (comma-separated, several per line) - same shape as plain wrapped
        // text, just with a tick/cross icon drawn before each name instead of
        // printed [Y]/[N]. jsPDF's built-in font has no tick/cross/arrow
        // glyphs and silently corrupts them if printed as text, so the icons
        // are vector lines, not characters, which is why this needs manual
        // layout instead of a plain autoTable text cell.
        const ICON_COLUMN = 4;
        const LINE_HEIGHT = 4.6; // mm per wrapped line
        const CELL_TOP_PAD = 2.4; // mm, matches autoTable's own cell padding
        const CELL_SIDE_PAD = 2; // mm
        const ICON_GAP = 3.4; // mm reserved for icon + gap before the name

        const doc = new jspdf.jsPDF({ orientation: 'landscape' });
        doc.setFontSize(8);

        // Greedily wraps this duty's sub places into lines that fit
        // maxWidth, keeping each "name, " as one unbreakable unit (so a line
        // never breaks in the middle of a name) - the same function is used
        // to measure how tall a row needs to be and, later, to actually draw
        // it, so the two always agree.
        function wrapSubPlaces(subs, maxWidth) {
          const lines = [[]];
          let x = 0;
          subs.forEach((sp, i) => {
            const unit = sp.name + (i === subs.length - 1 ? '' : ', ');
            const chunkWidth = ICON_GAP + doc.getTextWidth(unit);
            if (x > 0 && x + chunkWidth > maxWidth) {
              lines.push([]);
              x = 0;
            }
            lines[lines.length - 1].push({ sp, unit });
            x += chunkWidth;
          });
          return lines;
        }

        const subColWidth = 130;
        const wrapWidth = subColWidth - CELL_SIDE_PAD * 2;
        const layouts = all.map((d) => wrapSubPlaces(d.subPlaces || [], wrapWidth));

        const body = all.map((d, i) => [
          String(i + 1),
          prettyRange(d.dateRange).replace(' \u2192 ', ' to '),
          STATUS_LABEL[d.status] || d.status,
          d.mainPlace,
          { content: '', styles: { minCellHeight: layouts[i].length * LINE_HEIGHT + CELL_TOP_PAD } },
        ]);

        doc.setFontSize(14);
        doc.text(`My Duties - ${user.first_name} (${user.roll_no})`, 14, 15);
        doc.setFontSize(10);
        doc.text(`${all.length} duty assignment${all.length === 1 ? '' : 's'}`, 14, 21);
        doc.setFontSize(8);

        doc.autoTable({
          startY: 26,
          theme: 'grid',
          head: [['#', 'Duty Date Range', 'Status', 'Main Place', 'Sub Places (tick = scanned)']],
          body,
          styles: { fontSize: 8, lineWidth: 0.1, lineColor: [38, 56, 90] },
          headStyles: { fillColor: [18, 33, 58] },
          columnStyles: { [ICON_COLUMN]: { cellWidth: subColWidth } },
          didDrawCell: (data) => {
            if (data.section !== 'body' || data.column.index !== ICON_COLUMN) return;
            doc.setFontSize(8);
            const { x, y } = data.cell;
            const startX = x + CELL_SIDE_PAD;

            layouts[data.row.index].forEach((line, li) => {
              let cx = startX;
              const cy = y + CELL_TOP_PAD + li * LINE_HEIGHT + 2;
              line.forEach(({ sp, unit }) => {
                doc.setLineWidth(0.55);
                if (sp.scanned) {
                  doc.setDrawColor(46, 160, 90); // green tick
                  doc.line(cx - 0.2, cy - 0.2, cx + 1, cy + 1);
                  doc.line(cx + 1, cy + 1, cx + 2.6, cy - 1.5);
                } else {
                  doc.setDrawColor(210, 60, 60); // red cross
                  doc.line(cx, cy - 1.2, cx + 2.4, cy + 1.2);
                  doc.line(cx, cy + 1.2, cx + 2.4, cy - 1.2);
                }
                doc.setTextColor(60, 60, 60);
                doc.text(unit, cx + ICON_GAP, cy + 0.9);
                cx += ICON_GAP + doc.getTextWidth(unit);
              });
            });
          },
        });
        doc.save(`my_duties_${user.roll_no}.pdf`);
      });
    }
  }

  if (section === 'logs') {
    const filterSel = document.getElementById('logsFilter');
    const dateInput = document.getElementById('logsDate');
    const wrap = document.getElementById('logsTableWrap');
    const summary = document.getElementById('logsSummary');
    const pdfBtn = document.getElementById('downloadLogsPdfBtn');
    let logsSeq = 0; // ignore out-of-order responses if the filter changes quickly
    let loaded = { duties: [], byDate: true, date: '' }; // what's on screen right now, for the PDF

    // "22/09/2026, 10:52 am"
    function fmtDateTime(iso) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }

    // One serial number per duty (Main Place + Duty Date Range, merged cells),
    // with EVERY sub place assigned to the guard numbered underneath, each
    // marked Scanned / Not scanned and every scan time stacked in its Scanned
    // At cell. Shared by the on-screen table and the PDF.
    function groupLogRows(duties) {
      const rows = [];
      duties.forEach((g, gi) => {
        const subs = (g.subPlaces || []).map(sp => ({
          name: sp.name,
          scanned: !!sp.scanned,
          times: (sp.scans || []).slice().sort((x, y) => new Date(x) - new Date(y)),
        }));
        subs.forEach((sub, i) => rows.push({ group: g, groupIndex: gi + 1, span: subs.length, first: i === 0, subIndex: i + 1, sub }));
      });
      return rows;
    }

    function buildLogsTable(duties) {
      const rows = groupLogRows(duties);

      const body = rows.map(r => {
        const zebra = r.groupIndex % 2 === 0 ? ' style="background:rgba(255,255,255,0.025);"' : '';
        const merged = r.first
          ? `<td class="serial-col" rowspan="${r.span}" style="vertical-align:top;">${r.groupIndex}</td>
             <td class="preserve-space" rowspan="${r.span}" style="vertical-align:top;">${esc(r.group.mainPlace)}</td>
             <td rowspan="${r.span}" style="vertical-align:top; white-space:nowrap;">${esc(prettyRange(r.group.dateRange))}</td>`
          : '';
        return `<tr${zebra}>${merged}
          <td class="serial-col">${r.subIndex}</td>
          <td class="preserve-space">${esc(r.sub.name)}</td>
          <td style="white-space:nowrap;"><span class="badge ${r.sub.scanned ? 'badge-success' : 'badge-neutral'}">${r.sub.scanned ? 'Scanned' : 'Not scanned'}</span></td>
          <td style="white-space:nowrap;">${r.sub.scanned ? r.sub.times.map(fmtDateTime).join('<br>') : '—'}</td>
        </tr>`;
      }).join('');

      return `
        <table class="recent-scans-table" style="min-width:1020px;">
          <colgroup>
            <col style="width:56px;"><col style="width:190px;"><col style="width:190px;">
            <col style="width:64px;"><col style="width:240px;"><col style="width:130px;"><col style="width:170px;">
          </colgroup>
          <thead><tr>
            <th class="serial-col">#</th><th>Main Place</th><th>Duty Date Range</th>
            <th class="serial-col">Sub #</th><th>Sub Place</th><th>Status</th><th>Scanned At</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>`;
    }
    function prettyDateStr(iso) {
      const [y, m, d] = iso.split('-');
      return `${d}-${m}-${y}`;
    }

    async function loadLogs() {
      const seq = ++logsSeq;
      const byDate = filterSel.value === 'date';
      dateInput.style.display = byDate ? '' : 'none'; // "All" -> no date picker

      // Date mode needs a valid date: an empty/partial picker falls back to
      // today, and a future date is clamped to today.
      if (byDate) {
        const v = dateInput.value;
        const valid = /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000;
        if (!valid || v > todayISODate()) dateInput.value = todayISODate();
      }
      const date = byDate ? dateInput.value : '';

      wrap.innerHTML = '<p style="color:var(--ink-500); font-size:13px; padding:8px 0;">Loading...</p>';
      summary.textContent = '';
      pdfBtn.disabled = true;
      loaded = { duties: [], byDate, date };
      try {
        // Every sub place assigned to this guard, tagged scanned / not scanned.
        const { data } = await fetchQrScanCoverageViaApi({ guardEmpId: user.roll_no, date });
        if (seq !== logsSeq) return;

        loaded = { duties: data, byDate, date };
        pdfBtn.disabled = data.length === 0;

        const allSubs = data.flatMap(d => d.subPlaces || []);
        const scannedCount = allSubs.filter(sp => sp.scanned).length;
        summary.textContent = `${scannedCount} of ${allSubs.length} sub place${allSubs.length === 1 ? '' : 's'} scanned • ${byDate ? 'Duty ' + prettyDateStr(date) : 'All dates'}`;

        if (data.length === 0) {
          wrap.innerHTML = `<p style="color:var(--ink-300); font-size:13.5px; padding:8px 0;">${
            byDate ? 'No duty was assigned to you for ' + esc(prettyDateStr(date)) + '.' : 'No duties have been assigned to you yet.'
          }</p>`;
          return;
        }

        wrap.innerHTML = buildLogsTable(data);
      } catch (err) {
        if (seq !== logsSeq) return;
        wrap.innerHTML = `<p style="color:var(--danger); font-size:13px; padding:8px 0;">${esc(err.message || 'Could not load your logs.')}</p>
          <button class="btn btn-outline" id="retryLogsBtn" style="width:auto; padding:8px 18px;">Retry</button>`;
        document.getElementById('retryLogsBtn').addEventListener('click', loadLogs);
      }
    }

    filterSel.addEventListener('change', loadLogs);

    // Typing a date fires "change" for every intermediate year (0002, 0020,
    // 0202, 2026...), so wait for the typing to settle and skip incomplete
    // years instead of querying each one. Picking from the calendar loads
    // immediately.
    let dateTimer = null;
    dateInput.addEventListener('change', () => {
      clearTimeout(dateTimer);
      const v = dateInput.value;
      const complete = /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000;
      if (v && !complete) return; // still typing the year
      dateTimer = setTimeout(loadLogs, 200);
    });
    // ---------- Download PDF: mirrors the on-screen table (merged cells) ----------
    pdfBtn.addEventListener('click', () => {
      if (!loaded.duties.length) {
        alert('Nothing to export.');
        return;
      }
      if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        alert('The PDF export library did not load. Check your internet connection and try again.');
        return;
      }

      const rows = groupLogRows(loaded.duties);
      const body = rows.map(r => {
        const row = [];
        if (r.first) {
          row.push({ content: String(r.groupIndex), rowSpan: r.span, styles: { valign: 'top' } });
          row.push({ content: r.group.mainPlace, rowSpan: r.span, styles: { valign: 'top' } });
          // Plain "to" - the PDF's built-in font has no arrow glyph.
          row.push({ content: String(r.group.dateRange || '').replace('_', ' to '), rowSpan: r.span, styles: { valign: 'top' } });
        }
        row.push(String(r.subIndex));
        row.push(r.sub.name);
        row.push(r.sub.scanned ? 'Scanned' : 'Not scanned');
        row.push(r.sub.scanned ? r.sub.times.map(fmtDateTime).join('\n') : '-');
        return row;
      });

      const scope = loaded.byDate ? `Duty date ${prettyDateStr(loaded.date)}` : 'All dates';
      const doc = new jspdf.jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text(`Logs/Data - ${user.first_name} (${user.roll_no})`, 14, 15);
      doc.setFontSize(10);
      const pdfSubs = loaded.duties.flatMap(d => d.subPlaces || []);
      doc.text(`${scope}  |  ${pdfSubs.filter(sp => sp.scanned).length} of ${pdfSubs.length} sub places scanned`, 14, 21);
      doc.autoTable({
        startY: 26,
        theme: 'grid',
        head: [['#', 'Main Place', 'Duty Date Range', 'Sub #', 'Sub Place', 'Status', 'Scanned At']],
        body,
        styles: { fontSize: 8, lineWidth: 0.1, lineColor: [38, 56, 90] },
        headStyles: { fillColor: [18, 33, 58] },
      });
      doc.save(`logs_${user.roll_no}_${loaded.byDate ? loaded.date : 'all'}.pdf`);
    });

    loadLogs(); // default: today's date
  }

  if (section === 'images') {
    // ---------- Tab switching ----------
    const imgTabNames = ['uploadImage', 'getImages'];
    document.querySelectorAll('#imagesTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#imagesTabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        imgTabNames.forEach(t => {
          document.getElementById('tab-' + t).style.display = (t === btn.dataset.tab) ? 'block' : 'none';
        });
        if (btn.dataset.tab === 'getImages') loadMyImages();
      });
    });

    // Same rules as admin.js's Upload Image tab (see routes/uploadedImages.js
    // for the server-side checks these mirror): jpg/jpeg/png only, 10 KB -
    // 2 MB, must actually decode as an image, and a 3-500 character comment
    // is required before Upload unlocks.
    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
    const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
    const MIN_IMAGE_SIZE = 10 * 1024; // 10 KB
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
    const MIN_COMMENT_LENGTH = 3;
    const MAX_COMMENT_LENGTH = 500;

    const fileInput = document.getElementById('imageFileInput');
    const previewTile = document.querySelector('#tab-uploadImage .ph');
    const pickBtn = document.getElementById('pickImgBtn');
    const commentInput = document.getElementById('imageCommentInput');
    const commentCount = document.getElementById('imageCommentCount');
    const uploadBtn = document.getElementById('uploadImgBtn');
    const errBox = document.getElementById('imageUploadError');

    let selectedFile = null;

    function formatKB(bytes) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    function commentError() {
      const len = commentInput.value.trim().length;
      if (len === 0) return 'Please write a comment describing the photo.';
      if (len < MIN_COMMENT_LENGTH) return `Comment must be at least ${MIN_COMMENT_LENGTH} characters.`;
      if (len > MAX_COMMENT_LENGTH) return `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.`;
      return '';
    }

    function updateCommentCount() {
      const len = commentInput.value.trim().length;
      commentCount.textContent = `${len} / ${MAX_COMMENT_LENGTH}`;
      commentCount.style.color = (len > 0 && len < MIN_COMMENT_LENGTH) ? '#e2574c' : 'var(--ink-500)';
    }

    function refreshUploadButton() {
      uploadBtn.disabled = !(selectedFile && !commentError());
    }

    function resetSelection() {
      selectedFile = null;
      fileInput.value = '';
      previewTile.innerHTML = '🖼';
      refreshUploadButton();
    }

    pickBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      errBox.textContent = '';
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type) || ALLOWED_IMAGE_EXTENSIONS.includes(ext);
      if (!isAllowedType) {
        errBox.textContent = 'Only JPG, JPEG or PNG images are allowed.';
        resetSelection();
        return;
      }

      if (file.size < MIN_IMAGE_SIZE) {
        errBox.textContent = `Image is too small (${formatKB(file.size)}). Minimum size is 10 KB.`;
        resetSelection();
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        errBox.textContent = `Image is too large (${formatKB(file.size)}). Maximum size is 2 MB.`;
        resetSelection();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const probe = new Image();
        probe.onload = () => {
          selectedFile = file;
          previewTile.innerHTML = `<img src="${reader.result}" alt="Selected image" style="width:100%; height:100%; object-fit:cover;">`;
          refreshUploadButton();
        };
        probe.onerror = () => {
          errBox.textContent = 'This file is not a valid image. Please pick a different JPG or PNG.';
          resetSelection();
        };
        probe.src = reader.result;
      };
      reader.onerror = () => {
        errBox.textContent = 'Could not read the selected file. Please try again.';
        resetSelection();
      };
      reader.readAsDataURL(file);
    });

    commentInput.addEventListener('input', () => {
      if (commentInput.value.length > MAX_COMMENT_LENGTH) {
        commentInput.value = commentInput.value.slice(0, MAX_COMMENT_LENGTH);
      }
      errBox.textContent = '';
      updateCommentCount();
      refreshUploadButton();
    });

    updateCommentCount();

    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        errBox.textContent = 'Please pick an image first.';
        return;
      }
      const cErr = commentError();
      if (cErr) {
        errBox.textContent = cErr;
        return;
      }
      const comment = commentInput.value.trim();

      errBox.textContent = '';
      uploadBtn.disabled = true;
      pickBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
      try {
        await uploadImageViaApi({
          file: selectedFile,
          comment,
          guardEmpId: user.roll_no,
          guardName: user.first_name,
        });
        alert('Image uploaded successfully.');
        resetSelection();
        commentInput.value = '';
        updateCommentCount();
      } catch (err) {
        errBox.textContent = err.message || 'Could not upload the image.';
        refreshUploadButton();
      } finally {
        uploadBtn.textContent = 'Upload';
        pickBtn.disabled = false;
      }
    });

    // ======================================================================
    // Tab: Get Images - only the photos THIS guard has uploaded (the server
    // filters by guardEmpId), most recent first. Tap a thumbnail to open it
    // full-size; each tile also has a Download button.
    // ======================================================================
    let myImagesById = new Map();

    function imageDownloadName(img) {
      const uploaded = new Date(img.uploadedAt || img.createdAt);
      const stamp = isNaN(uploaded.getTime())
        ? Date.now()
        : uploaded.toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const dot = img.imageUrl.lastIndexOf('.');
      const ext = dot === -1 ? '.jpg' : img.imageUrl.slice(dot);
      return `${img.guardEmpId}_${stamp}${ext}`;
    }

    function imageDateTime(img) {
      const uploaded = new Date(img.uploadedAt || img.createdAt);
      if (isNaN(uploaded.getTime())) return { dateStr: '—', timeStr: '' };
      return {
        dateStr: uploaded.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        timeStr: uploaded.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
    }

    function openMyImagePreview(id) {
      const img = myImagesById.get(id);
      if (!img) return;
      const { dateStr, timeStr } = imageDateTime(img);
      openModal(`
        <div class="image-preview-modal">
          <img src="${esc(img.imageUrl)}" alt="Your uploaded image">
          <div class="meta">
            <span>${dateStr} • ${timeStr}</span>
            <p class="comment">"${esc(img.comment)}"</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="closePreviewBtn">Close</button>
            <a class="btn btn-primary" style="width:auto; padding:10px 20px; text-decoration:none;" href="${esc(img.imageUrl)}" download="${esc(imageDownloadName(img))}">Download</a>
          </div>
        </div>
      `, { maxWidth: '640px' });
      document.getElementById('closePreviewBtn').addEventListener('click', closeModal);
    }

    async function loadMyImages() {
      const grid = document.getElementById('myImagesGrid');
      grid.innerHTML = '<p style="color:var(--ink-500); font-size:13px;">Loading your images...</p>';
      try {
        const { data } = await fetchUploadedImagesViaApi({ guardEmpId: user.roll_no, limit: 100 });
        myImagesById = new Map(data.map(img => [img._id, img]));

        if (data.length === 0) {
          grid.innerHTML = '<p style="color:var(--ink-500); font-size:13px;">You have not uploaded any images yet.</p>';
          return;
        }
        grid.innerHTML = data.map(img => {
          const { dateStr, timeStr } = imageDateTime(img);
          return `
            <div class="image-tile">
              <div class="ph viewable" style="height:140px;" data-img-id="${esc(img._id)}" title="Tap to view full size">
                <img src="${esc(img.imageUrl)}" alt="Your uploaded image" style="width:100%; height:100%; object-fit:cover;">
                <a class="dl-btn" href="${esc(img.imageUrl)}" download="${esc(imageDownloadName(img))}" title="Download" onclick="event.stopPropagation()">⬇</a>
              </div>
              <div class="meta">
                <span>${dateStr} • ${timeStr}</span>
                <p class="comment">"${esc(img.comment)}"</p>
              </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.ph.viewable').forEach(el => {
          el.addEventListener('click', () => openMyImagePreview(el.dataset.imgId));
        });
      } catch (err) {
        grid.innerHTML = `<p style="color:#e2574c; font-size:13px;">${esc(err.message || 'Could not load your images.')}</p>`;
      }
    }
  }
}

render('home');
