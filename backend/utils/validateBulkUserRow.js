/**
 * Validation for one row of the admin "Add Security" CSV bulk upload.
 * Returns a list of problems (empty list = row is valid), so a row with
 * several mistakes reports all of them at once.
 *
 * Rules (the same ones the single "New account" form enforces):
 *  - password: 7+ characters, no spaces, an uppercase letter, a number and a
 *    special character
 *  - gender:   exactly "Male", "Female" or "Other" (capital first letter);
 *    may be left blank
 *  - mobile:   exactly 10 digits, starting with 6, 7, 8 or 9
 *  - role:     exactly "admin" or "security"
 */
const ALLOWED_ROLES = ['admin', 'security'];
const ALLOWED_GENDERS = ['Male', 'Female', 'Other'];

function validateBulkUserRow(row) {
  const problems = [];
  const { roll_no, password, first_name, gender, mobile, role } = row || {};

  if (!String(roll_no ?? '').trim() || !String(password ?? '') || !String(first_name ?? '').trim() ||
      !String(mobile ?? '').trim() || !String(role ?? '').trim()) {
    problems.push('Missing required field(s) (roll_no, password, first_name, mobile, role).');
    return problems;
  }

  const pwd = String(password);
  if (/\s/.test(pwd)) problems.push('Password cannot contain spaces.');
  else if (pwd.length < 7) problems.push('Password must be at least 7 characters.');
  else if (!/[A-Z]/.test(pwd)) problems.push('Password needs at least one uppercase letter.');
  else if (!/[0-9]/.test(pwd)) problems.push('Password needs at least one number.');
  else if (!/[^A-Za-z0-9\s]/.test(pwd)) problems.push('Password needs at least one special character (e.g. @ # $ !).');

  const g = String(gender ?? '').trim();
  if (g && !ALLOWED_GENDERS.includes(g)) {
    problems.push(`Gender must be Male, Female or Other with a capital first letter (got "${g}").`);
  }

  const mob = String(mobile).trim();
  if (!/^\d+$/.test(mob)) problems.push('Mobile must contain digits only.');
  else if (mob.length !== 10) problems.push('Mobile must be exactly 10 digits.');
  else if (!/^[6-9]/.test(mob)) problems.push('Mobile must start with 6, 7, 8 or 9.');

  const r = String(role).trim();
  if (!ALLOWED_ROLES.includes(r)) problems.push(`Role must be admin or security (got "${r}").`);

  return problems;
}

module.exports = { validateBulkUserRow };
