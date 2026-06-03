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

  // Admin — Admin Management (list)
  adminMgmtNavLabel: "Admin Management",
  adminMgmtTitle: "Admin Management",
  adminMgmtSubtitle: "Manage administrators and their access",
  adminMgmtAddLabel: "Add Admin",
  adminMgmtColName: "Name",
  adminMgmtColEmail: "Email",
  adminMgmtColRole: "Role",
  adminMgmtColStatus: "Status",
  adminMgmtColCreated: "Created",
  adminMgmtColActions: "Actions",
  adminMgmtRoleAdmin: "Admin",
  adminMgmtStatusPending: "Pending",
  adminMgmtStatusActive: "Active",
  adminMgmtYouBadge: "You",
  adminMgmtEmptyNote: "No administrators yet",

  // Admin — Admin Management (create modal)
  createAdminTitle: "Create New Admin",
  createAdminSubtitle: "Create a new administrator account and assign a role.",
  firstNameLabel: "First Name",
  lastNameLabel: "Last Name",
  adminMgmtRoleHelp: "Full administrative access to manage the tenant",
  createAdminSubmitLabel: "Create Admin",
  createAdminSubmittingLabel: "Creating…",
  cancelLabel: "Cancel",
  closeLabel: "Close",
  adminMgmtNameRequired: "First and last name are required.",
  adminMgmtEmailInvalid: "Enter a valid email address.",
  adminMgmtEmailInUse: "An administrator with that email already exists.",
  adminMgmtForbidden: "You don't have permission to do that.",
  inviteSentNote: "An invite to set a password has been emailed to the new admin.",
  adminMgmtInviteNotSent:
    "Admin created, but the invite email couldn't be sent. Use “Resend invite” to try again.",

  // Admin — Admin Management (resend invite)
  resendInviteLabel: "Resend invite",
  resendInviteSendingLabel: "Sending…",
  resendInviteSentNote: "A new invite link has been emailed.",
  adminMgmtResendNotPending: "This administrator has already set up their account.",
  adminMgmtInviteFailed: "The invite couldn't be sent. Please try again.",

  // Admin — Admin Management (remove)
  removeAdminTitle: "Remove administrator",
  removeAdminConfirm:
    "Remove this administrator? They will lose admin access immediately.",
  removeAdminSubmitLabel: "Remove",
  removeAdminSubmittingLabel: "Removing…",
  adminMgmtNoSelfRemove: "You can't remove your own account.",
  adminMgmtLastAdmin: "You can't remove the last active administrator.",
} as const;

export default strings;
