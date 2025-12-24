# Vercel Serverless Function entry point
from main import app

# Vercel looks for 'app', 'handler', 'server', or 'application'
# Explicitly define handler for clarity
handler = app
