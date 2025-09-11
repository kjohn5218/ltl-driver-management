# Email Configuration Setup

The rate confirmation system is configured to use Gmail (kevobhave@gmail.com) with a test email override.

## Current Configuration

- **SMTP Host**: smtp.gmail.com:587
- **From Address**: kevobhave@gmail.com  
- **Test Override**: All emails are routed to kjohn@ccfs.com for testing

## Gmail Setup Required

1. **Enable 2-Factor Authentication** on kevobhave@gmail.com account

2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"

3. **Update the `.env` file** with the generated app password:
   ```
   EMAIL_PASS="your-generated-16-character-app-password"
   ```

4. **Restart the server** after updating the `.env` file

## Test Email Override

The system is configured with `TEST_EMAIL_OVERRIDE="kjohn@ccfs.com"` which means:
- **ALL rate confirmation emails will be sent to kjohn@ccfs.com**
- The original recipient information will be shown in the email
- Subject line will include "[TEST EMAIL]" tag
- Console logs will show the email routing

## Testing the Configuration

You can test if email is properly configured by making a GET request to:
```
GET /api/bookings/test-email-config
```

This will show:
- Email configuration status
- Test override settings
- SMTP connection details

## Production vs Development

- **Development**: All emails go to kjohn@ccfs.com for testing
- **Production**: Remove `TEST_EMAIL_OVERRIDE` from `.env` to send emails to actual recipients

## How It Works

1. User sends rate confirmation to carrier email (e.g., carrier@example.com)
2. System intercepts and routes to kjohn@ccfs.com
3. Email shows original intended recipient in the body
4. Electronic signature links still work normally
5. Console shows routing information for debugging