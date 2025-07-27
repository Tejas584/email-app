# Deployment Guide

## Quick Deployment Checklist

### ✅ Code Ready
- [x] All debug logging removed
- [x] Error handling improved
- [x] Environment variables properly configured
- [x] File upload directory creation added
- [x] Package.json scripts updated
- [x] Dependencies optimized

### ✅ Environment Variables Required
- `REDIS_URL` - Redis connection string (required)
- `PORT` - Server port (optional, defaults to 3000)

## Platform-Specific Deployment

### Render.com

1. **Create Web Service**
   - Repository: Your GitHub repo
   - Build Command: `npm install`
   - Start Command: `npm start` (runs both app and worker)
   - Environment Variables:
     - `REDIS_URL`: Your Redis URL
     - `PORT`: 10000

2. **Add Redis Service**
   - Create new Redis service
   - Copy `REDIS_URL` to your web service

**Note**: The `npm start` command runs both the main app and the email worker process together using `concurrently`.

### Railway

1. **Deploy Main App**
   - Connect repository
   - Add environment variable: `REDIS_URL`
   - Railway auto-detects start command (`npm start`)

### Heroku

1. **Deploy with Procfile**
   ```bash
   heroku create your-app-name
   heroku config:set REDIS_URL=your-redis-url
   git push heroku main
   ```

2. **Scale Worker**
   ```bash
   heroku ps:scale worker=1
   ```

### DigitalOcean App Platform

1. **Create App**
   - Source: GitHub repository
   - Build Command: `npm install`
   - Run Command: `npm start`

2. **Add Redis Database**
   - Create managed Redis database
   - Use connection string as `REDIS_URL`

## Redis Setup Options

### Free Redis Services
- **Upstash**: https://upstash.com/ (free tier)
- **Redis Cloud**: https://redis.com/try-free/ (free tier)
- **Render Redis**: Free tier available

### Self-Hosted Redis
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Local installation
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

## Testing Deployment

1. **Check Redis Connection**
   - Look for "✅ Redis connected successfully" in logs
   - Look for "✅ Bull Queue ready and connected to Redis"

2. **Test File Upload**
   - Upload a small CSV file with test emails
   - Verify total count is displayed

3. **Test Email Sending**
   - Configure SMTP settings
   - Send a test email
   - Check status updates

4. **Test Worker**
   - Verify emails are actually sent
   - Check log download functionality

## Common Issues & Solutions

### Redis Connection Failed
- **Issue**: `ECONNREFUSED 127.0.0.1:6379`
- **Solution**: Set `REDIS_URL` environment variable

### Worker Not Processing Jobs
- **Issue**: Jobs stuck in queue
- **Solution**: Ensure both processes are running (check logs for both app and worker)

### File Upload Fails
- **Issue**: Upload directory not found
- **Solution**: Code now auto-creates uploads directory

### SMTP Errors
- **Issue**: Emails not sending
- **Solution**: Check SMTP credentials and server settings

## Monitoring

### Logs to Watch
- Redis connection status
- Queue processing status
- Email sending errors
- File upload errors

### Performance Tips
- Use batch limits (25-50 emails per batch)
- Monitor Redis memory usage
- Set up log rotation for production
- Consider Redis TTL for old logs

## Security Considerations

### Production Checklist
- [ ] Add authentication (if needed)
- [ ] Set up HTTPS
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Set up monitoring/alerting
- [ ] Configure Redis password
- [ ] Set up log rotation

### Environment Variables
- Never commit `.env` files
- Use platform-specific secret management
- Rotate Redis passwords regularly
- Use different Redis instances for dev/prod 