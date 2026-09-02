/*
 * ============================================================================
 *  DLP PASSPORT-PHOTO CLEANUP — paste into the BROWSER DEVTOOLS CONSOLE
 *  (on iheza.online, while logged in as a DLP principal / director / coordinator)
 * ============================================================================
 *
 *  WHY: DLP student/admission records carry huge base64 passport photos
 *  (0.5–3 MB each) inside the DB. Every page that lists DLP students pulls
 *  these blobs down, bloating API responses and causing 502/504/520 gateway
 *  errors under load.
 *
 *  WHAT THIS DOES:
 *    - scanDLPPhotos()  -> DRY RUN. Lists how many DLP records have base64
 *                          passport photos and their total size. NO changes.
 *    - clearDLPPhotos() -> Actually clears them (sets passport_photo to "").
 *
 *  HOW IT WORKS:
 *    - Uses your existing login token (localStorage.sessionToken).
 *    - GET /api/admissions?chain=DLP  returns DLP admissions AND students
 *      (the backend merges both collections).
 *    - For each record with a base64 photo it calls
 *      PUT /api/admissions/{id}  with { passport_photo: "" }.
 *      The backend syncs the change to BOTH the student and admission records.
 *    - Concurrency is capped at 3 in-flight requests so we do NOT recreate
 *      the very overload that causes the 502s.
 *
 *  USAGE:
 *    1. Log in to iheza.online as a DLP principal (or director/coordinator).
 *    2. Open DevTools (F12) -> Console.
 *    3. Paste this whole block and press Enter.
 *    4. Run  scanDLPPhotos()   to preview.
 *    5. Run  clearDLPPhotos()  to actually clear them.
 * ============================================================================
 */

(function () {
  const CHAIN = 'DLP';
  const CONCURRENCY = 3; // max simultaneous requests (keep low to avoid 502s)
  const DELAY_MS = 250;  // small pause between batches

  const token = localStorage.getItem('sessionToken');
  const base = window.location.origin; // same-origin on iheza.online

  function isBase64Photo(v) {
    return typeof v === 'string' && v.length > 100 && v.startsWith('data:image');
  }

  function approxBytes(str) {
    // ~0.75 bytes per base64 char (base64 is 4 chars per 3 bytes)
    return Math.round((str.length * 3) / 4);
  }

  async function api(path, method, body) {
    const res = await fetch(base + path, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + txt.slice(0, 200));
    }
    return res.json();
  }

  // Fetch all DLP records that carry a base64 passport photo.
  async function fetchDLPRecordsWithPhotos() {
    const records = await api('/api/admissions?chain=' + CHAIN);
    const hits = records.filter((r) => isBase64Photo(r.passport_photo));
    return hits;
  }

  // ---- DRY RUN -------------------------------------------------------------
  window.scanDLPPhotos = async function () {
    console.log('Scanning DLP records for base64 passport photos...');
    const hits = await fetchDLPRecordsWithPhotos();
    let totalBytes = 0;
    hits.forEach((r) => {
      const b = approxBytes(r.passport_photo);
      totalBytes += b;
      console.log(
        '  ' + (r.admission_no || r.id) +
        '  | ' + (r.student_name || (r.first_name + ' ' + r.last_name)) +
        '  | ' + (b / 1024).toFixed(0) + ' KB'
      );
    });
    console.log('----------------------------------------------');
    console.log('TOTAL: ' + hits.length + ' DLP record(s) with base64 photos, ~' +
      (totalBytes / 1024 / 1024).toFixed(2) + ' MB');
    console.log('Run clearDLPPhotos() to remove them.');
    return { count: hits.length, bytes: totalBytes };
  };

  // ---- ACTUALLY CLEAR ------------------------------------------------------
  window.clearDLPPhotos = async function () {
    const hits = await fetchDLPRecordsWithPhotos();
    if (hits.length === 0) {
      console.log('No DLP records with base64 photos found. Nothing to do.');
      return { cleared: 0 };
    }
    console.log('Clearing ' + hits.length + ' DLP record(s)... (concurrency=' + CONCURRENCY + ')');

    let cleared = 0;
    let failed = 0;
    const errors = [];

    // Worker pool with bounded concurrency.
    const queue = hits.slice();
    async function worker() {
      while (queue.length) {
        const rec = queue.shift();
        try {
          await api('/api/admissions/' + rec.id, 'PUT', { passport_photo: '' });
          cleared++;
          if (cleared % 10 === 0) console.log('  cleared ' + cleared + '/' + hits.length);
        } catch (e) {
          failed++;
          errors.push((rec.admission_no || rec.id) + ': ' + e.message);
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);

    console.log('----------------------------------------------');
    console.log('DONE. Cleared: ' + cleared + ' | Failed: ' + failed);
    if (errors.length) {
      console.log('Failures:');
      errors.forEach((e) => console.log('  ' + e));
    }
    return { cleared, failed };
  };

  console.log('Ready. Run  scanDLPPhotos()  to preview, then  clearDLPPhotos()  to remove.');
})();
