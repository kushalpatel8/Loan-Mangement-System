// Loan Summary Export Utility: Generates structured CSV and print-optimized PDF statements
// Matching Correm Financial Design and Compliance Standards

/**
 * Helper: Escapes values for safe RFC 4180 CSV output
 */
const esc = (val) => {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Format Indian Currency for display
 */
export const formatINR = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0'
  return `₹${Number(amount).toLocaleString('en-IN')}`
}

/**
 * 1. Export Applicant's Loan Summary as structured CSV
 * Includes BOM (\uFEFF) for native Excel/Numbers compatibility with Rupee symbol
 */
export const exportLoanSummaryCSV = (app, schedule = null) => {
  if (!app) return

  const rows = []

  // Document Header
  rows.push(['CORREM FINANCIAL PLATFORM', 'LOAN APPLICATION & SANCTION SUMMARY'].map(esc).join(','))
  rows.push(['Generated On', new Date().toLocaleString('en-IN')].map(esc).join(','))
  rows.push(['Statement Reference', `STMT-${app.applicationNumber || 'APP'}-${Date.now()}`].map(esc).join(','))
  rows.push([]) // empty row

  // Section 1: Overview
  rows.push(['--- 1. APPLICATION IDENTIFIERS & STATUS ---'].map(esc).join(','))
  rows.push(['Application Number', app.applicationNumber || 'N/A'].map(esc).join(','))
  rows.push(['Current Status', (app.status || 'submitted').toUpperCase()].map(esc).join(','))
  rows.push(['Submission Date', app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : 'N/A'].map(esc).join(','))
  rows.push(['Last Updated', app.updatedAt ? new Date(app.updatedAt).toLocaleDateString('en-IN') : 'N/A'].map(esc).join(','))
  rows.push([])

  // Section 2: Applicant Profile
  const pd = app.personalDetails || {}
  const applicantName = pd.fullName || app.applicantId?.name || 'N/A'
  const applicantEmail = pd.email || app.applicantId?.email || app.applicantEmail || 'N/A'
  const applicantPhone = pd.phone || app.applicantId?.phone || 'N/A'
  const addressStr = pd.address
    ? `${pd.address.street || ''}, ${pd.address.city || ''}, ${pd.address.state || ''} ${pd.address.postalCode || ''}, ${pd.address.country || 'India'}`.replace(/^,\s*|,\s*$/g, '')
    : 'N/A'

  rows.push(['--- 2. APPLICANT PERSONAL PROFILE ---'].map(esc).join(','))
  rows.push(['Full Name', applicantName].map(esc).join(','))
  rows.push(['Email Address', applicantEmail].map(esc).join(','))
  rows.push(['Contact Phone', applicantPhone].map(esc).join(','))
  rows.push(['PAN / Tax Identification', pd.panNumber || 'N/A'].map(esc).join(','))
  rows.push(['Date of Birth', pd.dateOfBirth ? new Date(pd.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'].map(esc).join(','))
  rows.push(['Residential Address', addressStr].map(esc).join(','))
  rows.push([])

  // Section 3: Loan Details & Terms
  const ld = app.loanDetails || {}
  rows.push(['--- 3. LOAN PARAMETERS & FINANCIAL TERMS ---'].map(esc).join(','))
  rows.push(['Loan Type / Product', (ld.loanType || 'Personal').toUpperCase()].map(esc).join(','))
  rows.push(['Requested Principal (INR)', ld.amount || 0].map(esc).join(','))
  rows.push(['Tenure (Months)', ld.tenureMonths || 0].map(esc).join(','))
  rows.push(['Annual Interest Rate (%)', `${ld.interestRate || 0}%`].map(esc).join(','))
  rows.push(['Estimated Monthly EMI (INR)', ld.monthlyEmiPreview || 0].map(esc).join(','))
  rows.push(['Loan Purpose', ld.purpose || 'General Financial Assistance'].map(esc).join(','))
  rows.push([])

  // Section 4: Income & Verification
  const inc = app.incomeDetails || {}
  const dti = app.eligibilityCheck?.debtToIncomeRatio ?? 'N/A'
  rows.push(['--- 4. INCOME & CREDIT VERIFICATION ---'].map(esc).join(','))
  rows.push(['Monthly Gross Income (INR)', inc.monthlyIncome || 0].map(esc).join(','))
  rows.push(['Employment Type', (inc.employmentType || 'Salaried').toUpperCase()].map(esc).join(','))
  rows.push(['Employer / Business Name', inc.employerName || 'N/A'].map(esc).join(','))
  rows.push(['Existing Monthly Debt Obligations (INR)', inc.existingMonthlyEmi || 0].map(esc).join(','))
  rows.push(['Calculated Debt-To-Income (DTI) %', typeof dti === 'number' ? `${dti}%` : dti].map(esc).join(','))
  rows.push([])

  // Section 5: Underwriting & Sanction Trail
  rows.push(['--- 5. UNDERWRITING & SANCTION DECISION TRAIL ---'].map(esc).join(','))
  if (app.officerReview) {
    rows.push(['Officer Recommendation', (app.officerReview.recommendation || '').replace(/_/g, ' ').toUpperCase()].map(esc).join(','))
    rows.push(['Officer Reviewed Date', app.officerReview.reviewedAt ? new Date(app.officerReview.reviewedAt).toLocaleDateString('en-IN') : 'N/A'].map(esc).join(','))
    rows.push(['Officer Underwriting Remarks', app.officerReview.remarks || 'N/A'].map(esc).join(','))
  } else {
    rows.push(['Officer Review', 'Pending / Under Process'].map(esc).join(','))
  }

  if (app.adminDecision) {
    rows.push(['Admin Sanction Decision', (app.adminDecision.decision || '').toUpperCase()].map(esc).join(','))
    rows.push(['Sanctioned Date', app.adminDecision.decidedAt ? new Date(app.adminDecision.decidedAt).toLocaleDateString('en-IN') : 'N/A'].map(esc).join(','))
    rows.push(['Admin Sanction Remarks', app.adminDecision.remarks || 'N/A'].map(esc).join(','))
  }
  rows.push([])

  // Section 6: Repayment Schedule & Amortization Table (if available)
  if (schedule && Array.isArray(schedule.installments) && schedule.installments.length > 0) {
    rows.push(['--- 6. REPAYMENT SCHEDULE & AMORTIZATION TABLE ---'].map(esc).join(','))
    rows.push(['Summary Total Principal (INR)', schedule.totalPrincipal || ld.amount || 0].map(esc).join(','))
    rows.push(['Summary Total Interest (INR)', schedule.totalInterest || 0].map(esc).join(','))
    rows.push(['Summary Gross Payable (INR)', schedule.totalAmountPayable || 0].map(esc).join(','))
    rows.push([])

    // Table Headers
    rows.push([
      'Installment #',
      'Due Date',
      'Monthly EMI (INR)',
      'Principal Component (INR)',
      'Interest Component (INR)',
      'Remaining Balance (INR)',
      'Status'
    ].map(esc).join(','))

    schedule.installments.forEach((inst) => {
      rows.push([
        inst.installmentNumber,
        inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-IN') : 'N/A',
        inst.emiAmount ?? 0,
        inst.principalComponent ?? 0,
        inst.interestComponent ?? 0,
        inst.remainingPrincipal ?? 0,
        (inst.status || 'pending').toUpperCase()
      ].map(esc).join(','))
    })
  }

  // Generate CSV Blob with UTF-8 BOM
  const csvContent = '\uFEFF' + rows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Loan_Summary_${app.applicationNumber || 'Statement'}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 2. Export Applicant's Loan Summary as a Print-Ready Official PDF Document
 * Opens high-resolution browser print / Save-as-PDF dialog with exact Correm branding
 */
export const exportLoanSummaryPDF = (app, schedule = null) => {
  if (!app) return

  const pd = app.personalDetails || {}
  const ld = app.loanDetails || {}
  const inc = app.incomeDetails || {}
  const applicantName = pd.fullName || app.applicantId?.name || 'Applicant'
  const applicantEmail = pd.email || app.applicantId?.email || app.applicantEmail || 'N/A'
  const applicantPhone = pd.phone || app.applicantId?.phone || 'N/A'
  const addressStr = pd.address
    ? `${pd.address.street || ''}, ${pd.address.city || ''}, ${pd.address.state || ''} - ${pd.address.postalCode || ''}, ${pd.address.country || 'India'}`.replace(/^,\s*|,\s*$/g, '')
    : 'N/A'

  const statusColorMap = {
    approved: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', label: 'APPROVED & SANCTIONED' },
    rejected: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3', label: 'APPLICATION REJECTED' },
    more_info_needed: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: 'ADDITIONAL INFO REQUIRED' },
    under_review: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'UNDER OFFICER REVIEW' },
    submitted: { bg: '#f8fafc', text: '#334155', border: '#e2e8f0', label: 'APPLICATION SUBMITTED' },
    draft: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1', label: 'DRAFT IN PROGRESS' }
  }
  const statusBadge = statusColorMap[app.status] || { bg: '#f8fafc', text: '#334155', border: '#e2e8f0', label: (app.status || 'SUBMITTED').toUpperCase() }

  // Build Installment table rows if schedule is available
  let installmentsHtml = ''
  if (schedule && Array.isArray(schedule.installments) && schedule.installments.length > 0) {
    installmentsHtml = `
      <div class="section-title">Repayment Amortization Schedule (${schedule.installments.length} Months)</div>
      
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Sanctioned Principal</div>
          <div class="kpi-value">${formatINR(schedule.totalPrincipal || ld.amount)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Fixed Monthly EMI</div>
          <div class="kpi-value text-amber">${formatINR(schedule.monthlyEmi || ld.monthlyEmiPreview)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Cumulative Interest</div>
          <div class="kpi-value">${formatINR(schedule.totalInterest)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Gross Amount Payable</div>
          <div class="kpi-value text-emerald">${formatINR(schedule.totalAmountPayable)}</div>
        </div>
      </div>

      <table class="schedule-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Due Date</th>
            <th>Monthly EMI</th>
            <th>Principal Component</th>
            <th>Interest Component</th>
            <th>Remaining Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${schedule.installments
            .map(
              (inst) => `
            <tr>
              <td><strong>${inst.installmentNumber}</strong></td>
              <td>${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-IN') : 'N/A'}</td>
              <td><strong>${formatINR(inst.emiAmount)}</strong></td>
              <td>${formatINR(inst.principalComponent)}</td>
              <td class="text-amber">${formatINR(inst.interestComponent)}</td>
              <td>${formatINR(inst.remainingPrincipal)}</td>
              <td><span class="badge ${inst.status === 'paid' ? 'badge-paid' : inst.status === 'overdue' ? 'badge-overdue' : 'badge-pending'}">${(inst.status || 'pending').toUpperCase()}</span></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
  }

  // Printable HTML template with Correm Warm Theme and Print Stylesheet
  const printDoc = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Loan Summary - ${app.applicationNumber || 'Application'}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 16mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #2B1B17;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11pt;
          line-height: 1.45;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #EFEAE2;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .logo-box {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-symbol {
          width: 36px;
          height: 36px;
          background: #2E1810;
          color: #F59E0B;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 900;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #2E1810;
          text-transform: uppercase;
        }
        .logo-sub {
          font-size: 8pt;
          color: #8C6D62;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .header-meta {
          text-align: right;
          font-size: 9pt;
          color: #5C3D2E;
        }
        .header-meta strong {
          color: #2E1810;
        }
        .status-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: ${statusBadge.bg};
          border: 1px solid ${statusBadge.border};
          color: ${statusBadge.text};
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .status-title {
          font-size: 12pt;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .status-app-num {
          font-size: 10pt;
          font-weight: 700;
        }
        .section-title {
          font-size: 10pt;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #5C3D2E;
          border-bottom: 1px solid #EFEAE2;
          padding-bottom: 4px;
          margin: 14px 0 8px 0;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 10px;
        }
        .box {
          background: #FAF8F5;
          border: 1px solid #EAE5DE;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .row-item {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          font-size: 9pt;
          border-bottom: 1px dashed #EDE8E1;
        }
        .row-item:last-child {
          border-bottom: none;
        }
        .row-label {
          color: #7A5C50;
        }
        .row-val {
          font-weight: 600;
          color: #2E1810;
          text-align: right;
          max-width: 60%;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }
        .kpi-card {
          background: #FAF8F5;
          border: 1px solid #EAE5DE;
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;
        }
        .kpi-label {
          font-size: 7.5pt;
          color: #7A5C50;
          text-transform: uppercase;
          font-weight: 600;
        }
        .kpi-value {
          font-size: 11pt;
          font-weight: 800;
          color: #2E1810;
          margin-top: 2px;
        }
        .text-amber { color: #B45309; }
        .text-emerald { color: #047857; }
        .schedule-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
          margin-top: 8px;
          page-break-inside: auto;
        }
        .schedule-table thead {
          display: table-header-group;
        }
        .schedule-table tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        .schedule-table th {
          background: #F4EFEB;
          color: #4A332A;
          font-weight: 700;
          text-transform: uppercase;
          padding: 6px 8px;
          text-align: left;
          border: 1px solid #E5DFD7;
          font-size: 7.5pt;
        }
        .schedule-table td {
          padding: 5px 8px;
          border: 1px solid #EFEAE2;
          color: #33221C;
        }
        .schedule-table tbody tr:nth-child(even) {
          background: #FAF8F5;
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 7pt;
          font-weight: 700;
          text-transform: uppercase;
        }
        .badge-paid { background: #d1fae5; color: #065f46; }
        .badge-pending { background: #f3f4f6; color: #4b5563; }
        .badge-overdue { background: #fee2e2; color: #991b1b; }
        .notes-box {
          background: #FFFDF9;
          border-left: 3px solid #D97706;
          padding: 8px 12px;
          margin: 10px 0;
          font-size: 8.5pt;
          border-radius: 0 6px 6px 0;
        }
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #EFEAE2;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 7.5pt;
          color: #8C6D62;
          page-break-inside: avoid;
        }
        .signature-line {
          width: 180px;
          border-top: 1px solid #2E1810;
          margin-top: 28px;
          text-align: center;
          font-weight: 700;
          color: #2E1810;
          padding-top: 4px;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div class="logo-box">
          <div class="logo-symbol">✦</div>
          <div>
            <div class="logo-text">CORREM</div>
            <div class="logo-sub">Financial Platforms &amp; Credit Management</div>
          </div>
        </div>
        <div class="header-meta">
          <div><strong>Official Statement</strong></div>
          <div>Ref: ${app.applicationNumber || 'N/A'}</div>
          <div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      <!-- Status Banner -->
      <div class="status-banner">
        <div>
          <div class="status-title">${statusBadge.label}</div>
          <div style="font-size: 8.5pt; opacity: 0.9; margin-top: 2px;">
            Application Type: ${(ld.loanType || 'Personal').toUpperCase()} LOAN
          </div>
        </div>
        <div style="text-align: right;">
          <div class="status-app-num">ID: ${app.applicationNumber || 'N/A'}</div>
          <div style="font-size: 8pt; opacity: 0.9;">Applied: ${app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : 'N/A'}</div>
        </div>
      </div>

      <!-- 2-Column Summary: Applicant & Loan -->
      <div class="grid-2">
        <!-- Applicant Profile -->
        <div class="box">
          <div class="section-title" style="margin-top: 0;">Applicant Details</div>
          <div class="row-item">
            <span class="row-label">Full Name:</span>
            <span class="row-val">${applicantName}</span>
          </div>
          <div class="row-item">
            <span class="row-label">PAN Number:</span>
            <span class="row-val">${pd.panNumber || 'N/A'}</span>
          </div>
          <div class="row-item">
            <span class="row-label">Email ID:</span>
            <span class="row-val">${applicantEmail}</span>
          </div>
          <div class="row-item">
            <span class="row-label">Contact Phone:</span>
            <span class="row-val">${applicantPhone}</span>
          </div>
          <div class="row-item">
            <span class="row-label">Date of Birth:</span>
            <span class="row-val">${pd.dateOfBirth ? new Date(pd.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'}</span>
          </div>
          <div class="row-item">
            <span class="row-label">Address:</span>
            <span class="row-val">${addressStr}</span>
          </div>
        </div>

        <!-- Loan & Financial Terms -->
        <div class="box">
          <div class="section-title" style="margin-top: 0;">Loan Terms &amp; Financials</div>
          <div class="row-item">
            <span class="row-label">Principal Amount:</span>
            <span class="row-val" style="color: #047857; font-weight: 800;">${formatINR(ld.amount)}</span>
          </div>
          <div class="row-item">
            <span class="row-label">Interest Rate:</span>
            <span class="row-val">${ld.interestRate || 0}% p.a. (Fixed)</span>
          </div>
          <div class="row-item">
            <span class="row-label">Tenure Duration:</span>
            <span class="row-val">${ld.tenureMonths || 0} Months</span>
          </div>
          <div class="row-item">
            <span class="row-label">Monthly EMI:</span>
            <span class="row-val" style="color: #B45309; font-weight: 800;">${formatINR(ld.monthlyEmiPreview)}/mo</span>
          </div>
          <div class="row-item">
            <span class="row-label">Monthly Income:</span>
            <span class="row-val">${formatINR(inc.monthlyIncome)} (${(inc.employmentType || 'Salaried').toUpperCase()})</span>
          </div>
          <div class="row-item">
            <span class="row-label">Existing Commitments:</span>
            <span class="row-val">${formatINR(inc.existingMonthlyEmi)}/mo</span>
          </div>
        </div>
      </div>

      <!-- Underwriting & Approval Audit Trail -->
      ${
        app.officerReview || app.adminDecision
          ? `
        <div class="section-title">Underwriting &amp; Sanction Audit Trail</div>
        ${
          app.officerReview
            ? `
          <div class="notes-box">
            <strong>Credit Officer Review:</strong> ${(app.officerReview.recommendation || '').replace(/_/g, ' ').toUpperCase()}
            ${app.officerReview.reviewedAt ? `&bull; <em>${new Date(app.officerReview.reviewedAt).toLocaleDateString('en-IN')}</em>` : ''}
            <div style="margin-top: 3px; color: #5C3D2E;">&quot;${app.officerReview.remarks || 'Application reviewed and verified against credit policies.'}&quot;</div>
          </div>
        `
            : ''
        }
        ${
          app.adminDecision
            ? `
          <div class="notes-box" style="border-left-color: #047857; background: #F6FBF8;">
            <strong>Executive Sanction Decision:</strong> ${(app.adminDecision.decision || '').toUpperCase()}
            ${app.adminDecision.decidedAt ? `&bull; <em>${new Date(app.adminDecision.decidedAt).toLocaleDateString('en-IN')}</em>` : ''}
            <div style="margin-top: 3px; color: #1E4620;">&quot;${app.adminDecision.remarks || 'Sanction approved. Repayment schedule auto-generated.'}&quot;</div>
          </div>
        `
            : ''
        }
      `
          : ''
      }

      <!-- Repayment Schedule if attached -->
      ${installmentsHtml}

      <!-- Footer & Signatures -->
      <div class="footer">
        <div>
          <div><strong>CORREM FINANCIAL SERVICES PVT. LTD.</strong></div>
          <div>Computer-generated official statement &bull; System Verified</div>
          <div>For inquiries, support, or disputes, contact support@correm.com</div>
        </div>
        <div>
          <div class="signature-line">Authorized Signatory / Seal</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `

  // Use hidden iframe to isolate print styles and trigger clean browser print/save-as-pdf
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('title', 'Loan Statement Print Frame')

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow || iframe.contentDocument
  const targetDoc = doc.document || doc

  targetDoc.open()
  targetDoc.write(printDoc)
  targetDoc.close()

  // Clean up iframe after printing dialog closes or after 60 seconds
  setTimeout(() => {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    } catch (e) {
      console.warn('Iframe cleanup:', e)
    }
  }, 60000)
}
