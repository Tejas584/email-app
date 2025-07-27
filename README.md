# Bulk Email Sender

A robust bulk email sender application with file upload support, SMTP configuration, and real-time status tracking.

## Features

- **File Upload Support**: CSV, TXT, XLSX, XLS, JSON files
- **Email Validation**: Automatic validation of email addresses
- **SMTP Configuration**: Support for any SMTP server
- **Batch Processing**: Configurable batch sizes to avoid rate limits
- **Real-time Status**: Live tracking of sent, failed, and pending emails
- **Test Mode**: Send test emails to specific recipients
- **Log Download**: CSV export of email sending results
- **Redis Integration**: Persistent storage and job queuing
- **Responsive UI**: Works on desktop and mobile devices

## Prerequisites

- Node.js 18+ 
- Redis instance (local or cloud)
- SMTP server credentials

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bulk-email-sender
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   REDIS_URL=redis://username:password@host:port
   PORT=3000
   ```

4. **Start the application**
   ```bash
   # Start both app and worker together
   npm start
   
   # Or run separately (for development)
   npm run app          # Main app only
   npm run worker       # Email worker only
   ```

## Deployment

### Render.com

1. **Create a new Web Service**
   - Connect your GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start` (runs both app and worker)
   - Add environment variable: `REDIS_URL`

2. **Add Redis service**
   - Create a new Redis service in Render
   - Copy the `REDIS_URL` from the Redis service

### Railway

1. **Deploy the application**
   - Connect your repository
   - Add `REDIS_URL` environment variable
   - Railway will auto-detect the start command

### Heroku

1. **Deploy the main app**
   ```bash
   heroku create your-app-name
   heroku config:set REDIS_URL=your-redis-url
   git push heroku main
   ```

2. **Deploy the worker**
   ```bash
   heroku ps:scale worker=1
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_URL` | Redis connection string | Yes |
| `PORT` | Server port (default: 3000) | No |

## Usage

1. **Upload Recipients**
   - Upload a file containing email addresses
   - Supported formats: CSV, TXT, XLSX, XLS, JSON
   - Invalid emails are automatically filtered

2. **Configure SMTP**
   - Enter your SMTP server details
   - Test the connection with a test email

3. **Set Email Parameters**
   - Choose Test or Bulk mode
   - Set batch limit (recommended: 25-50)
   - Configure sender details and message

4. **Send Emails**
   - Click "Send Email" to start
   - Monitor progress in the status panel
   - Download logs when complete

## File Formats

### CSV/TXT
```
email1@example.com
email2@example.com
email3@example.com
```

### JSON
```json
[
  "email1@example.com",
  "email2@example.com",
  "email3@example.com"
]
```

Or with objects:
```json
[
  {"email": "email1@example.com"},
  {"email": "email2@example.com"}
]
```

### Excel (XLSX/XLS)
First column should contain email addresses.

## API Endpoints

- `POST /recipients` - Upload recipient file
- `POST /send-email` - Send emails
- `GET /status?sessionId=<id>` - Get sending status
- `GET /log-download?sessionId=<id>` - Download email logs

## Troubleshooting

### Redis Connection Issues
- Ensure `REDIS_URL` is set correctly
- Check if Redis service is running
- Verify network connectivity

### Email Sending Issues
- Verify SMTP credentials
- Check SMTP server settings
- Review error logs in the status panel

### File Upload Issues
- Ensure file format is supported
- Check file size limits
- Verify file contains valid email addresses

## Security Notes

- SMTP credentials are stored in browser localStorage
- Uploaded files are automatically deleted after processing
- Email logs are stored in Redis (consider TTL for production)
- No authentication is implemented (add if needed for production)

## License

ISC 