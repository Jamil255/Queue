import express, { json } from 'express'
import emailQueue from './config/bull.js'
import cron from 'node-cron'
import { cronConfig } from './config/cron.js'

const app = express()
app.use(json())

// route to send email
app.post('/send-email', async (req, res) => {
  try {
    const { emails } = req.body
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: 'Invalid request. Provide "emails" array with email objects',
      })
    }

    // Add all jobs to queue in parallel (faster)
    const jobs = await Promise.all(
      emails.map((email) =>
        emailQueue.add(email, {
          attempts: 3, // retry 3 times
          backoff: 5000, // retry after 5 seconds
          priority: 1, // high priority
        })
      )
    )

    res.json({
      message: `${emails.length} email job(s) added to queue ✅`,
      jobCount: emails.length,
      jobIds: jobs.map((job) => job.id),
    })
  } catch (error) {
    console.error('Error adding jobs to queue:', error)
    res.status(500).json({
      error: 'Failed to add emails to queue',
      details: error.message,
    })
  }
})

// Route to check job status by ID
app.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await emailQueue.getJob(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const state = await job.getState()

    res.json({
      jobId: job.id,
      state: state, // completed, failed, active, waiting, delayed
      data: job.data, // Contains: to, subject, text
      attempts: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    })
  } catch (error) {
    console.error('Error fetching job:', error)
    res
      .status(500)
      .json({ error: 'Failed to fetch job', details: error.message })
  }
})

// Route to view all jobs in Redis (by status)
app.get('/jobs', async (req, res) => {
  try {
    const { status = 'all' } = req.query // ?status=completed or waiting or failed or active

    let jobs = []

    if (status === 'all') {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        emailQueue.getWaiting(),
        emailQueue.getActive(),
        emailQueue.getCompleted(),
        emailQueue.getFailed(),
        emailQueue.getDelayed(),
      ])

      jobs = {
        waiting: waiting.map((j) => ({
          id: j.id,
          data: j.data,
          state: 'waiting',
        })),
        active: active.map((j) => ({
          id: j.id,
          data: j.data,
          state: 'active',
        })),
        completed: completed.map((j) => ({
          id: j.id,
          data: j.data,
          state: 'completed',
        })),
        failed: failed.map((j) => ({
          id: j.id,
          data: j.data,
          failedReason: j.failedReason,
          state: 'failed',
        })),
        delayed: delayed.map((j) => ({
          id: j.id,
          data: j.data,
          state: 'delayed',
        })),
      }
    } else {
      // Get jobs by specific status
      const statusMap = {
        waiting: () => emailQueue.getWaiting(),
        active: () => emailQueue.getActive(),
        completed: () => emailQueue.getCompleted(),
        failed: () => emailQueue.getFailed(),
        delayed: () => emailQueue.getDelayed(),
      }

      if (statusMap[status]) {
        const jobList = await statusMap[status]()
        jobs = jobList.map((j) => ({
          id: j.id,
          data: j.data,
          state: status,
          failedReason: j.failedReason,
        }))
      }
    }

    res.json({
      queue: 'email-queue',
      status: status,
      jobs: jobs,
      count:
        status === 'all'
          ? Object.values(jobs).reduce((sum, arr) => sum + arr.length, 0)
          : jobs.length,
    })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    res
      .status(500)
      .json({ error: 'Failed to fetch jobs', details: error.message })
  }
})

// Route to get queue statistics
app.get('/stats', async (req, res) => {
  try {
    const [jobCounts, isPaused] = await Promise.all([
      emailQueue.getJobCounts(),
      emailQueue.isPaused(),
    ])

    res.json({
      queue: 'email-queue',
      stats: jobCounts,
      isPaused: isPaused,
      redis: {
        host: '127.0.0.1',
        port: 6379,
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res
      .status(500)
      .json({ error: 'Failed to fetch stats', details: error.message })
  }
})

// Route to manually retry all failed jobs
app.post('/retry-failed', async (req, res) => {
  try {
    const failedJobs = await emailQueue.getFailed()

    if (failedJobs.length === 0) {
      return res.json({ message: 'No failed jobs to retry', count: 0 })
    }

    let retriedCount = 0
    const results = []

    for (const job of failedJobs) {
      try {
        // Retry the job
        await job.retry()
        retriedCount++
        results.push({ jobId: job.id, status: 'retried', data: job.data })
      } catch (error) {
        results.push({
          jobId: job.id,
          status: 'retry-failed',
          error: error.message,
          data: job.data,
        })
      }
    }

    res.json({
      message: `Retried ${retriedCount} out of ${failedJobs.length} failed jobs ✅`,
      totalFailed: failedJobs.length,
      retriedCount: retriedCount,
      results: results,
    })
  } catch (error) {
    console.error('Error retrying failed jobs:', error)
    res.status(500).json({
      error: 'Failed to retry jobs',
      details: error.message,
    })
  }
})

// Cron job to automatically retry failed emails
// Runs every 5 minutes: '*/5 * * * *'
// Runs every hour: '0 * * * *'
// Runs every day at 2 AM: '0 2 * * *'
const retryFailedJobsCron = cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      console.log('🔄 Cron: Checking for failed jobs to retry...')

      const failedJobs = await emailQueue.getFailed()

      if (failedJobs.length === 0) {
        console.log('✅ Cron: No failed jobs found')
        return
      }

      console.log(
        `🔄 Cron: Found ${failedJobs.length} failed jobs. Retrying...`
      )

      let retriedCount = 0
      for (const job of failedJobs) {
        try {
          await job.retry()
          retriedCount++
          console.log(
            `✅ Cron: Retried job ${job.id} - Email to: ${job.data.to}`
          )
        } catch (error) {
          console.error(
            `❌ Cron: Failed to retry job ${job.id}:`,
            error.message
          )
        }
      }

      console.log(
        `✅ Cron: Completed. Retried ${retriedCount}/${failedJobs.length} jobs`
      )
    } catch (error) {
      console.error('❌ Cron: Error during retry process:', error.message)
    }
  },
  {
    scheduled: false, // Start it manually below
  }
)

// Start the cron job if enabled
if (cronConfig.enabled) {
  retryFailedJobsCron.start()
  console.log(
    `⏰ Cron job started: Retrying failed emails (Schedule: ${cronConfig.retryFailedEmails})`
  )
} else {
  console.log('⏰ Cron job is disabled in config/cron.js')
}

app.listen(3000, () => console.log('Server running on port 3000'))
