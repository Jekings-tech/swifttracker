// utils/email.js
const nodemailer = require('nodemailer');

// Configure transporter using Brevo SMTP
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify transporter
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter error:', error);
    } else {
        console.log('✅ Email transporter ready!');
    }
});

// ===== SHIPMENT CONFIRMATION EMAIL =====
async function sendShipmentCreated(shipment) {
    const trackingLink = `${process.env.FRONTEND_URL}/track/${shipment.trackingId}`;
    
    const estDelivery = new Date(shipment.shipmentInfo.estimatedDelivery);
    const formattedDate = estDelivery.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 0; background: #ffffff;">
            <!-- HEADER -->
            <div style="background: #DC2626; padding: 24px 28px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: 1px;">
                    SWIFT<span style="font-weight: 300;">EXPRESS</span>
                </h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0;">Global Logistics &amp; Courier Services</p>
            </div>
            
            <!-- BODY -->
            <div style="padding: 32px 28px;">
                <!-- Greeting -->
                <p style="color: #1A202C; font-size: 17px; font-weight: 600; margin-bottom: 4px;">
                    Hello ${shipment.recipient.name},
                </p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                    Your shipment has been confirmed and is now being processed.
                </p>
                
                <!-- Tracking Number Box -->
                <div style="background: #F8FAFC; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border-left: 4px solid #DC2626;">
                    <p style="margin: 0; font-size: 13px; color: #64748B;">
                        Your Tracking Number
                    </p>
                    <p style="margin: 4px 0 0; font-size: 22px; font-weight: 800; color: #DC2626; letter-spacing: 1px;">
                        ${shipment.trackingId}
                    </p>
                </div>
                
                <!-- Shipment Details -->
                <div style="background: #F8FAFC; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
                    <table style="width: 100%; font-size: 14px; color: #1A202C;">
                        <tr>
                            <td style="padding: 4px 0; color: #64748B; width: 40%;">From</td>
                            <td style="padding: 4px 0; font-weight: 600;">${shipment.shipper.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">To</td>
                            <td style="padding: 4px 0; font-weight: 600;">${shipment.recipient.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">Carrier</td>
                            <td style="padding: 4px 0; font-weight: 600;">${shipment.shipmentInfo.carrier}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">Est. Delivery</td>
                            <td style="padding: 4px 0; font-weight: 600;">${formattedDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">Status</td>
                            <td style="padding: 4px 0; font-weight: 600; color: #DC2626;">${shipment.shipmentInfo.status}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Track Button -->
                <div style="text-align: center; margin: 24px 0 20px 0;">
                    <a href="${trackingLink}" style="
                        display: inline-block;
                        background: #DC2626;
                        color: #ffffff;
                        padding: 13px 38px;
                        border-radius: 50px;
                        font-weight: 700;
                        font-size: 15px;
                        text-decoration: none;
                    ">
                        Track Your Shipment
                    </a>
                </div>
                
                <!-- What Happens Next -->
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
                    <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.7;">
                        <strong style="color: #1A202C;">What happens next?</strong><br>
                        You will receive email updates as your shipment moves through our network.
                    </p>
                </div>
                
                <!-- Contact -->
                <div style="margin-top: 16px;">
                    <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.7;">
                        Need help? Contact us at 
                        <a href="mailto:info@swiftexpressfreight.com" style="color: #DC2626; text-decoration: none; font-weight: 600;">
                            info@swiftexpressfreight.com
                        </a>
                    </p>
                </div>
            </div>
            
            <!-- FOOTER -->
            <div style="background: #F8FAFC; padding: 16px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="color: #94A3B8; font-size: 12px; margin: 0; line-height: 1.6;">
                    Thank you for choosing <strong style="color: #DC2626;">SWIFTEXPRESS</strong>
                </p>
                <p style="color: #94A3B8; font-size: 11px; margin: 4px 0 0;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    `;
    
    const text = `
SWIFTEXPRESS - Shipment Confirmed

Hello ${shipment.recipient.name},

Your shipment has been confirmed and is now being processed.

Your Tracking Number: ${shipment.trackingId}

From: ${shipment.shipper.name}
To: ${shipment.recipient.name}
Carrier: ${shipment.shipmentInfo.carrier}
Est. Delivery: ${formattedDate}
Status: ${shipment.shipmentInfo.status}

Track your shipment: ${trackingLink}

What happens next?
You will receive email updates as your shipment moves through our network.

Need help? Contact us at support@swiftexpressfreight.com

Thank you for choosing SWIFTEXPRESS.
    `.trim();
    
    const recipients = [
        shipment.recipient.email,
        shipment.shipper.email
    ];
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || `"SWIFTEXPRESS" <info@swiftexpressfreight.com>`,
        to: recipients.join(', '),
        subject: `Your Shipment ${shipment.trackingId} is Confirmed`,
        html: html,
        text: text
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Shipment confirmation email sent to: ${recipients.join(', ')}`);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== SHIPMENT STATUS UPDATE EMAIL =====
async function sendShipmentStatusUpdate(shipment, oldStatus, newStatus) {
    const trackingLink = `${process.env.FRONTEND_URL}/track/${shipment.trackingId}`;
    
    const statusMessages = {
        'Picked Up': 'Your package has been picked up by our courier.',
        'In Transit': 'Your package is now in transit to the destination.',
        'Out for Delivery': 'Your package is out for delivery today.',
        'Delivered': 'Your package has been successfully delivered.',
        'On Hold': 'Your package is temporarily on hold.',
        'Delayed': 'Your package has been delayed.'
    };
    
    const message = statusMessages[newStatus] || `Your shipment status has been updated to: ${newStatus}`;
    
    const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 0; background: #ffffff;">
            <div style="background: #DC2626; padding: 24px 28px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: 1px;">
                    SWIFT<span style="font-weight: 300;">EXPRESS</span>
                </h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0;">Global Logistics &amp; Courier Services</p>
            </div>
            
            <div style="padding: 32px 28px;">
                <p style="color: #1A202C; font-size: 17px; font-weight: 600; margin-bottom: 4px;">
                    Hello ${shipment.recipient.name},
                </p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                    ${message}
                </p>
                
                <div style="background: #F8FAFC; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border-left: 4px solid #DC2626;">
                    <table style="width: 100%; font-size: 14px; color: #1A202C;">
                        <tr>
                            <td style="padding: 4px 0; color: #64748B; width: 40%;">Tracking Number</td>
                            <td style="padding: 4px 0; font-weight: 700; color: #DC2626;">${shipment.trackingId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">Previous Status</td>
                            <td style="padding: 4px 0; font-weight: 600;">${oldStatus}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">New Status</td>
                            <td style="padding: 4px 0; font-weight: 700; color: #DC2626;">${newStatus}</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px 0; color: #64748B;">Location</td>
                            <td style="padding: 4px 0; font-weight: 600;">${shipment.route.currentLocation}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin: 24px 0 20px 0;">
                    <a href="${trackingLink}" style="
                        display: inline-block;
                        background: #DC2626;
                        color: #ffffff;
                        padding: 13px 38px;
                        border-radius: 50px;
                        font-weight: 700;
                        font-size: 15px;
                        text-decoration: none;
                    ">
                        Track Your Shipment
                    </a>
                </div>
                
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
                    <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.7;">
                        Need help? Contact us at 
                        <a href="mailto:support@swiftexpressfreight.com" style="color: #DC2626; text-decoration: none; font-weight: 600;">
                            support@swiftexpressfreight.com
                        </a>
                    </p>
                </div>
            </div>
            
            <div style="background: #F8FAFC; padding: 16px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="color: #94A3B8; font-size: 12px; margin: 0; line-height: 1.6;">
                    Thank you for choosing <strong style="color: #DC2626;">SWIFTEXPRESS</strong>
                </p>
                <p style="color: #94A3B8; font-size: 11px; margin: 4px 0 0;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    `;
    
    const text = `
SWIFTEXPRESS - Shipment Update

Hello ${shipment.recipient.name},

${message}

Tracking Number: ${shipment.trackingId}
Previous Status: ${oldStatus}
New Status: ${newStatus}
Location: ${shipment.route.currentLocation}

Track your shipment: ${trackingLink}

Need help? Contact us at support@swiftexpressfreight.com

Thank you for choosing SWIFTEXPRESS.
    `.trim();
    
    const recipients = [
        shipment.recipient.email,
        shipment.shipper.email
    ];
    
    const mailOptions = {
        from: process.env.EMAIL_FROM || `"SWIFTEXPRESS" <info@swiftexpressfreight.com>`,
        to: recipients.join(', '),
        subject: `Shipment ${shipment.trackingId} - ${newStatus}`,
        html: html,
        text: text
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Status update email sent to: ${recipients.join(', ')}`);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Status email failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ===== TEST EMAIL =====
async function sendTestEmail(to) {
    const mailOptions = {
        from: process.env.EMAIL_FROM || `"SWIFTEXPRESS" <info@swiftexpressfreight.com>`,
        to: to,
        subject: 'SWIFTEXPRESS - Email System Test',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 0; background: #ffffff;">
                <div style="background: #DC2626; padding: 24px 28px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: 1px;">
                        SWIFT<span style="font-weight: 300;">EXPRESS</span>
                    </h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0;">Global Logistics &amp; Courier Services</p>
                </div>
                
                <div style="padding: 32px 28px; text-align: center;">
                    <p style="color: #1A202C; font-size: 17px; font-weight: 600; margin-bottom: 4px;">
                        Hello,
                    </p>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                        This is a test email to confirm that the SWIFTEXPRESS email system is working correctly.
                    </p>
                    
                    <div style="background: #D1FAE5; border-radius: 10px; padding: 16px 20px; border-left: 4px solid #10B981;">
                        <p style="margin: 0; color: #065F46; font-weight: 600; font-size: 15px;">
                            ✅ Email system is ready
                        </p>
                    </div>
                </div>
                
                <div style="background: #F8FAFC; padding: 16px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
                    <p style="color: #94A3B8; font-size: 12px; margin: 0; line-height: 1.6;">
                        Thank you for choosing <strong style="color: #DC2626;">SWIFTEXPRESS</strong>
                    </p>
                </div>
            </div>
        `,
        text: `
SWIFTEXPRESS - Email System Test

Hello,

This is a test email to confirm that the SWIFTEXPRESS email system is working correctly.

✅ Email system is ready

Thank you for choosing SWIFTEXPRESS.
        `.trim()
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Test email sent to: ${to}`);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Test email failed:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendShipmentCreated,
    sendShipmentStatusUpdate,
    sendTestEmail
};