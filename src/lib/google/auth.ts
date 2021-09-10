import settings from "../../settings.js";

import gauth_library from 'google-auth-library'
const { JWT } = gauth_library
const client = new JWT({
  email: settings.google.client_email,
  key: settings.google.private_key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});
export default client
