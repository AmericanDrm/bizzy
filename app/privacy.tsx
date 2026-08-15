import { ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function Privacy() {
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

      {/* Legal content */}
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
<h1 style="font-size: 32px; margin-bottom: 10px; color: #FFFFFF;">Privacy Policy</h1>
<p style="color: #A0AEC0; margin-bottom: 30px;"><strong>Last updated: March 4, 2026</strong></p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">1. Introduction</h2>
<p>Bizzy (“the App”) is operated by Bizzy App (“we”, “us”, or “our”). This Privacy Policy explains how we collect, use, store, and protect your information when you use the App.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">2. Information We Collect</h2>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.1 Account Information</h3>
<p>When you sign in using Google OAuth, we receive your name, email address, and Google account ID. We do not receive your Google password.</p>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.2 Client & Business Data</h3>
<p>We store information you enter into Bizzy, including client names, phone numbers, addresses, job details, invoices, notes, and scheduling information.</p>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.3 Google Calendar & Contacts (Optional)</h3>
<p>If you choose to connect Google Calendar or Google Contacts, we may access read-only calendar events and contact information. You may disconnect these services at any time.</p>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.4 SMS & Call Data</h3>
<p>If you use Bizzy’s messaging features, we collect and store message content, delivery status, timestamps, and phone numbers. Messages are sent through Twilio and comply with A2P 10DLC requirements. Opt-in and opt-out events (e.g., STOP) are recorded.</p>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.5 Payment & Billing Data</h3>
<p>Payments are processed through Stripe. We may store invoice amounts, payment status, and customer information, but we do not store full payment card details.</p>

<h3 style="font-size: 18px; margin-top: 20px; margin-bottom: 8px; color: #FFFFFF;">2.6 Usage Data</h3>
<p>We may collect basic usage information such as pages visited, actions taken, and device/browser type to improve the App.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">3. How We Use Your Information</h2>
<p>We use your information to operate Bizzy, authenticate your account, manage scheduling and communication, process payments, improve the App, and provide support.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">4. Data Storage & Security</h2>
<p>Data is stored securely using Supabase with industry-standard security practices, including row-level security to ensure each business’s data remains isolated and private.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">5. Sharing of Information</h2>
<p>We do not share your information except with trusted third-party providers necessary to operate the App, such as Google, Stripe, Twilio, Mailgun/Resend, and Supabase, or when required by law.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">6. Third-Party Services</h2>
<p>Bizzy integrates with third-party services for authentication, messaging, payments, email delivery, and data storage. These providers may process data on our behalf in accordance with their own privacy policies.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">7. Your Rights</h2>
<p>You may request deletion of your account, export your data, disconnect Google services, or revoke permissions. Contact: <strong>Patrick@AmericanDream.business</strong></p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">8. Data Retention</h2>
<p>We retain data for as long as your account is active or as needed to provide the App. Backups may persist for a limited period as part of standard security practices.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">9. Changes to This Policy</h2>
<p>We may update this Privacy Policy. Updates will be posted on this page and take effect upon posting.</p>

<h2 style="font-size: 22px; margin-top: 30px; margin-bottom: 10px; color: #FFFFFF;">10. Contact</h2>
<p>For questions, contact: <strong>Patrick@AmericanDream.business</strong></p>
SMS & Communications Privacy

Bizzy collects client information such as names, phone numbers, email addresses, service details, and communication preferences for the purpose of scheduling, service updates, appointment reminders, estimates, invoices, and customer support.

Information collected through Bizzy is used solely to operate and improve the App and to deliver service-related communications. Bizzy does not sell, rent, or share personal information with third parties for marketing purposes. Information is only shared with trusted service providers (such as Twilio, Google, Stripe, and email delivery partners) as necessary to operate the Bizzy platform.

Clients may opt out of SMS communications at any time by replying STOP. For help, clients may reply HELP or contact Patrick@AmericanDream.business.
          `,
        }}
      />
    </ScrollView>
  );
}