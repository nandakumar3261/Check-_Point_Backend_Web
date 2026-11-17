const express = require('express');
const ScanSetting = require('../models/ScanSetting');

const { requireRole } = require('../middleware/auth');

const router = express.Router();

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// request "type"  ->  the dutyType stored in MongoDB.
// "scan" is the original general window (the document with no dutyType).
const DUTY_TYPE = { day: 'Day Duty', night: 'Night Duty' };

const win = (doc) => ({ from: (doc && doc.from) || null, to: (doc && doc.to) || null });

async function readAll() {
  const docs = await ScanSetting.find({});
  const general = docs.find((d) => !d.dutyType);
  return {
    // Top-level from/to = the original general window (mobile app unchanged).
    ...win(general),
    day: { ...win(docs.find((d) => d.dutyType === 'Day Duty')) },
    night: { ...win(docs.find((d) => d.dutyType === 'Night Duty')) },
  };
}

// GET /api/scan-settings
//   -> { from, to, day: { from, to }, night: { from, to } }  (nulls if never saved)
router.get('/', async (req, res) => {
  try {
    res.json(await readAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching the scan time window.' });
  }
});

// PUT /api/scan-settings  { from: "HH:mm", to: "HH:mm", type?: "scan" | "day" | "night" }
// day / night upsert the document whose dutyType is "Day Duty" / "Night Duty"
// (a new _id is created the first time). "scan" (default) edits the original
// general window, so the old request shape still works.
router.put('/', requireRole('admin'), async (req, res) => {
  try {
    const { from, to } = req.body;
    const type = req.body.type === undefined ? 'scan' : req.body.type;
    const valid = typeof type === 'string' &&
      (type === 'scan' || Object.prototype.hasOwnProperty.call(DUTY_TYPE, type));
    if (!valid) {
      return res.status(400).json({ error: 'type must be "scan", "day" or "night".' });
    }
    if (!TIME_PATTERN.test(from) || !TIME_PATTERN.test(to)) {
      return res.status(400).json({ error: 'from and to must both be 24-hour times in HH:mm form.' });
    }

    const filter = type === 'scan' ? { dutyType: { $exists: false } } : { dutyType: DUTY_TYPE[type] };
    await ScanSetting.findOneAndUpdate(
      filter,
      { $set: { from, to } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(await readAll());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving the scan time window.' });
  }
});

module.exports = router;
