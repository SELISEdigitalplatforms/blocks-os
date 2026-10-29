export interface IGuideSection {
  id: string;
  group?: string;
  heading: string;
  steps: string[];
}

export const GUIDE_TEXT = {
  title: "Setup guide — Push",
  intro: "All steps are in the Firebase console (console.firebase.google.com) unless marked Apple.",
  failHeading: "5. iOS test failed — what to do",
} as const;

export const GUIDE_SECTIONS: IGuideSection[] = [
  {
    id: "key",
    group: "Needed for all platforms",
    heading: "1. Service account key",
    steps: [
      "Open your project in the Firebase console.",
      "Click the gear icon → Project settings → tab Service accounts.",
      "Click Generate new private key → Generate key. A .json file downloads.",
      "Upload this file here. Or use Enter manually: copy client_email and private_key from the file.",
      "Delete the downloaded file from your computer after saving.",
      'Check also: Project settings → Cloud Messaging must show "Firebase Cloud Messaging API (V1) — Enabled".',
    ],
  },
  {
    id: "android",
    group: "Android",
    heading: "2. Android",
    steps: [
      "Nothing to enter in Blocks.",
      "The app team adds the Android app in Project settings → General → Your apps and puts google-services.json in the app.",
      "Open the app on a phone, sign in, allow notifications, then press Send test.",
    ],
  },
  {
    id: "ios",
    group: "iOS",
    heading: "3. iOS — APNs key (done in Apple and Firebase, not here)",
    steps: [
      "Apple: developer.apple.com → Certificates, IDs & Profiles → Keys → +.",
      "Tick Apple Push Notifications service (APNs) → Continue → Register → Download the .p8 file. It can be downloaded only once.",
      "Note the Key ID (on the key page) and the Team ID (top right, under your name).",
      "Firebase: Project settings → Cloud Messaging → Apple app configuration → APNs Authentication Key → Upload. Add the .p8, Key ID and Team ID.",
      "The iOS app in Firebase must have the same Bundle ID as the real app.",
      "The app team turns on Push Notifications in Xcode → Signing & Capabilities.",
    ],
  },
  {
    id: "web",
    group: "Web",
    heading: "4. Web config",
    steps: [
      "Project settings → General → Your apps. No web app yet? Click the </> icon and register one.",
      "Under SDK setup and configuration choose Config. Copy the whole firebaseConfig block and paste it here.",
      "VAPID key: Project settings → Cloud Messaging → Web Push certificates → Generate key pair. Copy the Key pair value.",
      "Manual entry: API key = apiKey, App ID = appId, Sender ID = messagingSenderId.",
    ],
  },
];

export const IOS_FAILURES: { title: string; text: string }[] = [
  {
    title: "APNs key missing",
    text: "No APNs key in Firebase. Do section 3, steps 1–4. Then send the test again.",
  },
  {
    title: "APNs key rejected",
    text: "Key ID or Team ID is wrong, or the key was revoked in Apple. Check both IDs; if revoked, make a new key and upload it again.",
  },
  {
    title: "Wrong app (bundle ID)",
    text: "The iOS app in Firebase has a different Bundle ID than the installed app. Fix the Bundle ID in Firebase, or add the right iOS app.",
  },
  {
    title: "Token expired",
    text: "The app was removed or reinstalled. Open the app again and sign in; it registers a new token. Blocks removes the old one.",
  },
  {
    title: "No iOS device registered",
    text: "Open the app on the iPhone, sign in, and tap Allow on the notification prompt.",
  },
  {
    title: "Delivered, but nothing shows",
    text: "On the iPhone: Settings → Notifications → the app → Allow Notifications on. Turn off Focus / Do Not Disturb. If the app is open on screen, iOS shows the banner only if the app handles it.",
  },
  {
    title: "Still failing",
    text: "Send a test to an Android device. If Android works, the problem is iOS setup (section 3). If both fail, check the service account key (section 1).",
  },
];
