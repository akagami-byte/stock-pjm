const { config } = require('dotenv')
const path = require('path')
const fs = require('fs')

// Read .env file manually
const envPath = path.join(__dirname, '.env')
let envVars = {}
if (fs.existsSync(envPath)) {
  envVars = config({ path: envPath }).parsed || {}
}

// Load base config from app.json
const appJson = require('./app.json')

// Forward all EXPO_PUBLIC_* vars into extra so they're accessible
// via expo-constants at runtime (more reliable than process.env in RN)
const extra = {
  ...appJson.expo.extra,
}

for (const [key, value] of Object.entries(envVars)) {
  if (key.startsWith('EXPO_PUBLIC_')) {
    extra[key] = value
  }
}

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra,
  },
}
