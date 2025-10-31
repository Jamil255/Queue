import { createTransport } from 'nodemailer'
import emailQueue from '../config/bull.js'
import dotenv from 'dotenv'
dotenv.config()

// Email transporter
const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL,
    pass: process.env.PASSWORD,
  },
})

emailQueue.process(10, async (job) => {
  const { to, subject, text } = job.data

  try {
    console.log(`Processing job ${job.id} - Sending email to:`, to)

    await transporter.sendMail({
      from: process.env.MAIL,
      to,
      subject,
      text,
    })

    console.log(`Email sent successfully ✅ to: ${to}`)
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message)
    throw error // This will mark the job as failed and trigger retry
  }
})

// Queue event listeners for monitoring
emailQueue.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed - Email sent to: ${job.data.to}`)
})

emailQueue.on('failed', (job, err) => {
  console.error(
    `❌ Job ${job.id} failed - Email to: ${job.data.to} - Error:`,
    err.message
  )
})

emailQueue.on('error', (error) => {
  console.error('Queue error:', error)
})

console.log(
  '🚀 Email worker is running and processing up to 10 concurrent jobs...'
)
