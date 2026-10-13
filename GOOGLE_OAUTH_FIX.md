# 🔧 Google OAuth Error Fix Guide

## Error Details

```
[GSI_LOGGER]: The given origin is not allowed for the given client ID.
Status: 403 Forbidden
```

---

## 🎯 Root Cause

Your Google OAuth Client ID (`791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com`) is **not authorized** to accept requests from `http://localhost:4200`.

This is a **security feature** in Google Cloud Console.

---

## ✅ Solution: Authorize localhost in Google Cloud Console

### Step 1: Go to Google Cloud Console
1. Open https://console.cloud.google.com/
2. Sign in with your Google account (kedarpatil966@gmail.com)

### Step 2: Select Your Project
1. Click the project dropdown at the top
2. Select the project that contains your OAuth credentials
3. If you don't remember the project name, it's likely "TedBus" or similar

### Step 3: Navigate to Credentials
1. In the left sidebar, click **"APIs & Services"**
2. Click **"Credentials"**
3. You'll see a list of OAuth 2.0 Client IDs

### Step 4: Edit Your OAuth Client ID
1. Find the client ID: `791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com`
2. Click the **pencil icon** (Edit) next to it

### Step 5: Add Authorized JavaScript Origins
In the **"Authorized JavaScript origins"** section, add:
```
http://localhost:4200
```

### Step 6: Add Authorized Redirect URIs
In the **"Authorized redirect URIs"** section, add:
```
http://localhost:4200
http://localhost:4200/auth/google/callback
```

### Step 7: Save Changes
1. Click **"SAVE"** at the bottom
2. Wait 5-60 seconds for changes to propagate

### Step 8: Test Your Application
1. Clear browser cache (or use Incognito mode)
2. Reload `http://localhost:4200`
3. Try the Google Sign-In button

---

## 🖼️ Visual Guide

### What you should see in Google Cloud Console:

```
OAuth 2.0 Client ID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Name: [Your App Name]

Client ID: 791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com

Client Secret: [Hidden]

Authorized JavaScript origins
┌─────────────────────────────────────┐
│ + ADD URI                           │
│                                     │
│ 1. http://localhost:4200           │
│ 2. http://localhost:3000 (optional)│
│                                     │
└─────────────────────────────────────┘

Authorized redirect URIs
┌─────────────────────────────────────────────────┐
│ + ADD URI                                       │
│                                                 │
│ 1. http://localhost:4200                      │
│ 2. http://localhost:4200/auth/google/callback │
│                                                 │
└─────────────────────────────────────────────────┘

[SAVE]  [CANCEL]
```

---

## 🔍 Alternative: Verify Current Settings

If you're not sure what's currently configured:

### Check via Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Check the "Authorized JavaScript origins" section
4. If `http://localhost:4200` is missing, add it

### Common Issues

#### Issue 1: Wrong Client ID
**Check**: Is the Client ID in `.env` correct?
```bash
# Check root .env
cat /Users/kedarpatil/Documents/kedar/tedbus_project/REDBUS-CLONE-MEAN-main-3/.env | grep GOOGLE_CLIENT_ID
```

**Expected Output**:
```
GOOGLE_CLIENT_ID=791529522730-e08dj90ak5669aahirpe84c9ukuku8pd.apps.googleusercontent.com
```

#### Issue 2: Multiple Client IDs
You might have multiple OAuth credentials. Make sure you're editing the correct one!

#### Issue 3: Changes Not Propagating
- Clear browser cache
- Use Incognito/Private browsing mode
- Wait a few minutes after saving changes

---

## 🚀 Quick Test After Fix

### Test 1: Check if Button Loads
1. Open browser console (F12)
2. Go to `http://localhost:4200`
3. Look for the Google Sign-In button
4. Should see NO errors about "origin is not allowed"

### Test 2: Click Sign-In
1. Click the Google Sign-In button
2. Should see Google's account picker
3. Select an account
4. Should redirect back to your app

### Test 3: Verify Backend
```bash
curl http://localhost:5001/health
```
Should return: `{"success":true,"message":"Server is healthy"}`

---

## 🔐 Production Deployment

When deploying to production, you'll need to add your production URL too:

### Example Production URLs
```
Authorized JavaScript origins:
- https://yourdomain.com
- https://www.yourdomain.com

Authorized redirect URIs:
- https://yourdomain.com
- https://yourdomain.com/auth/google/callback
- https://www.yourdomain.com
- https://www.yourdomain.com/auth/google/callback
```

---

## 📝 Complete URLs to Add

### For Development (localhost)
```
JavaScript Origins:
✓ http://localhost:4200
✓ http://localhost:5001 (if backend needs OAuth)

Redirect URIs:
✓ http://localhost:4200
✓ http://localhost:4200/auth/google/callback
```

### For Production (when you deploy)
```
JavaScript Origins:
✓ https://your-domain.com
✓ https://www.your-domain.com

Redirect URIs:
✓ https://your-domain.com
✓ https://your-domain.com/auth/google/callback
✓ https://www.your-domain.com
✓ https://www.your-domain.com/auth/google/callback
```

---

## ⚠️ Important Notes

1. **Changes take time**: Google changes can take 5-60 seconds to propagate
2. **Clear cache**: Always test in Incognito mode or clear cache after changes
3. **HTTPS in production**: Production MUST use HTTPS, not HTTP
4. **Multiple environments**: You can add multiple URLs (dev, staging, production)

---

## 🆘 Still Not Working?

### Debug Checklist

- [ ] Verified Client ID in `.env` matches Google Console
- [ ] Added `http://localhost:4200` to Authorized JavaScript origins
- [ ] Saved changes in Google Cloud Console
- [ ] Waited at least 60 seconds
- [ ] Cleared browser cache or used Incognito mode
- [ ] Backend is running on port 5001
- [ ] Frontend is running on port 4200
- [ ] No firewall blocking requests

### Get More Help

If still not working, check:
1. Browser console for detailed error messages
2. Network tab to see the actual request being made
3. Google Cloud Console audit logs

---

## 📞 Summary

**The Fix (3 steps):**
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth Client ID
3. Add `http://localhost:4200` to "Authorized JavaScript origins"

**Time to Fix:** 2-3 minutes  
**Wait Time:** 5-60 seconds for propagation  
**Test:** Reload page in Incognito mode

---

*Last Updated: October 5, 2026*
