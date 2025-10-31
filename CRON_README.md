# Bull Email Queue - Cron Job Setup

## ✅ Automatic Retry for Failed Emails

### How It Works:

A cron job automatically checks for failed emails and retries them based on the schedule you configure.

---

## 📅 Cron Schedule Configuration

Edit `config/cron.js` to change the schedule:

```javascript
export const cronConfig = {
  retryFailedEmails: '*/5 * * * *', // Every 5 minutes
  enabled: true, // Enable/disable cron job
}
```

### Common Schedules:

- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour (at minute 0)
- `0 */6 * * *` - Every 6 hours
- `0 2 * * *` - Every day at 2:00 AM
- `0 0 * * 0` - Every Sunday at midnight
- `0 9 * * 1-5` - Every weekday at 9:00 AM

**Cron Format:**

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

---

## 🔧 API Endpoints

### Manual Retry

Manually retry all failed jobs:

```
POST http://localhost:3000/retry-failed
```

**Response:**

```json
{
  "message": "Retried 3 out of 3 failed jobs ✅",
  "totalFailed": 3,
  "retriedCount": 3,
  "results": [
    {
      "jobId": "50",
      "status": "retried",
      "data": { "to": "test@gmail.com", "subject": "testing", "text": "..." }
    }
  ]
}
```

---

## 🚀 How to Use

### 1. Start the servers:

```bash
npm run dev      # API server (Terminal 1)
npm run queue    # Worker (Terminal 2)
```

### 2. The cron job will automatically:

- Check for failed jobs every 5 minutes (default)
- Retry all failed emails
- Log the results

### 3. View logs:

```
🔄 Cron: Checking for failed jobs to retry...
🔄 Cron: Found 2 failed jobs. Retrying...
✅ Cron: Retried job 50 - Email to: test@gmail.com
✅ Cron: Completed. Retried 2/2 jobs
```

### 4. Disable cron job:

Edit `config/cron.js`:

```javascript
enabled: false // This will disable automatic retries
```

---

## 📊 Monitor Failed Jobs

View all failed jobs:

```
GET http://localhost:3000/jobs?status=failed
```

View queue statistics:

```
GET http://localhost:3000/stats
```

---

## 🛠️ Troubleshooting

**Cron not running?**

- Check if `enabled: true` in `config/cron.js`
- Restart the server: `npm run dev`
- Check logs for cron messages

**Jobs not retrying?**

- Check if jobs have exceeded max attempts (default: 3)
- View failed jobs: `GET /jobs?status=failed`
- Check worker logs for errors

**Need immediate retry?**

- Use manual endpoint: `POST /retry-failed`

---

## 📝 All Available Endpoints

1. `POST /send-email` - Send emails
2. `GET /job/:jobId` - Get job details
3. `GET /jobs` - View all jobs
4. `GET /jobs?status=failed` - View failed jobs
5. `GET /stats` - Queue statistics
6. `POST /retry-failed` - **Manual retry all failed jobs**

---

## ⚙️ Configuration Files

- `config/cron.js` - Cron schedule settings
- `config/bull.js` - Bull queue configuration
- `.env` - Email credentials
