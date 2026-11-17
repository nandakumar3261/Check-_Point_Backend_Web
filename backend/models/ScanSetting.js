const mongoose = require('mongoose');
const { Schema } = mongoose;

// Stored as 24-hour "HH:mm" (e.g. "18:00"), not 12-hour + AM/PM - that
// keeps comparisons/validation simple; the admin UI converts to and from
// 12-hour + AM/PM only for display (see js/admin.js).
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DUTY_TYPES = ['Day Duty', 'Night Duty'];

/**
 * Scan time windows. One document per duty type:
 *   { dutyType: "Day Duty",   from: "07:00", to: "17:00" }
 *   { dutyType: "Night Duty", from: "19:00", to: "05:00" }
 * (routes/scanSettings.js creates each one the first time it is saved.)
 *
 * A document WITHOUT dutyType is the original general scan window. It is
 * kept as-is - routes/qrScans.js still uses it to decide when scanning is open.
 */
const ScanSettingSchema = new Schema(
  {
    dutyType: { type: String, enum: DUTY_TYPES },
    from: { type: String, required: true, match: TIME_PATTERN },
    to: { type: String, required: true, match: TIME_PATTERN },
  },
  { timestamps: true }
);

// At most one document per duty type (documents without dutyType are ignored).
ScanSettingSchema.index(
  { dutyType: 1 },
  { unique: true, partialFilterExpression: { dutyType: { $type: 'string' } } }
);

module.exports = mongoose.model('ScanSetting', ScanSettingSchema);
