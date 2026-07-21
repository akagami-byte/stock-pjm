const { config } = require('dotenv')
const path = require('path')
const fs = require('fs')

// Read .env file manually
const envPath = path.join(__dirname, '.env')
let envVars = {}
if (fs.existsSync(envPath)) {
  envVars = config({ path: envPath }).parsed || {}
}

// Forward all variables from the manual .env file
const extra = { ...envVars }

// Also forward all EXPO_PUBLIC_* keys from process.env (for EAS build secrets)
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('EXPO_PUBLIC_')) {
    extra[key] = value
  }
}

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      ...extra,
    },
  }
}
