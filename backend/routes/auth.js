const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// POST /api/auth/login  { roll_no, password }
router.post('/login', async (req, res) => {
  try {
    const { roll_no, password } = req.body;
    if (!roll_no || !password) {
      return res.status(400).json({ error: 'Roll number and password are required.' });
    }

    const user = await User.findOne({ roll_no: String(roll_no).trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid roll number or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid roll number or password.' });
    }

    if (user.blocked) {
      return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
    }

    // Demo auth only - no session/JWT issuance here yet.
    res.json({
      roll_no: user.roll_no,
      first_name: user.first_name,
      designation: user.designation,
      mobile: user.mobile,
      role: user.role,
      profile_pic: user.profile_pic || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

module.exports = router;
