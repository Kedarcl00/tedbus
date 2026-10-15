// Backend API configuration
// Points to the Express.js backend at port 5001
const rawUrl = 'https://tedbus-api-p6rq.onrender.com';
export const url: string = rawUrl.endsWith('/') ? rawUrl : `${rawUrl}/`;