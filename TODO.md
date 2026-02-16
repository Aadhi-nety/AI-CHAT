# Production Deployment Changes - TODO

## Tasks:
- [x] 1. Update backend/src/server.ts - Add proper CORS configuration for Vercel
- [ ] 2. Update lib/api-client.ts - Replace BACKEND_URL with API_BASE
- [ ] 3. Update app/labs/page.tsx - Use API_BASE instead of inline backendUrl

## Environment Variables to Set:

### Vercel (Frontend):
- `NEXT_PUBLIC_API_URL` = https://2rrfaahu3d.ap-south-1.awsapprunner.com

### AWS App Runner (Backend):
- Already configured to use process.env.PORT
