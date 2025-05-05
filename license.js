const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const { app } = require('electron');

const LICENSE_FILE = path.join(app.getPath('userData'), 'license.json');
console.log('License file path:', LICENSE_FILE);

function readLicenseKey() {
  if (!fs.existsSync(LICENSE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LICENSE_FILE)).license;
  } catch {
    return null;
  }
}

function getMachineId() {
  return machineIdSync();
}

async function checkLicense() {
  const license = readLicenseKey();
  const machine_id = getMachineId();
  console.log('Machine ID:', machine_id);

  if (!license) return { valid: false, licenseType: 'free' };

  try {
    const res = await axios.post('https://4309-2001-ee1-f703-9ef0-246e-2d53-61c0-dd5f.ngrok-free.app/api/license-key/verify', {
      license,
      machine_id
    });

    if (res.data.valid) {
      return { valid: true, licenseType: res.data.license_type, expiredDate: res.data.expired_date || null };
    }
  } catch (e) {
    console.error('License check failed:', e.message);
  }

  return { valid: false, licenseType: 'free', expiredDate: null };
}


module.exports = {
    checkLicense,
    readLicenseKey,
    getMachineId,
  };
  