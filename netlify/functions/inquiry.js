const nodemailer = require('nodemailer');

const requiredFields = ['name', 'email', 'service', 'budget', 'timeline', 'message'];
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { success: false, error: 'Method not allowed.' });

  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  const receiver = process.env.RECEIVER_EMAIL || user;
  if (!user || !password || !receiver) {
    console.error('Missing email environment variables.');
    return reply(500, { success: false, error: 'Email service is not configured on the server.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { success: false, error: 'Invalid JSON.' }); }

  const missing = requiredFields.filter(field =>
    typeof body[field] !== 'string' || !body[field].trim()
  );
  if (missing.length) {
    return reply(400, { success: false, error: `Missing required fields: ${missing.join(', ')}` });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail', auth: { user, pass: password }
  });
  const value = field => escapeHtml(body[field] || '—');

  try {
    await transporter.sendMail({
      from: `"${value('name')}" <${user}>`,
      replyTo: body.email,
      to: receiver,
      subject: `New Inquiry: ${body.service} — from ${body.name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h1>New Project Inquiry</h1>
        <p><strong>Name:</strong> ${value('name')}</p>
        <p><strong>Company:</strong> ${value('company')}</p>
        <p><strong>Email:</strong> ${value('email')}</p>
        <p><strong>Phone:</strong> ${value('phone')}</p>
        <p><strong>Country:</strong> ${value('country')}</p>
        <p><strong>Service:</strong> ${value('service')}</p>
        <p><strong>Budget:</strong> ${value('budget')}</p>
        <p><strong>Timeline:</strong> ${value('timeline')}</p>
        <h3>Project Description</h3><p>${value('message').replace(/\r?\n/g, '<br>')}</p>
      </div>`
    });
    return reply(200, { success: true, message: 'Inquiry sent successfully!' });
  } catch (error) {
    console.error('Failed to send inquiry:', error);
    return reply(500, { success: false, error: 'Failed to send inquiry. Please try again later.' });
  }
};
