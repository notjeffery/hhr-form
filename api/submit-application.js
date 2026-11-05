const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

// Each fund has its own wording. The form picks one with a hidden field named "fund".
// Forms that send no "fund" (the student form) fall back to "student".
const FUNDS = {
  student: {
    name: "Student Resilience Fund",
    title: "Emergency Support Application",
  },
  household: {
    name: "Household Resilience Fund",
    title: "Emergency Assistance Application",
  },
};

const SIMPLE_EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// Turns "fullName" into "Full Name" for readable PDF labels
function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Builds a PDF of the full application and resolves with it as a Buffer
function generateApplicationPDF(data, fund) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc
      .fontSize(18)
      .fillColor("#33422f")
      .text(fund.name, { align: "center" })
      .fontSize(13)
      .text(fund.title, { align: "center" });

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
      if (key === "fund") return; // internal routing field, not an answer
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

// Websites allowed to send applications to this endpoint (browser CORS check)
const ALLOWED_ORIGINS = [
  "https://householdresilience.org",
  "https://www.householdresilience.org",
];

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    let data = req.body;
    if (typeof data === "string") data = JSON.parse(data);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      res.status(400).json({ error: "Invalid application." });
      return;
    }

    const fund = FUNDS[data.fund] || FUNDS.student;
    const fullName =
      typeof data.fullName === "string" && data.fullName
        ? data.fullName
        : [data.firstName, data.lastName].filter((v) => typeof v === "string" && v).join(" ");

    const pdfBuffer = await generateApplicationPDF(data, fund);
    const applicantName = fullName ? fullName.replace(/[^a-z0-9]/gi, "_") : "applicant";

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
      subject: `New ${fund.name} Application: ${fullName || "Unknown applicant"}`,
      text: `A new ${fund.name} application has been submitted. See the attached PDF for full details.`,
      attachments: [
        {
          filename: `application-${applicantName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Confirmation email to the applicant (no PDF, just the message)
    if (typeof data.email === "string" && SIMPLE_EMAIL.test(data.email.trim())) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.email.trim(),
        subject: `${fund.name} Application Received`,
        text: `Thank you for submitting your ${fund.name} application.\n\nYour application has been received and is now being carefully reviewed. We appreciate the opportunity to consider your request and will be in touch as soon as a decision is made. We wish you and your household the very best during this time.`,
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
}
