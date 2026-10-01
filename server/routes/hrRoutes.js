const express = require('express');
const router = express.Router();
const { getCompanyApplicants } = require('../controllers/applicationController');
const { authenticate, authorize, hrCompanyOnly } = require('../middleware/auth');

router.get(
  '/applicants',
  authenticate,
  authorize('hr'),
  hrCompanyOnly,
  getCompanyApplicants
);

module.exports = router;
