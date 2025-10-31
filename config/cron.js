// Cron Schedule Configuration
// You can change the schedule here

export const cronConfig = {
  // Cron expression for retrying failed emails
  // Examples:
  // '*/5 * * * *'    - Every 5 minutes
  // '*/15 * * * *'   - Every 15 minutes
  // '0 * * * *'      - Every hour
  // '0 */6 * * *'    - Every 6 hours
  // '0 2 * * *'      - Every day at 2 AM
  // '0 0 * * 0'      - Every Sunday at midnight

  retryFailedEmails: '*/5 * * * *', // Default: Every 5 minutes

  // Enable or disable the cron job
  enabled: true,
}
