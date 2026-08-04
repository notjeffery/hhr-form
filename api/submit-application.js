const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const data = req.body;

    // Build a readable plain-text summary of every field submitted
    const lines = Object.entries(data)
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([key, value]) => {
        // Checkbox groups arrive as arrays (e.g. assistanceType)
        const displayValue = Array.isArray(value) ? value.join(", ") : value;
        return `${key}: ${displayValue}`;
      })
      .join("\n");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });

    // Email to your team with the full application
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.APPLICATIONS_INBOX || process.env.SMTP_FROM,
      subject: `New Application: ${data.fullName || "Unknown applicant"}`,
      text: lines,
    });

    // Optional confirmation email to the applicant
    if (data.email) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.email,
        subject: "Student Resilience Fund Application Received",
        text: `Thank you for submitting your Student Resilience Fund application.\n\nYour application has been received and is now being carefully reviewed. We appreciate the opportunity to consider your request and will be in touch as soon as a decision is made. We wish you and your household the very best during this time.`,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
};