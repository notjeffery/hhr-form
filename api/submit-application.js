const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// Turns "fullName" into "Full Name" for readable PDF labels
function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Builds a PDF of the full application and resolves with it as a Buffer
function generateApplicationPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc
      .fontSize(18)
      .fillColor("#33422f")
      .text("Student Resilience Fund", { align: "center" })
      .fontSize(13)
      .text("Emergency Support Application", { align: "center" });

    doc
      .moveDown(0.5)
      .fontSize(9)
      .fillColor("#7a7460")
      .text(`Submitted: ${new Date().toLocaleString()}`, { align: "center" });

    doc.moveDown(1.5);
    doc
      .strokeColor("#b99a4b")
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke();
    doc.moveDown(1);

    Object.entries(data).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) return;

      const displayValue = Array.isArray(value) ? value.join(", ") : String(value);

      // Avoid splitting a field awkwardly across a page break
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }

      doc
        .fontSize(10)
        .fillColor("#33422f")
        .font("Helvetica-Bold")
        .text(formatLabel(key));

      doc
        .fontSize(10)
        .fillColor("#2b2b26")
        .font("Helvetica")
        .text(displayValue);

      doc.moveDown(0.7);
    });

    doc.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const data = req.body;

    const pdfBuffer = await generateApplicationPDF(data);
    const applicantName = data.fullName ? data.fullName.replace(/[^a-z0-9]/gi, "_") : "applicant";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465, // true for port 465, false for 587/others
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });

    // Email to your team — application details as a PDF attachment
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.APPLICATIONS_INBOX || process.env.SMTP_FROM,
      subject: `New Application: ${data.fullName || "Unknown applicant"}`,
      text: `A new Student Resilience Fund application has been submitted. See the attached PDF for full details.`,
      attachments: [
        {
          filename: `application-${applicantName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Confirmation email to the applicant (no PDF, just the message)
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