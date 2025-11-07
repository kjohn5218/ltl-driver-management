# Deployment Guide for ContractPower

This guide helps you deploy your LTL management system to be accessible from outside your local network.

## Quick Setup Options

### Option 1: Using a Cloud VPS (Recommended)
Deploy on services like DigitalOcean, Linode, AWS EC2, or Vultr:

1. **Server Requirements:**
   - Ubuntu 20.04+ or similar Linux distribution
   - Minimum 2GB RAM, 2 CPU cores
   - PostgreSQL 12+
   - Node.js 18+
   - Nginx

2. **Basic Setup Steps:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL
   sudo apt install postgresql postgresql-contrib -y
   
   # Install Nginx
   sudo apt install nginx -y
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

3. **Deploy Application:**
   ```bash
   # Clone your repository
   git clone your-repo-url
   cd contractpower
   
   # Setup backend
   npm install
   cp .env.production .env
   # Edit .env with your production values
   npm run build
   
   # Setup frontend
   cd frontend
   npm install
   cp .env.production .env
   # Edit .env with your production API URL
   npm run build
   
   # Start backend with PM2
   cd ..
   pm2 start dist/index.js --name contractpower-api
   pm2 save
   pm2 startup
   
   # Configure Nginx (copy nginx.conf.example to /etc/nginx/sites-available/)
   ```

### Option 2: Home Server with Port Forwarding
If running from home:

1. **Configure your router:**
   - Forward port 443 (HTTPS) to your server's local IP
   - Forward port 80 (HTTP) for redirect
   - Consider using a dynamic DNS service (e.g., DuckDNS, No-IP)

2. **Get a domain or use dynamic DNS**

3. **Obtain SSL certificate:**
   ```bash
   # Using Let's Encrypt
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### Option 3: Using Ngrok (Temporary Testing)
For quick testing without permanent setup:

```bash
# Install ngrok
# Start your backend server
npm start

# In another terminal, expose it
ngrok http 3001

# You'll get a URL like: https://abc123.ngrok.io
# Update your frontend to use this URL for API calls
```

## Security Recommendations

1. **Environment Variables:**
   - Never commit `.env` files to git
   - Use strong, unique passwords
   - Generate secure JWT secret: `openssl rand -base64 64`

2. **Database Security:**
   - Use strong PostgreSQL passwords
   - Restrict database access to localhost only
   - Regular backups

3. **Application Security:**
   - Keep dependencies updated
   - Use HTTPS only in production
   - Implement rate limiting (already configured)
   - Regular security audits

4. **Server Security:**
   - Configure firewall (ufw)
   - Disable root SSH login
   - Use SSH keys instead of passwords
   - Keep system updated

## Production Checklist

- [ ] Update all environment variables in `.env.production`
- [ ] Build both frontend and backend for production
- [ ] Configure PostgreSQL with secure credentials
- [ ] Set up SSL certificates
- [ ] Configure Nginx reverse proxy
- [ ] Set up process manager (PM2)
- [ ] Configure firewall rules
- [ ] Set up monitoring (optional)
- [ ] Configure automated backups
- [ ] Test all functionality
- [ ] Set up domain/DNS

## Monitoring and Maintenance

1. **Process Monitoring:**
   ```bash
   pm2 monit
   pm2 logs contractpower-api
   ```

2. **Database Backups:**
   ```bash
   # Create backup script
   pg_dump -U your-db-user ltl_management > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Log Rotation:**
   Configure logrotate for application logs

## Troubleshooting

- **CORS errors:** Check CLIENT_URL in backend .env matches your frontend URL
- **Database connection:** Verify DATABASE_URL is correct
- **File uploads failing:** Check upload directory permissions
- **SSL issues:** Ensure certificates are valid and paths are correct

## Support

For issues specific to deployment, check:
- Server logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/error.log`
- Database logs: PostgreSQL logs location varies by system