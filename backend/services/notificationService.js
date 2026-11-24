// Notification Service (Simulates status change events, emails, and SMS alerts)
export const notifyStatusChange = async ({ user, application, previousStatus, newStatus, remarks }) => {
  const timestamp = new Date().toISOString()
  const recipientEmail = user?.email || "applicant@example.com"
  const recipientName = user?.name || "Applicant"
  const appNumber = application?.applicationNumber || application?._id

  console.log(`
[NOTIFICATION SIMULATION] -------------------------------------
To: ${recipientName} <${recipientEmail}>
Time: ${timestamp}
Event: Application Status Updated
Application Number: ${appNumber}
Transition: ${previousStatus} -> ${newStatus}
Remarks: ${remarks || "No additional remarks"}
--------------------------------------------------------------
  `)

  return {
    delivered: true,
    recipient: recipientEmail,
    event: "STATUS_CHANGE",
    timestamp
  }
}

export const notifyMoreInfoRequested = async ({ user, application, infoRequested }) => {
  console.log(`
[ALERT - ACTION REQUIRED] ------------------------------------
To: ${user?.name} <${user?.email}>
Notice: Additional documents or information requested by loan officer.
Application: ${application?.applicationNumber}
Requested Details: ${infoRequested}
Please log in to your LMS dashboard to respond.
--------------------------------------------------------------
  `)
}

export default {
  notifyStatusChange,
  notifyMoreInfoRequested
}
