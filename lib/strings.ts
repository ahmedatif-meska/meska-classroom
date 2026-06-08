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
  openNavLabel: "Open navigation menu",
  closeNavLabel: "Close navigation menu",
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

  // Admin — Instructors (list)
  instructorsNavLabel: "Instructors",
  instructorsTitle: "Instructors",
  instructorsSubtitle: "Manage the instructors shown in the classroom",
  instructorsAddLabel: "Add Instructor",
  instructorsColImage: "Photo",
  instructorsColName: "Name",
  instructorsColDescription: "Description",
  instructorsColAdded: "Added",
  instructorsColActions: "Actions",
  instructorsEmptyNote: "No instructors yet — add your first one",
  instructorsNoDescription: "No description",

  // Admin — Instructors (add/edit form)
  instructorFormAddTitle: "Add Instructor",
  instructorFormEditTitle: "Edit Instructor",
  instructorFormSubtitle: "Add a photo and a short, formatted description.",
  instructorNameLabel: "Name",
  instructorNamePlaceholder: "e.g. Dr. Sarah Lee",
  instructorImageLabel: "Photo",
  instructorImageHelp: "PNG, JPEG, or WebP, up to 5 MB",
  instructorImageCropHelp: "Drag the photo to reposition · use the slider to zoom.",
  instructorImageZoom: "Zoom",
  instructorImageCropFrame: "Reposition photo",
  instructorImageChangeLabel: "Change photo",
  instructorDescriptionLabel: "Description",
  instructorFormSubmitLabel: "Save",
  instructorFormSubmittingLabel: "Saving…",
  instructorEditLabel: "Edit",
  instructorsNameRequired: "Name is required.",
  instructorsImageInvalid: "Choose a PNG, JPEG, or WebP image up to 5 MB.",
  instructorsImageUploadFailed:
    "The image couldn't be uploaded. Please try again.",
  instructorsSaveFailed: "The instructor couldn't be saved. Please try again.",
  instructorsForbidden: "You don't have permission to do that.",

  // Admin — Instructors (remove)
  removeInstructorTitle: "Remove instructor",
  removeInstructorConfirm: "Remove this instructor? This can't be undone.",
  removeInstructorSubmitLabel: "Remove",
  removeInstructorSubmittingLabel: "Removing…",
  instructorsRemoveFailed:
    "The instructor couldn't be removed. Please try again.",

  // Admin — Instructors (rich-text editor toolbar)
  rteBold: "Bold",
  rteItalic: "Italic",
  rteUnderline: "Underline",
  rteBulletList: "Bulleted list",
  rteNumberList: "Numbered list",
  rteAlignLeft: "Align left",
  rteAlignCenter: "Align center",
  rteAlignRight: "Align right",
  rteIndent: "Increase indent",
  rteOutdent: "Decrease indent",
  rteLink: "Insert link",
  rteLinkUrlLabel: "Link URL",
  rteLinkPlaceholder: "https://…",
  rteLinkAdd: "Add link",
  rteFontSize: "Font size",
  rteFontFamily: "Font",
  rteFontFamilySans: "Sans",
  rteFontFamilySerif: "Serif",
  rteFontFamilyMono: "Mono",
  rteTextColor: "Text color",
  rteColorInk: "Default",
  rteColorBrand: "Blue",
  rteColorRed: "Red",
  rteColorGreen: "Green",
  rteColorAmber: "Amber",
  rteColorPurple: "Purple",

  // Admin — Members (list)
  membersNavLabel: "Members",
  membersTitle: "Members",
  membersSubtitle: "Manage members and their wave enrollment",
  membersAddLabel: "Add Members",
  membersDownloadTemplate: "Download CSV template",
  membersColName: "Name",
  membersColWhatsapp: "WhatsApp",
  membersColEmail: "Email",
  membersColWave: "Wave",
  membersColStatus: "Status",
  membersColActions: "Actions",
  membersStatusPending: "Pending",
  membersStatusActive: "Active",
  membersEmptyNote: "No members yet — add your first one",
  membersViewLabel: "View",

  // Admin — Members (add chooser)
  addMembersChooserTitle: "Add Members",
  addMembersChooserSubtitle: "Add one member, or bulk-upload a CSV.",
  addMemberFormOption: "Add by form",
  addMemberFormOptionHelp: "Create a single member.",
  bulkUploadOption: "Bulk upload",
  bulkUploadOptionHelp: "Import many members from a CSV.",

  // Admin — Members (single add form)
  memberFormTitle: "Add Member",
  memberFormSubtitle: "Create a member and assign them to a wave.",
  memberFullNameLabel: "Full Name",
  memberWhatsappLabel: "WhatsApp Mobile",
  memberWhatsappPlaceholder: "e.g. +201234567890",
  memberWaveLabel: "Wave",
  memberWavePlaceholder: "Select a wave…",
  memberFormSubmitLabel: "Add Member",
  memberFormSubmittingLabel: "Adding…",
  memberMgmtNameRequired: "Full name is required.",
  memberMgmtWhatsappRequired: "WhatsApp mobile is required.",
  memberMgmtEmailInvalid: "Enter a valid email address.",
  memberMgmtWaveRequired: "Select a wave.",
  memberMgmtEmailInUse: "A member with that email already exists.",
  memberMgmtForbidden: "You don't have permission to do that.",
  memberInviteSentNote:
    "An onboarding email to set a password has been emailed to the new member.",
  memberInviteNotSent:
    "Member created, but the onboarding email couldn't be sent. Use “Resend invite” to try again.",

  // Admin — Members (resend invite)
  memberResendInviteLabel: "Resend invite",
  memberResendSendingLabel: "Sending…",
  memberResendSentNote: "A new invite link has been emailed.",
  memberMgmtResendNotPending: "This member has already set up their account.",
  memberMgmtInviteFailed: "The invite couldn't be sent. Please try again.",

  // Admin — Members (remove)
  removeMemberLabel: "Remove member",
  removeMemberTitle: "Remove member",
  removeMemberConfirm:
    "This permanently deletes the member and their account. This can't be undone.",
  removeMemberSubmitLabel: "Remove",
  removeMemberSubmittingLabel: "Removing…",
  removeMemberFailed: "The member couldn't be removed. Please try again.",

  // Admin — Members (bulk upload)
  bulkFileLabel: "CSV file",
  bulkFileHelp: "Use the template columns: Full Name, WhatsApp Number, Email.",
  bulkValidateLabel: "Continue",
  bulkBackLabel: "Back",
  bulkChooseWaveTitle: "Assign a wave",
  bulkChooseWaveSubtitle:
    "These members will all be added to the selected wave.",
  bulkReadyNote: "rows ready to import",
  bulkSubmitLabel: "Create members",
  bulkSubmittingLabel: "Creating…",
  bulkInvalidCsv:
    "The file couldn't be read. Download the template and try again.",
  bulkWrongColumns:
    "The file columns don't match the template (Full Name, WhatsApp Number, Email).",
  bulkNoRows: "The file has no member rows.",
  bulkBlankCell: "Every field is required — empty value(s) in row(s):",
  bulkBadEmail: "Invalid email in row(s):",
  bulkDuplicateInFile: "Duplicate email in the file at row(s):",
  bulkCreatedLabel: "created",
  bulkSkippedLabel: "skipped (duplicate or already a member)",
  bulkDoneLabel: "Done",

  // Admin — Member information page (QR scan target)
  memberInfoTitle: "Member",
  memberInfoStatusLabel: "Status",
  memberInfoBackLabel: "Back to members",
  memberNotFound: "Member not found.",
  memberInfoUnauthorizedTitle: "Unauthorized",
  memberInfoUnauthorizedNote:
    "Member information is admin-only. Sign in to the admin panel and use Scan QR on the Members page.",
  memberInfoUnauthorizedCta: "Go to admin sign-in",

  // Admin — Members (scan QR)
  membersScanLabel: "Scan QR",
  scanTitle: "Scan member QR",
  scanInstruction: "Point your camera at a member's QR code.",
  scanInvalid: "That isn't a Meska member QR code. Try another.",
  scanCameraError: "Couldn't start the camera. Try again.",
  scanPermissionDenied:
    "Camera access was blocked. Allow camera for this site in your browser settings, then try again.",
  scanCameraBusy:
    "The camera is in use by another app or tab. Close other camera tabs/apps and try again.",
  scanNoCamera: "No camera was found on this device.",
  scanRetryLabel: "Try again",

  // Admin — Waves (list)
  wavesNavLabel: "Waves",
  wavesTitle: "Waves",
  wavesSubtitle: "Create and manage your waves",
  wavesAddLabel: "Create wave",
  wavesEmptyNote: "No waves yet — create your first one",
  waveTypeOnline: "Online",
  waveTypeOffline: "Offline",
  waveNoDescription: "No description",
  waveOpenLabel: "Open",
  waveWeeksLabel: "weeks",

  // Admin — Waves (create/edit form)
  waveFormAddTitle: "Create wave",
  waveFormEditTitle: "Edit wave",
  waveFormSubtitle: "Name the wave, describe it, and choose its type.",
  waveNameLabel: "Wave name",
  waveNamePlaceholder: "e.g. July 2026 Cohort",
  waveDescriptionLabel: "Description",
  waveTypeLabel: "Type",
  waveTypePlaceholder: "Select a type…",
  waveFormSubmitLabel: "Save",
  waveFormSubmittingLabel: "Saving…",
  waveEditLabel: "Edit",
  wavesNameRequired: "Wave name is required.",
  wavesTypeRequired: "Choose a type (Online or Offline).",
  wavesSaveFailed: "The wave couldn't be saved. Please try again.",
  wavesForbidden: "You don't have permission to do that.",

  // Admin — Waves (remove)
  removeWaveTitle: "Delete wave",
  removeWaveConfirm:
    "Delete this wave permanently? Its weeks, materials and assignments will be deleted, and any assigned members will be unassigned (their accounts are kept). This can't be undone.",
  removeWaveSubmitLabel: "Delete",
  removeWaveSubmittingLabel: "Deleting…",
  wavesRemoveFailed: "The wave couldn't be deleted. Please try again.",

  // Admin — Waves (weeks)
  weeksSectionTitle: "Weeks",
  weekAddLabel: "Add week",
  weekTitleLabel: "Week title",
  weekTitlePlaceholder: "e.g. Week 1",
  weekDescriptionLabel: "Week description (optional)",
  weekDefaultTitle: "Week",
  weekSaveLabel: "Save week",
  weekRemoveLabel: "Remove week",
  weeksEmptyNote: "No weeks yet — add the first week",
  wavesWeekSaveFailed: "The week couldn't be saved. Please try again.",

  // Admin — Waves (materials)
  materialAddLabel: "Add material",
  materialTitleLabel: "Title",
  materialFileLabel: "File",
  materialFileHelp: "PDF or PowerPoint, up to 25 MB",
  materialDownloadLabel: "Download",
  materialRemoveLabel: "Remove material",
  materialsEmptyNote: "No materials",
  wavesMaterialInvalid: "Choose a PDF or PowerPoint file up to 25 MB.",
  wavesMaterialUploadFailed: "The file couldn't be uploaded. Please try again.",
  wavesMaterialSaveFailed: "The material couldn't be saved. Please try again.",

  // Admin — Waves (assignments)
  assignmentAddLabel: "Add assignment",
  assignmentTitleLabel: "Title",
  assignmentInstructionsLabel: "Instructions",
  assignmentDueLabel: "Due date (optional)",
  assignmentSaveLabel: "Save assignment",
  assignmentRemoveLabel: "Remove assignment",
  assignmentsEmptyNote: "No assignments",
  assignmentSubmissionsLabel: "Submissions",
  assignmentNoSubmissions: "No submissions yet",
  wavesAssignmentSaveFailed:
    "The assignment couldn't be saved. Please try again.",

  // Student — wave content (dashboard)
  studentWaveSectionTitle: "Your wave",
  studentWaveNoContent: "No content has been added to your wave yet.",
  studentMaterialsLabel: "Materials",
  studentAssignmentsLabel: "Assignments",
  studentDueLabel: "Due",
  studentSubmitLabel: "Upload submission",
  studentSubmitReplaceLabel: "Replace submission",
  studentSubmittingLabel: "Uploading…",
  studentSubmissionDoneLabel: "Submitted",
  studentSubmissionFileHelp: "PDF, PowerPoint, or Word, up to 25 MB",
  studentSubmissionInvalid:
    "Choose a PDF, PowerPoint, or Word file up to 25 MB.",
  studentSubmissionFailed:
    "Your submission couldn't be uploaded. Please try again.",
  studentForbidden: "You don't have permission to do that.",

  // Student — sign in (email + password)
  studentSignInSubtitle: "Sign in with your email and password",
  studentEmailRequired: "Email and password are required.",
  studentAuthFailed: "Invalid email or password.",
  studentSigningIn: "Signing in…",
  studentSignInLabel: "Sign In",
  studentLoginIdIsEmailNote: "Your login ID is your email address.",
  studentSignOutLabel: "Sign out",

  // Student — onboarding confirm + set password
  studentConfirmPrompt: "Confirm it's you to continue setting your password.",
  studentConfirmLabel: "Continue",
  studentSetPasswordTitle: "Set your password",
  studentSetPasswordSubtitle:
    "Choose a password to finish setting up your account. Your login ID is your email address.",
  studentSetPasswordSubmitLabel: "Set password",
  studentSetPasswordSubmittingLabel: "Saving…",
  studentResetLinkInvalid: "This link is invalid or has expired.",

  // Student — home QR
  studentQrTitle: "Your QR code",
  studentQrSubtitle: "Show this at check-in.",
  studentQrAlt: "Your member QR code",
  studentQrPlaceholder: "Your QR code isn't ready yet.",
} as const;

export default strings;
