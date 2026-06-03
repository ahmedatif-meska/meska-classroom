const strings = {
  // Shared
  studentPanelName: "Student",
  adminPanelName: "Admin",
  logoAlt: "Meska Classroom",
  logoAriaLabel: "Meska Classroom — go to home",
  loadingLabel: "Loading…",
  notFoundTitle: "Page not found",
  notFoundBackLabel: "Go back home",
  errorTitle: "Something went wrong",
  errorRetryLabel: "Try again",

  // Student — join session
  welcomeTitle: "Welcome to Meska Classroom",
  welcomeSubtitle:
    "Enter your registered name and Student ID to join your session room",
  fullNameLabel: "Full Name",
  fullNamePlaceholder: "As registered in the roster…",
  studentIdLabel: "Student ID",
  studentIdPlaceholder: "e.g. STU-001",
  sessionRoomLabel: "Session Room",
  sessionRoomPlaceholder: "Select your room…",
  joinSessionLabel: "Join session →",

  // Dashboard (shared)
  dashboardLabel: "Dashboard",
  dashboardEmptyNote: "No data to display yet",
  adminDashboardSubtitle: "Overview of your admin workspace",
  studentDashboardSubtitle: "Overview of your student workspace",

  // Admin — portal sign in
  adminPortalTitle: "Admin Portal",
  adminPortalSubtitle: "Sign in to manage your workspace",
  emailLabel: "Email Address",
  emailPlaceholder: "admin@company.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Enter your password",
  forgotPasswordLabel: "Forgot password?",
  signInLabel: "Sign In",
  protectedAccessNote: "Protected admin access only",
  adminHelpNote: "Need help? Contact your system administrator",
  adminEmailRequired: "Email and password are required.",
  adminAuthFailed: "Invalid credentials or insufficient access.",
  adminSigningIn: "Signing in…",
  adminSignOutLabel: "Sign out",

  // Admin — forgot password (request a reset link)
  forgotTitle: "Reset your password",
  forgotSubtitle: "Enter your admin email and we'll send you a reset link.",
  forgotEmailRequired: "Please enter your email.",
  forgotSubmitLabel: "Send reset link",
  forgotSendingLabel: "Sending…",
  resetLinkSent:
    "If an admin account exists for that email, a reset link is on its way.",
  backToSignInLabel: "Back to sign in",

  // Admin — confirm recovery link (interstitial before the change-password page)
  confirmRecoveryPrompt: "Confirm it's you to continue setting a new password.",
  confirmRecoveryLabel: "Continue",

  // Admin — set a new password (change-password page)
  resetTitle: "Set a new password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm new password",
  resetPasswordTooShort: "Password must be at least 8 characters.",
  resetPasswordMismatch: "Passwords do not match.",
  resetSubmitLabel: "Update password",
  resetUpdatingLabel: "Updating…",
  resetUpdateFailed:
    "We couldn't update your password. Please request a new link.",
  resetSuccess: "Your password has been changed. Sign in with your new password.",
  resetLinkInvalid: "This reset link is invalid or has expired.",
  requestNewLinkLabel: "Request a new link",
} as const;

export default strings;
