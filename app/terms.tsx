import { ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function Terms() {
  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#050816", // Full-page background
      }}
      contentContainerStyle={{
        paddingVertical: 40,
        paddingHorizontal: 20,
        maxWidth: 800,
        marginHorizontal: "auto",
      }}
    >
      {/* Back link */}
      <Link
        href="/"
        style={{
          color: "#63B3ED",
          marginBottom: 30,
          display: "flex",
          fontSize: 16,
          fontWeight: "500",
        }}
      >
        ← Back to Home
      </Link>

      {/* Legal content container */}
      <div
        style={{
          backgroundColor: "#050816",
          color: "#E5E5E5",
          fontFamily: "Arial, sans-serif",
          lineHeight: 1.7,
          fontSize: 15,
        }}
        dangerouslySetInnerHTML={{
          __html: `
<h1 style="font-size: 32px; margin-bottom: 10px; color: #FFFFFF;">Terms of Service</h1>
<p style="color: #A0AEC0; margin-bottom: 30px;"><strong>Last updated: March 4, 2026</strong></p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">1. Acceptance of Terms</h2>
<p>By accessing or using Bizzy (“the App”), you agree to be bound by these Terms of Service. If you do not agree, you may not use the App.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">2. Eligibility</h2>
<p>You must be at least 18 years old and provide accurate account information. If you use Bizzy on behalf of a business, you represent that you are authorized to do so.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">3. Accounts & Authentication</h2>
<p>Bizzy uses Google OAuth for authentication. When signing in, you grant Bizzy permission to access your Google account information as described in our Privacy Policy. You are responsible for maintaining the security of your account and for all activity under it.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">4. Third-Party Integrations</h2>
<p>Bizzy integrates with third-party services including Google (OAuth, Calendar, Contacts), Stripe (payments), Twilio (SMS and voice), and Mailgun/Resend (email delivery). Your use of these features is subject to the terms and policies of those providers.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">5. User Responsibilities</h2>
<p>You agree not to misuse the App, interfere with its operation, attempt unauthorized access, or reverse engineer any part of the App. You are responsible for ensuring that your use of Bizzy complies with all applicable laws, including messaging and communication regulations.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">6. Messaging & Communication</h2>
<p>Bizzy provides tools for sending SMS messages, emails, and service-related notifications. You are responsible for obtaining proper consent from your clients before sending messages. Bizzy complies with Twilio A2P 10DLC requirements, but you are responsible for ensuring your messaging content and practices follow applicable regulations.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">7. Payments & Billing</h2>
<p>Payments processed through Bizzy use Stripe. Bizzy does not store full payment card details. You agree to Stripe’s terms when using payment features. Bizzy may charge subscription fees or usage-based fees as described at the time of purchase.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">8. Data & Privacy</h2>
<p>Your use of the App is governed by our Privacy Policy, which describes how we collect, use, and protect your information. By using Bizzy, you consent to the practices described in the Privacy Policy.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">9. Availability, Updates & Changes</h2>
<p>We may update, modify, or discontinue parts of the App at any time. We may also introduce new features or remove existing ones. We are not liable for any interruptions or loss of access to the App.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">10. Intellectual Property</h2>
<p>All content, trademarks, logos, and software associated with Bizzy are owned by Bizzy App or its licensors. You may not copy, modify, distribute, or create derivative works without permission.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">11. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, Bizzy App is not liable for indirect, incidental, special, or consequential damages, including loss of data, revenue, or business opportunities. Your sole remedy for dissatisfaction with the App is to stop using it.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">12. Termination</h2>
<p>We may suspend or terminate your access to the App at any time for violations of these Terms or for any behavior that may harm Bizzy, its users, or its partners. You may stop using the App at any time.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">13. Governing Law</h2>
<p>These Terms are governed by the laws of the State of Indiana, without regard to conflict-of-law principles.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">14. Contact</h2>
<p>For questions or support, contact: <strong>Patrick@AmericanDream.business</strong></p>

<p style="margin-top: 15px;">
<strong>Messaging Terms:</strong> By using Bizzy’s messaging features, you agree to receive SMS messages related to scheduling, service updates, appointment reminders, estimates, invoices, and customer communication. Message and data rates may apply. Message frequency varies. 
</p>

<p>
To opt out of receiving messages, reply <strong>STOP</strong>. For help, reply <strong>HELP</strong> or contact us at Patrick@AmericanDream.business.
</p>
Messaging Terms (A2P 10DLC Compliance)

Program Name: Bizzy Messaging Program

Program Description: Bizzy enables businesses to send service-related SMS messages to their clients, including appointment reminders, scheduling updates, on-the-way notifications, service confirmations, estimates, invoices, and customer communication.

Message/Data Rates: Message and data rates may apply for any messages sent or received. These charges are determined by your mobile carrier.

Message Frequency: Message frequency varies based on customer activity, scheduling, and service updates.

Opt-Out Instructions: You can opt out of receiving SMS messages at any time by replying STOP. After you send STOP, you will no longer receive messages from us. To re-enable messaging, you may text START.

Help Instructions: For help, reply HELP or contact us at Patrick@AmericanDream.business.

Support Contact Information: For assistance with messaging or service-related questions, email Patrick@AmericanDream.business.

Privacy: Information collected through Bizzy’s messaging program is handled in accordance with our Privacy Policy and is never sold or shared with third parties for marketing purposes.
          `,
        }}
      />
    </ScrollView>
  );
}